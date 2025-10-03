from datetime import datetime
import os
import cv2
import json

def empty_classAttection ():
    return {
        "High_Attention" : {
            "Focused": 0.0
        },
        "Low_Attention" : {
            "Drinking": 0.0,
            "Eating": 0.0,
            "Lookaways": 0.0,
            "Sleeping": 0.0,
            "UsingPhone": 0.0,
        }
    }

def average_dict_attendence(data_dict, total):
    result = {}

    for group, sub in data_dict.items():
        result[group] = {}

        for label, conf in sub.items():
            result[group][label] = conf / total

    return result 

def generate_image_filename():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"snapshot_{timestamp}.jpg"

def save_snapshot(frame, filename, folder):
    save_path = os.path.join(folder, filename)

    if cv2.imwrite(save_path, frame):
        print(f"✅ Image saved: {save_path}")
        return save_path
    else:
        print(f"❌ Failed to save image: {save_path}")
        return None

def save_file_log(history_5min = [], history_1hr = []):

    if history_1hr:
        file_log = f"log_1hr_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"  # กันชื่อไฟล์ซ้ำ
        with open(file_log, 'a', encoding='utf-8') as file:
            for his_1h in history_1hr:
                file.write("--- Mean 1 hour ---\n")
                file.write(json.dumps(his_1h) + "\n")

        print("บันทึก Log 1 ชั่วโมง เรียบร้อย", file_log)
    
    if history_5min:
        file_log = f"log_1min_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"  # กันชื่อไฟล์ซ้ำ
        with open(file_log, 'a', encoding='utf-8') as file:
            for his_5m in history_5min:
                file.write("--- Mean 5 minute ---\n")
                file.write(json.dumps(his_5m) + "\n")

        print("บันทึก Log 5 นาที เรียบร้อย", file_log)

    