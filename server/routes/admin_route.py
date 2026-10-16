"""รับคำขอจัดการอาจารย์และตรวจรูปแบบข้อมูลด้วย Pydantic."""

from fastapi import APIRouter

from schemas.teacher import TeacherCreateSchema
from services import teacher_service

admin_route = APIRouter(prefix="/api/admin", tags=["Admin"])


@admin_route.post("/create-teacher")
async def create_teacher(teacher: TeacherCreateSchema):
    return await teacher_service.create_teacher(teacher)
