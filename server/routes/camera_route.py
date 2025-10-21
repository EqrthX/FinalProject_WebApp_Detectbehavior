from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from ultralytics import YOLO
import cv2
import threading
import time
import os
from datetime import datetime
from utils.camera_helper import empty_flat_dict_behavior, calculate_average

camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "..", "runs", "detect", "train", "weights", "best.pt")
model = YOLO(MODEL_PATH)

cameras = {}

# สร้าง dict เก็บค่า conf 
classAttection = empty_flat_dict_behavior()

test_class_count = {
    "Focused": 0,
    "Drinking": 0,
    "Eating": 0,
    "Lookaways": 0,
    "Sleeping": 0,
    "UsingPhone": 0,
}

test_class_sum = {
    "Focused": 0.0,
    "Drinking": 0.0,
    "Eating": 0.0,
    "Lookaways": 0.0,
    "Sleeping": 0.0,
    "UsingPhone": 0.0,
}
        
cameras = {}  # { camera_id: {cap, running, detecting, seconds, last_frame, counters...} }

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

        # YOLO -> annotated frame
        results = model.predict(source=frame, conf=0.2, device="cpu", verbose=False)
        annotated = results[0].plot()

        # update last_frame (JPEG bytes)
        ok, buf = cv2.imencode(".jpg", annotated)
        if ok:
            cam_state["last_frame"] = buf.tobytes()

        # accumulate per-second
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

            # ทุก 60 วิ -> คำนวณ + รีเซ็ต
            if cam_state["seconds"] >= 60:
                avg = calculate_average(cam_state["count"], cam_state["sum"])
                print(f"📊 กล้องตัวที่ {camera_id} avg(1m): {avg}")

                # รีเซ็ตสะสม
                for k in cam_state["count"]:
                    cam_state["count"][k] = 0
                for k in cam_state["sum"]:
                    cam_state["sum"][k] = 0.0
                cam_state["seconds"] = 0

        time.sleep(0.03)

    print(f"🛑 stop detect on camera {camera_id}")
    cam_state["detecting"] = False  # เผื่อมีหลุด loop จาก running=False

@camera_router.get("/open-camera/{camera_id}")
async def camera_open(camera_id: str):
    # เปิดกล้องครั้งเดียว
    if camera_id in cameras and cameras[camera_id]["running"]:
        return {"message": "Camera already running"}

    source = int(camera_id) if camera_id.isdigit() else camera_id
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Cannot open camera")

    # ✅ สร้าง state ต่อกล้อง
    cameras[camera_id] = {
        "cap": cap,
        "thread": None,
        "running": True,       # เปิดกล้องแล้ว
        "detecting": False,    # ยังไม่เริ่ม YOLO
        "seconds": 0,
        "class_behavior": empty_flat_dict_behavior(),  # ถ้ามีใช้จริง
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
    return {"message": f"Camera {camera_id} opened"}

@camera_router.get("/start-detect/{camera_id}")
def start_detect(camera_id: str):
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

@camera_router.get("/video/{camera_id}")
def video_feed(camera_id: str):
    cam_state = cameras.get(camera_id)
    if not cam_state or not cam_state.get("running"):
        raise HTTPException(status_code=404, detail="Camera not running")

    def generate():
        while cam_state.get("running"):
            frame = cam_state.get("last_frame")
            if frame is None:
                time.sleep(0.05)
                continue
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")

    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

@camera_router.get("/close-camera/{camera_id}")
async def camera_close(camera_id: str):
    cam_state = cameras.get(camera_id)
    if not cam_state:
        return {"message": f"Camera {camera_id} already closed"}

    # ✅ ขั้นตอน 1: สั่งให้ thread หยุด
    cam_state["detecting"] = False
    cam_state["running"] = False

    # ✅ ขั้นตอน 2: รอ thread หยุด (ถ้ามี)
    t = cam_state.get("thread")
    if t and t.is_alive():
        t.join(timeout=2.0)  # รอไม่เกิน 2 วิให้ thread exit

    # ✅ ขั้นตอน 3: ปล่อยกล้อง
    cap = cam_state.get("cap")
    if cap and cap.isOpened():
        cap.release()

    # ✅ ขั้นตอน 4: ลบออกจาก dict
    cameras.pop(camera_id, None)
    print(f"🧹 Camera {camera_id} closed")
    return {"message": f"Camera {camera_id} closed"}

@camera_router.get("/list-camera")
async def check_list_camera():
    found = []
    i = 0
    not_found_count = 0
    while True:
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            found.append({"id": i, "name": f"Camera กล้องตัวที่ {i+1}"})
            not_found_count = 0
            cap.release()
        else:
            not_found_count += 1
            cap.release()
            if not_found_count >= 2:
                break
        i += 1
    return {"cameras": found}

@camera_router.on_event("shutdown")
def shutdown_event():
    print("🛑 Shutting down... closing all cameras")
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
    cameras = []
    i = 0
    not_fount_count = 0

    while True:
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            cameras.append({
                "id": i,
                "name": f"Camera {f'กล้องตัวที่ {i+1}'}"
                })
            not_fount_count = 0
        else:
            not_fount_count += 1
            if not_fount_count >= 2:
                break
        cap.release()
        i += 1
    
    return {"cameras": cameras}