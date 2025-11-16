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

ATT = define_HIGH_CLASS()
NON_ATT = define_LOW_CLASS()

def calculate_1s(total_frame, frame_dict):
    att_sum = 0
    non_att_sum = 0
    oth_sum = 0
    class_ratios_json = {}
    result_att = 0
    result_non_att = 0
    result_oth = 0

    if total_frame <= 0:
        return 0.0, 0.0, 0.0, {k: 0.0 for k in frame_dict.keys()}
    else:
        class_ratios_json = {
            k: round(v / total_frame, 3)
            for k, v in frame_dict.items()
        }

        att_sum = sum(v for k, v in frame_dict.items() if k in ATT)
        non_att_sum = sum(v for k, v in frame_dict.items() if k in NON_ATT)
        oth_sum = sum(v for k, v in frame_dict.items() if k not in ATT and k not in NON_ATT)

        result_att = att_sum / total_frame
        result_non_att = non_att_sum / total_frame
        result_oth = oth_sum / total_frame

    return result_att, result_non_att, result_oth, class_ratios_json

def calculate_30s(sec_data, class_keys):
    
    avg_att = sum(x['att'] for x in sec_data) / len(sec_data)
    avg_non = sum(x['non'] for x in sec_data) / len(sec_data)
    avg_oth = sum(x['oth'] for x in sec_data) / len(sec_data)

    avg_class_ratio = {}

    for cls in class_keys:
        avg_class_ratio[cls] = round(
            sum(item['class_json'][cls] for item in sec_data) / len(sec_data), 3
        )

    return avg_att, avg_non, avg_oth, avg_class_ratio
        
