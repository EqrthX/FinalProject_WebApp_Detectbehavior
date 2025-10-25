from utils.model_loader import get_model
from typing import List
def create_camera_state(cap):
    return {
        "cap": cap, # เปิดกล้อง
        "thread": None, # การทำงานของ thread
        "running": True, # เช็คว่ากล้องเปิดและ run อยู่ไหม
        "detecting": False, # เช็คการตรวจจับ
        "seconds": 0, # นับวินาที
        "history_5min": [], # ประวัติ 5 นาที
        "last_frame": None, # เก็บภาพจาก model ครั้งสุดท้ายของ frame ส่งมีการส่งไปแสดงผล frontend
        "frame": 0,
        "status": new_status_dict(),
        "class_behavior": {}
    }

def new_status_dict():
    try:
        model = get_model()
        if not hasattr(model, "names"):
            raise RuntimeError("YOLO model not loaded")
        labels: List[str] = list(get_model().names.values())
    except Exception as e:
        print(f"⚠️ [new_status_dict] Warning: cannot load model names ({e})")
        labels = ["Book","Focused", "Ipad", "Lookaways", "Looking_at_the_board", "SlePhoneeping", "Taking_notes", "Talking", "UsingPhone"]


    return {
        "frame_class_count": {cls: 0 for cls in labels},
        "frame_class_sum_conf": {cls: 0.0 for cls in labels}
    }

def new_history_dict():
    return {
        "history_5min": [],
        "history_1hr": []
    }