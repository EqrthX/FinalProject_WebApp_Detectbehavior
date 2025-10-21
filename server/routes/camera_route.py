from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from ultralytics import YOLO
import cv2
import threading
import time
import os
import base64
import asyncio
from utils.camera_helper import empty_flat_dict_behavior, calculate_average

camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "..", "runs", "detect", "train", "weights", "best.pt")
model = YOLO(MODEL_PATH)

# เก็บกล้องที่เปิดอยู่ทั้งหมด
cameras = {}
available_cameras = []

# ✅ ฟังก์ชันสแกนกล้องในเครื่อง
def scan_cameras():
    found = []
    for i in range(5):  # ตรวจสอบกล้อง 0-4
        try:
            cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)  # ✅ ใช้ CAP_MSMF แทน DSHOW
            if cap is not None and cap.isOpened():
                found.append({"id": i, "name": f"Camera กล้องตัวที่ {i+1}"})
                print(f"✅ พบกล้องที่ index {i}")
                cap.release()
            else:
                print(f"❌ ไม่พบกล้องที่ index {i}")
                if cap is not None:
                    cap.release()
        except Exception as e:
            print(f"⚠️ Error ตรวจสอบกล้อง {i}: {e}")
            # ป้องกันการ crash จาก release บน handle ว่าง
            try:
                if cap is not None:
                    cap.release()
            except:
                pass
    global available_cameras
    available_cameras = found
    print(f"📷 กล้องทั้งหมดที่ตรวจพบ: {len(found)} ตัว")



# ✅ ฟังก์ชันเปิดกล้องเดี่ยว (ใช้ภายใน)
def open_camera_instance(camera_id: str):
    source = int(camera_id)
    cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail=f"Cannot open camera {camera_id}")

    cameras[camera_id] = {
        "cap": cap,
        "thread": None,
        "running": True,
        "detecting": False,
        "seconds": 0,
        "class_behavior": empty_flat_dict_behavior(),
        "history_5min": [],
        "history_1hr": [],
        "last_frame": None,
        # สะสมต่อกล้อง
        "count": {
            "Focused": 0,
            "Drinking": 0,
            "Eating": 0,
            "Lookaways": 0,
            "Sleeping": 0,
            "UsingPhone": 0,
        },
        "sum": {
            "Focused": 0.0,
            "Drinking": 0.0,
            "Eating": 0.0,
            "Lookaways": 0.0,
            "Sleeping": 0.0,
            "UsingPhone": 0.0,
        },
    }
    print(f"✅ Camera {camera_id} opened")


# ✅ loop ตรวจจับ YOLO ต่อกล้อง
def camera_loop(camera_id: str):
    cam_state = cameras.get(camera_id)
    if not cam_state:
        print(f"❌ camera_loop: {camera_id} not found")
        return

    cap = cam_state.get("cap")
    if cap is None or not cap.isOpened():
        print(f"❌ camera_loop: cap invalid for {camera_id}")
        cam_state["detecting"] = False
        return

    print(f"🧠 start detect+calc on camera {camera_id}")
    last_check_time = time.time()

    while cam_state.get("running") and cam_state.get("detecting") and cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.03)
            continue

        # 🔹 YOLO ตรวจจับ
        results = model.predict(source=frame, conf=0.2, device="cpu", verbose=False)
        annotated = results[0].plot()

        # 🔹 แปลงเป็น JPEG และเก็บไว้
        ok, buf = cv2.imencode(".jpg", annotated)
        if ok:
            cam_state["last_frame"] = buf.tobytes()

        # 🔹 สะสมค่า
        now = time.time()
        if now - last_check_time >= 1.0:
            cam_state["seconds"] += 1
            last_check_time = now

            for box in results[0].boxes:  # type: ignore
                cls = int(box.cls)
                conf = float(box.conf.item())
                label = model.names[cls]
                if conf > 0.5 and label in cam_state["count"]:
                    cam_state["count"][label] += 1
                    cam_state["sum"][label] += conf

            if cam_state["seconds"] >= 60:
                avg = calculate_average(cam_state["count"], cam_state["sum"])
                print(f"📊 กล้อง {camera_id} avg(1m): {avg}")

                for k in cam_state["count"]:
                    cam_state["count"][k] = 0
                for k in cam_state["sum"]:
                    cam_state["sum"][k] = 0.0
                cam_state["seconds"] = 0

        time.sleep(0.03)

    print(f"🛑 stop detect on camera {camera_id}")
    cam_state["detecting"] = False


# ✅ เปิดกล้องทั้งหมดพร้อมกัน
@camera_router.get("/open-all")
async def open_all_cameras():
    if not available_cameras:
        scan_cameras()
    for cam in available_cameras:
        camera_id = str(cam["id"])
        if camera_id not in cameras:
            try:
                open_camera_instance(camera_id)
            except Exception as e:
                print(f"❌ Error opening camera {camera_id}: {e}")
    return {"message": f"{len(available_cameras)} cameras opened"}


# ✅ เริ่มตรวจจับ YOLO ทีละกล้อง
@camera_router.get("/start-detect/{camera_id}")
async def start_detect(camera_id: str):
    cam_state = cameras.get(camera_id)
    if not cam_state or not cam_state.get("running"):
        raise HTTPException(status_code=404, detail="Camera not found or not opened")

    if cam_state.get("detecting"):
        return {"message": f"Camera {camera_id} already detecting"}

    cam_state["detecting"] = True
    t = threading.Thread(target=camera_loop, args=(camera_id,), daemon=True)
    cam_state["thread"] = t
    t.start()
    return {"message": f"Detection started on camera {camera_id}"}


# ✅ ปิดกล้องเฉพาะตัว
@camera_router.get("/close-camera/{camera_id}")
async def camera_close(camera_id: str):
    cam_state = cameras.get(camera_id)
    if not cam_state:
        return {"message": f"Camera {camera_id} already closed"}

    cam_state["detecting"] = False
    cam_state["running"] = False

    cap = cam_state.get("cap")
    if cap and cap.isOpened():
        cap.release()

    cameras.pop(camera_id, None)
    print(f"🧹 Camera {camera_id} closed")
    return {"message": f"Camera {camera_id} closed"}


# ✅ ปิดกล้องทั้งหมด
@camera_router.get("/close-all")
async def close_all_cameras():
    for cam_id, cam_state in list(cameras.items()):
        try:
            cam_state["detecting"] = False
            cam_state["running"] = False
            cap = cam_state.get("cap")
            if cap and cap.isOpened():
                cap.release()
        except Exception as e:
            print(f"Error closing {cam_id}: {e}")
    cameras.clear()
    print("🧹 All cameras closed")
    return {"message": "All cameras closed"}


# ✅ แสดงรายการกล้อง
@camera_router.get("/list-camera")
async def check_list_camera():
    if not available_cameras:
        threading.Thread(target=scan_cameras, daemon=True).start()
        return {"status": "scanning", "cameras": []}
    return {"status": "done", "cameras": available_cameras}


# ✅ WebSocket สำหรับ stream แต่ละกล้อง
@camera_router.websocket("/ws/camera/{camera_id}")
async def camera_ws(websocket: WebSocket, camera_id: str):
    await websocket.accept()
    print(f"📡 Client connected for camera {camera_id}")

    cap = None
    cam_state = cameras.get(camera_id)
    if cam_state and cam_state.get("cap"):
        cap = cam_state["cap"]
    else:
        cap = cv2.VideoCapture(int(camera_id), cv2.CAP_DSHOW)
        if not cap.isOpened():
            await websocket.send_text("error: cannot open camera")
            await websocket.close()
            return

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                await websocket.send_text("error: cannot read frame")
                break

            _, buffer = cv2.imencode(".jpg", frame)
            jpg_as_text = base64.b64encode(buffer).decode("utf-8")
            await websocket.send_text(jpg_as_text)

            await asyncio.sleep(0.05)  # ~20 fps

    except WebSocketDisconnect:
        print(f"❌ WS disconnected for camera {camera_id}")

    finally:
        print(f"🧹 WS stream for camera {camera_id} ended")
        await websocket.close()


# ✅ ปิดทั้งหมดเมื่อ shutdown server
@camera_router.on_event("shutdown")
async def shutdown_event():
    print("🛑 Shutting down... closing all cameras")
    for cam_id, cam_state in list(cameras.items()):
        try:
            cam_state["running"] = False
            cap = cam_state.get("cap")
            if cap and cap.isOpened():
                cap.release()
        except Exception as e:
            print(f"Error closing {cam_id}: {e}")
        await asyncio.sleep(0)
    cameras.clear()
    print("✅ All cameras released")
