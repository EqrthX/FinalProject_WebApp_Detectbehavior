from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends
import cv2
import time
import base64
import asyncio
from datetime import datetime
from utils.camera_helper import create_camera_state, define_LOW_CLASS, define_HIGH_CLASS, calculate_1s, calculate_30s
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
scan_lock = asyncio.Lock()  # lock กัน async call ซ้ำเวลา scan กล้อง

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
def open_camera_instance(camera_id: str, teacher_id=None, subject_id=None):
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
    cameras[camera_id] = create_camera_state(cap, teacher_id=teacher_id, subject_id=subject_id)
    print(f"✅ Camera {int(camera_id) + 1} เปิด รหัสอาจารย์ {teacher_id} จับวิชา {subject_id}")

# ใช้กับ endpoint start-detect เมื่อเวลาเรียก api เส้นนี้จะทำการตรวจจับจาก webcam แล้วก็ให้มีการคำนวน
async def camera_loop(camera_id: str):
    loop = asyncio.get_event_loop()
    try:
        cam_state = cameras.get(camera_id)
        if not cam_state:
            print(f"❌ camera_loop: {int(camera_id) + 1} ไม่เจอ")
            return

        cap = cam_state.get("cap")
        if cap is None or not cap.isOpened():
            print(f"❌ camera_loop: cap invalid for {int(camera_id) + 1}")
            async with cam_state["lock"]:
                cam_state["detecting"] = False
            return

        print(f"🧠 start detect on camera {int(camera_id) + 1}")

        try:
            # เงื่อนต้องเปิดกล้อง และ กำลังตรวจจับ
            while True:
                # เช็คว่ายังรันอยู่ไหม / cap ยังใช้ได้ไหม
                cam_state = cameras.get(camera_id)
                if not cam_state:
                    break

                async with cam_state["lock"]:
                    running = cam_state.get("running")
                    detecting = cam_state.get("detecting")
                    cap = cam_state.get("cap")

                if not running or not detecting or cap is None or not cap.isOpened():
                    break

                # อ่านเฟรมจากกล้อง (ไม่ต้องล็อก)
                ret, frame = cap.read()
                if not ret:
                    print(f"⚠️ อ่านเฟรมไม่สำเร็จ → หยุดกล้อง {int(camera_id)+1}")
                    cam_state = cameras.get(camera_id)
                    if cam_state:
                        async with cam_state["lock"]:
                            cam_state["detecting"] = False
                    break

                results = await loop.run_in_executor(
                    None,
                    lambda: model.track(
                        source=frame,
                        conf=0.4,
                        device="cuda", #เปลี่ยนเป็น cpu
                        verbose=False,
                        tracker="bytetrack.yaml"
                    )
                )

                annotated = results[0].plot()
                now = time.time()

                # ------------- จัดการผล detect ของ YOLO -------------
                cam_state = cameras.get(camera_id)
                if not cam_state:
                    break

                # อ่านค่าเป้าหมาย track_id ปัจจุบัน
                target_track_id = cam_state.get("track_id")
                timer = cam_state["class_timer"]  # อ้างอิงไว้ใช้งานได้เลย (dict shared)

                found_valid_detection = False
                timer = cam_state['class_timer']

                for box in results[0].boxes:
                    cls = int(box.cls)
                    conf = float(box.conf.item())
                    label = model.names[cls]
                    track_id = int(box.id) if box.id is not None else -1

                    # เช็คว่า track id ตรงกับ state track_id ไหม
                    if track_id == target_track_id:
                        found_valid_detection = True

                        async with cam_state["lock"]:
                            timer = cam_state["class_timer"]
                            status = cam_state["status"]

                            if timer["current_class"] is None:
                                timer["current_class"] = label
                                timer["frame_count"] = 1
                                timer["duration"] = 0
                                timer["miss"] = 0
                            else:
                                if timer["current_class"] == label:
                                    timer["frame_count"] += 1
                                    timer["miss"] = 0
                                else:
                                    timer["miss"] += 1
                                    if timer["miss"] >= 5:
                                        timer["current_class"] = label
                                        timer["frame_count"] = 1
                                        timer["miss"] = 0

                            if label in ATTENDENCE:
                                status["frame_class_count"][label] += 1
                            elif label in NON_ATTENDENCE:
                                status["frame_class_count"][label] += 1
                            else:
                                status["frame_class_count"]["Other"] += 1

                        break
                    # ถ้าคนเดินผ่านละไม่ใช่ id ที่ track ไว้ตามกล้อง กล้องจะไม่สนใจ id นั้น
                    elif track_id != -1 and track_id != target_track_id:
                        print(f"🚫 กล้อง {int(camera_id) + 1} ไม่สนใจ ID {track_id} (กำลังจับ ID {target_track_id})")

                if not found_valid_detection:
                    print(f"😶 กล้อง {int(camera_id)+1}: ไม่เจอ object ")

                    cam_state = cameras.get(camera_id)
                    if cam_state:
                        async with cam_state["lock"]:
                            timer = cam_state["class_timer"]
                            timer["miss"] += 1

                            if timer["miss"] >= 3:
                                timer["current_class"] = None
                                timer["frame_count"] = 0
                                timer["duration"] = 0

                # 🔹 แปลงเป็น JPEG และเก็บไว้
                ok, buf = cv2.imencode(".jpg", annotated)
                if ok:
                    cam_state = cameras.get(camera_id)
                    if cam_state:
                        async with cam_state["lock"]:
                            cam_state["last_frame"] = buf.tobytes()

                insert_payload = None

                cam_state = cameras.get(camera_id)
                if not cam_state:
                    break

                async with cam_state["lock"]:
                    timer = cam_state["class_timer"]

                    # ถ้าครบ interval (เช่น 5 วิ) จะเข้ามาทำงาน Block นี้
                    if now - cam_state["last_interval_time"] >= cam_state["interval_seconds"]:
                        cam_state["last_interval_time"] = now
                        cam_state["interval_count"] += 1

                        current_interval_class = timer["current_class"]
                        if timer["current_class"] is not None and timer["miss"] == 0:
                            interval_sec = cam_state.get("interval_seconds", 5)
                            timer["duration"] += interval_sec

                        mapped_class = current_interval_class
                        if current_interval_class == "LookingAway":
                            duration_sec = timer.get("duration", 0)
                            if duration_sec < 3:
                                mapped_class = "LookingAway"
                            elif duration_sec < 15:
                                mapped_class = "Looking_at_the_board"
                            else:
                                mapped_class = "Taking_notes"

                        cam_state["interval_results"].append(
                            mapped_class if mapped_class is not None else "Other"
                        )

                        print(
                            f"⏱️ กล้อง {int(camera_id) + 1} รอบที่ {cam_state['interval_count']} : "
                            f"{current_interval_class} -> ใช้จริง: {mapped_class} (duration={timer.get('duration', 0)}s)"
                        )

                    if cam_state["interval_count"] >= cam_state["max_intervals"]:
                        subject_id = cam_state.get("subject_id")
                        interval_count = {}
                        for cls_label in cam_state["interval_results"]:
                            key = cls_label if cls_label is not None else "Other"
                            interval_count[key] = interval_count.get(key, 0) + 1

                        print(f"cam_state['interval_results'] {cam_state['interval_results']}")
                        total_intervals = len(cam_state["interval_results"]) or 1

                        att_sum = sum(
                            c for label, c in interval_count.items()
                            if label in ATTENDENCE
                        )

                        non_sum = sum(
                            c for label, c in interval_count.items()
                            if label in NON_ATTENDENCE
                        )

                        other_sum = total_intervals - att_sum - non_sum

                        result_attendence = att_sum / total_intervals
                        result_non_attendence = non_sum / total_intervals
                        result_other = other_sum / total_intervals

                        print(f"ตั้งใจ {result_attendence:.2f}")
                        print(f"ไม่ตั้งใจ {result_non_attendence:.2f}")
                        print(f"อื่นๆ {result_other:.2f}")
                        print(f"จำนวนที่เจอใน {cam_state['max_intervals']}")
                        print(interval_count)

                        class_result_json = {
                            label: round(count / total_intervals, 3)
                            for label, count in interval_count.items()
                        }

                        insert_payload = {
                            "camera_id": int(camera_id) + 1,
                            "track_id": cam_state["track_id"],
                            "teacher_id": cam_state["teacher_id"],
                            "Attention": round(result_attendence, 3),
                            "Non_Attention": round(result_non_attendence, 3),
                            "Other": round(result_other, 3),
                            "class_json": class_result_json,
                            "subject_id": subject_id,
                        }

                        # reset state สำหรับรอบถัดไป
                        cam_state["interval_count"] = 0
                        cam_state["interval_results"] = []

                        for k in cam_state["status"]["frame_class_count"]:
                            cam_state["status"]["frame_class_count"][k] = 0

                        timer["frame_count"] = 0
                        timer["duration"] = 0.0
                        timer["miss"] = 0

                if insert_payload is not None:
                    await loop.run_in_executor(
                        None,
                        lambda: supabase_client
                        .table("camera_logs")
                        .insert(insert_payload)
                        .execute()
                    )

                await asyncio.sleep(0.25)  # ~60 fps

            print(f"🛑 stop detect on camera {int(camera_id) + 1}")
            cam_state = cameras.get(camera_id)
            if cam_state:
                async with cam_state["lock"]:
                    cam_state["detecting"] = False

        except asyncio.CancelledError:
            print(f"⚠️ camera_loop cancelled for {int(camera_id) + 1}")
            cam_state = cameras.get(camera_id)
            if cam_state:
                async with cam_state["lock"]:
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
async def open_all_cameras(subjectId: str, user=Depends(verify_token)):

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
        await async_scan_cameras()  # ให้ตัวสแกนกล้องทำงานอยู่เบื้องหลังจะได้ไม่ชนกับ process อื่นๆ
        return {"status": "scanning"}
    elif is_scanning:
        return {"status": "already scanning"}

    for cam in available_cameras:  # ใช้ loop เพื่อหาจำนวนกล้องที่เชื่อมต่อได้
        camera_id = str(cam["id"])
        if camera_id not in cameras:
            try:
                open_camera_instance(camera_id, teacher_id=teacher_id, subject_id=subjectId)
            except Exception as e:
                print(f"❌ ข้อผิดพลาดเปิดกล้องตัวที่ {int(camera_id) + 1}: {e}")
    return {"message": f"{len(available_cameras)} cameras opened", "teacher_id": teacher}

# ✅ เริ่มตรวจจับ YOLO ทีละกล้อง
@camera_router.get("/start-detect/{camera_id}")
async def start_detect(camera_id: str):
    cam_state = cameras.get(camera_id)
    if not cam_state or not cam_state.get("running"):
        raise HTTPException(status_code=404, detail="ไม่เจอกล้องหรือไม่สามารถเปิดกล้องได้")

    async with cam_state["lock"]:
        if cam_state.get("detecting"):
            return {"message": f"กล้อง {int(camera_id) + 1} กำลังตรวจจับอยู่"}

        cam_state["detecting"] = True
        task = asyncio.create_task(camera_loop(camera_id))
        cam_state["task"] = task

    return {"message": f"Async detection started on camera {int(camera_id) + 1}"}

@camera_router.get("/start-all")
async def start_all_detections(user=Depends(verify_token)):
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
        if not cam_state.get("running"):
            continue

        async with cam_state["lock"]:
            if not cam_state.get("detecting"):
                cam_state["detecting"] = True
                task = asyncio.create_task(camera_loop(cam_id))
                cam_state["task"] = task
                started.append(cam_id)

    print(f"🚀 Started detection for cameras: {started}")
    return {"message": f"เริ่มตรวจจับ {len(started)} กล้อง", "started": started}

# endpoint ที่หยุดการทำงาน
@camera_router.get("/stop-all")
async def stop_all_detections():

    stopped = []
    for cam_id, cam_state in cameras.items():
        async with cam_state["lock"]:
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

    async with cam_state["lock"]:
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

    # ปิด flag และ cancel task
    for _, cam_state in list(cameras.items()):
        async with cam_state["lock"]:
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

    print("🧹 ปิดกล้องทั้งหมดสำเร็จ")
    return {"message": "ปิดกล้องทั้งหมด"}

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

    if not available_cameras or (now - last_scan_time > 10):
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

    if cap is None:
        cap = cv2.VideoCapture(int(camera_id), cv2.CAP_MSMF)
        if not cap.isOpened():
            await websocket.send_text("error: cannot open camera")
            await websocket.close()
            return

        cam_state = create_camera_state(cap)
        cameras[camera_id] = cam_state

    try:
        while True:  # จะให้ส่งภาพที่ bounding box แบบ real time ตลอดและกำหนด fps ที่ 30
            ret, frame = cap.read()
            if not ret:
                await websocket.send_text("error: cannot read frame")
                break

            results = model.predict(source=frame, conf=0.2, device="cuda", verbose=False)
            annotated = results[0].plot()

            cam_state = cameras.get(camera_id)
            if not cam_state:
                break

            ok, buffer = cv2.imencode(".jpg", annotated)
            if ok:
                cam_state["last_frame"] = buffer.tobytes()

            jpg_as_text = base64.b64encode(cam_state["last_frame"]).decode("utf-8")
            await websocket.send_text(jpg_as_text)

            await asyncio.sleep(0.05)  # ~30 fps

    except WebSocketDisconnect:
        print(f"❌ WS หยุดการเชื่อมต่อกล้อง {int(camera_id) + 1}")
    finally:
        try:
            if not websocket.client_state.name == "CLOSED":
                await websocket.close()
        except Exception:
            pass
        print(f"🧹 WS stream for camera {int(camera_id) + 1} ended")

# WebSocket ส่งภาพที่วินาที 30 วิ ไปแสดงผล
@camera_router.websocket("/ws/camera/summary/{camera_id}")
async def camera_summary(websocket: WebSocket, camera_id: str):
    await websocket.accept()

    cam_state = cameras.get(camera_id)

    if cam_state is None:
        print(f"❌ หา State ของกล้องไม่เจอ (กล้อง {int(camera_id) + 1})")
        await websocket.close()
        return

    try:
        print(f"📡 Summary WS started for camera {int(camera_id) + 1}")
        while True:
            cam_state = cameras.get(camera_id)
            if not cam_state:
                break

            async with cam_state["lock"]:
                running = cam_state.get("running")
                detecting = cam_state.get("detecting")
                summary_event = cam_state.get("summary_ready_event")

            if not running or not detecting:
                break

            if summary_event is None:
                await asyncio.sleep(0.5)
                continue

            await summary_event.wait()

            cam_state = cameras.get(camera_id)
            if not cam_state:
                break

            async with cam_state["lock"]:
                payload = cam_state.get("show_class", {}).copy() or {
                    "CameraId": int(camera_id) + 1,
                    "Time": datetime.now().strftime("%H:%M:%S"),
                }

                # 🔹 ถ้ามี image เป็น bytes → แปลง base64
                if "image" in payload and isinstance(payload["image"], (bytes, bytearray)):
                    payload["image"] = base64.b64encode(payload["image"]).decode("utf-8")

                # เคลียร์ event สำหรับรอรอบถัดไป
                if cam_state.get("summary_ready_event"):
                    cam_state["summary_ready_event"].clear()

            try:
                await websocket.send_json(payload)
            except RuntimeError:
                print(f"⚠️ Summary WS: Attempted send after close (camera {int(camera_id) + 1})")
                break
            except WebSocketDisconnect:
                print(f"🔌 Summary WS disconnected (camera {int(camera_id) + 1})")
                break

    except WebSocketDisconnect:
        print(f"🔌 WebSocket disconnected normally (camera {int(camera_id) + 1})")
    except Exception as e:
        print(f"❗ Summary WS error (camera {int(camera_id) + 1}): {e}")
    finally:
        if not websocket.client_state.name == "DISCONNECTED":
            await websocket.close(code=1000)
        print(f"🛑 Summary WS closed (camera {int(camera_id) + 1})")