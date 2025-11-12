from fastapi import Header, HTTPException
from config.bn_supabase import supabase_client

def verify_token(Authorization: str = Header(...)):
    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = Authorization.split(" ")[1]

    try:
        result = supabase_client.auth.get_user(token)

        # 🧩 บางเวอร์ชันอยู่ใน result.user, บางเวอร์ชันอยู่ใน result
        user_obj = getattr(result, "user", result)

        if not user_obj:
            raise HTTPException(status_code=401, detail="Invalid token or user not found")

        # ✅ Debug: ดู structure จริง ๆ
        # print("🧩 verify_token user object:", user_obj)

        # ดึง id และ email อย่างปลอดภัย
        user_id = getattr(user_obj, "id", None)
        email = getattr(user_obj, "email", None)

        if not user_id:
            raise HTTPException(status_code=401, detail="User id not found in token")

        return {"id": user_id, "email": email}

    except Exception as e:
        print("❌ verify_token error:", e)
        raise HTTPException(status_code=401, detail=f"Token validation failed: {e}")
