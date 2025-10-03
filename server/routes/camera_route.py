from fastapi import APIRouter, HTTPException, Depends, status, Response
from ultralytics import YOLO
import cv2
import threading
import time
import asyncio
import os
from datetime import datetime
from utils.camera_helper import average_dict_attendence, generate_image_filename, save_snapshot, empty_classAttection, save_file_log

camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "..", "runs", "detect", "train", "weights", "best.pt")
model = YOLO(MODEL_PATH)

cap = None
is_carema_running = False
camera_thread = None
seconds = 0
history_5min = []
history_1hr = []

# สร้างโฟเดอร์สำหรับเก็บภาพที่แคปทุกๆ นาทีที่กำหนดไว้
output_folder = "captured_images"

# สร้าง dict เก็บค่า conf เข้าตาม High Low
classAttection = empty_classAttection()

def camera_loop():
    
    global cap, is_carema_running, seconds, classAttection
    cap = cv2.VideoCapture(0)
    last_check_time = time.time()

    while is_carema_running and cap.isOpened():

        success, frame = cap.read()
        
        if not success:
            continue
        
        results = model.predict(source=frame, conf=0.2, device="cpu", verbose=False)
        anootated_frame = results[0].plot()
            
        now = time.time()
        
        if now - last_check_time >= 1:
            
            seconds+=1
            last_check_time = now
            
            for box in results[0].boxes: # pyright: ignore[reportOptionalIterable]
                
                cls = int(box.cls)
                conf = box.conf.item()
                label = model.names[cls]
                conf = round(conf, 2)
                
                if label in classAttection["High_Attention"]:
                    classAttection["High_Attention"][label] += conf
                elif label in classAttection["Low_Attention"]:
                    classAttection["Low_Attention"][label] += conf

            print(f"second {seconds}")

            if seconds == 300:
                avg_min = average_dict_attendence(classAttection, seconds)
                
                image_filename = generate_image_filename()
                save_path = save_snapshot(anootated_frame, image_filename, output_folder)
                
                record_min = {
                    "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "interval_minutes": 5,
                    "average": avg_min
                },

                history_5min.append(record_min)
                print(f"📊 History: {history_5min}, Path: {save_path}")
                
                # ⭐ RESET สำคัญมาก!
                seconds = 0
                classAttection = empty_classAttection()
                save_file_log(history_5min)

                if len(history_5min) >= 12:
                    print("History 1 hr.")
                    save_file_log(history_1hr)
            
        cv2.imshow("Detection Webcam", anootated_frame)
        cv2.waitKey(1)
                
    if cap:
        cap.release()
    cv2.destroyAllWindows()
    
@camera_router.get("/open-camera")
async def camera_open():
    
    global is_carema_running, camera_thread
    if is_carema_running:
        return {"message": "Camera already running"}

    is_carema_running = True
    camera_thread = threading.Thread(target=camera_loop, daemon=True)
    camera_thread.start()
    return {"message": "Camera running"}

@camera_router.get("/close-camera")
async def camera_close():
    global is_carema_running
    if not is_carema_running:
        return {"message": "Camera is not running"}
    
    is_carema_running = False
    await asyncio.sleep(1)
    return {"message": "Camera stopped"}