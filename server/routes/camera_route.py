import threading
import cv2
import time
import base64
import asyncio
from datetime import datetime
from collections import defaultdict
from typing import Optional
from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    Depends,
)

from utils.model_loader import get_model
from utils.auth import verify_token
from config.bn_supabase import supabase_client
from utils.json_buffer import save_buffer, load_buffer, clear_buffer

# ----------------- Router -----------------
camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

# ไม่โหลด YOLO เป็น global เพื่อหลีกเลี่ยงปัญหา multi-thread
ATTENDENCE = ["Focused", "Looking_at_the_board", "Taking_notes"]
NON_ATTENDENCE = ["LookingAway", "Talking", "UsingPhone"]

# state กล้องทั้งหมด
camera_threads: dict[str, "CameraThread"] = {}
available_cameras: list[dict] = []
last_scan_time: float = 0
scan_lock = asyncio.Lock()

# ==============================================================================
# CameraThread — 1 กล้อง = 1 Thread
# ==============================================================================

class CameraThread(threading.Thread):
    """
    Thread สำหรับกล้อง 1 ตัว:
    - เปิดกล้อง
    - อ่านเฟรม
    - ถ้า detecting=True → รัน YOLO + ByteTrack
    - Tracking แบบ "จับคนแรกแล้วตามยาว"
    - สรุปผลทุก 5 วินาที / 1 นาที
    - เตรียมภาพล่าสุด + summary ให้ WebSocket ใช้
    """

    def __init__(self, camera_id: str, teacher_id=None, subject_id=None):
        super().__init__(daemon=True)
        self.camera_id = str(camera_id)
        self.source_index = int(camera_id)

        self.teacher_id = teacher_id
        self.subject_id = subject_id

        # flags
        self.running = False
        self.detecting = False
        self.stop_flag = threading.Event()

        # OpenCV
        self.cap = None

        # sync
        self.lock = threading.Lock()

        # buffers
        self.jpeg_buffer: bytes | None = None
        self.latest_summary: dict = {}

        # asyncio loop + event สำหรับ summary WS
        self.loop: asyncio.AbstractEventLoop | None = None
        self.summary_ready_event: asyncio.Event | None = None

        # tracking logic
        self.track_id: int | None = None
        self.class_timer = {
            "current_class": None,
            "duration": 0.0,
            "miss": 0,
        }

        self.interval_results: list[str] = []
        self.interval_seconds = 5
        self.last_interval_time = time.time()
        self.interval_count = 0
        self.max_intervals = 12  # 12 x 5 วินาที = 1 นาที

        self.last_best_class: str | None = None
        self.last_best_conf: float = 0.0

        self.last_target_conf = 0.0

        self.skip_frames = 5  # detect ทุก 3 เฟรม เพื่อลดโหลด
        self.frame_counter = 0

        # YOLO model (แยก instance ต่อ thread)
        self.model = None

    # ------------- เปิดกล้อง -------------
    def open_camera(self) -> bool:
        backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
        for backend in backends:
            cap = cv2.VideoCapture(self.source_index, backend)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                cap.set(cv2.CAP_PROP_FPS, 30)
                cap.set(
                    cv2.CAP_PROP_FOURCC,
                    cv2.VideoWriter_fourcc("M", "J", "P", "G"),
                )
                self.cap = cap
                print(f"✅ Camera {self.camera_id} opened with backend={backend}")
                return True
            cap.release()
        print(f"❌ Camera {self.camera_id} failed to open with all backends")
        return False

    # ------------- Main loop -------------

    def run(self):
        if not self.open_camera():
            return

        # โหลด YOLO instance สำหรับ thread นี้
        try:
            print(f"⏳ Loading YOLO model for camera {self.camera_id} ...")
            self.model = get_model()
            print(f"✅ YOLO model loaded for camera {self.camera_id}")
        except Exception as e:
            print(f"❌ Failed to load YOLO for camera {self.camera_id}: {e}")
            return

        self.running = True

        while not self.stop_flag.is_set():
            ret, frame = self.cap.read()
            if not ret:
                print(f"⚠️ Camera {self.camera_id} read error")
                break

            self.frame_counter += 1
            now = time.time()
            annotated = frame

            # ---------- ทำ YOLO แค่ตอน detecting=True ----------
            if self.detecting and self.frame_counter % self.skip_frames == 0:
                try:
                    results = self.model.track(
                        source=frame,
                        conf=0.45,
                        tracker="bytetrack.yaml",
                        device="cuda",  # GPU 0 (ปรับเป็น "cpu" ถ้าไม่มี GPU)
                        verbose=False,
                        persist=True,
                    )

                    result = results[0]
                    annotated = result.plot()

                    self.process_behavior(result, now)

                except Exception as e:
                    print(f"❌ YOLO error camera {self.camera_id}: {e}")
            # else: ใช้ภาพดิบๆ (annotated = frame)

            # encode JPEG เก็บไว้ใน buffer ให้ WS เอาไปส่ง
            ok, buf = cv2.imencode(".jpg", annotated)
            if ok:
                with self.lock:
                    self.jpeg_buffer = buf.tobytes()

            time.sleep(0.01)  # ~100 fps ใน thread (ยืดหยุ่น)

        # cleanup
        self.running = False
        if self.cap:
            self.cap.release()
        print(f"🛑 CameraThread {self.camera_id} stopped")

    def stop(self):
        self.stop_flag.set()
        try:
            self.join(timeout=1.0)
        except RuntimeError:
            # ถ้า thread ยังไม่ start หรือ join ซ้ำ ให้ข้าม
            pass

    # ------------- Tracking / Behavior logic -------------

    def select_track_id_first_person(self, boxes):
        """
        เลือกคนแรกที่ conf สูงสุดในเฟรมแรก แล้วล็อก track_id นี้ยาว ๆ
        """
        best_id = None
        best_conf = 0.0
        for box in boxes:
            if box.id is None:
                continue
            tid = int(box.id)
            conf = float(box.conf.item())
            if conf > best_conf:
                best_conf = conf
                best_id = tid

        self.track_id = best_id
        print(f"🎯 Camera {self.camera_id} picked target track_id = {best_id}")

    def update_class_state(self, label: str):
        """
        อัปเดต state ของ current_class / miss
        กติกา:
        - ถ้า label เดิม → miss=0
        - ถ้า label ใหม่ → เพิ่ม miss, ถ้า miss>=5 → เปลี่ยน label
        """
        timer = self.class_timer

        if timer["current_class"] is None:
            timer["current_class"] = label
            timer["duration"] = 0
            timer["miss"] = 0
            return

        if timer["current_class"] == label:
            timer["miss"] = 0
            return

        timer["miss"] += 1
        if timer["miss"] >= 5:
            timer["current_class"] = label
            timer["duration"] = 0
            timer["miss"] = 0

    def handle_missing_target(self):
        """
        ถ้าเฟรมนี้ไม่เจอ target track_id:
        - ถ้า last_best_conf > 0.65 → ใช้ last_best_class
        - ถ้าไม่ → miss เพิ่ม, ถ้า miss>=3 → current_class=None
        """
        timer = self.class_timer

        if self.last_best_conf > 0.65 and self.last_best_class:
            timer["current_class"] = self.last_best_class
            return

        timer["miss"] += 1
        if timer["miss"] >= 5:
            timer["current_class"] = None
            timer["duration"] = 0

    def process_behavior(self, result, now: float):
        """
        ใช้กับ YOLO result (ByteTrack):
        - เลือก track_id เป้าหมาย (คนแรก) ครั้งเดียว
        - ทุกเฟรม หาเฉพาะ box ที่ track_id == target แล้วอัปเดต class
        - ทุก 5 วิ ทำ interval logic
        """
        boxes = result.boxes

        # 1) ถ้ายังไม่มี target → เลือกคนแรกที่ conf สูงสุด
        if self.track_id is None:
            self.select_track_id_first_person(boxes)

        found_target = False

        # 2) loop boxes หาเฉพาะ track_id ที่เราเลือกไว้
        for box in boxes:
            if box.id is None:
                continue

            tid = int(box.id)
            conf = float(box.conf.item())
            cls_idx = int(box.cls)
            label = self.model.names[cls_idx]

            # เก็บ best class เผื่อ fallback
            if conf > self.last_best_conf:
                self.last_best_conf = conf
                self.last_best_class = label

            if tid == self.track_id:
                found_target = True
                self.last_target_conf = conf
                self.update_class_state(label)
                break

        # 3) ถ้าไม่เจอ target ในเฟรมนี้ → ใช้ fallback
        if not found_target:
            self.last_target_conf = 0.0
            self.handle_missing_target()

        # 4) เช็คครบ 5 วิหรือยัง → interval logic
        if now - self.last_interval_time >= self.interval_seconds:
            self.last_interval_time = now
            self.handle_interval()

    # ------------- Interval / Summary -------------

    def handle_interval(self):
        """
        ทุก 5 วิ:
        - ดู current_class
        - ถ้าเป็น LookingAway → ใช้ duration map ไปเป็น 3 ระดับ
        - เก็บลง interval_results
        - ครบ 12 รอบ (1 นาที) → save_summary()
        """
        cls = self.class_timer["current_class"]
        mapped = cls

        if cls == "LookingAway":
            self.class_timer["duration"] += self.interval_seconds
            dur = self.class_timer["duration"]

            if dur <= 15:
                mapped = "LookingAway"
            elif dur <= 35:
                mapped = "Looking_at_the_board"
            else:
                mapped = "Taking_notes"
        else:
            self.class_timer["duration"] = 0

        if mapped and self.last_target_conf > 0.7:
            self.interval_results.append(mapped)
            print(f"⏱️ Cam {self.camera_id}: class: {mapped} conf: {last_scan_time} ({len(self.interval_results)})")

        if len(self.interval_results) > self.max_intervals:
            self.interval_results.pop(0)

        self.interval_count += 1

        if self.interval_count >= self.max_intervals:
            self.save_summary()
            self.interval_count = 0
            self.interval_results.clear()
            self.last_best_class = None
            self.last_best_conf = 0.0
            self.class_timer["miss"] = 0
            self.class_timer["duration"] = 0

    def save_summary(self):
        """
        สรุปทุก 1 นาที:
        - คิดสัดส่วน ATTENDENCE / NON_ATTENDENCE
        - เก็บ class_json
        - แจ้ง WS summary
        - save_buffer ลง JSON ไฟล์
        """
        total = len(self.interval_results)
        if total == 0:
            return

        count = defaultdict(int)
        for c in self.interval_results:
            count[c] += 1

        att = sum(count[c] for c in count if c in ATTENDENCE) / total
        non = sum(count[c] for c in count if c in NON_ATTENDENCE) / total

        class_json = {k: round(v / total, 3) for k, v in count.items()}

        
        img_base64 = None

        with self.lock:
            if self.jpeg_buffer:
                img_base64 = base64.b64encode(self.jpeg_buffer).decode("utf-8")
        
            payload = {
                "CameraId": int(self.camera_id) + 1,
                "Time": datetime.now().strftime("%H:%M:%S"),
                "Attention": att,
                "Non_Attention": non,
                "image": img_base64
            }

            self.latest_summary = payload
        
        # แจ้ง WS summary (ถ้ามี loop + event)
        if self.loop and self.summary_ready_event:
            self.loop.call_soon_threadsafe(self.summary_ready_event.set)

        # บันทึกลง buffer สำหรับ insert Supabase ทีหลัง
        if self.teacher_id and self.subject_id:
            try:
                fake_cam_state = {"teacher_id": self.teacher_id}
                save_buffer(
                    camera_id=self.camera_id,
                    cam_state=fake_cam_state,
                    ATT=att,
                    NON=non,
                    class_json=class_json,
                    subject_id=self.subject_id,
                )
            except Exception as e:
                print(f"❌ save_buffer error cam {self.camera_id}: {e}")


# ==============================================================================
# Scan Cameras
# ==============================================================================


def quick_scan_camera(index: int) -> bool:
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if cap.isOpened():
        cap.release()
        return True

    cap = cv2.VideoCapture(index, cv2.CAP_MSMF)
    if cap.isOpened():
        cap.release()
        return True

    cap = cv2.VideoCapture(index, cv2.CAP_ANY)
    if cap.isOpened():
        cap.release()
        return True

    return False

@camera_router.get("/list-camera")
async def list_camera():
    """
    endpoint สำหรับหน้า RecordPage.jsx ใช้ดึงรายชื่อกล้อง
    """
    cams = []
    for i in range(10):
        ok = quick_scan_camera(i)
        if ok:
            cams.append({
                "id": i,
                "name": f"กล้องตัวที่ {i}",
                "status": "ใช้ได้"
            })
    return {"cameras": cams}


# ==============================================================================
# Start / Stop / Close
# ==============================================================================

@camera_router.get("/start-detect/{camera_id}")
async def start_detect(camera_id: str):
    """
    เริ่ม detect เฉพาะกล้องนี้
    """
    loop = asyncio.get_running_loop()

    if camera_id in camera_threads:
        th = camera_threads[camera_id]
        if th.is_alive():
            th.detecting = True
            th.loop = loop
            if th.summary_ready_event is None:
                th.summary_ready_event = asyncio.Event()
            return {"msg": f"resumed camera {int(camera_id)+1}"}
        else:
            th.stop()
            del camera_threads[camera_id]

    # สร้าง thread ใหม่
    th = CameraThread(camera_id)
    th.loop = loop
    th.summary_ready_event = asyncio.Event()
    th.detecting = True
    th.start()
    camera_threads[camera_id] = th

    return {"msg": f"started camera {int(camera_id)+1}"}


@camera_router.get("/start-all")
async def start_all_detections(
    subject_id: Optional[str] = None,
    user=Depends(verify_token)
):
    """
    เริ่ม detect ทุกกล้องที่มี
    ผูก teacher_id จาก token, subject_id ใช้ DEFAULT_SUB ชั่วคราว
    """
    loop = asyncio.get_running_loop()

    teacher_res = (
        supabase_client.table("teacher")
        .select("teacher_id")
        .eq("id", user["id"])
        .execute()
    )
    t_id = teacher_res.data[0]["teacher_id"] if teacher_res.data else None

    started = []

    # ใช้ available_cameras ที่ scan ได้ ถ้าไม่มีให้ default 0-1
    cam_ids = (
        [str(cam["id"]) for cam in available_cameras]
        if available_cameras
        else [str(i) for i in range(2)]
    )

    for cid in cam_ids:
        if cid not in camera_threads or not camera_threads[cid].is_alive():
            th = CameraThread(cid, teacher_id=t_id, subject_id=subject_id)
            th.loop = loop
            th.summary_ready_event = asyncio.Event()
            th.detecting = True
            th.start()
            camera_threads[cid] = th
        else:
            th = camera_threads[cid]
            th.detecting = True
            th.loop = loop
            if th.summary_ready_event is None:
                th.summary_ready_event = asyncio.Event()
            if t_id:
                th.teacher_id = t_id
                if not th.subject_id:
                    th.subject_id = "DEFAULT_SUB"
        started.append(cid)

    return {"message": f"Started {len(started)} cameras", "started": started}


@camera_router.get("/stop-all")
async def stop_all_detections():
    """
    แค่หยุด detect (แต่ไม่ปิดกล้อง)
    """
    for th in camera_threads.values():
        th.detecting = False
    return {"message": "Stopped detection for all cameras"}


@camera_router.get("/close-all")
async def close_all_cameras():
    """
    ปิดกล้อง / หยุด thread ทั้งหมด
    """
    for cid, th in list(camera_threads.items()):
        th.stop()
        del camera_threads[cid]
    return {"message": "All camera threads closed"}


# ==============================================================================
# WebSocket: live video
# ==============================================================================

@camera_router.websocket("/ws/camera/{camera_id}")
async def ws_camera(websocket: WebSocket, camera_id: str):
    """
    ส่งภาพจากกล้องแบบ real-time (JPEG base64)
    """
    await websocket.accept()
    loop = asyncio.get_running_loop()
    teacher_id = websocket.query_params.get("teacher_id")
    subject_id = websocket.query_params.get("subject_id")
    
    # ensure thread
    if camera_id not in camera_threads or not camera_threads[camera_id].is_alive():
        th = CameraThread(camera_id, teacher_id=teacher_id, subject_id=subject_id)
        th.loop = loop
        th.summary_ready_event = asyncio.Event()
        th.detecting = False  # live preview เฉย ๆ ยังไม่ detect
        th.start()
        camera_threads[camera_id] = th
    else:

        th = camera_threads[camera_id]
        if teacher_id:
            th.teacher_id = teacher_id
        if subject_id:
            th.subject_id = subject_id

    th = camera_threads[camera_id]
    th.loop = loop

    try:
        while True:
            with th.lock:
                frame = th.jpeg_buffer

            if frame:
                await websocket.send_text(base64.b64encode(frame).decode())

            await asyncio.sleep(0.04)  # ~25 fps

    except WebSocketDisconnect:
        print(f"🔌 WS camera disconnected: {camera_id}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ==============================================================================
# WebSocket: summary per minute
# ==============================================================================


@camera_router.websocket("/ws/camera/summary/{camera_id}")
async def ws_summary(websocket: WebSocket, camera_id: str):
    """
    WS ส่ง Summary ทุก 1 นาที
    """
    await websocket.accept()
    loop = asyncio.get_running_loop()

    th = camera_threads.get(camera_id)
    if not th:
        await websocket.close()
        return

    th.loop = loop
    if th.summary_ready_event is None:
        th.summary_ready_event = asyncio.Event()

    try:
        while True:
            # รอ event จาก thread
            await th.summary_ready_event.wait()
            th.summary_ready_event.clear()

            with th.lock:
                payload = th.latest_summary.copy()

            if payload:
                await websocket.send_json(payload)

    except WebSocketDisconnect:
        print(f"🔌 WS summary disconnected: {camera_id}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ==============================================================================
# summary-to-supabase
# ==============================================================================


@camera_router.get("/summary-to-supabase")
async def summary_to_supabase_route():
    """
    ดึง buffer ทุกกล้อง → insert ลง Supabase
    (camera_logs เท่านั้น, daily summary ถ้าจะทำเพิ่มภายหลังได้)
    """
    all_summary_data = []
    try:
        for cam_id in list(camera_threads.keys()):
            data = load_buffer(str(cam_id))
            if data:
                all_summary_data.append(data)
                clear_buffer(str(cam_id))

        if not all_summary_data:
            return {"message": "ไม่มีข้อมูลใน buffer", "inserted": 0}

        insert_payload = []
        for summary in all_summary_data:
            camera_id = summary["camera_id"]
            teacher_id = summary["teacher_id"]
            subject_id = (summary.get("subject_id") or "").strip()

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

        return {
            "message": "บันทึกข้อมูลเสร็จสิ้น",
            "inserted": len(insert_payload),
        }
    except Exception as e:
        print("Error summary_to_supabase:", e)
        return {"error": str(e)}
