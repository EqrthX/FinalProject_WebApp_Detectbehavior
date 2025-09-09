from pydantic import BaseModel
from typing import Optional

class UserLogin(BaseModel):
    username: str
    password: str

class UserSignup(BaseModel):
    username: str
    password: str
    fullname: str
    userRole: str
    userCode: Optional[str] = None  # ตอน request ไม่ต้องส่ง
