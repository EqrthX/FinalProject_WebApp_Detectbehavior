from datetime import datetime
import os
import cv2

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