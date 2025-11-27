# ดึงฟังก์ชัน get_model สำหรับโหลดโมเดล YOLO ที่คุณใช้ detect / track
from utils.model_loader import get_model

# นำเข้า List จาก typing (ตอนนี้ยังไม่ได้ใช้ในฟังก์ชันนี้ แต่เอาไว้เผื่อพิมพ์ type hint เพิ่มทีหลัง)
from typing import List


# ฟังก์ชันนี้มีหน้าที่สร้าง "โครง dict สำหรับเก็บสถิติของแต่ละคลาส"
# เช่น เอาไว้เก็บว่ามีเฟรมที่เป็น Focused กี่เฟรม, Talking กี่เฟรม ฯลฯ
def new_status_dict():
    try:
        # -------------------------------
        # 1) พยายามโหลดโมเดล YOLO
        # -------------------------------
        model = get_model()  # เรียกฟังก์ชันจาก model_loader (ปกติจะโหลดโมเดลที่เทรนไว้แล้ว)

        # ถ้า model ไม่มี attribute ที่ชื่อว่า "names"
        # แสดงว่ามันไม่มีข้อมูลชื่อคลาส → ถือว่าโมเดลใช้ไม่ได้
        if not hasattr(model, "names"):
            raise RuntimeError("YOLO model not loaded")

        # -------------------------------
        # 2) ดึงชื่อคลาสทั้งหมดจากโมเดล YOLO
        # -------------------------------
        # model.names มักจะเป็น dict เช่น {0: "Focused", 1: "LookingAway", ...}
        # เราเอาเฉพาะ values (ชื่อคลาส) มาแปลงให้เป็น list
        labels = list(model.names.values())

        # -------------------------------
        # 3) ลบคลาสที่ไม่ต้องการออก
        # -------------------------------
        # สมมติในโมเดลมี class "Phone" แต่คุณไม่อยากเอามานับในระบบนี้
        remove_classes = {"Phone"}

        # กรอง list labels ให้เหลือเฉพาะคลาสที่ "ไม่อยู่" ใน remove_classes
        labels = [cls for cls in labels if cls not in remove_classes]

    except Exception as e:
        # -------------------------------
        # 4) ถ้าโหลดโมเดลไม่ได้ / ผิดพลาดระหว่างทาง
        # -------------------------------
        # เช่น model โหลดไม่สำเร็จ, ไม่มี model.names, error อื่น ๆ
        # ให้โชว์ warning ใน console เพื่อ debug
        print(f"⚠️ [new_status_dict] Warning: cannot load model names ({e})")

        # แล้วใช้ fallback เป็น list ของคลาสที่เรากำหนดเองแทน
        # อันนี้คือ manual list ตาม dataset ที่คุณใช้
        labels = [
            "Focused",
            "LookingAway",
            "Looking_at_the_board",
            "Taking_notes",
            "Talking",
            "UsingPhone",
        ]

    # -------------------------------
    # 5) สร้าง dict สำหรับเก็บจำนวนเฟรมของแต่ละคลาส
    # -------------------------------
    # รูปแบบที่คืนค่ากลับไปจะเป็น:
    # {
    #     "frame_class_count": {
    #         "Focused": 0,
    #         "LookingAway": 0,
    #         ...
    #     }
    # }
    # เริ่มต้นทุกค่า = 0 เพราะยังไม่เจออะไรเลยในตอนเริ่มต้น
    return {
        "frame_class_count": {cls: 0 for cls in labels},
    }
