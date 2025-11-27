# นำเข้าเครื่องมือจาก FastAPI
from fastapi import APIRouter, HTTPException, Form

# นำเข้า Supabase client (ใช้เชื่อมกับฐานข้อมูลและระบบ Auth)
from config.bn_supabase import supabase_client

# สร้าง Router สำหรับกลุ่ม API ที่เกี่ยวกับ Admin 
# prefix = จะทำให้ endpoint นี้ขึ้นต้นด้วย /api/admin
admin_route = APIRouter(prefix="/api/admin", tags=["Admin"])


# ----------------------------- #
# 📌 API: เพิ่มอาจารย์ใหม่ลงระบบ
# URL: POST /api/admin/create-teacher
# ----------------------------- #
@admin_route.post("/create-teacher")
async def create_teacher(
    # ในการส่งข้อมูลแบบ Form (เช่น ผ่านหน้าเว็บ)
    # ต้องใช้ Form() เพื่อให้ FastAPI รู้ว่ารับค่าจากฟอร์ม
    email: str = Form(),
    password: str = Form(),
    teacher_id: str = Form(),
    fullname: str = Form(),
    major: str = Form()
):
    try:
        # พิมพ์ให้ดูใน Terminal ว่าได้รับค่าอะไรมา (ช่วย debug)
        print("email", email)
        print("password", password)
        print("teacher_id", teacher_id)
        print("fullname", fullname)
        print("major", major)

        # ----------------------------------------------------
        # 1) ⭐ สร้างบัญชีผู้ใช้ใน Supabase Auth (ส่วน Login)
        # ----------------------------------------------------
        # ใช้สิทธิ์ admin.create_user เพื่อสร้างบัญชีใหม่
        auth_response = supabase_client.auth.admin.create_user(
            attributes={
                "email": email,            # อีเมลที่จะใช้ Login
                "password": password,      # รหัสผ่าน
                "email_confirm": True      # ยืนยันอีเมลอัตโนมัติ (ไม่ต้องเช็ค email)
            }
        )

        # ได้ผลลัพธ์เป็น object ของ user ที่เพิ่งถูกสร้าง
        new_user = auth_response.user

        # ถ้า new_user = None แปลว่าการสร้าง user ล้มเหลว
        if not new_user:
            raise HTTPException(status_code=400, detail="❌ ฟังก์ชั่น create teacher ผิดพลาด")

        # ----------------------------------------------------
        # 2) ⭐ แยกชื่อเต็มของอาจารย์เป็นชื่อจริง + นามสกุล
        # ----------------------------------------------------
        # fullname เช่น "สมชาย ใจดี"
        name_part = fullname.split(" ")   # แยกเป็น ["สมชาย", "ใจดี"]

        first_name = name_part[0]         # ชื่อจริง = "สมชาย"
        
        # ถ้ามีมากกว่า 1 คำ ให้ต่อที่เหลือเป็นนามสกุล
        # ถ้าไม่มี ให้เป็น string ว่าง
        last_name = " ".join(name_part[1:]) if len(name_part) > 1 else ""

        # ----------------------------------------------------
        # 3) ⭐ เตรียมข้อมูลเพื่อเก็บลง Table "teacher"
        # ----------------------------------------------------
        profile_data = {
            "id": new_user.id,      # ใช้ UUID เดียวกับระบบ Auth
            "teacher_id": teacher_id,   # รหัสอาจารย์ที่ Admin ป้อน
            "first_name": first_name,   # ชื่อจริง
            "last_name": last_name,     # นามสกุล
            "major_id": major           # สาขาวิชา
        }

        # ----------------------------------------------------
        # 4) ⭐ บันทึกข้อมูลลง Supabase Table "teacher"
        # ----------------------------------------------------
        result = supabase_client.table("teacher").insert(profile_data).execute()

        # ถ้า insert สำเร็จ result.data จะมีข้อมูลกลับมา
        if result.data:
            return {"status": "success", "detail": "เพิ่มอาจารย์เสร็จสิ้น"}
        else:
            # ถ้า insert ไม่สำเร็จ แสดง error ที่มาจาก result.error
            raise HTTPException(status_code=400, detail=f"Insert failed: {result.error}")

    except Exception as e:
        # ดักจับ error ทั้งหมด แล้วส่งกลับเป็นข้อความ
        raise HTTPException(status_code=400, detail=str(e))
