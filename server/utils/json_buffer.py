import json, os, glob
from datetime import datetime

# หา path โฟลเดอร์ jsonlogs
def get_json_dir():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    server_dir = os.path.dirname(base_dir)
    buffer_dir = os.path.join(server_dir, "jsonlogs")
    os.makedirs(buffer_dir, exist_ok=True)
    return buffer_dir

# สร้างไฟล์สำหรับเก็บข้อมูลลง json แยกเป็นของแต่ละกล้อง
def get_buffer_file(camera_id: str, teacher_id: str, subject_id: str, group):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    server_dir = os.path.dirname(base_dir)
    buffer_dir = os.path.join(server_dir, "jsonlogs")
    os.makedirs(buffer_dir, exist_ok=True)
    return os.path.join(buffer_dir, f"camera_{int(camera_id) + 1}_{teacher_id}_{subject_id}_{group}.json")

# -----------------------------------------------------------
# 2. ฟังก์ชัน Save (ใช้โค้ดที่คุณเขียนมาได้เลย + ปรับนิดหน่อย)
# -----------------------------------------------------------
def save_buffer(camera_id: str, teacher_id, ATT, NON, class_json, subject_id: str, group, class_duration):
    # เรียกใช้ get_buffer_file เพื่อได้ path ที่ถูกต้อง
    path = get_buffer_file(camera_id, teacher_id=teacher_id, subject_id=subject_id, group=group)

    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {
            "camera_id": int(camera_id) + 1,
            "teacher_id": teacher_id,
            "subject_id": subject_id,
            "group": group,
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
    
    print(f"💾 Saved buffer → {os.path.basename(path)}")

# -----------------------------------------------------------
# 4. ✅ ฟังก์ชันใหม่: กวาดหาไฟล์ทั้งหมด (ต้องมี!)
# -----------------------------------------------------------
def get_all_pending_files():
    buffer_dir = get_json_dir()
    # หาไฟล์ทุกอันที่ลงท้ายด้วย .json ไม่สนว่าชื่อ Teacher อะไร
    files = glob.glob(os.path.join(buffer_dir, "*.json"))
    return files