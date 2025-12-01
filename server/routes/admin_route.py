from fastapi import APIRouter, HTTPException, Form
from config.bn_supabase import supabase_client, supabase_admin 

admin_route = APIRouter(prefix="/api/admin", tags=["Admin"])

@admin_route.post("/create-teacher")
async def create_teacher(
    email:str = Form(), 
    password:str = Form(), 
    teacher_id: str = Form(), 
    fullname: str = Form(), 
    majorId: str = Form()
    ):
    try:
        # 1. เช็คว่ามี Admin Client (Service Role) หรือไม่
        if not supabase_admin:
            raise Exception("Service Role Key missing on Server")

        # 2. สร้าง User ในระบบ Auth (ใช้ admin create_user)
        auth_response = supabase_admin.auth.admin.create_user(
            attributes={
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": { "fullname": fullname }
            }
        ) 
        new_user = auth_response.user
        
        if not new_user:
            raise Exception("ไม่สามารถสร้าง User Auth ได้")

        # 🟢 3. (จุดที่ขาดไป) ต้องแยก fullname เป็น first_name กับ last_name ก่อน
        name_parts = fullname.strip().split(" ") # ตัดคำด้วยช่องว่าง
        first_name = name_parts[0] # คำแรกเป็นชื่อจริง
        # คำที่เหลือเอามาต่อกันเป็นนามสกุล (ถ้ามี)
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        # 4. เตรียมข้อมูลลงตาราง teacher
        profile_data = {
            "id": new_user.id,
            "teacher_id": teacher_id,
            "first_name": first_name, # ตอนนี้ตัวแปรนี้มีค่าแล้ว
            "last_name": last_name,   # ตอนนี้ตัวแปรนี้มีค่าแล้ว
            "major_id": majorId       # เช็คชื่อ field ให้ตรง DB (ใน DB เป็น major_id)
        }
        
        # 5. Insert ข้อมูลลง Table teacher (ใช้ supabase_admin เพื่อข้าม RLS)
        result = supabase_admin.table("teacher").insert(profile_data).execute()

        # เช็คผลลัพธ์ (supabase-py เวอร์ชั่นใหม่ถ้า insert สำเร็จมักจะคืน data มาเป็น list ไม่ใช่ None)
        if result.data:
            return {"status": "success", "detail": "เพิ่มอาจารย์เสร็จสิ้น"}
        else:
            # กรณีที่ไม่ error แต่ไม่มี data กลับมา (บางทีอาจจะเกิดขึ้นได้ แต่ส่วนใหญ่ถ้าเฟลจะเข้า except)
            return {"status": "success", "detail": "เพิ่มอาจารย์เสร็จสิ้น (No data returned)"}

    except Exception as e:
        print(f"Error Create Teacher: {e}") 
        # ถ้าเกิด Error ให้ส่ง 400 กลับไป Frontend พร้อมข้อความ
        raise HTTPException(status_code=400, detail=str(e))