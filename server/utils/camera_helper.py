from utils.instance_class import new_status_dict
from datetime import datetime
from config.bn_supabase import supabase_client
import asyncio
def define_HIGH_CLASS():
    return ["Focused", "Looking_at_the_board", "Taking_notes"]

def define_LOW_CLASS():
    return ["LookingAway", "Talking", "UsingPhone"]

def create_camera_state(cap, teacher_id=None):
    """คืนค่า state เริ่มต้นของแต่ละกล้อง"""
    return {
        "cap": cap,                   # กล้องที่เปิดอยู่
        "thread": None,               # Thread หรือ task ที่ใช้ detect
        "running": True,              # เปิดอยู่หรือไม่
        "detecting": False,           # กำลังตรวจจับอยู่ไหม
        "seconds": 0,                 # นับเวลา
        "last_frame": None,           # เฟรมล่าสุด
        "status": new_status_dict(),  # ✅ สถานะคลาสทั้งหมด
        "teacher_id": teacher_id,
        "track_id": None,
        "show_class": {},
        "summary_ready_event": asyncio.Event()
    }
