from  datetime import datetime, timedelta
from jose import JWSError, jwt
from fastapi import Request, HTTPException

secretkey = "secret_Key"
algorithem = "HS256"
access_token_expire_minutes = 240 # 4 ชม

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now() + (expires_delta or timedelta(minutes=access_token_expire_minutes))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, secretkey, algorithm=algorithem)
    return encoded_jwt

async def get_current_user(request: Request):
    auth_user = request.headers.get("Authorization")
    if not auth_user or not auth_user.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="ไม่พบ token"
        )
    
    token = auth_user.split(" ")[1]
    
    try:
        payload = jwt.decode(token, secretkey, algorithms=algorithem)
        username: str = payload.get("sub")
        fullname: str = payload.get("fullname")
        role: str = payload.get("role")
        userCode: str = payload.get("userCode")
        
        if username is None:
            raise HTTPException(
                status_code=401,
                detail="Token ไม่ถูกต้อง"
            )
        return {
            "username": username,
            "fullname": fullname,
            "role": role,
            "userCode": userCode
        }
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Token หมดอายุหรือไม่ถูกต้อง",
        )