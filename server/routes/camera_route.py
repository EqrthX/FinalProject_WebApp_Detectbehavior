from fastapi import APIRouter, HTTPException, Depends, status, Response
from ultralytics import YOLO
import cv2
import threading
import time

camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

model = YOLO("yolov8n.pt")

cap = None
is_carema_running = False
camera_thread = None

def camera_loop():
    
    global cap, is_carema_running
    cap = cv2.VideoCapture(0)
    seconds = 0
    sumConf = 0
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
            
            for box in results[0].boxes:
                
                cls = int(box.cls)
                conf = box.conf.item()
                label = model.names[cls]
                conf = round(conf, 2)
                
                if conf > 0.75:
                    sumConf += conf
                        
            calculate5Min(seconds, sumConf, label)
            
        cv2.imshow("YOLO Webcam", anootated_frame)
        cv2.waitKey(1)

                
    if cap:
        cap.release()
    cv2.destroyAllWindows()

def calculate5Min(seconds = 0, conf = 0.0, label = ""):
    
    arrConf = []
    print(f"seconds {seconds}, conf {conf}")
    
    if seconds % 60 == 0:
        print(f"result conf {conf / seconds}")
        arrConf.append(conf / seconds)
    
    
@camera_router.get("/open-camera")
async def camera_open():
    
    global is_carema_running, camera_thread
    if is_carema_running:
        return {"message": "Camera already running"}

    is_carema_running = True
    camera_thread = threading.Thread(target=camera_loop)
    camera_thread.start()
    return {"message": "Camera running"}

@camera_router.get("/close-camera")
async def camera_close():
    global is_carema_running
    if not is_carema_running:
        return {"message": "Camera is not running"}
    
    is_carema_running = False
    time.sleep(0.1)
    return {"message": "Camera stopped"}