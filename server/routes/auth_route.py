"""รับข้อมูล login จาก HTTP แล้วส่งต่อให้ service."""

from fastapi import APIRouter, Form

from services import auth_service

auth_route = APIRouter(prefix="/api/auth", tags=["Auth"])


@auth_route.post("/login-by-id")
async def login_by_teacher_id(
    teacher_id: str = Form(),
    password: str = Form(),
):
    return await auth_service.login_by_teacher_id(teacher_id, password)
