import threading          # ใช้สำหรับสร้าง Thread แยกให้แต่ละกล้องทำงานของตัวเอง
import cv2                # OpenCV สำหรับเปิดกล้องและจัดการภาพ
import time               # ใช้สำหรับจับเวลา เช่น interval สรุปผลทุก 5 วินาที ฯลฯ
import base64             # ใช้แปลง bytes ของรูปเป็น base64 เพื่อส่งผ่าน WebSocket / JSON
import asyncio            # ใช้สำหรับ async/await ใน FastAPI (WebSocket / Router ต่าง ๆ)
import torch              # ใช้ดูว่ามี GPU ไหม (cuda) และใช้กับ YOLO ที่อยู่ใน ultralytics
from datetime import datetime           # ใช้สำหรับเวลาปัจจุบันเก็บลง summary
from collections import defaultdict     # ใช้ dict แบบค่า default=0 (นับจำนวน class ต่าง ๆ)
from typing import Optional             # ใช้บอก type ของพารามิเตอร์ที่เป็น optional
from ultralytics import YOLO
from fastapi import (
    APIRouter,          # สร้าง router ย่อยสำหรับ path ที่เกี่ยวกับกล้อง
    WebSocket,          # สำหรับประกาศ WebSocket endpoint
    WebSocketDisconnect,# สำหรับจับ event เมื่อ WebSocket หลุด
    Depends,            # ใช้กับ Depends(verify_token) เพื่อเช็ค token
)

from utils.model_loader import get_model_path          # ฟังก์ชันหา path model (จากไฟล์อื่น)
from utils.auth import verify_token               # ฟังก์ชันเช็ค token ของผู้ใช้
from config.bn_supabase import supabase_client    # client สำหรับเรียก Supabase
from utils.json_buffer import save_buffer, load_buffer, clear_buffer  # จัดการไฟล์ buffer JSON

# ----------------- Router หลักของกล้อง -----------------
camera_router = APIRouter(prefix="/api/camera", tags=["camera"])
# prefix หมายถึง path ทุกอันในไฟล์นี้จะขึ้นต้นด้วย /api/camera
# tags ใช้สำหรับจัด group ใน docs ของ FastAPI

# ----------------- กำหนดกลุ่มคลาสพฤติกรรม -----------------
ATTENDENCE = ["Focused", "Looking_at_the_board", "Taking_notes"]
NON_ATTENDENCE = ["LookingAway", "Talking", "UsingPhone"]

# ----------------- state สำหรับกล้องทั้งหมดในเซิร์ฟเวอร์ -----------------
# dict เก็บ Thread ของแต่ละกล้อง โดย key เป็น str(camera_id)
camera_threads: dict[str, "CameraThread"] = {}
# list เก็บข้อมูลกล้องที่ scan เจอ (เช่น id, name, backend)
available_cameras: list[dict] = []
# เวลา stamp ล่าสุดที่ scan กล้องเสร็จ
last_scan_time: float = 0
# Lock กันไม่ให้มีการ scan กล้องซ้อนกัน
scan_lock = asyncio.Lock()
model_path = get_model_path()


# ==============================================================================
#  Class: CameraThread — กล้อง 1 ตัว = 1 Thread
# ==============================================================================
class CameraThread(threading.Thread):
    """
    คลาสนี้แทน "กล้อง 1 ตัว" ที่รันอยู่บน Thread แยกของมันเอง

    หน้าที่หลัก:
    - เปิดกล้อง (VideoCapture)
    - วนลูปอ่านเฟรมจากกล้อง
    - ถ้า self.detecting == True → เรียก YOLO + Track (model.track)
    - ใช้ track_id เลือก "คนหลักคนแรก" แล้วตามคนนี้ไปเรื่อย ๆ
    - อัปเดตพฤติกรรม (Focused / LookingAway / ฯลฯ) ของคนหลัก
    - ทุก ๆ 5 วินาที สรุป class ที่เกิดขึ้น → เก็บลง self.interval_results
    - ทุก ๆ 1 นาที (12 interval) สรุปเป็น Attention / Non_Attention แล้วเก็บลง buffer + ส่ง WS
    - เก็บภาพล่าสุด (annotated frame) ไว้ใน self.jpeg_buffer ให้ WebSocket live / summary ใช้
    """

    def __init__(self, camera_id: str, teacher_id=None, subject_id=None):
        """
        ฟังก์ชันเริ่มต้นของ Thread กล้อง
        - รับ camera_id เป็น string (เช่น "0", "1")
        - teacher_id, subject_id เอาไว้ผูกข้อมูลกับครู/วิชา เวลา insert Supabase
        """
        # เรียก __init__ ของ threading.Thread และ set daemon=True (ถ้า main ตาย Thread ก็ตายตาม)
        super().__init__(daemon=True)

        # ----------------- ข้อมูลพื้นฐานของกล้อง -----------------
        self.camera_id = str(camera_id)          # id ของกล้องในรูปแบบ string
        self.source_index = int(camera_id)       # index ที่ใช้กับ cv2.VideoCapture

        # ข้อมูลที่ใช้ผูกกับตารางใน Supabase
        self.teacher_id = teacher_id
        self.subject_id = subject_id

        # ----------------- flag และ state ทั่วไป -----------------
        self.running = False                     # บอกว่า Thread นี้กำลังทำงานอยู่ไหม
        self.detecting = False                   # บอกว่าตอนนี้กำลัง detect/track อยู่ไหม
        self.stop_flag = threading.Event()       # Event ใช้สั่งหยุดลูปหลัก (เมื่อปิดกล้อง)

        # ----------------- ตัวแปรของ OpenCV -----------------
        self.cap = None                          # จะเก็บ VideoCapture object ของกล้องนี้

        # ----------------- YOLO Model -----------------
        # ตอน __init__ ยังไม่โหลด model เพื่อให้การสร้าง object เร็วขึ้น
        # จะไปโหลดใน run() อีกที (ต่อ Thread)
        self.model = None

        # device ที่จะใช้ (ถ้ามี GPU → cuda, ถ้าไม่มี → cpu)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # ----------------- Lock สำหรับ sync ข้อมูลใน Thread นี้ -----------------
        # ใช้เวลาจะอ่าน/เขียน self.jpeg_buffer หรือ self.latest_summary จาก WebSocket
        self.lock = threading.Lock()

        # ----------------- Buffer ภาพล่าสุด (annotated) -----------------
        self.jpeg_buffer: bytes | None = None    # เก็บ bytes ของภาพ JPEG ล่าสุด
        self.latest_summary: dict = {}           # เก็บ payload summary ล่าสุดสำหรับ WS

        # ----------------- ตัวแปรที่ใช้ร่วมกับ WebSocket summary -----------------
        self.loop: asyncio.AbstractEventLoop | None = None   # เก็บ event loop ของ FastAPI
        self.summary_ready_event: asyncio.Event | None = None# ใช้แจ้งว่า summary พร้อมส่งแล้ว

        # ----------------- ตัวแปรสำหรับ Behavior / Timer -----------------
        # dict เก็บสถานะของคลาสปัจจุบัน + duration + miss
        self.class_timer = {
            "current_class": None,   # class ปัจจุบันที่ถือว่าใช้ (เช่น "Focused")
            "duration": 0.0,         # ใช้กับ LookingAway → เวลา
            "miss": 0,               # ใช้ตัดสินใจเปลี่ยน class เมื่อเจอคลาสใหม่ซ้ำ ๆ
        }

        # list เก็บ class ในแต่ละ interval (ทุก 5 วินาที)
        self.interval_results: list[str] = []

        # ความถี่ในการสรุป interval (วินาที)
        self.interval_seconds = 5
        # เวลา timestamp ล่าสุดที่สรุป interval ไปแล้ว
        self.last_interval_time = time.time()
        # นับจำนวน interval ที่ผ่านไปแล้วในรอบ "1 นาที"
        self.interval_count = 0
        # จำนวน interval สูงสุดใน 1 รอบสรุป (12 x 5 วิ = 1 นาที)
        self.max_intervals = 12

        # เก็บค่า confidence ล่าสุดของ target (ไว้ print log)
        self.last_target_conf = 0.0

        # เก็บภาพ annotated ล่าสุด (จะใช้เวลาไม่ detect frame นั้น)
        self.last_annotated = None

        # ----------------- ตัวแปรสำหรับ Tracking ด้วย track_id -----------------
        # track_id ของ "คนหลัก" คนแรกที่กล้องเจอ
        self.main_track_id = None

        # ใช้นับจำนวนเฟรมที่ "ไม่เจอคนหลัก" ถ้าเกิน limit จะ reset main_track_id
        self.main_lost_frames = 0

        # ให้หายไปได้สูงสุดกี่เฟรมก่อนจะยอม reset main_track_id
        self.main_max_lost_frames = 30    
        self.last_detect_time = 0
        
    # ----------------------------------------------------------------------
    # ฟังก์ชันเปิดกล้อง (พยายามหลาย backend)
    # ----------------------------------------------------------------------
    def open_camera(self) -> bool:
        """
        พยายามเปิดกล้องด้วย backend ต่าง ๆ ของ OpenCV:
        - CAP_DSHOW
        - CAP_MSMF
        - CAP_ANY

        ถ้าเปิดสำเร็จ → เซ็ต self.cap และ return True
        ถ้าไม่สำเร็จเลย → return False
        """
        # กำหนดลำดับ backend ที่จะลอง
        backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]

        # วนลองทีละ backend
        for backend in backends:
            cap = None
            try:
                # พยายามสร้าง VideoCapture ด้วย index และ backend นี้
                cap = cv2.VideoCapture(self.source_index, backend)

                # ถ้าเปิดได้ (isOpened=True)
                if cap.isOpened():
                    # ตั้งค่าความกว้างของเฟรม (pixel)
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    # ตั้งค่าความสูงของเฟรม (pixel)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    # ตั้งค่า FPS เป้าหมาย
                    cap.set(cv2.CAP_PROP_FPS, 30)
                    # ตั้งค่ารูปแบบ fourcc (รูปแบบ encode video ที่ driver ชอบ)
                    cap.set(
                        cv2.CAP_PROP_FOURCC,
                        cv2.VideoWriter_fourcc(*"MJPG"),
                    )
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) 
                    # บันทึก VideoCapture นี้ลง self.cap
                    self.cap = cap

                    print(f"✅ Camera {self.camera_id} opened with backend={backend}")
                    return True

            except Exception as e:
                # ถ้าเกิด error ตอนเปิดกล้อง → print log ไว้ debug
                print(f"เกิดข้อผิดพลาดของการเปิดกล้อง {self.camera_id} ของ backend={backend} error -> {e} ")
            finally:
                # ถ้า cap ถูกสร้าง แต่ self.cap ยัง None แปลว่าเปิดไม่สำเร็จ → release cap
                if cap and (self.cap is None):
                    cap.release()

        # ถ้าลองทุก backend แล้วยังไม่สำเร็จ → แจ้งเตือนและ return False
        print(f"❌ กล้อง {self.camera_id} ไม่สามารถเปิดได้เลยตาม backends")
        return False

    # ----------------------------------------------------------------------
    # ฟังก์ชันหลักของ Thread (เริ่มทำงานเมื่อเรียก .start())
    # ----------------------------------------------------------------------
    def run(self):
        """
        ฟังก์ชันที่ Thread จะรันเมื่อเราเรียก .start() บน object นี้

        ขั้นตอน:
        1. พยายามเปิดกล้อง (open_camera)
        2. โหลด YOLO model สำหรับ Thread นี้
        3. วนลูปอ่านเฟรมจากกล้อง
        4. ถ้า self.detecting=True และถึงรอบที่ต้อง track → เรียก self.model.track()
        5. ประมวลผลผลลัพธ์ของ track → อัปเดตพฤติกรรม + summary
        6. แปลงภาพเป็น JPEG แล้วเก็บใน self.jpeg_buffer
        7. ถ้ามี error → print log แล้วออกจากลูป
        """
        # ----------------- 1) เปิดกล้อง -----------------
        if not self.open_camera():
            # ถ้าเปิดกล้องไม่ได้ → ไม่ทำอะไรต่อ (ออกจาก Thread เลย)
            return

        # ----------------- 2) โหลด YOLO Model -----------------
        try:
            print(f"⏳ กำลังโหลดโมเดลของกล้อง {self.camera_id} ...")
            self.model = YOLO(model_path)
            print(f"✅ โหลด Model Yolo ของกล้อง {self.camera_id}")
        except Exception as e:
            # ถ้าโหลดโมเดลไม่สำเร็จ → print error แล้วจบ Thread
            print(f"❌ เกิดข้อผิดพลาดในการโหลด Model Yolo ของกล้อง {self.camera_id}: {e}")
            return

        # ----------------- 3) เริ่มลูปหลัก -----------------
        self.running = True
        
        
        try:
            # วนลูปไปเรื่อย ๆ จนกว่าจะมีคนสั่ง stop_flag.set()
            while not self.stop_flag.is_set():
                # 3.1 อ่านเฟรมจากกล้อง
                ret, frame = self.cap.read()

                # ถ้าอ่านไม่ได้ → แจ้งเตือนและ break ออกจากลูป
                if not ret:
                    print(f"⚠️ กล้อง {self.camera_id} อ่านเฟรมไม่เจอ")
                    break

                # เริ่มจากใช้ภาพดิบจากกล้องก่อน
                annotated = frame

                # ----------------- 4) ถ้าต้องการ detect / track -----------------
                # เงื่อนไข:
                # - self.detecting == True → กำลัง detect อยู่
                if self.detecting:
                    try:
                        # ข้อสำคัญ:
                        # - persist=True → ใช้ track_id ต่อเนื่องระหว่างเฟรม
                        # - tracker="bytetrack.yaml" → ใช้ ByteTrack เป็น tracker
                        results = self.model.track(
                            source=frame,           # เฟรมปัจจุบันจากกล้อง
                            conf=0.20,              # ค่าความมั่นใจขั้นต่ำในการ detect
                            iou=0.45,               # ค่า IOU ขั้นต่ำในการจับคู่ box กับ track
                            device=self.device,     # "cuda" หรือ "cpu"
                            verbose=False,          # ไม่ต้อง print log จาก ultralytics
                            persist=True,           # ให้ YOLO จำ track_id ต่อเนื่อง
                            tracker="bytetrack.yaml",  # ใช้ ByteTrack
                        )

                        # results เป็น list ของผลลัพธ์ต่อ source 1 ตัว → หยิบอันแรก
                        result = results[0]

                        # วาดกล่อง/label ลงบนภาพด้วย .plot()
                        annotated = result.plot()

                        # เก็บ annotated frame ล่าสุดไว้ (เผื่อเฟรมอื่นที่ไม่ track)
                        self.last_annotated = annotated

                        # ประมวลผล behavior โดยใช้ข้อมูล track (track_id, class)
                        self.process_behavior_track(result, now=time.time())

                    except Exception as e:
                        # ถ้า YOLO หรือ track พัง → print error, หน่วงเวลาเล็กน้อยแล้วข้ามเฟรมนี้
                        print(f"❌ YOLO track error camera {self.camera_id}: {e}")
                        self.last_annotated = frame
                        continue

                else:
                    # ----------------- 5) ถ้าไม่ได้ detect ในเฟรมนี้ -----------------
                    # ถ้าเคยมี annotated เก็บไว้ → ใช้รูปเก่าที่วาดกล่องแล้ว
                    if self.last_annotated is not None:
                        annotated = self.last_annotated.copy()
                    else:
                        annotated = frame

                # ----------------- 6) แปลงภาพเป็น JPEG แล้วเก็บลง buffer -----------------
                # cv2.imencode(".jpg", annotated) จะคืน (ok, buf)
                ok, buf = cv2.imencode(".jpg", annotated)

                if ok:
                    # แปลง buffer เป็น bytes แล้วเก็บลง self.jpeg_buffer โดยใช้ lock กันชนกับ WebSocket
                    with self.lock:
                        self.jpeg_buffer = buf.tobytes()
                else:
                    print(f"JPG encode เกิดข้อผิดพลาดของกล้อง {self.camera_id}")
                    continue

        except Exception as e:
            # ถ้าเกิด error ใด ๆ ที่หลุดมานอก try ด้านใน → log ไว้ก่อนปิดกล้อง
            print(f"Thread กล้อง {self.camera_id} crash: {e}")
            
        # ----------------- 7) cleanup เมื่อออกจากลูปหลัก -----------------
        self.running = False

        # ปิดกล้องถ้ามี
        if self.cap:
            self.cap.release()

        print(f"🛑 CameraThread {self.camera_id} stopped")

    # ----------------------------------------------------------------------
    # ฟังก์ชันสั่งหยุด Thread 
    # ----------------------------------------------------------------------
    def stop(self):
        """
        ใช้สั่งให้ Thread นี้หยุดทำงาน:
        - set stop_flag
        - พยายาม join ให้ Thread จบตัวเองใน 1 วินาที
        """
        # สั่งให้ลูปหลักใน run() รู้ว่าต้องหยุด
        self.stop_flag.set()

        try:
            # join คือรอให้ Thread จบ ในเวลา timeout=1 วินาที
            self.join(timeout=1.0)
        except RuntimeError:
            # ถ้า Thread ยังไม่ start หรือ join ซ้ำ → ไม่ต้องทำอะไร
            pass

    # ----------------------------------------------------------------------
    # ฟังก์ชันอัปเดต state ของ class_timer ตาม label ที่เข้ามา
    # ----------------------------------------------------------------------
    def update_class_state(self, label: str):
        """
        อัปเดตสถานะ class ปัจจุบัน (current_class) และ miss counter

        กติกา:
        - ถ้า current_class ยังเป็น None → เซ็ตเป็น label ที่เข้ามาเลย
        - ถ้า label ใหม่ == current_class เดิม → reset miss เป็น 0
        - ถ้า label ใหม่ != current_class เดิม:
            - เพิ่ม miss ทีละ 1
            - ถ้า miss >= 5 → ยอมเปลี่ยน current_class = label ใหม่ และ reset duration เป็น 0
        """
        timer = self.class_timer

        # ถ้ายังไม่เคยมี class มาก่อนเลย → ตั้งค่า initial
        if timer["current_class"] is None:
            timer["current_class"] = label
            timer["duration"] = 0.0
            timer["miss"] = 0
            return

        # ถ้า label เดิมเหมือน current_class → ถือว่าต่อเนื่อง → miss=0
        if timer["current_class"] == label:
            timer["miss"] = 0
            return

        timer["miss"] += 1

        # ถ้า miss ถึง threshold (5 ครั้งติดต่อกัน)
        if timer["miss"] >= 5:
            timer["current_class"] = label
            timer["duration"] = 0.0
            timer["miss"] = 0

    # ----------------------------------------------------------------------
    # ฟังก์ชันประมวลผล Behavior จาก YOLO result (โหมด track)
    # ----------------------------------------------------------------------
    def process_behavior_track(self, result, now: float):
        """
        ประมวลผล behavior โดยใช้ผลลัพธ์จาก YOLO track.

        Concept :
        - สนใจเฉพาะคลาสใน ATTENDENCE + NON_ATTENDENCE
        - ใช้ main_track_id เลือก "คนหลักคนแรก"
        - เฟรมต่อ ๆ ไป: ใช้เฉพาะ box ที่ track_id == main_track_id
        - คนอื่นที่เดินผ่าน (track_id อื่น) → print log ว่า ignore
        - ถ้าไม่เจอคนหลักติด ๆ กันหลายเฟรม → reset main_track_id
        - ทุก ๆ 5 วินาที → เรียก handle_interval() ตามเวลา
        """
        
        boxes = result.boxes

        # ถ้าไม่มี box เลยในเฟรมนี้
        if boxes is None or len(boxes) == 0:
            if self.main_track_id is not None:
                self.main_lost_frames += 1

                # ถ้าหายเกิน limit → ยอม reset main_track_id
                if self.main_lost_frames >= self.main_max_lost_frames:
                    self.main_track_id = None
                    self.main_lost_frames  = 0
            return

        # list เก็บ detection ที่ "เกี่ยวข้อง" (เฉพาะคลาสที่เราสนใจ)
        detections = []

        # วนดูทุก box ที่ detect ได้
        for box in boxes:
            # index class → ชื่อคลาส
            cls_idx = int(box.cls)
            label = self.model.names[cls_idx]

            # สนใจเฉพาะ class ที่อยู่ใน list ATTENDENCE + NON_ATTENDENCE
            if label not in ATTENDENCE + NON_ATTENDENCE:
                continue

            # ค่าความมั่นใจของ box นี้ (confidence)
            conf = float(box.conf.item())

            # track_id (ถ้า YOLO ตั้งให้)
            track_id = None
            if box.id is not None:
                track_id = int(box.id.item() if hasattr(box.id, "item") else box.id)

            # ถ้าไม่มี track_id → ข้าม (เพราะเราจะใช้ track_id ในการเลือกคนหลัก)
            if track_id is None:
                continue

            detections.append({
                "box": box,
                "label": label,
                "conf": conf,
                "track_id": track_id,
            })

        # ถ้าไม่มี detection ที่เข้าเงื่อนไขเลย
        if not detections:
            # นับว่าไม่เจอคนหลักในเฟรมนี้
            if self.main_track_id is not None:
                self.main_lost_frames += 1
                if self.main_lost_frames >= self.main_max_lost_frames:
                    print(f"❌ [Cam {self.camera_id}] Target Lost too long (no valid det). Resetting ID.")
                    self.main_track_id = None
                    self.main_lost_frames = 0
            return

        # ----------------- เลือก / ติดตาม main_track_id -----------------
        
        # ถ้ายังไม่มีคนหลักมาก่อนเลย → เลือกจาก detection ที่ conf สูงสุดในเฟรมนี้
        if self.main_track_id is None:
            best = max(detections, key=lambda d: d["conf"])
            self.main_track_id = best["track_id"]
            self.main_lost_frames = 0
            self.last_target_conf = best["conf"]

            print(
                f"🎯 [Cam {self.camera_id}] New Target ID={self.main_track_id} "
                f"({best['label']} conf={best['conf']:.2f})"
            )

            # ถ้า conf สูงพอ (เช่น > 0.6) → อัปเดต behavior ทันที
            if best["conf"] > 0.60:
                self.update_class_state(best["label"])

        else:
            target_det = None

            for d in detections:
                if d["track_id"] == self.main_track_id:
                    target_det = d
                else:
                    # คนอื่นที่เดินผ่าน → เมิน
                    print(
                        f"🚫 [Cam {self.camera_id}] Ignoring Stranger ID={d['track_id']} "
                        f"({d['label']} conf={d['conf']:.2f})"
                    )

            if target_det is not None:
                # เจอคนหลักในเฟรมนี้
                self.main_lost_frames = 0
                self.last_target_conf = target_det["conf"]

                if target_det["conf"] >= 0.6:
                    self.update_class_state(target_det["label"])

                # debug log
                # print(
                #     f"✅ [Cam {self.camera_id}] Target ID={self.main_track_id} "
                #     f"{target_det['label']} ({target_det['conf']:.2f})"
                # )

            else:
                # ไม่เจอคนหลักเลยในเฟรมนี้
                self.main_lost_frames += 1
                print(
                    f"⚠️ [Cam {self.camera_id}] Target ID={self.main_track_id} lost "
                    f"({self.main_lost_frames}/{self.main_max_lost_frames})"
                )

                if self.main_lost_frames >= self.main_max_lost_frames:
                    print(f"❌ [Cam {self.camera_id}] Target Lost too long. Resetting ID.")
                    self.main_track_id = None
                    self.main_lost_frames = 0

            # ----------------- เรียก handle_interval() ทุก ๆ 5 วินาที -----------------
            # เช็คว่าจากครั้งสุดท้ายที่ handle_interval() ถูกเรียกผ่านมาเกิน 5 วินาทีหรือยัง
            if now - self.last_interval_time >= self.interval_seconds:
                # อัปเดตเวลา last_interval_time เป็นตอนนี้
                self.last_interval_time = now
                self.handle_interval()

    # ----------------------------------------------------------------------
    # ฟังก์ชัน handle_interval — ถูกเรียกทุก ๆ 5 วินาที
    # ----------------------------------------------------------------------
    def handle_interval(self):
        """
        ฟังก์ชันนี้จะถูกเรียกทุก ๆ self.interval_seconds (5 วินาที)
        เพื่อ:
        - ดูค่า current_class จาก self.class_timer
        - ถ้าเป็น LookingAway:
            - เพิ่ม duration ทีละ 5 วินาที
            - ใช้ duration ตัดสินว่า map เป็น LookingAway / Looking_at_the_board / Taking_notes
        - นำ class ที่ได้ (mapped) ไปเก็บใน self.interval_results
        - ถ้าสะสมครบ self.max_intervals (12 ครั้ง = 1 นาที):
            - เรียก save_summary() สรุปผล 1 นาที
            - reset ตัวนับ interval ต่าง ๆ
        """
        # ดึง current_class ที่คำนวณล่าสุด
        cls = self.class_timer["current_class"]
        mapped = cls

        # ถ้า current_class เป็น "LookingAway" → ใช้ duration แปลเป็น 3 level
        if cls == "LookingAway":
            # เพิ่มเวลา duration = duration เดิม + 5 วินาที
            self.class_timer["duration"] += self.interval_seconds
            dur = self.class_timer["duration"]

            # ถ้า duration <= 15 วิ → mapped = "LookingAway"
            if dur <= 15:
                mapped = "LookingAway"
            # ถ้า duration <= 35 วิ → mapped = "Looking_at_the_board"
            elif dur <= 35:
                mapped = "Looking_at_the_board"
            # เกิน 35 วิ → mapped = "Taking_notes"
            else:
                mapped = "Taking_notes"
        else:
            # ถ้าไม่ใช่ LookingAway → reset duration เป็น 0
            self.class_timer["duration"] = 0.0

        # ถ้า mapped ไม่ใช่ None → เอาไปเก็บใน interval_results
        if mapped:
            self.interval_results.append(mapped)
            # log เล็ก ๆ สำหรับ debug ว่าตอนนี้ class อะไร conf เท่าไหร่ และมี interval กี่อันแล้ว
            print(
                f"⏱️ Cam {self.camera_id}: class: {mapped} "
                f"conf: {self.last_target_conf:.3f} "
                f"({len(self.interval_results)})"
            )

        # ถ้าเก็บ interval_results เกิน max_intervals → ลบตัวเก่าสุดออก (ให้ list มีขนาด max)
        if len(self.interval_results) > self.max_intervals:
            self.interval_results.pop(0)

        self.interval_count += 1
        # ถ้าเกินหรือเท่ากับ max_intervals (12 ครั้ง = 1 นาที)
        if self.interval_count >= self.max_intervals:
            self.save_summary()

            # reset ตัวนับ interval, interval_results, miss, duration
            self.interval_count = 0
            self.interval_results.clear()

            # reset ค่าอื่น ๆ ที่เคยใช้ (ป้องกัน state เก่ามีผลเกินจำเป็น)
            self.class_timer["miss"] = 0
            self.class_timer["duration"] = 0.0

    # ----------------------------------------------------------------------
    # ฟังก์ชัน save_summary — สรุปผลทุก 1 นาที
    # ----------------------------------------------------------------------
    def save_summary(self):
        """
        ฟังก์ชันนี้จะถูกเรียกเมื่อครบรอบ 1 นาที (12 interval)
        หน้าที่:
        - นับจำนวนแต่ละ class ใน self.interval_results
        - แปลงเป็นสัดส่วน (attention / non-attention)
        - สร้าง class_json ตามสัดส่วนของแต่ละ class
        - เตรียม payload ที่ใช้ส่งผ่าน WebSocket (summary)
        - เรียก save_buffer() เพื่อสะสมข้อมูลลง JSON ต่อกล้อง
        - แจ้ง event ให้ WS summary รู้ว่ามีข้อมูลใหม่ให้ส่งแล้ว
        """
        # จำนวนทั้งหมดของค่าใน interval_results
        total = len(self.interval_results)

        # ถ้าไม่มีเลย → ไม่ต้องสรุป
        if total == 0:
            return

        # ใช้ defaultdict(int) ไว้นับว่ามีแต่ละ class กี่ครั้ง
        count = defaultdict(int)

        # วนทุก class ที่เก็บใน interval_results
        for c in self.interval_results:
            count[c] += 1

        # คำนวณสัดส่วน ATTENDENCE (จาก ATTENDENCE list)
        att = sum(count[c] for c in count if c in ATTENDENCE) / total
        # คำนวณสัดส่วน NON_ATTENDENCE
        non = sum(count[c] for c in count if c in NON_ATTENDENCE) / total

        # สร้าง class_json ที่เก็บสัดส่วนของแต่ละ class
        class_json = {k: round(v / total, 3) for k, v in count.items()}

        # เตรียมตัวแปรสำหรับเก็บภาพที่แปลงเป็น base64
        img_base64 = None

        # เข้าถึง jpeg_buffer ด้วย lock เพื่ออ่านภาพล่าสุด
        with self.lock:
            if self.jpeg_buffer:
                # แปลง bytes → base64 string
                img_base64 = base64.b64encode(self.jpeg_buffer).decode("utf-8")

            # สร้าง payload ที่จะส่งให้ frontend ผ่าน WS summary
            payload = {
                "CameraId": int(self.camera_id) + 1,             # หมายเลขกล้อง (1-based)
                "Time": datetime.now().strftime("%H:%M:%S"),     # เวลา ณ นาทีนี้
                "Attention": att,                                # สัดส่วน ATTENDENCE
                "Non_Attention": non,                            # สัดส่วน NON_ATTENDENCE
                "image": img_base64,                             # รูป base64
            }

            # เก็บ payload ไว้ใน latest_summary
            self.latest_summary = payload

        # ถ้ามี event loop กับ summary_ready_event อยู่
        if self.loop and self.summary_ready_event:
            # เรียก set() ผ่าน call_soon_threadsafe เพื่อแจ้ง loop ฝั่ง async ว่าพร้อมแล้ว
            self.loop.call_soon_threadsafe(self.summary_ready_event.set)

        # บันทึกลง JSON buffer ไว้รอ insert Supabase (สำหรับ camera_logs)
        if self.teacher_id and self.subject_id:
            try:
                save_buffer(
                    camera_id=self.camera_id,
                    teacher_id=self.teacher_id,
                    ATT=att,
                    NON=non,
                    class_json=class_json,
                    subject_id=self.subject_id,
                )
            except Exception as e:
                print(f"❌ save_buffer error cam {self.camera_id}: {e}")


# ==============================================================================
# ฟังก์ชันช่วย scan กล้องอย่างรวดเร็ว (ไม่เกี่ยวกับ track)
# ==============================================================================


@camera_router.get("/list-camera")
async def list_camera():
    """
    Endpoint สำหรับหน้า RecordPage.jsx ใช้ดึง "รายชื่อกล้อง" ที่ใช้งานได้

    ขั้นตอน:
    - ลอง quick_scan_camera ตั้งแต่ index 0-9
    - ถ้าเปิดได้ → เพิ่มลง list (id, name, status)
    - ถ้าไม่มีเลย → ส่ง message ว่าไม่เจอ
    """
    cams = []
    available_cameras.clear()
    # ลอง index 0 ถึง 9
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
        # ถ้าไม่เจอกล้องเลย → ส่ง message อย่างเดียว
        return {"message": "ไม่เจอ USB ที่กำลังเชื่อมต่อกล้อง"}

    # ถ้าเจอบางตัว → ส่ง list ของกล้องกลับไป
    return {"cameras": cams}


# ==============================================================================
# Start / Stop / Close กล้องทั้งหมด
# ==============================================================================

@camera_router.get("/start-all")
async def start_all_detections(
    subject_id: Optional[str] = None,
    user=Depends(verify_token),
):
    """
    Endpoint ใช้เริ่ม "การตรวจจับ/track" สำหรับทุกกล้องที่มี
    - ดึง teacher_id จาก token (ตาราง teacher)
    - เปิด Thread ใหม่สำหรับกล้องที่ยังไม่ถูกเปิด
    - set detecting=True เพื่อให้เริ่ม track
    """
    # ดึง event loop ปัจจุบันของ FastAPI (ใช้กับ WS summary ภายหลัง)
    loop = asyncio.get_running_loop()

    # ไป Supabase ตาราง teacher เพื่อเอา teacher_id ตาม user id
    teacher_res = (
        supabase_client.table("teacher")
        .select("teacher_id")
        .eq("id", user["id"])
        .execute()
    )

    # ถ้าเจอข้อมูล → เอา teacher_id ออกมา, ถ้าไม่เจอ → None
    t_id = teacher_res.data[0]["teacher_id"] if teacher_res.data else None

    # list เก็บ id กล้องที่เราจะ start ในคำสั่งนี้
    started = []

    # ถ้ามี available_cameras ที่ scan ไว้แล้ว → ใช้ id จากตรงนั้น
    cam_ids = (
        [str(cam["id"]) for cam in available_cameras]
    )

    # วนทุก camera id ที่จะใช้
    for cid in cam_ids:
        # ถ้า cid ยังไม่มีใน camera_threads หรือ Thread ตายไปแล้ว
        if cid not in camera_threads or not camera_threads[cid].is_alive():
            # สร้าง CameraThread ใหม่
            th = CameraThread(cid, teacher_id=t_id, subject_id=subject_id)

            # ให้ Thread รู้จัก event loop และ summary_ready_event
            th.loop = loop
            th.summary_ready_event = asyncio.Event()

            # set ให้ detect/track ทันที
            th.detecting = True

            # start Thread (จะไปเรียก th.run() ภายใน)
            th.start()

            # เก็บไว้ใน dictionary กลาง
            camera_threads[cid] = th
            print(camera_threads)
        else:
            # ถ้า Thread เดิมยังมีชีวิตอยู่ → เอา object เดิมมาใช้งานต่อ
            th = camera_threads[cid]
            # เปิดการ detect/track
            th.detecting = True
            th.loop = loop

            # ถ้า summary_ready_event ยังไม่มี → สร้างใหม่
            if th.summary_ready_event is None:
                th.summary_ready_event = asyncio.Event()

            # อัปเดต teacher_id / subject_id ให้ตรงกับค่าใหม่
            if t_id:
                th.teacher_id = t_id
                if not th.subject_id:
                    th.subject_id = subject_id or "DEFAULT_SUB"

        # เพิ่ม cid ลง list started
        started.append(cid)

    # ส่งข้อความกลับว่าเริ่มกล้องกี่ตัว id อะไรบ้าง
    return {"message": f"Started {len(started)} cameras", "started": started}


@camera_router.get("/stop-all")
async def stop_all_detections():
    """
    Endpoint สำหรับ "หยุด detect/track" ทุกกล้อง
    หมายเหตุ: ไม่ได้ปิดกล้อง, แค่ตั้ง th.detecting = False
    """
    for th in camera_threads.values():
        th.detecting = False
    return {"message": "Stopped detection for all cameras"}


@camera_router.get("/close-all")
async def close_all_cameras():
    """
    Endpoint สำหรับ "ปิดกล้องทั้งหมด" และหยุด Thread ทุกตัว
    - เรียก th.stop() ซึ่งจะ set stop_flag และ join thread
    - ลบ entry ของแต่ละกล้องออกจาก camera_threads
    """
    for cid, th in list(camera_threads.items()):
        th.stop()
        del camera_threads[cid]

    return {"message": "All camera threads closed"}


# ==============================================================================
# WebSocket: ส่งภาพจากกล้องแบบ real-time
# ==============================================================================
@camera_router.websocket("/ws/camera/{camera_id}")
async def ws_camera(websocket: WebSocket, camera_id: str):
    """
    WebSocket สำหรับส่งภาพ real-time ของกล้องแต่ละตัว (JPEG base64 string ต่อเฟรม)

    ขั้นตอน:
    - accept websocket
    - ถ้ายังไม่มี Thread กล้องนี้ → สร้าง CameraThread ใหม่ (detecting=False แค่ preview)
    - วนลูปดึง jpeg_buffer จาก Thread แล้วส่งไปหน้าเว็บ
    """
    # อนุญาตให้ client เชื่อมต่อ
    await websocket.accept()

    # ดึง event loop ปัจจุบัน
    loop = asyncio.get_running_loop()

    # ดึง query params teacher_id, subject_id (ถ้ามี) จาก URL
    teacher_id = websocket.query_params.get("teacher_id")
    subject_id = websocket.query_params.get("subject_id")

    # ----------------- สร้าง Thread ให้กล้องนี้ ถ้ายังไม่มี -----------------
    if camera_id not in camera_threads or not camera_threads[camera_id].is_alive():
        # สร้าง CameraThread ใหม่ (detecting=False → preview)
        th = CameraThread(camera_id, teacher_id=teacher_id, subject_id=subject_id)
        th.loop = loop
        th.summary_ready_event = asyncio.Event()
        th.detecting = False     # แสดงภาพอย่างเดียว ยังไม่ detect/track
        th.start()

        camera_threads[camera_id] = th
    else:
        # ถ้ามี Thread เดิม → อัปเดต teacher_id / subject_id ตาม query ล่าสุด
        th = camera_threads[camera_id]
        if teacher_id:
            th.teacher_id = teacher_id
        if subject_id:
            th.subject_id = subject_id

    # ให้ Thread รู้จัก event loop ปัจจุบัน
    th = camera_threads[camera_id]
    th.loop = loop

    try:
        # วนลูปส่งภาพไปเรื่อย ๆ
        while True:
            # อ่าน frame ล่าสุดจาก Thread ด้วย lock
            with th.lock:
                frame = th.jpeg_buffer

            if frame:
                # แปลง bytes → base64 string ก่อนส่งไปทาง WebSocket
                await websocket.send_text(base64.b64encode(frame).decode())

            # หน่วง ~0.04 วินาที (ประมาณ 25 fps)
            await asyncio.sleep(0.04)

    except WebSocketDisconnect:
        # ถ้ามีการ disconnect จากฝั่ง client → log ไว้
        print(f"🔌 WS camera disconnected: {camera_id}")
    finally:
        # พยายามปิด websocket ให้เรียบร้อย
        try:
            await websocket.close()
        except Exception:
            pass


# ==============================================================================
# WebSocket: ส่ง Summary ราย 1 นาที
# ==============================================================================
@camera_router.websocket("/ws/camera/summary/{camera_id}")
async def ws_summary(websocket: WebSocket, camera_id: str):
    """
    WebSocket สำหรับส่ง summary ราย 1 นาที ของกล้องแต่ละตัว

    การทำงาน:
    - accept websocket
    - หาว่า camera_id นี้มี Thread หรือไม่
    - รอให้ summary_ready_event ของ Thread ถูก set (จาก save_summary)
    - เมื่อ event ถูก set → ส่ง payload summary (th.latest_summary) ให้ client
    """
    # อนุญาตให้ client เชื่อมต่อ
    await websocket.accept()

    # ดึง event loop ปัจจุบัน
    loop = asyncio.get_running_loop()

    # หา Thread ของกล้องนี้จาก dict
    th = camera_threads.get(camera_id)
    if not th:
        # ถ้าไม่เจอ Thread เลย → ปิด WebSocket ทันที
        await websocket.close()
        return

    # ให้ Thread รู้จัก event loop
    th.loop = loop

    # ถ้า summary_ready_event ยังไม่มี → สร้างใหม่
    if th.summary_ready_event is None:
        th.summary_ready_event = asyncio.Event()

    try:
        # วนลูปตลอดการเชื่อมต่อ
        while True:
            # รอ event จาก Thread (จะถูก set ใน save_summary)
            await th.summary_ready_event.wait()
            # พอ event ถูก set แล้ว → reset event กลับไปเป็น False
            th.summary_ready_event.clear()

            # ดึง payload summary ล่าสุดจาก Thread ด้วย lock
            with th.lock:
                payload = th.latest_summary.copy()

            # ถ้ามี payload → ส่งเป็น JSON ไปยัง client
            if payload:
                await websocket.send_json(payload)

    except WebSocketDisconnect:
        # ถ้า client ปิด WebSocket → log ไว้
        print(f"🔌 WS summary disconnected: {camera_id}")
    finally:
        # พยายามปิด websocket
        try:
            await websocket.close()
        except Exception:
            pass


# ==============================================================================
# Endpoint: ดึง summary จาก buffer แล้ว insert ลง Supabase
# ==============================================================================
@camera_router.get("/summary-to-supabase")
async def summary_to_supabase_route():
    """
    Endpoint นี้มีหน้าที่:
    1) ดึง buffer ของทุกกล้อง จากไฟล์ JSON (ผ่าน load_buffer)
    2) เตรียม payload สำหรับ insert ลงตาราง camera_logs (ทุก record ที่มี)
    3) สร้าง daily summary (ค่าเฉลี่ย attention / non-attention / class_json_summary รายวัน)
       แล้ว insert ลงตาราง camera_daily_summary
    4) ล้าง buffer (ไฟล์ JSON) ด้วย clear_buffer เมื่อ insert สำเร็จ
    """
    all_summary_data = []

    try:
        # ----------------- 1) ดึงข้อมูลจาก buffer ของทุกกล้อง -----------------
        for cam_id in list(camera_threads.keys()):
            data = load_buffer(str(cam_id))
            if data:
                all_summary_data.append(data)

                # หลังอ่านแล้ว ลองลบไฟล์ buffer
                err_buffer = clear_buffer(str(cam_id))
                if err_buffer:
                    print("ไม่สามารถลบไฟล์ JSON ได้")
            else:
                print("ไม่เจอไฟล์ JSON ที่กำลังบันทึก")

        # ถ้าไม่มีข้อมูลเลยในทุก buffer → ส่ง message ว่าไม่มีข้อมูล
        if not all_summary_data:
            return {"message": "ไม่มีข้อมูลใน buffer", "inserted": 0}

        # ----------------- 2) เตรียม insert ลง camera_logs -----------------
        insert_payload = []

        # all_summary_data เป็น list ของ dict ต่อกล้อง
        for summary in all_summary_data:
            camera_id = summary["camera_id"]
            teacher_id = summary["teacher_id"]
            subject_id = (summary.get("subject_id") or "").strip()

            # summary["records"] เก็บข้อมูลหลายช่วงเวลาในวันนั้น
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

        # ถ้ามีข้อมูลพร้อม insert → เรียก Supabase insert
        if insert_payload:
            supabase_client.table("camera_logs").insert(insert_payload).execute()

        # ----------------- 3) เตรียม daily summary ลง camera_daily_summary -----------------
        # ใช้ defaultdict(list) เพื่อ group row ตาม (teacher_id, subject_id, camera_id, date)
        grops = defaultdict(list)

        for row in insert_payload:
            teacher_id = row["teacher_id"]
            subject_id = row["subject_id"]
            camera_id = row["camera_id"]

            # created_at เป็น datetime หรือ string (ISO) → แปลงเป็น datetime เสมอ
            dt = (
                row["created_at"]
                if isinstance(row["created_at"], datetime)
                else datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00"))
            )

            # date_key คือวันที่ในรูปแบบ YYYY-MM-DD
            date_key = dt.date().isoformat()

            key = (teacher_id, subject_id, camera_id, date_key)
            grops[key].append(row)

        # list สำหรับเก็บ row ที่จะ insert ลง camera_daily_summary
        daily_rows = []

        # วนกลุ่มทีละ group
        for (teacher_id, subject_id, camera_id, summary_date), rows in grops.items():
            total_att = 0.0
            total_non = 0.0
            count = len(rows)

            # เช่น {"Focused": 1.2, "LookingAway": 0.7, ...}
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
                    except Exception:
                        cj = {}

                for cls_name, ratio in cj.items():
                    class_totals[cls_name] += float(ratio or 0.0)

            # ค่าเฉลี่ย attention / non-attention ของวันนั้น
            avg_att = total_att / count if count > 0 else 0.0
            avg_non = total_non / count if count > 0 else 0.0

            # คำนวณค่าเฉลี่ย class_json_summary
            class_summary = {}
            if count > 0:
                for cls_name, total_val in class_totals.items():
                    class_summary[cls_name] = round(total_val / count, 3)

            # เตรียม row สำหรับ insert ลง camera_daily_summary
            daily_rows.append(
                {
                    "teacher_id": teacher_id,
                    "subject_id": subject_id,
                    "camera_id": camera_id,
                    "summary_date": summary_date,                  # string "YYYY-MM-DD"
                    "avg_attention": round(avg_att, 3),
                    "avg_non_attention": round(avg_non, 3),
                    "class_json_summary": class_summary,
                }
            )

        # ถ้ามี daily_rows ให้ insert ลง Supabase
        if daily_rows:
            supabase_client.table("camera_daily_summary").insert(daily_rows).execute()

        # สุดท้ายส่งคำตอบกลับว่าบันทึกสำเร็จ และมีกี่ record
        return {
            "message": "บันทึกข้อมูลเสร็จสิ้น",
            "inserted": len(insert_payload),
        }

    except Exception as e:
        # ถ้าระหว่างทางมี error → log และส่ง error message กลับ
        print("Error summary_to_supabase:", e)
        return {"error": str(e)}