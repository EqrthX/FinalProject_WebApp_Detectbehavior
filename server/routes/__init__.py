"""รวม router ของแต่ละส่วน เพื่อให้ main.py ดูแลเฉพาะการตั้งค่าแอป."""

from fastapi import APIRouter

from .admin_route import admin_route
from .auth_route import auth_route
from .camera import camera_router

api_router = APIRouter()
api_router.include_router(camera_router)
api_router.include_router(admin_route)
api_router.include_router(auth_route)
