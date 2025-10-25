from datetime import datetime
import os
import cv2
import json
from decimal import Decimal, ROUND_HALF_EVEN
from ultralytics import YOLO
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
    }

def calculate_average(dict_count: dict, dict_sum: dict):
    result = {}

    for key in dict_count.keys() & dict_sum.keys():
        num_class = Decimal(str(dict_count[key]))
        sum_class = Decimal(str(dict_sum[key]))

        if num_class != 0:
            value = (sum_class / num_class).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
            result[key] = float(value)
        else:
            result[key] = 0.0
    
    return result
