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
from ultralytics import YOLO

from utils.model_loader import get_model_path
from config.bn_supabase import supabase_client
from utils.json_buffer import save_buffer

# คอนฟิกการแปลงคลาสและสี
CLASS_MAPPING = {
    "Looking at the board": {"label": "Looking at the board", "color": (255, 0, 0)},   # น้ำเงิน
    "Looking down to write": {"label": "Looking down to write", "color": (0, 255, 0)},   # เขียว 
    "Looking Away": {"label": "Looking Away", "color": (0, 165, 255)}, # ส้ม
    "Using Phone": {"label": "Using Phone", "color": (0, 0, 255)},   # แดง
    "Other": {"label": "Other", "color": (128, 128, 128)},  # สีเทา
}

ATTENDENCE = ["Looking at the board", "Looking down to write"]
NON_ATTENDENCE = ["Looking Away", "Using Phone"]

# เก็บข้อมูลสถานะกล้องที่แชร์ระหว่าง REST APIs และ WebSockets
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
        self.interval_seconds = 1
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
        self.start_time = None

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
        return False
    
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

                # Logic หา Main Target
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
            self.update_class_state(found_class)
        else:
            # กรณีไม่เจอ: เอา Class ล่าสุดมาใช้ต่อ (Fake ว่าทำท่าเดิมอยู่)
            self.update_class_state("Other")

        if now - self.last_interval_time >= self.interval_seconds:
            self.last_interval_time = now
            self.handle_interval()

    # จัดการสรุปผลราย Interval และบันทึกข้อมูลเมื่อครบกำหนดเวลา
    def handle_interval(self):
        self.interval_count += 1

        cls = self.class_timer["current_class"]
        mapped = cls
        
        if len(self.interval_results) > self.max_intervals:
            self.interval_results.pop(0)

        current_duration = 0
        if self.start_time is not None:
            current_duration = int(time.time() - self.start_time)
        
        realtime_payload = {
            "type": "realtime",
            "CameraId": int(self.camera_id) + 1,
            "total_duration_sec": current_duration,
            "CurrentClass": cls
        }

        with self.lock:
            self.latest_summary = realtime_payload
        
        if self.loop and self.summary_ready_event:
            self.loop.call_soon_threadsafe(self.summary_ready_event.set)

        if self.interval_count % 3 == 0:
            if mapped:
                self.interval_results.append(cls)
                print(
                    f"⏱️ Cam {self.camera_id}: class: {cls} \n,total times: {self.class_durations[cls]} ({len(self.interval_results)})"
                )
                
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
                "type": "summary",
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
