from fastapi import APIRouter, HTTPException, Form
from config.bn_supabase import supabase_client

auth_route = APIRouter(prefix="/api/auth", tags=["Auth"])

@auth_route.post("/login-by-id")
async def login_by_teacher_id(
    teacher_id: str = Form(),
    password: str = Form()
):
    try:
        # ล้าง session server-side ให้สะอาดก่อนทุก login
        supabase_client.auth._remove_session()
        supabase_client.auth.sign_out()

        print(f"📩 Login attempt teacher_id={teacher_id}")

        # ✅ 1. หา uuid ของ user จาก table teacher
        teacher = supabase_client.table("teacher").select("*").eq("teacher_id", teacher_id).execute()
        is_teacher = bool(teacher.data)
        user_uuid = None

        if is_teacher:
            user_uuid = teacher.data[0]["id"]
            print(f"เจออาจารย์ {teacher.data[0]}")
        else:
            print("แอดมินเข้าสู่ระบบ")

        email = None
        if user_uuid:
            # ✅ 2. ดึง email จาก auth.users ผ่าน admin API
            all_users = supabase_client.auth.admin.list_users()
            target_user = next((u for u in all_users if u.id == user_uuid), None)

            if not target_user:
                raise HTTPException(status_code=400, detail="ไม่พบผู้ใช้งานในระบบ Auth")
            email = target_user.email
        else:
            email = teacher_id

        if not email:
            raise HTTPException(status_code=400, detail="ผู้ใช้นี้ไม่มีอีเมลในระบบ Auth")
        
        # 🔥 reset session/auth cache ของ supabase server-side
        supabase_client.auth._remove_session()   

        # ✅ 3. ทำการ login ด้วย email + password ผ่าน auth
        supabase_client.auth.sign_out()
        login_response = supabase_client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        if not login_response.session:
            raise HTTPException(status_code=401, detail="รหัสผ่านไม่ถูกต้อง")

        fullname = ""
        major_name = None
        # ✅ 4. ตรวจว่าคนนี้อยู่ใน table teacher ไหม
        role = "teacher" if teacher.data else "admin"
        
        if is_teacher:
            first = teacher.data[0].get("first_name", "")
            last = teacher.data[0].get("last_name", "")
            fullname = f"{first} {last}".strip()

            major_id = teacher.data[0].get("major_id")
            if major_id:
                major_result = supabase_client.table("majors").select("major_name").eq("major_id", major_id).execute()
                if major_result.data:
                    major_name = major_result.data[0]["major_name"]
        print(f"✅ Login success for {email} ({role})")

        return {
            "status": "success",
            "role": role,
            "teacher_id": teacher_id,
            "fullname": fullname,
            "major": major_name,
            "access_token": login_response.session.access_token,
            "refresh_token": login_response.session.refresh_token,
        }

    except Exception as e:
        print("❌ Login error:", e)
        raise HTTPException(status_code=400, detail=f"รหัสประจำตัว / รหัสผ่านไม่ถูกต้อง")
