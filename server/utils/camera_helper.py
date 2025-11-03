from decimal import Decimal, ROUND_HALF_EVEN
from utils.instance_class import new_status_dict

def create_camera_state(cap):
    """คืนค่า state เริ่มต้นของแต่ละกล้อง"""
    return {
        "cap": cap,                   # กล้องที่เปิดอยู่
        "thread": None,               # Thread หรือ task ที่ใช้ detect
        "running": True,              # เปิดอยู่หรือไม่
        "detecting": False,           # กำลังตรวจจับอยู่ไหม
        "seconds": 0,                 # นับเวลา
        "last_frame": None,           # เฟรมล่าสุด
        "frame": 0,                   # นับเฟรม
        "status": new_status_dict(),  # ✅ สถานะคลาสทั้งหมด
        "track_id": None
    }

def calculate_average(frame_total, dict_count: dict, ):
    result = {}
    
    for key in dict_count.keys() :
        num_class = Decimal(str(dict_count[key])) # ใช้ frame_class_count จำนวนครั้งที่เจอในแต่ละ class นั้นๆ
    
        # อัตราส่วนความถี่ต่อจำนวนเฟรมทั้งหมด
        ratio = (num_class / Decimal(str(frame_total))).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN) if frame_total != 0 else Decimal("0.00")  

        result[key] = {
            "ratio": float(ratio)
        }  

    return result

def compare_class(avg_dict: dict):
    HIGH_CLASSES = ["Focused", "Looking_at_the_board", "Taking_notes"]
    LOW_CLASSES = ["LookingAway", "Talking", "UsingPhone",]
    
    high_ratio_sum =  0.0
    low_ratio_sum = 0.0
    total_ratio = sum(val['ratio'] for val in avg_dict.values())

    if total_ratio == 0:
        total_ratio= 1
    
    # Normaalize ให้รวมเป็น 1.0
    normalized = {k: v["ratio"] / total_ratio for k, v in avg_dict.items() }
    
    # คำนวนหาค่าเฉลี่ยของอัตราการตรวจเจอ
    high_ratio_sum = sum(normalized[k] for k in HIGH_CLASSES if k in normalized)
    low_ratio_sum = sum(normalized[k] for k in LOW_CLASSES if k in normalized)

    print("\n📊 สรุปผลรวม:")
    print(f"🎓 High Avg Ratio: {round(high_ratio_sum, 2)}")
    print(f"💤 Low  Avg Ratio: {round(low_ratio_sum, 2)}")
