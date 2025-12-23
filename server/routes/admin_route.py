# นำเข้าเครื่องมือจาก FastAPI
from fastapi import APIRouter, HTTPException, Body 
from pydantic import BaseModel # 1. เพิ่ม import BaseModel

# นำเข้า Supabase client (ใช้เชื่อมกับฐานข้อมูลและระบบ Auth)
from config.bn_supabase import supabase_client, supabase_admin 

# สร้าง Router สำหรับกลุ่ม API ที่เกี่ยวกับ Admin 
# prefix = จะทำให้ endpoint นี้ขึ้นต้นด้วย /api/admin
admin_route = APIRouter(prefix="/api/admin", tags=["Admin"])

# 2. สร้าง Schema สำหรับรับข้อมูล JSON
class TeacherCreateSchema(BaseModel):
    email: str
    password: str
    teacher_id: str
    fullname: str
    major_id: str  # ตั้งชื่อให้ตรงกับ Frontend และ Database (snake_case)

@admin_route.post("/create-teacher")
async def create_teacher(teacher: TeacherCreateSchema): # 3. รับค่าผ่าน Schema
    try:
        if not supabase_admin:
            raise Exception("Service Role Key missing on Server")

        # 4. เวลาเรียกใช้ตัวแปร ต้องเรียกผ่าน teacher.xxx
        auth_response = supabase_admin.auth.admin.create_user(
            attributes={
                "email": teacher.email,
                "password": teacher.password,
                "email_confirm": True,
                "user_metadata": { "fullname": teacher.fullname }
            }
        )

        # ได้ผลลัพธ์เป็น object ของ user ที่เพิ่งถูกสร้าง
        new_user = auth_response.user
        
        if not new_user:
            raise Exception("ไม่สามารถสร้าง User Auth ได้")

        # แยกชื่อ-นามสกุล
        name_parts = teacher.fullname.strip().split(" ") 
        first_name = name_parts[0] 
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        # เตรียมข้อมูลลง DB
        profile_data = {
            "id": new_user.id,
            "teacher_id": teacher.teacher_id,
            "first_name": first_name,
            "last_name": last_name,
            "major_id": teacher.major_id # ตรงนี้ชื่อตรงกันแล้ว ไม่สับสน
        }
        
        result = supabase_admin.table("teacher").insert(profile_data).execute()

        # ถ้า insert สำเร็จ result.data จะมีข้อมูลกลับมา
        if result.data:
            return {"status": "success", "detail": "เพิ่มอาจารย์เสร็จสิ้น"}
        else:
            return {"status": "success", "detail": "เพิ่มอาจารย์เสร็จสิ้น (No data returned)"}

    except Exception as e:
        print(f"Error Create Teacher: {e}") 
        raise HTTPException(status_code=400, detail=str(e))
