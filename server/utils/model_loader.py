# นำเข้า YOLO class จากไลบรารี ultralytics
# ใช้สำหรับโหลดโมเดล .pt ที่คุณเทรนมาแล้ว
from ultralytics import YOLO

# os เอาไว้จัดการเส้นทางไฟล์ เช่น path ของโมเดล
import os

# ตัวแปร model ใช้เก็บโมเดลที่โหลดแล้ว
# เริ่มต้นเป็น None = ยังไม่ได้โหลด
model = None


# ------------------------------------------------------------
# 📌 ฟังก์ชัน get_model()
# หน้าที่:
#   - โหลดโมเดล YOLO จากไฟล์ best.pt
#   - ใช้ global cache = โหลดครั้งเดียว ใช้ซ้ำได้ทุกที่
#   - ถ้าโหลดไม่ได้ จะโยน error ให้รู้ทันที
# ------------------------------------------------------------
def get_model():
    global model  # บอก Python ว่าใช้ตัวแปร model ที่ประกาศข้างบน

    # --------------------------------------
    # 1) ถ้า model เคยโหลดแล้ว → ใช้ซ้ำทันที
    # --------------------------------------
    # เพื่อประหยัดเวลา (ไม่ต้องโหลดใหม่ทุกครั้ง)
    if model is not None:
        return model
    
    # --------------------------------------
    # 2) สร้าง path ไฟล์โมเดล .pt ที่เก็บไว้
    # --------------------------------------
    # BASE_DIR = โฟลเดอร์ที่ไฟล์นี้ (model_loader.py) อยู่
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

    # MODEL_PATH = path ที่วิ่งออกไปหาไฟล์ best.pt
    # มักจะอยู่ใน: /dataset/detect/train/weights/best.pt
    MODEL_PATH = os.path.join(
        BASE_DIR,
        "..", "..",          # ขึ้นไป 2 โฟลเดอร์  
        "dataset", "detect", "train", "weights",
        "best.pt"            # ไฟล์โมเดลที่เทรนเสร็จ
    )
    
    # --------------------------------------
    # 3) เช็คว่ามีไฟล์โมเดลจริงไหม
    # --------------------------------------
    if not os.path.exists(MODEL_PATH):
        print(f"❌ [model_loader] Model file not found at: {MODEL_PATH}")
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
    
    # --------------------------------------
    # 4) พยายามโหลดโมเดล YOLO จากไฟล์
    # --------------------------------------
    try:
        print(f"[model_loader] ดึงโมเดลจาก {MODEL_PATH}")

        # โหลดโมเดล YOLO
        model = YOLO(MODEL_PATH)

        print(f"[model_loader] โหลดโมเดลสำเร็จ ({len(model.names)}) classes")

        return model

    except Exception as e:
        # ถ้าโหลดไม่ได้ → แจ้งเตือน + โยน error เพื่อให้ระบบรู้
        print(f"❌ [model_loader] Failed to load YOLO model: {e}")
        raise RuntimeError("Cannot load YOLO model") from e
