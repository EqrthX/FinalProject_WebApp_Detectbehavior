
# นำเข้า asyncio เพื่อใช้สร้างตัวล็อก (Lock) และ Event ที่ใช้ร่วมกับ async/await
import asyncio

# นำเข้า time เพื่อใช้เก็บเวลาปัจจุบัน (timestamp) สำหรับนับรอบ/จับเวลา
import time


# -----------------------------
# 🔹 ฟังก์ชันกำหนด "กลุ่มคลาสที่ถือว่า ตั้งใจเรียน / Attention สูง"
# -----------------------------
def define_HIGH_CLASS():
    # คืนค่าเป็น list ของชื่อคลาสที่เราถือว่า "ดี / ตั้งใจเรียน"
    # ใช้ตอนคำนวณสัดส่วน High_Attention ใน 1 นาที
    return ["Focused", "Looking_at_the_board", "Taking_notes"]


# -----------------------------
# 🔹 ฟังก์ชันกำหนด "กลุ่มคลาสที่ถือว่า ไม่ตั้งใจเรียน / Attention ต่ำ"
# -----------------------------
def define_LOW_CLASS():
    # คืนค่าเป็น list ของชื่อคลาสที่เราถือว่า "ไม่ตั้งใจ / รบกวน / เล่นมือถือ ฯลฯ"
    # ใช้ตอนคำนวณสัดส่วน Low_Attention
    return ["LookingAway", "Talking", "UsingPhone"]


# -----------------------------
# 🔹 ฟังก์ชันสร้าง state เริ่มต้นของ "กล้อง 1 ตัว"
# ใช้เก็บข้อมูลทุกอย่างที่เกี่ยวกับกล้องตัวนั้น
# -----------------------------
def create_camera_state(cap, teacher_id=None, subject_id=None):
    """
    คืนค่า state เริ่มต้นของแต่ละกล้องเป็น dict ก้อนใหญ่ ๆ
    เอาไปเก็บในตัวแปร cameras[camera_id]

    cap         = ตัวกล้องที่เปิดแล้ว (cv2.VideoCapture)
    teacher_id  = อาจารย์ที่ใช้กล้องนี้ตอนนี้ (เพื่อผูก log กับคนสอน)
    subject_id  = วิชาที่กำลังสอน (เพื่อผูก log กับวิชา)
    """
    return {
        # ------------------ กล้องและ thread ------------------
        "cap": cap,                   # ตัวกล้องที่เปิดอยู่ (VideoCapture)
        "thread": None,               # ใช้เก็บ thread/task ที่ทำงาน loop อ่านเฟรม/YOLO (อาจจะเป็น asyncio.Task)
        "running": True,              # flag บอกว่ากล้องนี้ "ยังทำงานอยู่ไหม" (ใช้หยุด loop)
        "detecting": False,           # flag บอกว่าตอนนี้ "กำลังรัน YOLO detect อยู่หรือเปล่า"

        # Lock สำหรับกันไม่ให้หลายที่มาแก้ state ของกล้องพร้อมกัน
        # เช่น กล้องกำลังอ่านภาพอยู่ แล้วมีอีกที่สั่ง stop/start พร้อมกัน → จะไม่ชนกัน
        "lock": asyncio.Lock(),

        # ------------------ ระบบจับคลาสเป็นช่วงเวลา (Interval) ------------------
        # แนวคิด: ไม่ได้คำนวณทุกเฟรม แต่จับผล "ทุก ๆ 5 วินาที" แล้วเก็บไว้
        "interval_seconds": 5,               # ความยาว 1 interval = 5 วินาที
        "last_interval_time": time.time(),   # เวลา ณ ตอนที่เริ่มจับ interval ล่าสุด (เวลาเริ่มรอบปัจจุบัน)
        "interval_count": 0,                 # นับว่าตอนนี้ผ่านไปแล้วกี่ interval (5 วิ/ครั้ง)
        "max_intervals": 12,                 # 12 interval * 5 วิ = 60 วิ = 1 นาที
        "interval_results": [],              # list เก็บผลคลาสของแต่ละช่วง 5 วิ เช่น ["Focused","Focused","UsingPhone",...]

        # ------------------ YOLO detect state ------------------
        "last_frame": None,           # เก็บเฟรมล่าสุดที่อ่านได้ (เอาไว้ส่งให้ frontend หรือเอาไปวาดกรอบ)

        "track_id": None,             # ใช้ผูก "กล้องนี้" กับ "นักศึกษาคนใดคนหนึ่ง" ผ่าน track_id จาก YOLO/Tracker

        # ข้อมูลสำหรับผูก log กับอาจารย์และรายวิชาเวลาเซฟลงฐานข้อมูล
        "teacher_id": teacher_id,
        "subject_id": subject_id,

        # ------------------ สำหรับแสดงผล/สรุปทุก 30 วิ หรือ 1 นาที ------------------
        "show_class": {},             # เอาไว้เก็บคลาสที่ใช้แสดงสรุป (เช่น ratio High/Low/Other ใน 1 นาทีล่าสุด)

        # Event ของ asyncio เมื่อ summary พร้อมแล้ว (เช่น ครบ 1 นาที)
        # ส่วนที่เก็บ summary เสร็จจะ set() event นี้
        # ส่วนที่รอส่งไป frontend หรือเซฟ Supabase จะ await รอ event นี้
        "summary_ready_event": asyncio.Event(),

        # ------------------ Timer สำหรับคำนวณเวลาในแต่ละคลาส ------------------
        # ใช้แนวคิดว่า "ตอนนี้กล้องอยู่ในคลาสอะไร และอยู่นานแค่ไหนแล้ว"
        "class_timer": {
            "current_class": None,    # คลาสปัจจุบัน เช่น "Focused", "Talking"
            "duration": 0.0,         # ระยะเวลาที่อยู่ใน current_class นี้ (หน่วยวินาที)
            "frame_count": 0,        # จำนวนเฟรมที่เจอ current_class (ช่วยความเนียนของค่า)
            "miss": 0,               # จำนวนครั้งที่ "ไม่เจอ" object หรือไม่มั่นใจ (ใช้ตัดสินใจเปลี่ยนคลาส)
        },

        # ค่า best class ล่าสุดในรอบนั้น ๆ (ผลสรุปของช่วงระยะหนึ่ง เช่น 1 วินาที / 5 วินาที)
        "last_best_class": None,      # ชื่อคลาสที่โมเดลมั่นใจที่สุดในช่วงที่ผ่านมา เช่น "Focused"
        "last_best_conf": 0.0,        # ค่า confidence สูงสุดที่เจอสำหรับ last_best_class เช่น 0.87
    }

"""
cameras = {
    "0": create_camera_state(cap0, teacher_id="T001", subject_id="SUB001"),
    "1": create_camera_state(cap1, teacher_id="T001", subject_id="SUB001"),
    # ...
}
"""