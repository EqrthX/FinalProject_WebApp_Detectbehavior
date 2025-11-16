from fastapi import APIRouter, HTTPException, Form
from config.bn_supabase import supabase_client

admin_route = APIRouter(prefix="/api/admin", tags=["Admin"])

@admin_route.post("/create-teacher")
async def create_teacher(
    email:str = Form(), 
    password:str = Form(), 
    teacher_id: str = Form(), 
    fullname: str = Form(), 
    major: str = Form()
    ):
    try:
        print("email", email)
        print("password", password)
        print("teacher_id", teacher_id)
        print("fullname", fullname)
        print("major", major)
    
        auth_response = supabase_client.auth.admin.create_user(
            attributes={
                "email": email,
                "password": password,
                "email_confirm": True
            }
        ) 
        new_user = auth_response.user
        if not new_user:
            raise HTTPException(status_code=400, detail="❌ ฟังก์ชั่น create teacher ผิดพลาด")
        
        name_part = fullname.split(" ")
        first_name = name_part[0]
        last_name = name_part[1] if len(name_part) > 1 else ""

        profile_data = {
            "id": new_user.id,
            "teacher_id": teacher_id,
            "first_name": first_name,
            "last_name": last_name,
            "major_id": major
        }

        result = supabase_client.table("teacher").insert(profile_data).execute()

        if result.data:
            return {"status": "success", "detail": "เพิ่มอาจารย์เสร็จสิ้น"}
        else:
            raise HTTPException(status_code=400, detail=f"Insert failed: {result.error}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"อีเมลนี้ถูกลงทะเบียนแล้ว")