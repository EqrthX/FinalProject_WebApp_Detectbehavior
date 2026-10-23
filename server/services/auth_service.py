"""ขั้นตอนเข้าสู่ระบบที่ย้ายมาจาก auth_route โดยคงการทำงานเดิม."""

import logging

from fastapi import HTTPException, status
from httpx import TransportError
from supabase import create_client
from supabase_auth.errors import AuthApiError, AuthRetryableError

from config.bn_supabase import (
    SUPABASE_KEY,
    SUPABASE_URL,
    supabase_admin,
)

logger = logging.getLogger(__name__)


async def login_by_teacher_id(teacher_id: str, password: str):
    try:        

        teacher = supabase_admin.table("teacher").select("*").eq("teacher_id", teacher_id).execute()
        user_uuid = teacher.data[0]["id"] if teacher.data else None
        email = None

        if user_uuid:
            all_users = supabase_admin.auth.admin.get_user_by_id(uid = user_uuid)
            target_user = next(
                (u for u in all_users if u.id == user_uuid), 
                None)

            if not target_user:
                raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้งานในระบบ Auth")
            email = target_user.email
        else:
            email = teacher_id

        if not email:
            raise HTTPException(status_code=404, detail="ผู้ใช้นี้ไม่มีอีเมลในระบบ Auth")
        
        # Create an isolated auth client for this login request.
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        try:
            login_response = auth_client.auth.sign_in_with_password({
                "email": email,
                "password": password,
            })
        except AuthApiError as exc:
            # Only an explicit credentials error means the login details are wrong.
            if exc.code == "invalid_credentials":
                raise HTTPException(
                    status_code=401,
                    detail="รหัสประจำตัว / อีเมล หรือรหัสผ่านไม่ถูกต้อง",
                ) from exc
            if exc.code == "email_not_confirmed":
                raise HTTPException(
                    status_code=403,
                    detail="กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ",
                ) from exc
            if exc.status == 429:
                raise HTTPException(
                    status_code=429,
                    detail="เข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
                ) from exc
            logger.error("Auth sign-in failed: status=%s code=%s", exc.status, exc.code)
            raise HTTPException(
                status_code=503,
                detail="ระบบเข้าสู่ระบบไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง",
            ) from exc

        if not login_response.session:
            raise HTTPException(status_code=401, detail="ไม่สามารถสร้าง session ได้ กรุณาเข้าสู่ระบบใหม่")
        
        user_id = login_response.session.user.id

        admin_result = (
            supabase_admin
            .table("admin")
            .select("id")
            .eq("id", user_id)
            .execute()
        )

        teacher_result = (
            supabase_admin
            .table("teacher")
            .select("*")
            .eq("id", user_id)
            .execute()
        )

        is_teacher = bool(teacher_result.data)

        fullname = ""
        major_name = None

        if admin_result.data:
            role = "admin"
        elif teacher_result.data:
            role = "teacher"
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งาน",
            )
        
        if is_teacher:
            teacher_profile = teacher_result.data[0]

            first = teacher_profile.get("first_name") or ""
            last = teacher_profile.get("last_name") or ""
            fullname = f"{first} {last}".strip()

            major_id = teacher_profile.get("major_id")
            if major_id:
                major_result = supabase_admin.table("majors").select("major_name").eq("major_id", major_id).execute()
                if major_result.data:
                    major_name = major_result.data[0]["major_name"]

        return {
            "status": "success",
            "role": role,
            "teacher_id": teacher_result.data[0]["teacher_id"] if teacher_result.data else None,
            "fullname": fullname,
            "major": major_name,
            "access_token": login_response.session.access_token,
            "refresh_token": login_response.session.refresh_token,
        }
    except HTTPException:
        raise

    except (AuthRetryableError, TransportError) as exc:
        logger.error("Login dependency unavailable: %s", type(exc).__name__)
        raise HTTPException(
            status_code=503,
            detail="ไม่สามารถติดต่อระบบเข้าสู่ระบบได้ กรุณาลองใหม่ภายหลัง",
        ) from exc

    except Exception as exc:
        logger.error("Unexpected login failure: %s", type(exc).__name__)
        raise HTTPException(
            status_code=500,
            detail="ระบบเกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง",
        ) from exc
