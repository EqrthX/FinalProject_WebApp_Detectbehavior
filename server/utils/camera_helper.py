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

def calculate_average(frame_total, dict_count: dict, dict_sum: dict):
    result = {}
    
    for key in dict_count.keys() & dict_sum.keys():
        num = Decimal(str(dict_count[key])) # ใช้ frame_class_count จำนวนครั้งที่เจอ
        sum_conf = Decimal(str(dict_sum[key])) # ใช้ frame_conf_count ผลรวม conf
        

        # ค่าเฉลี่ย conf ต่อเฟรมทั้งหมด (เอาไว้ใช้ประกอบ)
        avg_conf_frame = (sum_conf / Decimal(str(frame_total))).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN) if frame_total != 0 else Decimal("0.00") 

        # ค่าเฉลี่ย conf เฉพาะตอนที่เจอ class นั้น
        avg_conf_detect = (sum_conf / num).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN) if num != 0 else Decimal("0.00")

        # อัตราส่วนความถี่ต่อจำนวนเฟรมทั้งหมด
        ratio = (num / Decimal(str(frame_total))).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN) if frame_total != 0 else Decimal("0.00")  

        result[key] = {
            "avg_conf_detect": float(avg_conf_detect),
            "avg_conf_frame": float(avg_conf_frame),
            "ratio": float(ratio)
        }  

    return result

def compare_class(avg_dict: dict):
    HIGH_CLASSES = ["Focused", "Looking_at_the_board", "Taking_notes"]
    LOW_CLASSES = ["Lookaways", "Talking", "UsingPhone",]
    
    high_conf_sum, high_ratio_sum, high_count = 0.0, 0.0, 0
    low_conf_sum, low_ratio_sum, low_count = 0.0, 0.0, 0

    for key, val in avg_dict.items():
        avg_conf_frame = val.get("avg_conf_frame", 0.0)
        avg_conf_detect = val.get("avg_conf_detect", 0.0)
        ratio = val.get("ratio", 0.0)

        if key in HIGH_CLASSES:
            print(f"🎓 High -> {key}: conf={avg_conf_detect}, ratio={ratio}")
            high_conf_sum += avg_conf_detect
            high_ratio_sum += ratio
            high_count += 1
        elif key in LOW_CLASSES:
            print(f"💤 Low -> {key}: conf={avg_conf_detect}, ratio={ratio}")
            low_conf_sum += avg_conf_detect
            low_ratio_sum += ratio
            low_count += 1

    high_conf_avg = round(high_conf_sum / high_count, 3) if high_count else len(HIGH_CLASSES)
    low_conf_avg = round(low_conf_sum / low_count, 3) if low_count else len(LOW_CLASSES)

    high_ratio_avg = round(high_ratio_sum / high_count, 3) if high_count else len(HIGH_CLASSES)
    low_ratio_avg = round(low_ratio_sum / low_count, 3) if low_count else len(LOW_CLASSES)

    print("\n📊 สรุปผลรวม:")
    print(f"🎓 High Avg Conf: {high_conf_avg}, Avg Ratio: {high_ratio_avg}")
    print(f"💤 Low  Avg Conf: {low_conf_avg}, Avg Ratio: {low_ratio_avg}")
