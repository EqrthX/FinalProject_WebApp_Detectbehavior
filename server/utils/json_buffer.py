import json, os, glob
from datetime import datetime

def get_json_dir():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    server_dir = os.path.dirname(base_dir)
    buffer_dir = os.path.join(server_dir, "jsonlogs")
    os.makedirs(buffer_dir, exist_ok=True)
    return buffer_dir

# ✅ ปรับแก้: รับ session_id มาตั้งชื่อไฟล์ให้ไม่ซ้ำกันในแต่ละรอบ
def get_buffer_file(camera_id: str, teacher_id: str, subject_id: str, group, session_id):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    server_dir = os.path.dirname(base_dir)
    buffer_dir = os.path.join(server_dir, "jsonlogs")
    os.makedirs(buffer_dir, exist_ok=True)
    # ใส่ session_id ลงไปในชื่อไฟล์
    return os.path.join(buffer_dir, f"camera_{int(camera_id) + 1}_{teacher_id}_{subject_id}_{group}_{session_id}.json")

# ✅ ปรับแก้: รับ parameter session_id เพิ่ม
def save_buffer(camera_id: str, teacher_id, ATT, NON, class_json, subject_id: str, group, class_duration, session_id):
    path = get_buffer_file(camera_id, teacher_id=teacher_id, subject_id=subject_id, group=group, session_id=session_id)

    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {
            "camera_id": int(camera_id) + 1,
            "teacher_id": teacher_id,
            "subject_id": subject_id,
            "group": group,
            "session_id": session_id, # เก็บ session_id ไว้ในไฟล์ด้วย
            "records": []   
        }
    
    data["records"].append({
        "created_at": datetime.now().astimezone().isoformat(),
        "Attention": round(ATT, 3),
        "Non_Attention": round(NON, 3),
        "class_json": class_json,
        "class_duration": class_duration
    })

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # print(f"💾 Saved buffer → {os.path.basename(path)}")

def get_all_pending_files():
    buffer_dir = get_json_dir()
    files = glob.glob(os.path.join(buffer_dir, "*.json"))
    return files