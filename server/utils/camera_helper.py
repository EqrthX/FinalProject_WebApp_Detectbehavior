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

def average_dict_hourly(history_5min = []):
    result = {}
    n = len(history_5min)

    for group in history_5min[0]["average"].keys():
        result[group] = {}
        for label in history_5min[0]["average"][group].keys():
            result[group][label] = 0.0
    
    for record in history_5min:
        avg_block = record["average"]
        for group, sub in avg_block.items():
            for label, value in sub.items():
                result[group][label] += value
    
    for group, sub in result.items():
        for label in sub:
            result[group][label] /= n
    
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
        file_log = f"log_1hr_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"  # กันชื่อไฟล์ซ้ำ
        with open(file_log, 'w', encoding='utf-8') as file:
            json.dump(history_1hr, file, ensure_ascii=False, indent=2)
        print("บันทึก Log 1 ชั่วโมง เรียบร้อย", file_log)
    
    if history_5min:
        file_log = f"log_5min_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"  # กันชื่อไฟล์ซ้ำ
        with open(file_log, 'w', encoding='utf-8') as file:
            json.dump(history_5min, file, ensure_ascii=False, indent=2)
        print("บันทึก Log 5 นาที เรียบร้อย", file_log)

    