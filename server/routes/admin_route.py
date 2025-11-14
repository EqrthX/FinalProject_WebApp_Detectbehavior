from fastapi import APIRouter, HTTPException, Form
from config.bn_supabase import supabase_client

admin_route = APIRouter(prefix="/api/admin", tags=["Admin"])

@admin_route.post("/create-teacher")
async def create_teacher(
    email: str = Form(), 
    password: str = Form(), 
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
        
        # ตรวจสอบว่า teacher_id ซ้ำหรือไม่
        existing_teacher = supabase_client.table("teachers").select("teacher_id").eq("teacher_id", teacher_id).execute()
        if existing_teacher.data:
            raise HTTPException(status_code=400, detail="❌ รหัสประจำตัวอาจารย์นี้มีในระบบแล้ว")
        
        # สร้าง user ใน Auth
        auth_response = supabase_client.auth.admin.create_user(
            attributes={
                "email": email,
                "password": password,
                "email_confirm": True
            }
        ) 
        
        new_user = auth_response.user
        if not new_user:
            raise HTTPException(status_code=400, detail="❌ ไม่สามารถสร้างบัญชีผู้ใช้ได้")
        
        # แยกชื่อ-นามสกุล
        name_parts = fullname.strip().split(" ", 1)  # split เฉพาะครั้งแรก
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # เตรียมข้อมูลสำหรับ insert
        profile_data = {
            "id": new_user.id,
            "teacher_id": teacher_id,
            "first_name": first_name,
            "last_name": last_name,
            "major_id": major
        }

        # Insert ข้อมูลลงตาราง teachers (ไม่ใช่ teacher)
        result = supabase_client.table("teachers").insert(profile_data).execute()

        if result.data:
            return {"status": "success", "detail": "✅ เพิ่มอาจารย์เสร็จสิ้น"}
        else:
            # ถ้า insert ไม่สำเร็จ ให้ลบ user ที่สร้างไว้
            try:
                supabase_client.auth.admin.delete_user(new_user.id)
            except:
                pass
            raise HTTPException(status_code=400, detail=f"❌ ไม่สามารถบันทึกข้อมูลอาจารย์ได้")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating teacher: {str(e)}")
        raise HTTPException(status_code=500, detail=f"❌ เกิดข้อผิดพลาด: {str(e)}")


@admin_route.get("/teachers")
async def get_all_teachers():
    """ดึงข้อมูลอาจารย์ทั้งหมด"""
    try:
        result = supabase_client.table("teachers").select(
            "id, teacher_id, first_name, last_name, majors(major_name, faculty(faculty_name))"
        ).execute()
        
        return {"status": "success", "data": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"❌ เกิดข้อผิดพลาดในการดึงข้อมูล: {str(e)}")


@admin_route.delete("/teacher/{teacher_id}")
async def delete_teacher(teacher_id: str):
    """ลบข้อมูลอาจารย์"""
    try:
        # ค้นหา teacher
        teacher = supabase_client.table("teachers").select("id").eq("id", teacher_id).execute()
        
        if not teacher.data:
            raise HTTPException(status_code=404, detail="❌ ไม่พบข้อมูลอาจารย์")
        
        user_id = teacher.data[0]["id"]
        
        # ลบข้อมูลจากตาราง teachers
        supabase_client.table("teachers").delete().eq("id", teacher_id).execute()
        
        # ลบ user จาก Auth
        try:
            supabase_client.auth.admin.delete_user(user_id)
        except:
            pass  # ถ้าลบไม่ได้ก็ไม่เป็นไร
        
        return {"status": "success", "detail": "✅ ลบอาจารย์เสร็จสิ้น"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"❌ เกิดข้อผิดพลาด: {str(e)}")


@admin_route.put("/teacher/{teacher_id}")
async def update_teacher(
    teacher_id: str,
    teacher_code: str = Form(None),
    fullname: str = Form(None),
    major: str = Form(None)
):
    """แก้ไขข้อมูลอาจารย์"""
    try:
        # ค้นหา teacher
        teacher = supabase_client.table("teachers").select("*").eq("id", teacher_id).execute()
        
        if not teacher.data:
            raise HTTPException(status_code=404, detail="❌ ไม่พบข้อมูลอาจารย์")
        
        update_data = {}
        
        # อัพเดทรหัสประจำตัว
        if teacher_code:
            # ตรวจสอบว่ารหัสซ้ำหรือไม่
            existing = supabase_client.table("teachers").select("teacher_id").eq("teacher_id", teacher_code).neq("id", teacher_id).execute()
            if existing.data:
                raise HTTPException(status_code=400, detail="❌ รหัสประจำตัวนี้มีในระบบแล้ว")
            update_data["teacher_id"] = teacher_code
        
        # อัพเดทชื่อ-นามสกุล
        if fullname:
            name_parts = fullname.strip().split(" ", 1)
            update_data["first_name"] = name_parts[0]
            update_data["last_name"] = name_parts[1] if len(name_parts) > 1 else ""
        
        # อัพเดทสาขา
        if major:
            update_data["major_id"] = major
        
        # อัพเดทข้อมูล
        if update_data:
            result = supabase_client.table("teachers").update(update_data).eq("id", teacher_id).execute()
            
            if result.data:
                return {"status": "success", "detail": "✅ แก้ไขข้อมูลอาจารย์เสร็จสิ้น"}
        
        return {"status": "success", "detail": "ไม่มีข้อมูลที่ต้องแก้ไข"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"❌ เกิดข้อผิดพลาด: {str(e)}")