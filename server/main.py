# นำเข้า FastAPI เพื่อสร้าง Web Server / API หลักของระบบ
from fastapi import FastAPI

# นำเข้า CORS middleware สำหรับอนุญาตให้ frontend (React) เรียก API นี้ได้
from fastapi.middleware.cors import CORSMiddleware

# นำเข้า camera_router = API ที่เกี่ยวกับกล้อง
# นำเข้า cameras = dict ที่เก็บสถานะของแต่ละกล้อง (ใช้ปิดตอน server ปิด)
from routes.camera_route import camera_router, cameras

# นำเข้า admin_route = API สำหรับสร้างอาจารย์ / จัดการข้อมูล admin
from routes.admin_route import admin_route

# นำเข้า auth_route = API สำหรับ Login / ตรวจสอบสิทธิ์
from routes.auth_rote import auth_route


# สร้างแอป FastAPI หลัก
app = FastAPI()


# -------------------------------------------------------------
# 📌 เปิดใช้งาน CORS (Cross-Origin Resource Sharing)
# ให้ frontend ทุก domain สามารถเรียก API นี้ได้
# -------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # "*" = อนุญาตทุกเว็บไซต์ (React localhost, Production)
    allow_credentials=True,     # อนุญาต Cookie/Token
    allow_methods=["*"],        # อนุญาตทุก method: GET POST PUT DELETE ...
    allow_headers=["*"]         # อนุญาตทุก header
)


# -------------------------------------------------------------
# 📌 เพิ่มชุด API ต่าง ๆ เข้าไปใน FastAPI หลัก
# -------------------------------------------------------------
app.include_router(camera_router)   # API กล้อง
app.include_router(admin_route)     # API ผู้ดูแล (Admin)
app.include_router(auth_route)      # API Login / Auth


# -------------------------------------------------------------
# 📌 ฟังก์ชันนี้จะทำงานเมื่อตัว Server ปิดลง (shutdown)
# ใช้เพื่อปิดกล้องทุกตัวอย่างปลอดภัย
# -------------------------------------------------------------
@app.on_event("shutdown")
async def shutdown_event():
    print("🛑 Shutting down... closing all cameras")

    # วนลูปทุกกล้องที่ยังเปิดอยู่ในตัวแปร cameras
    for cam_id, cam_state in list(cameras.items()):
        try:
            # ตั้งค่าว่า "กล้องนี้ไม่ต้องทำงานต่อแล้ว"
            cam_state["running"] = False

            # ดึงตัวกล้อง (cv2.VideoCapture)
            cap = cam_state.get("cap")

            # ถ้ามีและเปิดอยู่ → ปิดกล้อง
            if cap and cap.isOpened():
                cap.release()

        except Exception as e:
            print(f"Error closing {cam_id}: {e}")

    # ล้างข้อมูลของกล้องทั้งหมดทิ้ง
    cameras.clear()
    print("✅ All cameras released")
