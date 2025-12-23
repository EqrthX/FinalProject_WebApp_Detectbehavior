# นำเข้า FastAPI เพื่อสร้าง Web Server / API หลักของระบบ
from fastapi import FastAPI

# นำเข้า CORS middleware สำหรับอนุญาตให้ frontend (React) เรียก API นี้ได้
from fastapi.middleware.cors import CORSMiddleware
from routes.camera_route import camera_router
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

app.include_router(camera_router)
app.include_router(admin_route)
app.include_router(auth_route)
