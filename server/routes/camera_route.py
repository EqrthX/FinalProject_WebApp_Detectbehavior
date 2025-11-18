from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends
import cv2
import time
import base64
import asyncio
from datetime import datetime
from utils.camera_helper import create_camera_state, define_LOW_CLASS, define_HIGH_CLASS
from utils.model_loader import get_model
from utils.auth import verify_token
from datetime import datetime
from config.bn_supabase import supabase_client

camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

model = get_model()

# เก็บกล้องที่เปิดอยู่ทั้งหมด
cameras = {}
available_cameras = []
last_scan_time = 0
backends_cameras = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
is_scanning = False
scan_lock = asyncio.Lock()  # lock กัน async call ซ้ำ

ATTENDENCE = define_HIGH_CLASS()
NON_ATTENDENCE = define_LOW_CLASS()
# ----------------------------------------

# ✅ ฟังก์ชันสแกนกล้องในเครื่อง
async def async_scan_cameras():
    global available_cameras, is_scanning
    # ✅ กันสแกนซ้ำ
    async with scan_lock:
        if is_scanning:
            print("⏳ Scan already running, skip this call")
            return
        is_scanning = True

        found = []
        print("🔍 Start scanning cameras...")

        try:
            for i in range(10):
                await asyncio.sleep(0)  # ให้ event loop สลับ
                for backend in backends_cameras:
                    cap = cv2.VideoCapture(i, backend)
                    if cap.isOpened():
                        print(f"✅ กล้องตัวที่ {i + 1} found with backend {backend}")
                        found.append({
                            "id": i,
                            "name": f"กล้องตัวที่ {i+1}",
                            "backend_camera": backend
                        })
                        cap.release()
                        break
                    cap.release()

            available_cameras = found
            print(f"📷 กล้องทั้งหมดที่ตรวจพบ: {len(found)} ตัว")

        finally:
            is_scanning = False  # ✅ ปลดล็อกเสมอ

# ✅ ฟังก์ชันเปิดกล้องเดี่ยว (ใช้ภายใน)
def open_camera_instance(camera_id: str, teacher_id = None):
    source = int(camera_id)
    backend = cv2.CAP_ANY
    for cam in available_cameras:
        if cam["id"] == source:
            backend = cam.get("backend_camera", cv2.CAP_ANY)
            break
    cap = cv2.VideoCapture(source, backend)
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail=f"ไม่สามารถเปิดกล้อง {int(camera_id) + 1}")

    # สร้าง dict cameras ที่เก็บ key value สำหรับการควบคุมกล้อง ใช้ id เพื่อเช็คตามกล้อง
    cameras[camera_id] = create_camera_state(cap, teacher_id=teacher_id)
    print(f"✅ Camera {int(camera_id) + 1} เปิด รหัสอาจารย์ {teacher_id}")

# ใช้กับ endpoint start-detect เมื่อเวลาเรียก api เส้นนี้จะทำการตรวจจับจาก webcam แล้วก็ให้มีการคำนวน
async def camera_loop(camera_id: str):
    try:
        cam_state = cameras.get(camera_id)
        if not cam_state:
            print(f"❌ camera_loop: {int(camera_id) + 1} ไม่เจอ")
            return
    
        cap = cam_state.get("cap")
        if cap is None or not cap.isOpened():
            print(f"❌ camera_loop: cap invalid for {int(camera_id) + 1}")
            cam_state["detecting"] = False
            return
        
        if "class_timer" not in cam_state:
            cam_state.setdefault("class_timer", {
                "current_class": None,
                "duration": 0.0,
                "frame_count": 0,
                "miss": 0,
            })
        
        loop = asyncio.get_event_loop()

        print(f"🧠 start detect on camera {int(camera_id) + 1}")
        last_check_time = time.time()
        
        try:
            # เงื่อนต้องเปิดกล้อง และ กำลังตรวจจับ
            while cam_state.get("running") and cam_state.get("detecting") and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    await asyncio.sleep(0.03)
                    continue

                label = None
                
                results = await loop.run_in_executor(
                    None, lambda: model.track(source=frame, conf=0.2, device="cpu", verbose=False, tracker="bytetrack.yaml")
                )

                annotated = results[0].plot()

                now = time.time()
                found_valid_detection = False
                timer = cam_state['class_timer']

                for box in results[0].boxes:  

                    cls = int(box.cls)
                    conf = float(box.conf.item())
                    label = model.names[cls]
                    track_id = int(box.id) if box.id is not None else -1
                        
                        # เช็คว่า track id ตรงกับ state track_id ไหม
                    if track_id == cam_state["track_id"] and conf > 0.3:

                        found_valid_detection = True

                        if label in ATTENDENCE:
                            cam_state["status"]["frame_class_count"][label] += 1
                        elif label in NON_ATTENDENCE:
                            cam_state["status"]["frame_class_count"][label] += 1
                        else:
                            cam_state["status"]["frame_class_count"]["Other"] += 1

                        if timer['current_class'] == label:
                            timer['frame_count'] += 1
                            timer['miss'] = 0
                        else:

                            timer['miss'] += 1

                            if timer['miss'] >= 5:
                                timer['current_class'] = label
                                timer['frame_count'] = 1
                                timer['miss'] = 0

                            
                        print(f"🔍 กล้องตัวที่ {int(camera_id) + 1} ID {track_id} Detect: {label} ({conf:.2f})")
                        print(f"{'-'*40}")
                        
                        # ถ้าคนเดินผ่านละไม่ใช่ id ที่ track ไว้ตามกล้อง กล้องจะไม่สนใจ id นั้น
                    elif track_id != -1 and track_id != cam_state["track_id"]:
                        print(f"🚫 กล้อง {int(camera_id) + 1} ไม่สนใจ ID {track_id} (กำลังจับ ID {cam_state['track_id']})")

                if not found_valid_detection:
                    cam_state['status']['frame_class_count']['Other'] += 1
                    print(f"😶 กล้อง {int(camera_id)+1}: ไม่เจอ object → บวก Other 1 เฟรม")

                # 🔹 แปลงเป็น JPEG และเก็บไว้
                ok, buf = cv2.imencode(".jpg", annotated)
                if ok:
                    cam_state["last_frame"] = buf.tobytes()

                print(f'วินาที่ที่ {cam_state['seconds']}')
                
                if now - last_check_time >= 1:
                    last_check_time = now
                    cam_state["seconds"] += 1

                    if timer['current_class'] is not None and timer['miss'] == 0:
                        timer['duration'] += 1

                    if cam_state['class_timer']['current_class'] == 'LookingAway':

                        count = timer['frame_count']
                        duration = timer['duration']
                        if duration >= 15.0:
                            print(f"⚠️ กล้อง {int(camera_id) + 1}: LookingAway {cam_state['class_timer']['frame_count']} เฟรม ({cam_state['class_timer']['duration']:.1f} วิ) → เปลี่ยนเป็น Look at the board")
                            cam_state['status']['frame_class_count']['LookingAway'] = max(
                                0,
                                cam_state['status']['frame_class_count']['LookingAway'] - count
                            )
                            cam_state['status']['frame_class_count']['Looking_at_the_board'] += count

                            timer["current_class"] = None
                            timer["duration"] = 0.0
                            timer["frame_count"] = 0
                            timer["miss"] = 3     
                    
                        elif 10.0 <= duration < 15.0 :
                            print(f"⚠️ กล้อง {int(camera_id) + 1}: LookingAway {cam_state['class_timer']['frame_count']} เฟรม ({cam_state['class_timer']['duration']:.1f} วิ) → เปลี่ยนเป็น Taking Notes")
                            
                            cam_state['status']['frame_class_count']['LookingAway'] = max(
                                0,
                                cam_state['status']['frame_class_count']['LookingAway'] - count
                            )

                            cam_state['status']['frame_class_count']['Taking_notes'] += count
                            
                            timer["current_class"] = None
                            timer["duration"] = 0.0
                            timer["frame_count"] = 0
                            timer["miss"] = 3                        
                       
                    if cam_state["seconds"] >= 30:
                        class_result_json = {}
                        print_lines = {
                            "att": [],
                            "non": [],
                            "oth": []
                        }
                        
                        attendence_sum = 0
                        non_attendence_sum = 0
                        other_sum = 0
                        
                        total_frame = sum(cam_state['status']['frame_class_count'].values())

                        for k, v in cam_state['status']['frame_class_count'].items():
                            ratio = 0.0
                            if total_frame > 0:
                                ratio = v / total_frame

                            class_result_json[k] = round(ratio, 3)

                            line_to_print = f"\t*{k:<25} : {v:>5}"
                            if k in ATTENDENCE:
                                print_lines["att"].append(line_to_print)
                                attendence_sum += v
                            elif k in NON_ATTENDENCE:
                                print_lines["non"].append(line_to_print)
                                non_attendence_sum += v
                            else:
                                print_lines['oth'].append(line_to_print)
                                other_sum += v

                        result_attendence = attendence_sum / total_frame
                        result_non_attendence = non_attendence_sum / total_frame
                        result_other = other_sum / total_frame

                        print(f"{'*'*3}|{'='*50}|{'*'*3}")
                        print(f"รหัสอาจารย์ {cam_state['teacher_id']} 📸 กล้อง {int(camera_id) + 1} ID {cam_state['track_id']} ครบ {cam_state['seconds']} วิ - รวม {total_frame} เฟรม\n")
                        print("🎯 สิ่งที่ตรวจจับเจอของแต่ละ Class\n")

                        print("🟢 ตั้งใจเรียน (ATTENDENCE):")
                        for line in print_lines["att"]: print(line)
                        
                        print("\n🔴 ไม่ตั้งใจเรียน (NON_ATTENDENCE):")
                        for line in print_lines["non"]: print(line)
                        
                        print("\n⚪ อื่น ๆ (OTHER):")
                        for line in print_lines["oth"]: print(line)
                        
                        print(f"ตั้งใจ {result_attendence:.2f}")
                        print(f"ไม่ตั้งใจ {result_non_attendence:.2f}")
                        print(f"อื่นๆ {result_other:.2f}")
                        print(f"{'*'*3}|{'='*50}|{'*'*3}")

                        supabase_client.table("camera_logs").insert({
                            "camera_id":int(camera_id) + 1,
                            "track_id":cam_state['track_id'],
                            "teacher_id":cam_state['teacher_id'],
                            "Attention":round(result_attendence, 3),
                            "Non_Attention":round(result_non_attendence, 3),
                            "Other":round(result_other, 3),
                            "class_json": class_result_json
                        }).execute()

                        cam_state["show_class"] = {
                            "CameraId": int(camera_id) + 1,
                            "ID": cam_state["track_id"],
                            "Time": datetime.now().strftime("%H:%M:%S"),
                            "image": base64.b64encode(cam_state['last_frame']).decode('utf-8')
                        }

                        cam_state.get("summary_ready_event").set()
                        # reset count sum เป็น 0 เพื่อคำนวณใหม่
                        for k in cam_state["status"]["frame_class_count"]:
                            cam_state["status"]["frame_class_count"][k] = 0
                        cam_state["seconds"] = 0
                    
                await asyncio.sleep(0.016) # ~60 fps

            print(f"🛑 stop detect on camera {int(camera_id) + 1}")
            cam_state["detecting"] = False

        except asyncio.CancelledError:
            print(f"⚠️ camera_loop cancelled for {int(camera_id) + 1}")
            cam_state["detecting"] = False
            cam_state["running"] = False

            cap = cam_state.get("cap")
            if cap and cap.isOpened():
                cap.release()
            return
        
    except asyncio.CancelledError:
        print(f"⚠️ ฟังก์ชั่น [camera_loop] มีปัญหา")
        return
    
# ✅ เปิดกล้องทั้งหมดพร้อมกัน
@camera_router.get("/open-all")
async def open_all_cameras(user=Depends(verify_token)):

    teacher = (
        supabase_client
        .table("teacher")
        .select("teacher_id")
        .eq("id", user["id"])
        .execute()
    )

    teacher_id = None
    if teacher.data:
        teacher_id = teacher.data[0]["teacher_id"]

    if not available_cameras and not is_scanning:
        await async_scan_cameras() # ให้ตัวสแกนกล้องทำงานอยู่เบื้องหลังจะได้ไม่ชนกับ process อื่นๆ
        return {"status": "scanning"}
    elif is_scanning:
        return {"status": "already scanning"}
    for cam in available_cameras: # ใช้ loop เพื่อหาจำนวนกล้องที่เชื่อมต่อได้
        camera_id = str(cam["id"])
        if camera_id not in cameras:
            try:
                open_camera_instance(camera_id, teacher_id=teacher_id) # ถ้าเจอกล้องแล้วจะให้เปิดกล้องและทำการใช้ state ที่สร้างขึ้นใน func นี้
            except Exception as e:
                print(f"❌ ข้อผิดพลาดเปิดกล้องตัวที่ {int(camera_id) + 1}: {e}")
    return {"message": f"{len(available_cameras)} cameras opened", "teacher_id": teacher}

# ✅ เริ่มตรวจจับ YOLO ทีละกล้อง
@camera_router.get("/start-detect/{camera_id}")
async def start_detect(camera_id: str):
    cam_state = cameras.get(camera_id)
    # เช็คว่าเจอกล้องที่เชื่อมต่อไหมหรือกำลังเปิดอยู่ไหม
    if not cam_state or not cam_state.get("running"):
        raise HTTPException(status_code=404, detail="Camera not found or not opened")
    # ถ้ากำลังเปิดอยู่จะแจ้งเตือน
    if cam_state.get("detecting"):
        return {"message": f"กล้อง {int(camera_id) + 1} กำลังตรวจจับอยู่"}
    # เปลี่ยน state ของ detecting เป้น true เพื่อให้เริ่มการตรวจจับ
    cam_state["detecting"] = True
    task = asyncio.create_task(camera_loop(camera_id))
    cam_state["task"] = task
    return {"message": f"Async detection started on camera {int(camera_id) + 1}"}

@camera_router.get("/start-all")
async def start_all_detections(user = Depends(verify_token)):
    started = []
    teacher_result = supabase_client.table('teacher').select('teacher_id').eq('id', user['id']).execute()
    
    teacher_id = None
    if teacher_result.data and len(teacher_result.data) > 0:
        teacher_id = teacher_result.data[0]['teacher_id']
        print(f"[/start-all] รหัสอาจารย์ {teacher_id}")
    else:
        print(f"[/start-all] ไม่พบรหัสอาจารย์ {teacher_id}")
    # วนลูปกล้องทั้งหมดที่มี
    for cam_id, cam_state in cameras.items():
        # เช็คว่ากล้องเปิดอยู่ (running) และ ยังไม่ได้ตรวจจับ (not detecting)
        if cam_state.get("running") and not cam_state.get("detecting"):
            
            cam_state["detecting"] = True
            task = asyncio.create_task(camera_loop(cam_id))
            cam_state["task"] = task
            started.append(cam_id)
            
    print(f"🚀 Started detection for cameras: {started}")
    return {"message": f"Started {len(started)} cameras", "started": started}

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
        return {"message": f"กล้องตัวที่ {int(camera_id) + 1} ปิดอยู่แล้ว"}

    cam_state["detecting"] = False
    cam_state["running"] = False
    cam_state["track_id"] = None

    cap = cam_state.get("cap")
    if cap and cap.isOpened():
        cap.release()

    cameras.pop(camera_id, None)
    print(f"🧹 กล้องตัวที่ {int(camera_id) + 1} ปิด")
    return {"message": f"กล้องตัวที่ {int(camera_id) + 1} ปิด"}

# ✅ ปิดกล้องทั้งหมด
@camera_router.get("/close-all")
async def close_all_cameras():
    tasks_to_cancel = []

    for _, cam_state in list(cameras.items()):
        cam_state["detecting"] = False
        cam_state["running"] = False
        cam_state["track_id"] = None

        task = cam_state.get("task")
        if task and not task.done():
            task.cancel()
            tasks_to_cancel.append(task)

    # ✅ รอทุก task ปิดให้หมดก่อน
    if tasks_to_cancel:
        await asyncio.gather(*tasks_to_cancel, return_exceptions=True)

    # ✅ cleanup กล้อง
    for _, cam_state in list(cameras.items()):
        cap = cam_state.get("cap")
        if cap and cap.isOpened():
            cap.release()

    cameras.clear()

    print("🧹 All cameras closed successfully.")
    return {"message": "All cameras closed"}

# ✅ แสดงรายการกล้อง
@camera_router.get("/list-camera")
async def check_list_camera(user=Depends(verify_token)):
    global available_cameras, last_scan_time
    now = time.time()
    teacher_result = supabase_client.table('teacher').select('teacher_id').eq('id', user['id']).execute()

    teacher_id = None
    if teacher_result.data and len(teacher_result.data) > 0:
        teacher_id = teacher_result.data[0]['teacher_id']
        print(f"รหัสอาจารย์ {teacher_id}")
    else:
        print(f"ไม่พบรหัสอาจารย์ {teacher_id}")

    if is_scanning:
        print("⏳ Skip scanning, already in progress")
        return {"status": "scanning", "cameras": available_cameras}
    
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
    print(f"📡 Client connected for camera {int(camera_id) + 1}")
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
        cam_state = create_camera_state(cap)
        cameras[camera_id] = cam_state
    try:
        while True: # จะให้ส่งภาพที่ bounding box แบบ real time ตลอดและกำหนด fps ที่ 30 
            ret, frame = cap.read()
            if not ret:
                await websocket.send_text("error: cannot read frame")
                break

            results = model.track(source=frame, conf=0.2, device="cpu", verbose=False, tracker="bytetrack.yaml")
            annotated = results[0].plot()

            for box in results[0].boxes:
                track_id = int(box.id) if box.id is not None else -1

                # เพิ่มการตรวจสอบว่าถ้าไม่มีใครในกล้องให้ track id คนนั้นเป็นคนแรก
                if "track_id" not in cam_state or cam_state["track_id"] is None:
                    cam_state["track_id"] = track_id
            ok, buffer = cv2.imencode(".jpg", annotated)
            if ok:
                cam_state["last_frame"] = buffer.tobytes()
            jpg_as_text = base64.b64encode(buffer).decode("utf-8")
            await websocket.send_text(jpg_as_text)

            await asyncio.sleep(0.016)  # ~60 fps

    except WebSocketDisconnect:
        print(f"❌ WS disconnected for camera {int(camera_id) + 1}")

    finally:
        try:
            if not websocket.client_state.name == "CLOSED":
                await websocket.close()
        except Exception as e:
            print(f"🧹 WS stream for camera {int(camera_id) + 1} ended")
        print(f"🧹 WS stream for camera {int(camera_id) + 1} ended")

# WebSocket ส่งภาพที่วินาที 30 วิ ไปแสดงผล
@camera_router.websocket("/ws/camera/summary/{camera_id}")
async def camera_summary(websocket: WebSocket, camera_id: str):
    await websocket.accept()
    cam_state = cameras.get(camera_id)

    if cam_state is None:
        print(f"❌ หา State ของกล้องไม่เจอ (กล้อง {int(camera_id) + 1})")
        # ปิดแค่ครั้งเดียว
        return
    summary_event = cam_state.get("summary_ready_event")
    try:
        print(f"📡 Summary WS started for camera {int(camera_id) + 1}")
        while cam_state.get("running") and cam_state.get("detecting"):

            await summary_event.wait()

            payload = cam_state.get("show_class", {}).copy() or {}
            if not payload:
                payload = {
                    "CameraId": int(camera_id) + 1,
                    "Time": datetime.now().strftime("%H:%M:%S")
                }

            # 🔹 ถ้ามี image เป็น bytes → แปลง base64
            if "image" in payload and isinstance(payload["image"], (bytes, bytearray)):
                payload["image"] = base64.b64encode(payload["image"]).decode("utf-8")

            try:
                await websocket.send_json(payload)
            except RuntimeError:
                # ถ้า WS ปิดไปแล้ว ไม่ต้องส่งซ้ำ
                print(f"⚠️ Summary WS: Attempted send after close (camera {int(camera_id) + 1})")
                break
            except WebSocketDisconnect:
                print(f"🔌 Summary WS disconnected (camera {int(camera_id) + 1})")
                break

            summary_event.clear()

    except WebSocketDisconnect:
        print(f"🔌 WebSocket disconnected normally (camera {int(camera_id) + 1})")

    except Exception as e:
        print(f"❗ Summary WS error (camera {int(camera_id) + 1}): {e}")

    finally:
        # ✅ ป้องกัน double-close
        if not websocket.client_state.name == "DISCONNECTED":
            await websocket.close(code=1000)
        print(f"🛑 Summary WS closed (camera {int(camera_id) + 1})")