import json, os
from datetime import datetime


# ------------------------------------------------------------
# 📌 ฟังก์ชัน: get_buffer_file(camera_id)
# ใช้สำหรับหา "ตำแหน่งไฟล์ .json" ที่เก็บข้อมูลของกล้องแต่ละตัว
# เช่น camera_1.json, camera_2.json, ...
# ------------------------------------------------------------
def get_buffer_file(camera_id: str):
    # __file__ คือ path ของไฟล์นี้เอง (json_buffer.py)
    # os.path.abspath(__file__) → path เต็มของไฟล์นี้
    # os.path.dirname → โฟลเดอร์ที่ไฟล์นี้อยู่
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # server_dir = โฟลเดอร์แม่ของ base_dir
    # เช่น .../server/utils/json_buffer.py → ขึ้นบน 1 ขั้น = .../server/
    server_dir = os.path.dirname(base_dir)

    # สร้างโฟลเดอร์ jsonlogs ในโฟลเดอร์ server
    buffer_dir = os.path.join(server_dir, "jsonlogs")
    os.makedirs(buffer_dir, exist_ok=True)  # สร้างถ้าไม่มี

    # คืนค่า path ของไฟล์ json ตามหมายเลขกล้อง
    # +1 เพื่อให้กล้องนับเริ่มที่ 1 เช่น camera_1.json
    return os.path.join(buffer_dir, f"camera_{int(camera_id) + 1}.json")


# ------------------------------------------------------------
# 📌 ฟังก์ชัน: save_buffer()
# ทำหน้าที่: “เก็บผลสรุป 1 นาที” ลงไฟล์ JSON ชั่วคราว
# เช่น ATT = 0.65, NON = 0.30, class_json = {...}
# ------------------------------------------------------------
def save_buffer(camera_id: str, cam_state, ATT, NON, class_json, subject_id: str):
    path = get_buffer_file(camera_id)  # หาไฟล์ json ของกล้องนี้ก่อน

    # ถ้าไฟล์มีอยู่แล้ว → โหลดข้อมูลเดิมขึ้นมา (append เพิ่ม)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        # ถ้าเป็นไฟล์ใหม่ → สร้างโครง JSON เริ่มต้น
        data = {
            "camera_id": int(camera_id) + 1,
            "teacher_id": cam_state["teacher_id"],  # ใครเป็นคนสอน
            "subject_id": subject_id,              # วิชาอะไร
            "records": []                           # เก็บข้อมูลรายนาที
        }
    
    # บันทึกข้อมูลเพิ่มเข้าไปใน records (คล้ายการเพิ่ม 1 รายการ)
    data["records"].append({
        "created_at": datetime.now().astimezone().isoformat(),  # เวลาปัจจุบันแบบ ISO
        "Attention": round(ATT, 3),        # ค่า Attention เช่น 0.682
        "Non_Attention": round(NON, 3),    # ค่า Non_Attention
        "class_json": class_json,          # รายละเอียด class แบบเต็ม
    })

    # เขียนข้อมูลกลับลงไฟล์ JSON
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"💾 Saved summary buffer → {path}")


# ------------------------------------------------------------
# 📌 ฟังก์ชัน: load_buffer()
# โหลดไฟล์ JSON ที่เคยบันทึกไว้ของกล้องแต่ละตัว
# ------------------------------------------------------------
def load_buffer(camera_id: str):
    path = get_buffer_file(camera_id)
    if not os.path.exists(path):
        return None  # ไม่มีไฟล์ ก็ return None ไปเลย

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)   # data ที่อยู่ในไฟล์


# ------------------------------------------------------------
# 📌 ฟังก์ชัน: clear_buffer()
# ใช้สำหรับลบไฟล์ JSON หลังจากที่ข้อมูลถูก insert 
# ลง Supabase สำเร็จแล้ว (กันไฟล์ค้าง)
# ------------------------------------------------------------
def clear_buffer(camera_id):
    path = get_buffer_file(camera_id)
    if os.path.exists(path):
        os.remove(path)  # ลบไฟล์ออกจากระบบ
