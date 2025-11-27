from fastapi import (
    APIRouter,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Depends,
)
import cv2
import time
import base64
import asyncio
from datetime import datetime
from utils.camera_helper import (
    create_camera_state,
    define_LOW_CLASS,
    define_HIGH_CLASS,
)
from utils.model_loader import get_model
from utils.auth import verify_token
from config.bn_supabase import supabase_client
from utils.json_buffer import (
    save_buffer,
    load_buffer,
    clear_buffer,
)
from collections import defaultdict

camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

model = get_model()

# -------------------- Global States --------------------
cameras: dict[str, dict] = {}  # state ต่อกล้อง
available_cameras: list[dict] = []  # list กล้องที่ scan เจอ
last_scan_time: float = 0
backends_cameras = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
is_scanning = False
scan_lock = asyncio.Lock()  # lock กัน scan ซ้อน

ATTENDENCE = define_HIGH_CLASS()
NON_ATTENDENCE = define_LOW_CLASS()


# -------------------- Helper Functions (Run in Executor) --------------------
def read_frame_sync(cap):
    """อ่านภาพจากกล้องแบบ Blocking (รันใน Thread)"""
    return cap.read()

def process_plot_and_encode(result_object):
    """วาด Bounding Box และแปลงเป็น JPG (รันใน Thread)"""
    annotated = result_object.plot()
    ok, buf = cv2.imencode(".jpg", annotated)
    if ok:
        return buf.tobytes()
    return None

def encode_frame_sync(frame):
    """แปลงภาพ Raw เป็น JPG (รันใน Thread)"""
    ok, buf = cv2.imencode(".jpg", frame)
    if ok:
        return buf.tobytes()
    return None


# -------------------- Helper: เปิดกล้องด้วย backend ที่ใช้ได้ --------------------
def open_camera_with_backends(index: int):
    """
    พยายามเปิดกล้องตาม backend ที่เคย scan เจอ
    ถ้าเปิดไม่ได้ให้ลอง fallback ด้วย backends_cameras
    """
    # 1) ถ้าเคยสแกนเจอ backend ที่ใช้ได้ → ใช้ตัวนั้นก่อน
    for cam in available_cameras:
        if cam["id"] == index:
            backend = cam.get("backend_camera", cv2.CAP_ANY)
            cap = cv2.VideoCapture(index, backend)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                cap.set(cv2.CAP_PROP_FPS, 60) # บังคับที่กล้องเลย
                print(f"🎥 เปิดกล้อง {index} ด้วย backend จาก scan = {backend}")
                return cap
            cap.release()
            print(f"⚠️ backend จาก scan ใช้ไม่ได้ index={index}, backend={backend}")
            break

    # 2) fallback ลองทุก backend
    for backend in backends_cameras:
        cap = cv2.VideoCapture(index, backend)
        if cap.isOpened():
            print(f"🎥 เปิดกล้อง {index} ด้วย backend fallback = {backend}")
            return cap
        cap.release()

    print(f"❌ open_camera_with_backends: เปิดกล้อง index={index} ไม่ได้ทุก backend")
    return None


# -------------------- Scan กล้อง --------------------
async def async_scan_cameras():
    global available_cameras, is_scanning, last_scan_time

    async with scan_lock:
        if is_scanning:
            print("⏳ Scan already running, skip this call")
            return

        is_scanning = True
        print("🔍 Start scanning cameras...")

        found: list[dict] = []
        try:
            # ลอง 0-9
            for i in range(10):
                await asyncio.sleep(0)
                for backend in backends_cameras:
                    cap = cv2.VideoCapture(i, backend)
                    if cap.isOpened():
                        print(f"✅ กล้องตัวที่ {i + 1} found with backend {backend}")
                        found.append(
                            {
                                "id": i,
                                "name": f"กล้องตัวที่ {i+1}",
                                "backend_camera": backend,
                            }
                        )
                        cap.release()
                        break
                    cap.release()

            available_cameras = found
            last_scan_time = time.time()
            print(f"📷 กล้องทั้งหมดที่ตรวจพบ: {len(found)} ตัว")
        finally:
            is_scanning = False


# -------------------- เปิดกล้องเดี่ยว (ถ้าอยากใช้ผ่าน HTTP) --------------------
def open_camera_instance(camera_id: str, teacher_id=None, subject_id=None):
    source = int(camera_id)
    cap = open_camera_with_backends(source)
    if cap is None:
        raise HTTPException(
            status_code=500, detail=f"ไม่สามารถเปิดกล้อง {source + 1}"
        )

    cam_state = create_camera_state(
        cap, teacher_id=teacher_id, subject_id=subject_id
    )
    cameras[camera_id] = cam_state
    load_buffer(camera_id=camera_id)

    # ตั้งค่าเริ่มต้นสำหรับ loop
    cam_state["running"] = True
    cam_state["detecting"] = False
    cam_state["task"] = asyncio.create_task(camera_loop(camera_id))

    print(
        f"✅ Camera {source + 1} เปิด รหัสอาจารย์ {teacher_id} จับวิชา {subject_id}"
    )


# -------------------- Loop YOLO ต่อกล้อง --------------------
async def camera_loop(camera_id: str):
    """
    Loop หลักสำหรับอ่านกล้องและประมวลผล
    - เป็น Producer เดียวที่อ่านภาพจากกล้อง (cap.read)
    - ใช้ Thread Executor เพื่อไม่ให้ Block Main Loop (แก้ปัญหากล้องค้าง)
    """
    loop = asyncio.get_event_loop()
    FRAME_INTERVAL = 1 / 60  # target ~30 fps ต่อกล้อง
    last_time = time.perf_counter()

    try:
        while True:
            cam_state = cameras.get(camera_id)
            if not cam_state:
                print(f"❌ camera_loop: state ของกล้อง {int(camera_id)+1} หาย")
                break

            async with cam_state["lock"]:
                running = cam_state.get("running", False)
                detecting = cam_state.get("detecting", False)
                cap = cam_state.get("cap")

            if not running:
                print(f"⏹ camera_loop stop: running=False cam {int(camera_id)+1}")
                break

            if cap is None or not cap.isOpened():
                print(f"❌ camera_loop: cap invalid for {int(camera_id) + 1}")
                async with cam_state["lock"]:
                    cam_state["detecting"] = False
                break

            # --- [Fix] อ่านเฟรมจากกล้องผ่าน Thread Executor ---
            ret, frame = await loop.run_in_executor(None, read_frame_sync, cap)
            
            if not ret:
                print(f"⚠️ อ่านเฟรมไม่สำเร็จ → หยุดกล้อง {int(camera_id)+1}")
                async with cam_state["lock"]:
                    cam_state["detecting"] = False
                    cam_state["running"] = False
                break

            now = time.time()
            jpg_bytes = None

            # -------------------- YOLO + logic เฉพาะตอน detecting=True --------------------
            if detecting:
                # รัน YOLO ใน thread แยก (CPU)
                results = await loop.run_in_executor(
                    None,
                    lambda: model.track(
                        source=frame,
                        conf=0.45,
                        device="cpu", # หรือ 'cuda' ถ้ามี GPU
                        verbose=False,
                        tracker="bytetrack.yaml",
                    ),
                )

                # --- [Fix] Plot & Encode ใน Thread Executor ---
                jpg_bytes = await loop.run_in_executor(
                    None, 
                    process_plot_and_encode, 
                    results[0]
                )

                cam_state = cameras.get(camera_id)
                if not cam_state:
                    break

                target_track_id = cam_state.get("track_id")
                timer = cam_state["class_timer"]
                found_valid_detection = False

                last_best_class = cam_state.get("last_best_class", None)
                last_best_conf = cam_state.get("last_best_conf", 0.0)

                # ---------- ประมวลผลผลลัพธ์ YOLO ----------
                for box in results[0].boxes:
                    cls = int(box.cls)
                    conf = float(box.conf.item())
                    label = model.names[cls]
                    track_id = int(box.id) if box.id is not None else -1

                    async with cam_state["lock"]:
                        if conf > last_best_conf:
                            cam_state["last_best_class"] = label
                            cam_state["last_best_conf"] = conf
                            last_best_conf = conf

                    # ถ้ายังไม่มี track_id ให้เลือกตัวแรกที่เจอ
                    if cam_state["track_id"] is None and track_id != -1:
                        cam_state["track_id"] = track_id
                        timer["current_class"] = label
                        timer["miss"] = 0

                    # ใช้เฉพาะ track_id ที่กล้องนี้กำลังสนใจ
                    if track_id == target_track_id:
                        found_valid_detection = True
                        async with cam_state["lock"]:
                            timer = cam_state["class_timer"]

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
                                        timer["duration"] = 0
                                        timer["miss"] = 0
                        break

                    elif track_id != -1 and track_id != target_track_id:
                        # Log warning (optional)
                        pass

                # ถ้าไม่เจอ object ตาม track_id เลย
                if not found_valid_detection:
                    # print(f"😶 กล้อง {int(camera_id)+1}: ไม่เจอ object ")
                    cam_state = cameras.get(camera_id)
                    if cam_state:
                        async with cam_state["lock"]:
                            last_best_class = cam_state.get("last_best_class")
                            last_best_conf = cam_state.get("last_best_conf", 0.0)

                            if last_best_conf > 0.65:
                                timer["current_class"] = last_best_class
                            else:
                                timer["miss"] += 1
                                if timer["miss"] >= 3:
                                    timer["current_class"] = None
                                    timer["frame_count"] = 0
                                    timer["duration"] = 0

                # ---------- จัดการ interval (5 วิ / 1 นาที) ----------
                cam_state = cameras.get(camera_id)
                if not cam_state:
                    break

                async with cam_state["lock"]:
                    timer = cam_state["class_timer"]
                    interval_seconds = cam_state.get("interval_seconds", 5)

                    if now - cam_state["last_interval_time"] >= interval_seconds:
                        cam_state["last_interval_time"] = now
                        current_interval_class = timer["current_class"]
                        if timer["current_class"] is not None and timer["miss"] == 0:
                            timer["duration"] += interval_seconds

                        mapped_class = current_interval_class
                        if current_interval_class == "LookingAway":
                            duration_sec = timer.get("duration", 0)
                            if duration_sec <= 15:
                                mapped_class = "LookingAway"
                            elif duration_sec <= 35:
                                mapped_class = "Looking_at_the_board"
                            else:
                                mapped_class = "Taking_notes"

                        if mapped_class in ATTENDENCE or mapped_class in NON_ATTENDENCE:
                            cam_state["interval_results"].append(mapped_class)

                        if len(cam_state["interval_results"]) > cam_state["max_intervals"]:
                            cam_state["interval_results"] = cam_state["interval_results"][
                                : cam_state["max_intervals"]
                            ]

                        cam_state["interval_count"] = len(
                            cam_state["interval_results"]
                        )

                        print(
                            f"⏱️ กล้อง {int(camera_id) + 1} รอบที่ {cam_state['interval_count']} : "
                            f"{current_interval_class} -> ใช้จริง: {mapped_class} (duration={timer.get('duration', 0)}s)"
                        )

                    # ครบ 1 นาที (12 interval)
                    if cam_state["interval_count"] >= cam_state["max_intervals"]:
                        subject_id = cam_state.get("subject_id")
                        teacher_id = cam_state.get("teacher_id")
                        interval_count = {}
                        summary_payload = {
                            "CameraId": int(camera_id) + 1,
                            "Time": datetime.now().strftime("%H:%M:%S"),
                        }

                        if jpg_bytes:
                            summary_payload["image"] = jpg_bytes
                        
                        cam_state["show_class"] = summary_payload
                        # ensure summary_ready_event มี
                        if "summary_ready_event" not in cam_state:
                            cam_state["summary_ready_event"] = asyncio.Event()
                        cam_state["summary_ready_event"].set()

                        for cls_label in cam_state["interval_results"]:
                            interval_count[cls_label] = (
                                interval_count.get(cls_label, 0) + 1
                            )

                        print(
                            f"cam_state['interval_results']{camera_id} {cam_state['interval_results']}"
                        )
                        valid_total = len(cam_state["interval_results"]) or 1

                        att_sum = sum(
                            c
                            for label, c in interval_count.items()
                            if label in ATTENDENCE
                        )
                        non_sum = sum(
                            c
                            for label, c in interval_count.items()
                            if label in NON_ATTENDENCE
                        )

                        result_attendence = att_sum / valid_total
                        result_non_attendence = non_sum / valid_total

                        print(f"ตั้งใจ {result_attendence:.2f}")
                        print(f"ไม่ตั้งใจ {result_non_attendence:.2f}")
                        print(f"จำนวนที่เจอใน {cam_state['max_intervals']}")

                        class_result_json = {
                            label: round(count / valid_total, 3)
                            for label, count in interval_count.items()
                        }

                        try:
                            if teacher_id and subject_id:
                                save_buffer(
                                    camera_id=camera_id,
                                    cam_state=cam_state,
                                    ATT=result_attendence,
                                    NON=result_non_attendence,
                                    class_json=class_result_json,
                                    subject_id=subject_id,
                                )
                            else:
                                print(
                                    f"⚠️ ข้าม save_buffer เพราะ teacher_id/subject_id ว่าง (cam {camera_id})"
                                )
                        except Exception as e:
                            print(f"❌ save_buffer error cam {camera_id}: {e}")

                        # reset สำหรับรอบถัดไป
                        cam_state["last_best_class"] = None
                        cam_state["last_best_conf"] = 0.0
                        cam_state["interval_count"] = 0
                        cam_state["interval_results"] = []
                        cam_state["last_interval_time"] = now
                        timer["frame_count"] = 0
                        timer["duration"] = 0.0
                        timer["miss"] = 0
            
            else:
                # --- [Fix] กรณีไม่ Detect ก็ต้อง Encode ผ่าน Thread เหมือนกัน ---
                jpg_bytes = await loop.run_in_executor(None, encode_frame_sync, frame)

            # -------------------- update last_frame --------------------
            if jpg_bytes:
                cam_state = cameras.get(camera_id)
                if cam_state:
                    async with cam_state["lock"]:
                        cam_state["last_frame"] = jpg_bytes

            # === FPS Control ===
            end_time = time.perf_counter()
            elapsed = end_time - last_time
            remain = FRAME_INTERVAL - elapsed
            if remain > 0:
                await asyncio.sleep(remain)
            last_time = time.perf_counter()

        print(f"🛑 stop camera_loop on camera {int(camera_id) + 1}")
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


# -------------------- summary buffer → Supabase --------------------
@camera_router.get("/summary-to-supabase")
async def summary_to_supabase():
    all_summary_data = []
    try:
        for cam_id in list(cameras.keys()):
            summary = load_buffer(str(cam_id))
            if summary:
                all_summary_data.append(summary)
                clear_buffer(str(cam_id))

        if not all_summary_data:
            return {"message": "ไม่มีข้อมูลใน buffer"}

        insert_payload = []
        for summary in all_summary_data:
            camera_id = summary["camera_id"]
            teacher_id = summary["teacher_id"]
            subject_id = summary["subject_id"]
            subject_id = subject_id.strip()
            for record in summary["records"]:
                insert_payload.append(
                    {
                        "camera_id": camera_id,
                        "teacher_id": teacher_id,
                        "subject_id": subject_id,
                        "Attention": record["Attention"],
                        "Non_Attention": record["Non_Attention"],
                        "class_json": record["class_json"],
                        "created_at": record["created_at"],
                    }
                )

        if insert_payload:
            supabase_client.table("camera_logs").insert(insert_payload).execute()

        grops = defaultdict(list)

        for row in insert_payload:
            teacher_id = row["teacher_id"]
            subject_id = row["subject_id"]
            camera_id = row["camera_id"]

            dt = (
                row["created_at"]
                if isinstance(row["created_at"], datetime)
                else datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00"))
            )

            date_key = dt.date().isoformat()

            key = (teacher_id, subject_id, camera_id, date_key)
            grops[key].append(row)

        daily_rows = []

        for  (teacher_id, subject_id, camera_id, summary_date), rows in grops.items():
            total_att = 0.0
            total_non = 0.0
            count = len(rows)

            class_totals = defaultdict(float)

            for r in rows:
                att = float(r.get("Attention") or 0.0)
                non = float(r.get("Non_Attention") or 0.0)
                total_att += att
                total_non += non

                cj = r.get("class_json") or {}
                if isinstance(cj, str):
                    try:
                        import json
                        cj = json.loads(cj)
                    except:
                        cj = {}
                
                for cls_name, ratio in cj.items():
                    class_totals[cls_name] += float(ratio or 0.0)
            avg_att = total_att / count if count > 0 else 0.0
            avg_non = total_non / count if count > 0 else 0.0

            class_summary = {}
            if count > 0:
                for cls_name, total_val in class_totals.items():
                    class_summary[cls_name] = round(total_val / count, 3)
            
            daily_rows.append(
                {
                    "teacher_id": teacher_id,
                    "subject_id": subject_id,
                    "camera_id": camera_id,
                    "summary_date": summary_date,
                    "avg_attention": round(avg_att, 3),
                    "avg_non_attention": round(avg_non, 3),
                    "class_json_summary": class_summary,
                }
            )

            if daily_rows:
                supabase_client.table("camera_daily_summary").insert(daily_rows).execute()

        await asyncio.sleep(3)
        return {"message": "บันทึกข้อมูลเสร็จสิ้น", "inserted": len(insert_payload), "inserted_daily_summary": len(daily_rows)}
    except Exception as e:
        print("Error summary", str(e))
        return {"error": str(e)}


# -------------------- Start / Stop detect --------------------
@camera_router.get("/start-detect/{camera_id}")
async def start_detect(camera_id: str):
    cam_state = cameras.get(camera_id)
    if not cam_state:
        raise HTTPException(status_code=404, detail="ไม่เจอกล้อง")

    async with cam_state["lock"]:
        cam_state["running"] = True
        cam_state["detecting"] = True
        task = cam_state.get("task")
        if not task or task.done():
            task = asyncio.create_task(camera_loop(camera_id))
            cam_state["task"] = task

    return {"message": f"เริ่มตรวจจับกล้อง {int(camera_id) + 1}"}


@camera_router.get("/start-all")
async def start_all_detections(user=Depends(verify_token)):
    if not cameras:
        return {"message": "ยังไม่มีกล้องที่เปิดอยู่", "started": []}

    started: list[str] = []

    teacher_result = (
        supabase_client.table("teacher")
        .select("teacher_id")
        .eq("id", user["id"])
        .execute()
    )
    if teacher_result.data:
        teacher_id = teacher_result.data[0]["teacher_id"]
        print(f"[/start-all] รหัสอาจารย์ {teacher_id}")
    else:
        print("[/start-all] ไม่พบรหัสอาจารย์")

    for cam_id, cam_state in cameras.items():
        async with cam_state["lock"]:
            cam_state["running"] = True
            if not cam_state.get("detecting", False):
                cam_state["detecting"] = True

            task = cam_state.get("task")
            if not task or task.done():
                task = asyncio.create_task(camera_loop(cam_id))
                cam_state["task"] = task

            started.append(cam_id)

    print(f"🚀 Started detection for cameras: {started}")
    return {"message": f"เริ่มตรวจจับ {len(started)} กล้อง", "started": started}


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


# -------------------- ปิดกล้อง --------------------
@camera_router.get("/close-camera/{camera_id}")
async def camera_close(camera_id: str):
    cam_state = cameras.get(camera_id)
    if not cam_state:
        return {"message": f"กล้องตัวที่ {int(camera_id) + 1} ปิดอยู่แล้ว"}

    async with cam_state["lock"]:
        cam_state["detecting"] = False
        cam_state["running"] = False
        cam_state["track_id"] = None

        task = cam_state.get("task")
        if task and not task.done():
            task.cancel()

        cap = cam_state.get("cap")
        if cap and cap.isOpened():
            cap.release()

    cameras.pop(camera_id, None)
    print(f"🧹 กล้องตัวที่ {int(camera_id) + 1} ปิด")
    return {"message": f"กล้องตัวที่ {int(camera_id) + 1} ปิด"}


@camera_router.get("/close-all")
async def close_all_cameras():
    tasks_to_cancel = []

    for _, cam_state in list(cameras.items()):
        async with cam_state["lock"]:
            cam_state["detecting"] = False
            cam_state["running"] = False
            cam_state["track_id"] = None

            task = cam_state.get("task")
            if task and not task.done():
                task.cancel()
                tasks_to_cancel.append(task)

    if tasks_to_cancel:
        await asyncio.gather(*tasks_to_cancel, return_exceptions=True)

    for _, cam_state in list(cameras.items()):
        cap = cam_state.get("cap")
        if cap and cap.isOpened():
            cap.release()

    cameras.clear()
    print("🧹 ปิดกล้องทั้งหมดสำเร็จ")
    return {"message": "ปิดกล้องทั้งหมด"}


# -------------------- list-camera --------------------
@camera_router.get("/list-camera")
async def check_list_camera(user=Depends(verify_token)):
    global available_cameras, last_scan_time
    now = time.time()

    teacher_result = (
        supabase_client.table("teacher")
        .select("teacher_id")
        .eq("id", user["id"])
        .execute()
    )

    if teacher_result.data and len(teacher_result.data) > 0:
        teacher_id = teacher_result.data[0]["teacher_id"]
        print(f"รหัสอาจารย์ {teacher_id}")
    else:
        print("ไม่พบรหัสอาจารย์ในระบบ")

    if is_scanning:
        print("⏳ Skip scanning, already in progress")
        return {"status": "scanning", "cameras": available_cameras}

    if not available_cameras or (now - last_scan_time > 10):
        last_scan_time = now
        await async_scan_cameras()
        # รอบแรกให้ status scanning และ cameras ว่าง
        return {"status": "scanning", "cameras": []}

    return {"status": "done", "cameras": available_cameras}


# -------------------- WebSockets --------------------
@camera_router.websocket("/ws/camera/{camera_id}")
async def camera_ws(websocket: WebSocket, camera_id: str):
    """
    WebSocket นี้จะไม่แย่งอ่าน Cap จาก camera_loop
    แต่จะทำหน้าที่แค่ส่ง last_frame ที่ camera_loop ผลิตไว้ให้เท่านั้น
    """
    await websocket.accept()
    print(f"📡 Client connected for camera {int(camera_id) + 1}")

    teacher_id = websocket.query_params.get("teacher_id")
    subject_id = websocket.query_params.get("subject_id")

    cam_state = cameras.get(camera_id)
    cap = None

    # ถ้ามี state อยู่แล้วให้ใช้ cap เดิม
    if cam_state and cam_state.get("cap"):
        cap = cam_state["cap"]

    # ถ้าไม่มี state → เปิดกล้องใหม่ + start loop
    if cap is None:
        cap = open_camera_with_backends(int(camera_id))
        if cap is None:
            await websocket.send_text("error: cannot open camera")
            await websocket.close()
            print(f"❌ ไม่สามารถเปิดกล้อง {int(camera_id)+1}")
            return

        cam_state = create_camera_state(
            cap, teacher_id=teacher_id, subject_id=subject_id
        )
        cameras[camera_id] = cam_state

    # ตรวจสอบและเริ่ม loop ถ้ายังไม่เริ่ม
    async with cam_state["lock"]:
        cam_state["running"] = True
        task = cam_state.get("task")
        if not task or task.done():
            task = asyncio.create_task(camera_loop(camera_id))
            cam_state["task"] = task

    try:
        while True:
            cam_state = cameras.get(camera_id)
            if not cam_state:
                break

            # --- [Fix] อ่านแค่ last_frame (ไม่แตะ cap.read เอง) ---
            async with cam_state["lock"]:
                frame_bytes = cam_state.get("last_frame")

            if not frame_bytes:
                await asyncio.sleep(0.03)
                continue

            await websocket.send_text(base64.b64encode(frame_bytes).decode("utf-8"))
            await asyncio.sleep(0.03)  # ~30fps

    except WebSocketDisconnect:
        print(f"❌ WS หยุดการเชื่อมต่อกล้อง {int(camera_id) + 1}")
    finally:
        try:
            if websocket.client_state.name != "CLOSED":
                await websocket.close()
        except Exception:
            pass
        print(f"🧹 WS stream for camera {int(camera_id) + 1} ended")


@camera_router.websocket("/ws/camera/detect/{camera_id}")
async def camera_detect_ws(websocket: WebSocket, camera_id: str):
    """
    stream เฉพาะภาพที่ camera_loop สร้างไว้ใน last_frame
    """
    await websocket.accept()
    print(f"📡 Detect WS connected for camera {int(camera_id)+1}")
    try:
        while True:
            cam_state = cameras.get(camera_id)
            if not cam_state:
                break

            async with cam_state["lock"]:
                frame_bytes = cam_state.get("last_frame")

            if not frame_bytes:
                await asyncio.sleep(0.03)
                continue

            await websocket.send_text(
                base64.b64encode(frame_bytes).decode("utf-8")
            )

            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        print(f"🔌 Detect WS disconnected cam {int(camera_id)+1}")
    finally:
        try:
            if websocket.client_state.name != "CLOSED":
                await websocket.close()
        except Exception:
            pass
        print(f"🧹 Detect WS closed cam {int(camera_id)+1}")


@camera_router.websocket("/ws/camera/summary/{camera_id}")
async def camera_summary(websocket: WebSocket, camera_id: str):
    await websocket.accept()

    cam_state = cameras.get(camera_id)
    if cam_state is None:
        print(f"❌ หา State ของกล้องไม่เจอ (กล้อง {int(camera_id) + 1})")
        await websocket.close()
        return
    
    async with cam_state["lock"]:
        if "summary_ready_event" not in cam_state or cam_state["summary_ready_event"] is None:
            cam_state["summary_ready_event"] = asyncio.Event()
    
    try:
        print(f"📡 Summary WS started for camera {int(camera_id) + 1}")
        while True:
            cam_state = cameras.get(camera_id)
            if not cam_state:
                break

            async with cam_state["lock"]:
                running = cam_state.get("running", False)
                detecting = cam_state.get("detecting", False)
                summary_event = cam_state.get("summary_ready_event")

            if not running or not detecting:
                await asyncio.sleep(0.5)
                continue

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

                if "image" in payload and isinstance(
                    payload["image"], (bytes, bytearray)
                ):
                    payload["image"] = base64.b64encode(payload["image"]).decode(
                        "utf-8"
                    )

                if cam_state.get("summary_ready_event"):
                    cam_state["summary_ready_event"].clear()

            try:
                await websocket.send_json(payload)
            except WebSocketDisconnect:
                print(f"🔌 Summary WS disconnected (camera {int(camera_id) + 1})")
                break

    except WebSocketDisconnect:
        print(f"🔌 WebSocket disconnected normally (camera {int(camera_id) + 1})")
    except Exception as e:
        print(f"❗ Summary WS error (camera {int(camera_id) + 1}): {e}")
    finally:
        try:
            if websocket.client_state.name != "CLOSED":
                await websocket.close(code=1000)
        except Exception:
            pass
        print(f"🛑 Summary WS closed (camera {int(camera_id) + 1})")