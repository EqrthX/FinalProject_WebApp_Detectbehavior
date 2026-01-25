import threading
import cv2
import time
import base64
import asyncio
import torch
import os
import json
from datetime import datetime
from collections import defaultdict
from typing import Optional
from ultralytics import YOLO
from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    Depends,
)
from utils.model_loader import get_model_path
from utils.auth import verify_token
from config.bn_supabase import supabase_client
from utils.json_buffer import get_all_pending_files, save_buffer

camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

CLASS_MAPPING = {
    "Looking_at_the_board": {"label": "Looking_at_the_board", "color": (255, 0, 0)},   # น้ำเงิน
    "Taking_notes": {"label": "Looking_Down", "color": (0, 255, 0)},   # เขียว 
    "LookingAway": {"label": "LookingAway", "color": (0, 165, 255)}, # ส้ม
    "UsingPhone": {"label": "UsingPhone", "color": (0, 0, 255)},   # แดง
}

ATTENDENCE = ["Looking_at_the_board", "Looking_Down"]
NON_ATTENDENCE = ["LookingAway", "UsingPhone"]

camera_threads: dict[str, "CameraThread"] = {}
available_cameras: list[dict] = []
last_scan_time: float = 0
scan_lock = asyncio.Lock()
model_path = get_model_path()

# คลาสสำหรับจัดการ Thread ของกล้องแต่ละตัว ทำหน้าที่อ่านภาพ ประมวลผล AI และจัดการ Buffer ข้อมูล
class CameraThread(threading.Thread):
    def __init__(self, camera_id: str, teacher_id=None, subject_id=None, group=None):
        super().__init__(daemon=True)

        self.camera_id = str(camera_id)
        self.source_index = int(camera_id)

        self.teacher_id = teacher_id
        self.subject_id = subject_id
        self.group = group

        self.running = False
        self.detecting = False
        self.stop_flag = threading.Event()

        self.cap = None
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.lock = threading.Lock()

        self.jpeg_buffer: bytes | None = None
        self.latest_summary: dict = {}

        self.loop: asyncio.AbstractEventLoop | None = None
        self.summary_ready_event: asyncio.Event | None = None

        self.class_durations = defaultdict(float)

        self.class_timer = {
            "current_class": None,
            "duration": 0.0,
            "miss": 0,
        }

        self.interval_results: list[str] = []
        self.interval_seconds = 3
        self.last_interval_time = time.time()
        self.interval_count = 0
        self.max_intervals = int(60 / self.interval_seconds)

        self.last_target_conf = 0.0
        self.last_annotated = None

        self.main_track_id = None
        self.main_lost_frames = 0
        self.main_max_lost_frames = 5
        self.last_detect_time = 0
        self.last_target_center = None
        self.last_class_update_time = time.time()
        self.session_id = int(time.time())

    # รีเซ็ตค่า State ต่างๆ ของกล้องให้กลับเป็นค่าเริ่มต้น
    def reset_state(self):
        with self.lock:
            self.jpeg_buffer = None
            self.last_annotated = None
            self.latest_summary = {}
        
        self.main_track_id = None
        self.main_lost_frames = 0
        self.last_target_conf = None

        self.interval_results.clear()
        self.class_durations.clear()
        self.interval_count = 0
        self.last_interval_time = time.time()
        self.class_timer = {
            "current_class": None,
            "duration": 0.0,
            "miss": 0
        }

   
    def open_camera(self) -> bool:
        backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
        max_retries = 10  # เพิ่มจำนวนครั้งที่จะลองเปิดใหม่
        retry_delay = 0.5 # รอ 0.5 วินาทีก่อนลองใหม่

        for attempt in range(max_retries):
            for backend in backends:
                cap = None
                try:
                    # ลองเปิดกล้อง
                    cap = cv2.VideoCapture(self.source_index, backend)

                    if cap.isOpened():
                        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                        cap.set(cv2.CAP_PROP_FPS, 30)
                        cap.set(
                            cv2.CAP_PROP_FOURCC,
                            cv2.VideoWriter_fourcc(*"MJPG"),
                        )
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) 
                        self.cap = cap

                        print(f"✅ Camera {self.camera_id} opened with backend={backend} (Attempt {attempt+1})")
                        return True
                    
                except Exception as e:
                    print(f"เกิดข้อผิดพลาดของการเปิดกล้อง {self.camera_id} (Attempt {attempt+1}) error -> {e} ")
                
                # ถ้าเปิดไม่ได้ ให้ release ทันทีเพื่อกัน memory leak ใน loop
                if cap:
                    cap.release()

            # ถ้าวนครบทุก backend แล้วยังไม่ได้ ให้รอสักพักแล้วลองใหม่ (เผื่อ thread เก่ายังคืนกล้องไม่เสร็จ)
            print(f"⏳ Camera {self.camera_id} busy, retrying in {retry_delay}s... ({attempt+1}/{max_retries})")
            time.sleep(retry_delay)

        print(f"❌ กล้อง {self.camera_id} ไม่สามารถเปิดได้เลยหลังจากลอง {max_retries} ครั้ง")
        return False    # ฟังก์ชันหลักของ Thread ทำหน้าที่โหลดโมเดล เปิดกล้อง และวนลูปประมวลผลภาพ
    
    def run(self):
        if not self.open_camera():
            return

        try:
            print(f"⏳ กำลังโหลดโมเดลของกล้อง {self.camera_id} ...")
            self.model = YOLO(model_path)
            print(f"✅ โหลด Model Yolo ของกล้อง {self.camera_id}")
        except Exception as e:
            print(f"❌ เกิดข้อผิดพลาดในการโหลด Model Yolo ของกล้อง {self.camera_id}: {e}")
            return

        self.running = True
        
        try:
            while not self.stop_flag.is_set():
                ret, frame = self.cap.read()

                if not ret:
                    print(f"⚠️ กล้อง {self.camera_id} อ่านเฟรมไม่เจอ")
                    break

                annotated = frame

                if self.detecting:
                    try:
                        results = self.model.track(
                            source=frame,
                            conf=0.45,
                            iou=0.50,
                            device=self.device,
                            verbose=False,
                            persist=True,
                            tracker="bytetrack.yaml",
                        )

                        result = results[0]
                        annotated = frame.copy()
                        if result.boxes:
                            for box in result.boxes:
                                x1, y1, x2, y2 = map(int, box.xyxy[0])
                                cls_idx = int(box.cls)
                                raw_label = self.model.names[cls_idx]
                                conf = float(box.conf)

                                # ดึงค่า Config (สีและชื่อใหม่)
                                mapping = CLASS_MAPPING.get(raw_label)
                                label_text = mapping["label"] # ได้คำว่า "Looking Down"
                                color = mapping["color"]

                                # 1. วาดกล่อง
                                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

                                # 2. วาดป้ายชื่อ (พื้นหลัง + ตัวหนังสือ)
                                text_show = f"{label_text} {conf:.2f}"
                                (w, h), _ = cv2.getTextSize(text_show, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                                cv2.rectangle(annotated, (x1, y1 - 25), (x1 + w, y1), color, -1)
                                cv2.putText(annotated, text_show, (x1, y1 - 8),
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                                
                        self.last_annotated = annotated
                        self.process_behavior_track(result, now=time.time())

                    except Exception as e:
                        print(f"❌ YOLO track error camera {self.camera_id}: {e}")
                        self.last_annotated = frame
                        continue

                else:
                    if self.last_annotated is not None:
                        annotated = self.last_annotated.copy()
                    else:
                        annotated = frame

                ok, buf = cv2.imencode(".jpg", annotated)

                if ok:
                    with self.lock:
                        self.jpeg_buffer = buf.tobytes()
                else:
                    print(f"JPG encode เกิดข้อผิดพลาดของกล้อง {self.camera_id}")
                    continue

        except Exception as e:
            print(f"Thread กล้อง {self.camera_id} crash: {e}")
            
        self.running = False

        if self.cap:
            self.cap.release()

        print(f"🛑 CameraThread {self.camera_id} stopped")

    # สั่งหยุด Thread และรอให้ Process จบ
    def stop(self):
        self.stop_flag.set()

        try:
            self.join(timeout=1.0)
        except RuntimeError:
            pass

    # อัปเดตสถานะ Class ปัจจุบัน โดยมี Logic ป้องกันการเปลี่ยนสถานะไปมาไวเกินไป (Debounce)
    def update_class_state(self, label: str):
        now = time.time()

        delta = now - self.last_class_update_time

        self.last_class_update_time = now

        timer = self.class_timer
        if timer["current_class"] is None:
            timer["current_class"] = label
            timer["duration"] = 0.0
            timer["miss"] = 0
            return

        if timer["current_class"] == label:
            self.class_durations[label] += delta
            timer["duration"] += delta
            timer["miss"] = 0
        else:
            timer["miss"] += 1
            if timer["miss"] >= 3:
                timer["current_class"] = label
                timer["duration"] = 0.0
                timer["miss"] = 0

    # ประมวลผลพฤติกรรมจากผลลัพธ์ YOLO Track และจัดการ Target ID หลัก
    def process_behavior_track(self, result, now: float):
        boxes = result.boxes
        found_class = None # ตัวแปรสำหรับเก็บ Class ที่เจอในรอบนี้

        # -----------------------------------------------------
        # ส่วนที่ 1: พยายามหา Class จาก Detection (ถ้ามี)
        # -----------------------------------------------------
        if boxes is not None and len(boxes) > 0:
            detections = []
            for box in boxes:
                cls_idx = int(box.cls)
                raw_label = self.model.names[cls_idx]
                mapping = CLASS_MAPPING.get(raw_label)

                if mapping:
                    label = mapping["label"]
                else:
                    continue
                
                if label not in ATTENDENCE + NON_ATTENDENCE:
                    continue

                conf = float(box.conf.item())
                track_id = int(box.id.item()) if box.id is not None else None
                
                if track_id is None: continue

                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cx = (x1 + x2) / 2
                cy = (y1 + y2) / 2

                detections.append({
                    "box": box, "label": label, "conf": conf, "track_id": track_id,
                    "center": (cx, cy)
                })

            if detections:
                found_det = None

                # Logic หา Main Target (เหมือนเดิม)
                if self.main_track_id is None:
                    best = max(detections, key=lambda d: d["conf"])
                    self.main_track_id = best["track_id"]
                    self.last_target_center = best["center"]
                    self.main_lost_frames = 0
                    self.last_target_conf = best["conf"]
                    
                    if best["conf"] > 0.60:
                        found_class = best["label"] # เจอแล้ว! จำไว้ก่อน
                    found_det = best

                else:
                    for d in detections:
                        if d["track_id"] == self.main_track_id:
                            found_det = d
                            break
                    
                    if found_det is None and self.last_target_center is not None:
                        last_cx, last_cy = self.last_target_center
                        min_dist = 150
                        closest = None
                        for d in detections:
                            dcx, dcy = d["center"]
                            dist = ((dcx - last_cx)**2 + (dcy - last_cy)**2)**0.5 
                            if dist < 150 and dist < min_dist: 
                                min_dist = dist
                                closest = d
                        
                        if closest is not None:
                            self.main_track_id = closest["track_id"]
                            found_det = closest

                if found_det:
                    self.main_lost_frames = 0
                    self.last_target_conf = found_det["conf"]
                    self.last_target_center = found_det["center"] 
                    if found_det["conf"] >= 0.50:
                        found_class = found_det["label"] 
                else:
                    self.main_lost_frames += 1
                    if self.main_lost_frames >= self.main_max_lost_frames:
                        self.main_track_id = None
                        self.last_target_center = None
                        self.main_lost_frames = 0
            else:
                 pass
        else:
             # กรณีไม่มี Box เลย (ห้องว่าง / หาไม่เจอ)
             if self.main_track_id is not None:
                self.main_lost_frames += 1
                if self.main_lost_frames >= self.main_max_lost_frames:
                    self.main_track_id = None
                    self.last_target_center = None
                    self.main_lost_frames = 0

        if found_class:
            # กรณีเจอ: อัปเดตด้วย Class ที่เจอ
            self.update_class_state(found_class)
        else:
            # กรณีไม่เจอ: เอา Class ล่าสุดมาใช้ต่อ (Fake ว่าทำท่าเดิมอยู่)
            current = self.class_timer.get("current_class")
            
            if current:
                self.update_class_state(current)
            else:
                pass

        if now - self.last_interval_time >= self.interval_seconds:
            self.last_interval_time = now
            self.handle_interval()

    # จัดการสรุปผลราย Interval และบันทึกข้อมูลเมื่อครบกำหนดเวลา
    def handle_interval(self):
        cls = self.class_timer["current_class"]
        mapped = cls
        
        if mapped:
            self.interval_results.append(cls)
            print(
                f"⏱️ Cam {self.camera_id}: class: {cls} \n,total times: {self.class_durations[cls]} ({len(self.interval_results)})"
                )

        if len(self.interval_results) > self.max_intervals:
            self.interval_results.pop(0)

        self.interval_count += 1
        if self.interval_count >= self.max_intervals:
            self.save_summary()
            self.interval_count = 0
            self.interval_results.clear()
            self.class_durations.clear()
            self.class_timer["miss"] = 0
            self.class_timer["duration"] = 0.0

    # สร้างข้อมูลสรุปผล (Summary) เพื่อส่งผ่าน WebSocket และบันทึกลง Buffer
    def save_summary(self):
        total = len(self.interval_results)

        if total == 0:
            return

        count = defaultdict(int)

        for c in self.interval_results:
            count[c] += 1

        att = sum(count[c] for c in count if c in ATTENDENCE) / total
        non = sum(count[c] for c in count if c in NON_ATTENDENCE) / total

        class_json = {k: round(v / total, 3) for k, v in count.items()}

        class_duration_json = {k: round(v, 1) for k, v in self.class_durations.items()}
        img_base64 = None
        lass_class = self.interval_results[-1]
        with self.lock:
            if self.jpeg_buffer:
                img_base64 = base64.b64encode(self.jpeg_buffer).decode("utf-8")

            payload = {
                "CameraId": int(self.camera_id) + 1,
                "Time": datetime.now().strftime("%H:%M:%S"),
                "CurrentClass": lass_class,
                "class_duration": class_duration_json,
                "image": img_base64,
            }

            self.latest_summary = payload

        if self.loop and self.summary_ready_event:
            self.loop.call_soon_threadsafe(self.summary_ready_event.set)

        if self.teacher_id and self.subject_id:
            try:
                save_buffer(
                    camera_id=self.camera_id,
                    teacher_id=self.teacher_id,
                    ATT=att,
                    NON=non,
                    class_json=class_json,
                    subject_id=self.subject_id,
                    group=self.group,
                    class_duration=class_duration_json,
                    session_id=self.session_id
                )
            except Exception as e:
                print(f"❌ save_buffer error cam {self.camera_id}: {e}")

# API สำหรับสแกนหากล้องที่เชื่อมต่ออยู่ (0-9)
@camera_router.get("/list-camera")
async def list_camera():
    cams = []
    available_cameras.clear()
    for i in range(10):
        cap = None
        try:
            cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
            if cap.isOpened():
                cams.append({
                    "id": i,
                    "name": f"กล้องตัวที่ {i}",
                    "status": "ใช้ได้",
                })
                available_cameras.append({"id": i})
        except Exception as e:
            print(f"quick_scan_camera index {i} error: {e}")
        finally:
            if cap and cap.isOpened():
                cap.release()
    if not cams:
        return {"message": "ไม่เจอ USB ที่กำลังเชื่อมต่อกล้อง"}

    return {"cameras": cams}

# API สำหรับเริ่มการทำงาน (Detection) ของกล้องทั้งหมดที่มี
@camera_router.get("/start-all")
async def start_all_detections(
    subject_id: Optional[str] = None,
    group: Optional[str] = None,
    user=Depends(verify_token),
):
    loop = asyncio.get_running_loop()

    teacher_res = (
        supabase_client.table("teacher")
        .select("teacher_id")
        .eq("id", user["id"])
        .execute()
    )

    t_id = teacher_res.data[0]["teacher_id"] if teacher_res.data else None
    started = []
    cam_ids = (
        [str(cam["id"]) for cam in available_cameras]
    )

    for cid in cam_ids:
        if cid not in camera_threads or not camera_threads[cid].is_alive():
            th = CameraThread(cid, teacher_id=t_id, subject_id=subject_id, group=group)

            th.loop = loop
            th.summary_ready_event = asyncio.Event()
            th.detecting = True
            th.start()
            camera_threads[cid] = th
            print(camera_threads)
        else:
            th = camera_threads[cid]
            th.detecting = True
            th.loop = loop

            if th.summary_ready_event is None:
                th.summary_ready_event = asyncio.Event()

            if t_id:
                th.teacher_id = t_id
                if not th.subject_id:
                    th.subject_id = subject_id or "DEFAULT_SUB"

        started.append(cid)

    return {"message": f"Started {len(started)} cameras", "started": started}

# API สำหรับหยุดการตรวจจับ (Detection) ของกล้องทั้งหมด (แต่ Thread ยังทำงานอยู่)
@camera_router.get("/stop-all")
async def stop_all_detections():
    for th in camera_threads.values():
        th.detecting = False
    return {"message": "Stopped detection for all cameras"}

# API สำหรับปิดการทำงานของกล้องทั้งหมดและเคลียร์ Thread
@camera_router.get("/close-all")
async def close_all_cameras():
    for cid, th in list(camera_threads.items()):
        th.detecting = False

        if len(th.interval_results) > 0:
            print(f"💾 Force saving partial data for Cam {cid} ({len(th.interval_results)} items)")
            th.save_summary()

        th.reset_state()
        th.stop()
        del camera_threads[cid]

    return {"message": "All camera threads closed"}

# WebSocket สำหรับสตรีมภาพสดจากกล้อง
@camera_router.websocket("/ws/camera/{camera_id}")
async def ws_camera(websocket: WebSocket, camera_id: str):
    await websocket.accept()

    loop = asyncio.get_running_loop()
    teacher_id = websocket.query_params.get("teacher_id")
    subject_id = websocket.query_params.get("subject_id")
    group = websocket.query_params.get("group")

    if camera_id not in camera_threads or not camera_threads[camera_id].is_alive():
        th = CameraThread(camera_id, teacher_id=teacher_id, subject_id=subject_id, group=group)
        th.loop = loop
        th.summary_ready_event = asyncio.Event()
        th.detecting = False
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
            # เพิ่มมา เช็คว่า thread กล้องตายยัง
            if not th.is_alive():
                print(f"⚠️ Thread กล้อง {camera_id} ตายแล้ว ปิด WebSocket")
                break

            with th.lock:
                frame = th.jpeg_buffer

            if frame:
                await websocket.send_text(base64.b64encode(frame).decode())

            await asyncio.sleep(0.04)

    except WebSocketDisconnect:
        print(f"🔌 WS camera disconnected: {camera_id}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

# WebSocket สำหรับส่งข้อมูลสรุป (Summary) แบบ Real-time
@camera_router.websocket("/ws/camera/summary/{camera_id}")
async def ws_summary(websocket: WebSocket, camera_id: str):
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

# API สำหรับอ่านไฟล์ JSON Buffer และบันทึกข้อมูลลง Supabase
@camera_router.get("/summary-to-supabase")
async def summary_to_supabase_route():
    files = get_all_pending_files()
    print(f"📂 Found {len(files)} files pending upload")
    
    if not files:
        return {"message": "ไม่มีข้อมูลค้างอยู่", "inserted": 0}

    total_inserted = 0
    total_summary_inserted = 0

    # ✅ วนลูปทำทีละไฟล์ (ทีละ Session) ไม่เอามารวมกันแล้ว
    for path in files:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"❌ Error reading {path}: {e}")
            continue

        # 1. เตรียมข้อมูล Logs
        camera_id = data["camera_id"]
        teacher_id = data["teacher_id"]
        subject_id = (data.get("subject_id") or "").strip()
        group = data["group"]
        records = data["records"]
        session_id = data.get("session_id")
        
        if not records:
            # ไฟล์เปล่า ลบทิ้งเลย
            try: os.remove(path) 
            except: pass
            continue

        insert_payload = []
        for record in records:
            insert_payload.append({
                "camera_id": camera_id,
                "teacher_id": teacher_id,
                "subject_id": subject_id,
                "group": group,
                "session_id": session_id,
                "Attention": record["Attention"],
                "Non_Attention": record["Non_Attention"],
                "class_json": record["class_json"],
                "class_duration": record["class_duration"],
                "created_at": record["created_at"],
            })

        # 2. Insert Logs (บันทึกข้อมูลดิบรายนาที)
        if insert_payload:
            try:
                supabase_client.table("camera_logs").insert(insert_payload).execute()
                total_inserted += len(insert_payload)
            except Exception as e:
                print(f"❌ Error inserting logs for {path}: {e}")
                continue # ถ้า log เข้าไม่ได้ อย่าเพิ่งทำ summary และอย่าเพิ่งลบไฟล์

        # 3. คำนวณ Summary **เฉพาะของไฟล์นี้ (Session นี้)**
        total_att = 0.0
        total_non = 0.0
        count = len(records)
        class_totals = defaultdict(float)
        class_duration_totals = defaultdict(float)

        # หาวันที่ของไฟล์นี้ (เอาจาก record แรก)
        first_dt = records[0]["created_at"]
        if isinstance(first_dt, str):
            dt_obj = datetime.fromisoformat(first_dt.replace("Z", "+00:00"))
            summary_date = dt_obj.date().isoformat()
        else:
            summary_date = datetime.now().date().isoformat()

        for r in records:
            total_att += float(r.get("Attention") or 0.0)
            total_non += float(r.get("Non_Attention") or 0.0)
            
            # รวม class count (%)
            cj = r.get("class_json") or {}
            if isinstance(cj, str): cj = json.loads(cj)
            for k, v in cj.items():
                class_totals[k] += float(v or 0.0)

            # รวม duration (sec)
            cd = r.get("class_duration") or {}
            if isinstance(cd, str): cd = json.loads(cd)
            for k, v in cd.items():
                class_duration_totals[k] += float(v or 0.0)

        # ค่าเฉลี่ยของ Session นี้
        avg_att = total_att / count if count > 0 else 0.0
        avg_non = total_non / count if count > 0 else 0.0
        
        class_summary = {}
        if count > 0:
            for k, v in class_totals.items():
                class_summary[k] = round(v / count, 3)

        daily_row = {
            "teacher_id": teacher_id,
            "subject_id": subject_id,
            "camera_id": camera_id,
            "summary_date": summary_date,
            "avg_attention": round(avg_att, 3),
            "avg_non_attention": round(avg_non, 3),
            "class_json_summary": class_summary,
            "class_duration_summary": {k: round(v, 1) for k, v in class_duration_totals.items()},
            "group": group,
            "session_id": session_id
        }

        # 4. Insert Summary (1 ไฟล์ = 1 แถวสรุป)
        try:
            supabase_client.table("camera_daily_summary").insert(daily_row).execute()
            total_summary_inserted += 1
            
            # ✅ ทำเสร็จแล้วลบไฟล์ทิ้ง
            os.remove(path)
            print(f"✅ Processed and deleted: {path}")

        except Exception as e:
            print(f"❌ Error inserting summary for {path}: {e}")

    return {
        "message": f"บันทึกข้อมูลเสร็จสิ้น แยก {total_summary_inserted} sessions",
        "inserted": total_inserted,
    }