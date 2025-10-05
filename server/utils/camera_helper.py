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
    if total <= 0:
        return data_dict
    
    result = {}
    for group, sub in data_dict.items():
        result[group] = {}

        for label, conf in sub.items():
            result[group][label] = conf / total

    return result 

def calculate_average(history = []):

    if not history:
        return {
            "High_Attention": {},
            "Low_Attention": {}
        }
    
    result_high, result_low = {}, {}
    for record_list in history:
        
        for key, value in record_list['average']['High_Attention'].items():
            result_high[key] = result_high.get(key, 0) + value

        for key, value in record_list['average']['Low_Attention'].items():
            result_low[key] = result_low.get(key, 0) + value
    
    n = len(history)
    for i in result_high.items():
        result_high[i[0]] = i[1] / n
    
    for i in result_low.items():
        result_low[i[0]] = i[1] / n

    return {
        "High_Attention": result_high, 
        "Low_Attention": result_low
        }
    
def generate_image_filename():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"snapshot_{timestamp}.jpg"

def save_snapshot(frame, filename, folder):
    os.makedirs(folder, exist_ok=True)
    save_path = os.path.join(folder, filename)
    if cv2.imwrite(save_path, frame):
        print(f"✅ Image saved: {save_path}")
        return save_path
    else:
        print(f"❌ Failed to save image: {save_path}")
        return None

def save_file_log(history_5min = [], history_1hr = []):

    file_5min = "log_5min.json"
    file_1hr = "log_1hr.json"

    if history_5min:
        with open(file_5min, 'w', encoding='utf-8') as file:
            json.dump(history_5min, file, ensure_ascii=False, indent=2)
            file.write(',\n')

    if history_1hr:
        with open(file_1hr, 'w', encoding='utf-8') as file:
            json.dump(history_1hr, file, ensure_ascii=False, indent=2)
            file.write(',\n')
    
