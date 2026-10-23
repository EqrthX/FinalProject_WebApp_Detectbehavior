"""รับคำขอจัดการอาจารย์และตรวจรูปแบบข้อมูลด้วย Pydantic."""

from fastapi import APIRouter, Depends

from schemas.teacher import TeacherCreateSchema
from services import teacher_service
from utils.auth import required_admin
admin_route = APIRouter(prefix="/api/admin", tags=["Admin"])


@admin_route.post("/create-teacher")
async def create_teacher(teacher: TeacherCreateSchema, admin=Depends(required_admin)):
    return await teacher_service.create_teacher(teacher)
