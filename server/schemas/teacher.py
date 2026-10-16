"""รูปแบบข้อมูลสำหรับสร้างอาจารย์ ใช้ field และ validation เดิม."""

from pydantic import BaseModel


class TeacherCreateSchema(BaseModel):
    email: str
    password: str
    teacher_id: str
    fullname: str
    major_id: str  # ตั้งชื่อให้ตรงกับ Frontend และ Database (snake_case)
