from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config.bn_supabase import supabase_client

bearer = HTTPBearer(auto_error=False)

def verify_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer)
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        result = supabase_client.auth.get_user(token)

        # 🧩 บางเวอร์ชันอยู่ใน result.user, บางเวอร์ชันอยู่ใน result
        user_obj = getattr(result, "user", result)

        if not user_obj:
            raise HTTPException(status_code=401, detail="Invalid token or user not found")

        # ดึง id และ email อย่างปลอดภัย
        user_id = getattr(user_obj, "id", None)
        email = getattr(user_obj, "email", None)

        if not user_id:
            raise HTTPException(status_code=401, detail="User id not found in token")

        return {"id": user_id, "email": email}

    except Exception as e:
        print("❌ verify_token error:", e)
        raise HTTPException(status_code=401, detail=f"Token validation failed: {e}")

def required_admin(user = Depends(verify_token)):
    query = (
        supabase_client
        .table("admin")
        .select("id")
        .eq("id", user["id"])
        .execute()
    )

    if not query.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
                        detail="เฉพาะผู้ดูแลระบบเท่านั้น",
        )

    return user