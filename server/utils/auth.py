from fastapi import Depends, Header, HTTPException
from config.bn_supabase import supabase_client

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.replace("Bearer ", "")
    try:
        user = supabase_client.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return user.user
    except Exception as e:
        print("Auth check error:", e)
        raise HTTPException(status_code=401, detail="Auth validation failed")