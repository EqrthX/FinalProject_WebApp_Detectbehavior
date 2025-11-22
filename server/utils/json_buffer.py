import json, os
from datetime import datetime

# สร้างไฟล์สำหรับเก็บข้อมูลลง json แยกเป็นของแต่ละกล้อง
def get_buffer_file(camera_id: str):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    server_dir = os.path.dirname(base_dir)
    buffer_dir = os.path.join(server_dir, "jsonlogs")
    os.makedirs(buffer_dir, exist_ok=True)
    return os.path.join(buffer_dir, f"camera_{int(camera_id) + 1}.json")

# บันทึกข้อมูลลงไฟล์ json ก่อน
def save_buffer(camera_id: str, cam_state, ATT, NON, class_json, subject_id: str):
    path = get_buffer_file(camera_id)

    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:

        data = {
            "camera_id": int(camera_id) + 1,
            "track_id": cam_state["track_id"],
            "teacher_id": cam_state["teacher_id"],
            "subject_id": subject_id,
            "records": []   
        }
    
    data["records"].append({
        "created_at": datetime.now().astimezone().isoformat(),
        "Attention": round(ATT, 3),
        "Non_Attention": round(NON, 3),
        "class_json": class_json,
    })

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"💾 Saved summary buffer → {path}")

# โหลดไฟล์ json ขึ้นมาเพื่อที่จะ
def load_buffer(camera_id: str):
    path = get_buffer_file(camera_id)
    if not os.path.exists(path):
        return None

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def clear_buffer(camera_id):
    path = get_buffer_file(camera_id)
    if os.path.exists(path):
        os.remove(path) 