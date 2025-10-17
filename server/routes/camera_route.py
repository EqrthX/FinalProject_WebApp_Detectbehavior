from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from ultralytics import YOLO
import cv2
import threading
import time
import asyncio
import os
from datetime import datetime
from utils.camera_helper import empty_flat_dict_behavior, calculate_average
import json

camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "..", "runs", "detect", "train", "weights", "best.pt")
model = YOLO(MODEL_PATH)

cameras = {
    "cap": None,
    "thread": None,
    "running": False,
    "seconds": 0,
    "class_beharvior": empty_flat_dict_behavior(),
    "history_1min": [],
    "history_1hr": []
}

# สร้าง dict เก็บค่า conf เข้าตาม High Low
classAttection = empty_flat_dict_behavior()

def camera_loop(camera_id, sorce):
    
    cam_state = cameras[camera_id]
    cam_state["cap"] = cv2.VideoCapture(sorce)
    last_check_time = time.time()

    while cam_state["running"] and cam_state["cap"].isOpened():

        success, frame = cam_state["cap"].read()
        
        if not success:
            continue
        
        results = model.predict(source=frame, conf=0.2, device="cpu", verbose=False)
        anootated_frame = results[0].plot()
            
        now = time.time()
        
        if now - last_check_time >= 1:
            
            cam_state["seconds"]+=1
            last_check_time = now
            
            for box in results[0].boxes: # pyright: ignore[reportOptionalIterable]
                
                cls = int(box.cls)
                conf = box.conf.item()
                label = model.names[cls]
                conf = round(conf, 2)


            print(f"second {cam_state["seconds"]}")

            
        cv2.imshow("Detection Webcam", anootated_frame)
        cv2.waitKey(1)
                
    if cam_state["cap"]:
        cam_state["cap"].release()
    cv2.destroyAllWindows()

@camera_router.get("/cal")
async def test_calculate():

    data = []
    with open('log_5min_20251003_160754.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    #ตำนวน หาค่าเฉลี่ย 1 ชม
    result = calculate_average(data)
    
    with open('log_cal.json', 'a', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    for cat, values in result.items():
        for k, v in values.items():
            print(f"{k}: {v}")
    print('Save ลงไฟล์แล้ว')
    
@camera_router.get("/open-camera/{camera_id}")
async def camera_open(camera_id: str):
    
    if camera_id in cameras and cameras[camera_id]["running"]:
        raise HTTPException(
            status_code = 400,
            detail = {"message": "Camera alrady running"}
        )
    
    try:
        
        source = int(camera_id) if camera_id.isdigit() else camera_id
        cameras[camera_id] = {
            "cap": None,
            "thread": None,
            "running": True,
            "seconds": 0,
            "class_beharvior": empty_flat_dict_behavior(),
            "history_5min": [],
            "history_1hr": []
        }

        camera_thread = threading.Thread(target=camera_loop, args=(camera_id, source)  ,daemon=True)
        cameras[camera_id]['thread'] = camera_thread
        camera_thread.start()
        return HTTPException(
            status_code=201,
            detail={"message": f"Camera {camera_id} started"}
        )
    except Exception as e:
        cameras[camera_id]["running"] = False
        return HTTPException(
            status_code=500,
            detail={"error": f"Open camera : {str(e)}"}
        )

@camera_router.get("/close-camera/{camera_id}")
async def camera_close(camera_id: str):

    if camera_id not in cameras:
        raise HTTPException(
            status_code=404,
            detail={"message": "Camera not found"}
        )
    
    try:
        cameras[camera_id]["running"] = False
        await asyncio.sleep(1)
        return {"message" : f"Close camera : {camera_id}"}
    except Exception as e:
        return HTTPException(
            status_code=500,
            detail={"error": f"Close camera : {str(e)}"}
        )
    
@camera_router.get("/list-camera")
async def check_list_camera():
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