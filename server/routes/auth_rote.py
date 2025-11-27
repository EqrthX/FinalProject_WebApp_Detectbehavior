# นำเข้าเครื่องมือจาก FastAPI สำหรับสร้าง API และรับค่าจากฟอร์ม
from fastapi import APIRouter, HTTPException, Form

# นำเข้า supabase client (ใช้เชื่อมต่อระบบ Auth + Database)
from config.bn_supabase import supabase_client


# สร้าง Router สำหรับ API ที่เกี่ยวกับการเข้าสู่ระบบ
# prefix = "/api/auth" หมายถึง endpoint ทั้งหมดจะขึ้นด้วยคำนี้
auth_route = APIRouter(prefix="/api/auth", tags=["Auth"])


# -----------------------------
# 📌 API: Login โดยใช้ teacher_id + password
# URL: POST /api/auth/login-by-id
# -----------------------------
@auth_route.post("/login-by-id")
async def login_by_teacher_id(
    teacher_id: str = Form(),   # รับค่า teacher_id จากฟอร์มหน้าเว็บ
    password: str = Form()      # รหัสผ่าน
):
    try:
        # ------------------------------------------------------------
        # ⭐ 0. ล้าง session เก่าออกก่อนทุกครั้ง เพื่อกัน session ค้าง
        # ------------------------------------------------------------
        supabase_client.auth._remove_session()
        supabase_client.auth.sign_out()

        print(f"📩 Login attempt teacher_id={teacher_id}")

        # ------------------------------------------------------------
        # ⭐ 1. ค้นหาผู้ใช้งานใน table "teacher" จาก teacher_id
        # ------------------------------------------------------------
        teacher = supabase_client.table("teacher").select("*").eq("teacher_id", teacher_id).execute()

        # is_teacher = True ถ้าเจอข้อมูลอาจารย์ในฐานข้อมูล
        is_teacher = bool(teacher.data)

        # user_uuid คือค่า id ของ user ใน Auth (UUID ของ Supabase)
        user_uuid = None

        if is_teacher:
            # ถ้าเจออาจารย์ → ดึง UUID จากฐานข้อมูล
            user_uuid = teacher.data[0]["id"]
            print(f"เจออาจารย์ {teacher.data[0]}")
        else:
            # ถ้าไม่เจอ → จะลองเข้าสู่ระบบแบบ admin (ใช้ email admin โดยตรง)
            print("ไม่เจออาจารย์")

        # Email ที่จะใช้ login
        email = None

        # ------------------------------------------------------------
        # ⭐ 2. ถ้ามี user_uuid ให้ไปค้นหา email ในระบบ Auth.users
        # ------------------------------------------------------------
        if user_uuid:
            # ดึงผู้ใช้ทั้งหมดจากระบบ Auth
            all_users = supabase_client.auth.admin.list_users()

            # หา user ที่มี UUID ตรงกัน
            target_user = next((u for u in all_users if u.id == user_uuid), None)

            if not target_user:
                raise HTTPException(status_code=400, detail="ไม่พบผู้ใช้งานในระบบ Auth")

            # ถ้าพบ → เอา email จาก Auth มาใช้ login
            email = target_user.email

        else:
            # ถ้าไม่เจอใน teacher table → ถือว่า login เป็น admin
            # โดย teacher_id ที่กรอกมาจะเป็น email ของ admin
            email = teacher_id

        # ถ้า email ยังไม่มี ให้หยุดเลย
        if not email:
            raise HTTPException(status_code=400, detail="ผู้ใช้นี้ไม่มีอีเมลในระบบ Auth")

        # ล้าง session อีกรอบ ให้แน่ใจว่าไม่ติด cache เดิม
        supabase_client.auth._remove_session()

        # ------------------------------------------------------------
        # ⭐ 3. ทำการเข้าสู่ระบบด้วย email + password ผ่าน Supabase Auth
        # ------------------------------------------------------------
        supabase_client.auth.sign_out()

        login_response = supabase_client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        # ถ้า sign in แล้วไม่มี session แสดงว่ารหัสผ่านผิด
        if not login_response.session:
            raise HTTPException(status_code=401, detail="รหัสผ่านไม่ถูกต้อง")

        # ------------------------------------------------------------
        # ⭐ 4. เช็ค role ว่าเป็น teacher หรือ admin
        # ------------------------------------------------------------
        fullname = ""
        major_name = None

        # ถ้าเจอใน table teacher → role = "teacher" ไม่งั้น = "admin"
        role = "teacher" if teacher.data else "admin"

        # ------------------------------------------------------------
        # ⭐ 5. ถ้าเป็นอาจารย์ ดึงชื่อ-นามสกุล และชื่อสาขา
        # ------------------------------------------------------------
        if is_teacher:
            # รวม first_name + last_name เป็น fullname
            first = teacher.data[0].get("first_name", "")
            last = teacher.data[0].get("last_name", "")
            fullname = f"{first} {last}".strip()

            # ดึงชื่อสาขาจาก table majors
            major_id = teacher.data[0].get("major_id")
            if major_id:
                major_result = supabase_client.table("majors").select("major_name").eq("major_id", major_id).execute()
                if major_result.data:
                    major_name = major_result.data[0]["major_name"]

        print(f"✅ Login success for {email} ({role})")

        # ------------------------------------------------------------
        # ⭐ 6. ส่งข้อมูลกลับให้ Frontend
        # ------------------------------------------------------------
        return {
            "status": "success",
            "role": role,                                      # teacher หรือ admin
            "teacher_id": teacher_id,                           # ID ที่ใช้ login
            "fullname": fullname,                               # ชื่อจริง+นามสกุลของอาจารย์
            "major": major_name,                                # ชื่อสาขา
            "access_token": login_response.session.access_token,  # token สำหรับดึง API อื่น
            "refresh_token": login_response.session.refresh_token # token ใช้ขอ token ใหม่
        }

    except Exception as e:
        print("❌ Login error:", e)
        # ไม่โชว์ error จริงเพื่อความปลอดภัย
        raise HTTPException(status_code=400, detail="รหัสประจำตัว / รหัสผ่านไม่ถูกต้อง")
