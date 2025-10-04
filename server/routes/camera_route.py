from fastapi import APIRouter, HTTPException, Depends
from ultralytics import YOLO
import cv2
import threading
import time
import asyncio
import os
from datetime import datetime
from utils.camera_helper import average_dict_attendence, generate_image_filename, save_snapshot, empty_classAttection, save_file_log, calculate_average
import json

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
                }

                history_5min.append(record_min)
                print(f"📊 History: {history_5min}, Path: {save_path}")
                
                # ⭐ RESET สำคัญมาก!
                seconds = 0
                classAttection = empty_classAttection()
                save_file_log(history_5min)

                if len(history_5min) >= 12 and len(history_5min) % 12 == 0:

                    start_index = len(history_5min) - 12
                    hour_records = history_5min[start_index:]
                    avg_hr = calculate_average(hour_records)

                    record_1hr = {
                        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "interval_minute": 60,
                        "average": avg_hr
                    }
                    
                    history_1hr.append(record_1hr)
                    save_file_log(history_1hr)

            
        cv2.imshow("Detection Webcam", anootated_frame)
        cv2.waitKey(1)
                
    if cap:
        cap.release()
    cv2.destroyAllWindows()

@camera_router.get("/cal")
async def test_calculate():

    history_5min = []
    data = []
    with open('log_5min_20251003_160754.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    #ตำนวน หาค่าเฉลี่ย 1 ชม
    for i in range(36):
        record = {
            "time": f"2025-10-03 13:{i*5:02d}",
            "interval_minutes": 5,
            "average": {
                "High_Attention": {"Focused": i*0.01},
                "Low_Attention": {
                    "Drinking": 0.01*i,
                    "Eating": 0.02*i,
                    "Lookaways": 0.03*i,
                    "Sleeping": 0.005*i,
                    "UsingPhone": 0.04*i
                }
            }
        }
        history_5min.append(record)

    first_record = history_5min[0:12]
    avg_first = calculate_average(first_record)
    seconds_record = history_5min[12:24]
    avg_seconds = calculate_average(seconds_record)
    third_record = history_5min[24:36]
    avg_third = calculate_average(third_record)
    
    print(f"first {avg_first}")
    print(f"seconds {avg_seconds}")
    print(f"third {avg_third}")
    
@camera_router.get("/open-camera")
async def camera_open():
    
    global is_carema_running, camera_thread

    if is_carema_running:
        return HTTPException(
            status_code = 200,
            detail = {"message": "Camera alrady running"}
        )
    
    try:
        is_carema_running = True
        camera_thread = threading.Thread(target=camera_loop, daemon=True)
        camera_thread.start()
        return HTTPException(
            status_code=201,
            detail={"message": "Camera started"}
        )
    except Exception as e:
        is_carema_running = False
        return HTTPException(
            status_code=500,
            detail={"error": f"Open camera : {str(e)}"}
        )

@camera_router.get("/close-camera")
async def camera_close():

    global is_carema_running

    if not is_carema_running:
        return HTTPException(
            status_code=400,
            detail={"message": "Camera is not running"}
        )
    
    try:
        is_carema_running = False
        await asyncio.sleep(1)
        return HTTPException(
            status_code=200,
            detail={"message": "Camera stopped"}
        )
    except Exception as e:
        return HTTPException(
            status_code=500,
            detail={"error": f"Close camera : {str(e)}"}
        )