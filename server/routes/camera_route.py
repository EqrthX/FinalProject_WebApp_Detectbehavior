from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from starlette.types import HTTPExceptionHandler
from ultralytics import YOLO
import cv2
import time
import os
import base64
import asyncio
from utils.camera_helper import empty_flat_dict_behavior, calculate_average
from utils.model_loader import get_model
from datetime import datetime
camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "..", "runs", "detect", "train", "weights", "best.pt")
model = get_model()

# เก็บกล้องที่เปิดอยู่ทั้งหมด
cameras = {}
available_cameras = []
last_scan_time = 0

# ✅ ฟังก์ชันสแกนกล้องในเครื่อง
async def async_scan_cameras():
    global available_cameras
    found = []
    print("🔍 Start scanning cameras...")
    for i in range(10):
        await asyncio.sleep(0)  # ให้ event loop ได้ switch
        cap = cv2.VideoCapture(i, cv2.CAP_MSMF) # สำหรับกล้องที่ทันสมัย
        if cap.isOpened():
            print(f"✅ Camera {i} found")
            found.append({"id": i, "name": f"Camera กล้องตัวที่ {i+1}"})
            cap.release()
        else:
            print(f"❌ Camera {i} not found")
            cap.release()
    available_cameras = found
    print(f"📷 กล้องทั้งหมดที่ตรวจพบ: {len(found)} ตัว")

# ✅ ฟังก์ชันเปิดกล้องเดี่ยว (ใช้ภายใน)
def open_camera_instance(camera_id: str):
    source = int(camera_id)
    cap = cv2.VideoCapture(source, cv2.CAP_MSMF)
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail=f"Cannot open camera {camera_id}")

    # สร้าง dict cameras ที่เก็บ key value สำหรับการควบคุมกล้อง ใช้ id เพื่อเช็คตามกล้อง
    cameras[camera_id] = {
        "cap": cap, # เปิดกล้อง
        "thread": None, # การทำงานของ thread
        "running": True, # เช็คว่ากล้องเปิดและ run อยู่ไหม
        "detecting": False, # เช็คการตรวจจับ
        "seconds": 0, # นับวินาที
        "class_behavior": empty_flat_dict_behavior(), #กำลัง class เริ่มต้น
        "history_5min": [], # ประวัติ 5 นาที
        "last_frame": None, # เก็บภาพจาก model ครั้งสุดท้ายของ frame ส่งมีการส่งไปแสดงผล frontend
        "frame_count": 0,
        # สะสมต่อกล้อง
        "frame_class_count": {
            "Focused": 0,
            "Drinking": 0,
            "Eating": 0,
            "Lookaways": 0,
            "Sleeping": 0,
            "UsingPhone": 0,
            "Vacant": 0
        },
        "frame_conf_sum": {
            "Focused": 0.0,
            "Drinking": 0.0,
            "Eating": 0.0,
            "Lookaways": 0.0,
            "Sleeping": 0.0,
            "UsingPhone": 0.0,
            "Vacant": 0.0
        },
    }
    print(f"✅ Camera {camera_id} opened")

# ✅ loop ตรวจจับ YOLO ต่อกล้อง
async def camera_loop(camera_id: str):
    try:
        cam_state = cameras.get(camera_id)
        if not cam_state:
            print(f"❌ camera_loop: {camera_id} not found")
            return

        cap = cam_state.get("cap")
        if cap is None or not cap.isOpened():
            print(f"❌ camera_loop: cap invalid for {camera_id}")
            cam_state["detecting"] = False
            return

        loop = asyncio.get_event_loop()

        print(f"🧠 start detect+calc on camera {camera_id}")
        last_check_time = time.time()

        # เงื่อนต้องเปิดกล้อง และ กำลังตรวจจับ
        while cam_state.get("running") and cam_state.get("detecting") and cap.isOpened():
            found_classes = set()
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.03)
                continue
            cam_state["frame_count"] += 1
            # 🔹 YOLO ตรวจจับ

            results = await loop.run_in_executor(
                None, lambda: model.predict(source=frame, conf=0.2, device="cpu", verbose=False)
            )
            annotated = results[0].plot()

            for box in results[0].boxes:  # type: ignore
                    cls = int(box.cls)
                    conf = float(box.conf.item())
                    label = model.names[cls]
                    if conf > 0.6:
                        found_classes.add(label)
                        cam_state["frame_class_count"][label] += 1
                        cam_state["frame_conf_sum"][label] += conf

            # 🔹 แปลงเป็น JPEG และเก็บไว้
            ok, buf = cv2.imencode(".jpg", annotated)
            if ok:
                cam_state["last_frame"] = buf.tobytes()

            now = time.time()

            if now - last_check_time >= 1:
                cam_state["seconds"] += 1
                last_check_time = now
                
                print(f"กล้อง {int(camera_id) + 1} 1 วิ ล่าสุด (จาก {cam_state["frame_count"]} frame)")
                
                if cam_state["seconds"] >= 30:
                    print(f"\n📸 กล้อง {camera_id} ครบ 30 วิ - รวม {cam_state["frame_count"]} เฟรม และ เฟรม label {cam_state["frame_class_count"]}")

                    # avg = calculate_average(cam_state["count"], cam_state["sum"])
                    # print(f"📊 กล้อง {int(camera_id) + 1} avg(30 วิ): {avg}")

                    # # สร้าง list ของคลาส
                    # HIGH_CLASSES = ["Focused", "Drinking", "Eating"]
                    # LOW_CLASSES = ["Lookaways", "Sleeping", "UsingPhone"]
                    # # และนำค่า list มากำหนดค่าจากตัวแปร avg ที่คำนวนตาม lable ที่กำหนดไว้
                    # high_dict = {k: avg.get(k, 0.0) for k in HIGH_CLASSES}
                    # low_dict = {k: avg.get(k, 0.0) for k in LOW_CLASSES}
                    # # คำนวนค่าเฉลี่ยจาก sub class 3 class เพื่อหาว่าตัวไหน High Low ในช่วงนี้อะไรเยอะกว่า
                    # high_avg = round(sum(high_dict.values()) / len(high_dict), 3)
                    # low_avg = round(sum(low_dict.values()) / len(low_dict), 3)

                    # # state class_behavior เก็บ time High_Attention Low_Attention และมี sub class เป็น avg details ตามที่กำหนดไว้
                    # cam_state["class_behavior"] = {
                    #     "time": datetime.now().strftime("%H:%M:%S"), 
                    #     "High_Attention": {
                    #         "avg": high_avg,
                    #         "details": high_dict
                    #     },
                    #     "Low_Attention": {
                    #         "avg": low_avg,
                    #         "details": low_dict
                    #     }
                    # }
                    
                    # reset count sum เป็น 0 เพื่อคำนวณใหม่
                    for k in cam_state["frame_class_count"]:
                        cam_state["frame_class_count"][k] = 0
                    for k in cam_state["frame_conf_sum"]:
                        cam_state["frame_conf_sum"][k] = 0.0
                    cam_state["frame_count"] = 0
                    cam_state["seconds"] = 0

                    print(f"🎯 class_behavior กล้อง {camera_id}: {cam_state['class_behavior']}")

            await asyncio.sleep(0.033) # 30 fps

        print(f"🛑 stop detect on camera {camera_id}")
        cam_state["detecting"] = False
    except asyncio.CancelledError:
        print(f"⚠️ camera_loop cancelled for {camera_id}")
    


# ✅ เปิดกล้องทั้งหมดพร้อมกัน
@camera_router.get("/open-all")
async def open_all_cameras():
    if not available_cameras:
        asyncio.create_task(async_scan_cameras()) # ให้ตัวสแกนกล้องทำงานอยู่เบื้องหลังจะได้ไม่ชนกับ process อื่นๆ
        return {"status": "scanning"}
    for cam in available_cameras: # ใช้ loop เพื่อหาจำนวนกล้องที่เชื่อมต่อได้
        camera_id = str(cam["id"])
        if camera_id not in cameras:
            try:
                open_camera_instance(camera_id) # ถ้าเจอกล้องแล้วจะให้เปิดกล้องและทำการใช้ state ที่สร้างขึ้นใน func นี้
            except Exception as e:
                print(f"❌ Error opening camera {camera_id}: {e}")
    return {"message": f"{len(available_cameras)} cameras opened"}

# ✅ เริ่มตรวจจับ YOLO ทีละกล้อง
@camera_router.get("/start-detect/{camera_id}")
async def start_detect(camera_id: str):
    cam_state = cameras.get(camera_id)
    # เช็คว่าเจอกล้องที่เชื่อมต่อไหมหรือกำลังเปิดอยู่ไหม
    if not cam_state or not cam_state.get("running"):
        raise HTTPException(status_code=404, detail="Camera not found or not opened")
    # ถ้ากำลังเปิดอยู่จะแจ้งเตือน
    if cam_state.get("detecting"):
        return {"message": f"Camera {camera_id} already detecting"}
    # เปลี่ยน state ของ detecting เป้น true เพื่อให้เริ่มการตรวจจับ
    cam_state["detecting"] = True
    task = asyncio.create_task(camera_loop(camera_id))
    cam_state["task"] = task
    return {"message": f"Async detection started on camera {camera_id}"}
# endpoint ที่หยุดการทำงาน
@camera_router.get("/stop-all")
async def stop_all_detections():
    stopped = []
    for cam_id, cam_state in cameras.items():
        if cam_state.get("detecting"):
            cam_state["detecting"] = False
            stopped.append(cam_id)
    print(f"🛑 Stopped detection for cameras: {stopped}")
    return {"message": f"Stopped {len(stopped)} cameras", "stopped": stopped}

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

            task = cam_state.get("task")
            if task and not task.done():
                task.cancel()

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
    global available_cameras, last_scan_time
    now = time.time()
    if not available_cameras or (now - last_scan_time > 10): # ถ้าเจอกล้องและไม่นานเกิน 10 วิจะไม่เข้าเงื่อนการ scan กล้อง เพราะมีกล้องอยู่แล้ว
        last_scan_time = now
        await async_scan_cameras()
        return {"status": "scanning", "cameras": []}
    return {"status": "done", "cameras": available_cameras}

# ------------- WebSocket -------------

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
        cap = cv2.VideoCapture(int(camera_id), cv2.CAP_MSMF)
        if not cap.isOpened(): # ถ้าเปิดกล้องไม่ได้ จะให้ส่ง error ไป frontend แบบ real time และหยุดการทำงาน
            await websocket.send_text("error: cannot open camera")
            await websocket.close()
            return

    try:
        while True: # จะให้ส่งภาพที่ bounding box แบบ real time ตลอดและกำหนด fps ที่ 30 
            ret, frame = cap.read()
            if not ret:
                await websocket.send_text("error: cannot read frame")
                break

            results = model.predict(source=frame, conf=0.2, device="cpu", verbose=False)
            annotated = results[0].plot()

            ok, buffer = cv2.imencode(".jpg", annotated)
            if ok:
                cam_state["last_frame"] = buffer.tobytes()
            
            jpg_as_text = base64.b64encode(buffer).decode("utf-8")
            await websocket.send_text(jpg_as_text)

            await asyncio.sleep(0.033)  # ~30 fps

    except WebSocketDisconnect:
        print(f"❌ WS disconnected for camera {camera_id}")

    finally:
        try:
            if not websocket.client_state.name == "CLOSED":
                await websocket.close()
        except Exception as e:
            print(f"🧹 WS stream for camera {camera_id} ended")
        print(f"🧹 WS stream for camera {camera_id} ended")

# WebSocket ส่งภาพที่วินาที 30 วิ ไปแสดงผล
@camera_router.websocket("/ws/camera/summary/{camera_id}")
async def camera_summary(websocket: WebSocket, camera_id: str):
    await websocket.accept()
    cam_state = cameras.get(camera_id)

    try:
        while cam_state.get("running") and cam_state.get("detecting"):
            await asyncio.sleep(30)

            payload = cam_state.get("class_behavior", {})
            if payload:
                await websocket.send_json(payload)
                print(f"📊 ส่ง summary กล้อง {camera_id}: {payload}")
    except Exception as e:
        print("Summary ws:", e)
    finally:
        await websocket.close()