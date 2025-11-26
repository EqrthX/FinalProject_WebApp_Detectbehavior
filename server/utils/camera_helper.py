from utils.instance_class import new_status_dict
import asyncio
import time

def final_hour_accuracy(interval_results):
    total_intervals = len(interval_results)
    valid_intervals = sum(1 for c in interval_results if c is not None)

    interval_accuracy = valid_intervals / total_intervals if total_intervals else 0

    return {
        "interval_accuracy": round(interval_accuracy, 4),
        "final_hour_accuracy": round(interval_accuracy, 4)
    }

def define_HIGH_CLASS():
    return ["Focused", "Looking_at_the_board", "Taking_notes"]

def define_LOW_CLASS():
    return ["LookingAway", "Talking", "UsingPhone"]

def create_camera_state(cap, teacher_id=None, subject_id=None):
    """คืนค่า state เริ่มต้นของแต่ละกล้อง"""
    return {
        "cap": cap,                   # กล้องที่เปิดอยู่
        "thread": None,               # Thread หรือ task ที่ใช้ detect
        "running": True,              # เปิดอยู่หรือไม่
        "detecting": False,           # กำลังตรวจจับอยู่ไหม
        "lock": asyncio.Lock(),
        # --- ระบบจับคลาสเป็นช่วงเวลา ---
        "interval_seconds": 5,               # จับ snapshot ทุก 5 วิ
        "last_interval_time": time.time(),   # เวลา snapshot ล่าสุด
        "interval_count": 0,                 # นับไปแล้วกี่รอบ (แต่ละรอบ = 5 วิ)
        "max_intervals": 12,                 # 12 รอบ = 1 นาที
        "interval_results": [],              # เก็บคลาสของแต่ละรอบ (5 วิ / ครั้ง)

        # --- YOLO detect state ---
        "last_frame": None,           # เฟรมล่าสุด
        "status": new_status_dict(),  # ✅ สถานะคลาสทั้งหมด
        "track_id": None,
        "teacher_id": teacher_id,
        "subject_id": subject_id,

        # --- สำหรับแสดงผล 30 วิ หรือ summary ---
        "show_class": {},
        "summary_ready_event": asyncio.Event(),

        "class_timer": {
            "current_class": None,
            "duration": 0.0,
            "frame_count": 0,
            "miss": 0,
        },
        "last_best_class": None,
        "last_best_conf": 0.0,
}
