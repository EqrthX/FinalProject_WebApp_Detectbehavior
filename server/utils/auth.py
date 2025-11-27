# นำเข้า Header และ HTTPException จาก FastAPI
# Header(...): เอาไว้บังคับให้ต้องส่งค่า Header มาด้วยเวลาจะเรียก API
# HTTPException: ใช้โยน error กลับไปให้ฝั่ง Client
from fastapi import Header, HTTPException

# นำเข้า supabase_client ซึ่งเป็นตัวเชื่อมต่อกับระบบ Auth ของ Supabase
from config.bn_supabase import supabase_client


# ฟังก์ชันตรวจสอบ token ว่าถูกต้องหรือไม่
# ใช้ในทุก API ที่ต้องการป้องกันไม่ให้เข้าถึงโดยไม่มี Login
def verify_token(Authorization: str = Header(...)):
    # ------------------------------------------
    # 1) ตรวจสอบว่า Header มีคำว่า "Bearer " ไหม
    # ------------------------------------------
    # เวลา client ส่ง token มาจะหน้าตาแบบนี้:
    # Authorization: Bearer xxxxx.yyyyy.zzzzz
    # ถ้าไม่ได้ขึ้นต้นด้วย Bearer แสดงว่า client ส่ง token มาไม่ถูกต้อง
    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    # ------------------------------------------
    # 2) แยกเอา token ออกมาจากคำว่า Bearer
    # ------------------------------------------
    # ตัวอย่าง:
    # "Bearer abc123" → split → ["Bearer", "abc123"]
    # เอาตัวที่ 2 (index 1) คือ token จริง ๆ
    token = Authorization.split(" ")[1]

    try:
        # ------------------------------------------
        # 3) ส่ง token ไปให้ Supabase ตรวจสอบว่าใช้ได้ไหม
        # ------------------------------------------
        # supabase_client.auth.get_user(token)
        # ถ้า token ถูกต้อง → จะคืนข้อมูลผู้ใช้กลับมา
        # ถ้า token ผิด → จะเกิด exception
        result = supabase_client.auth.get_user(token)

        # ------------------------------------------
        # 4) รองรับหลาย version ของ Supabase Python SDK
        # ------------------------------------------
        # บางเวอร์ชันจะให้ result.user
        # บางเวอร์ชันจะให้ข้อมูลอยู่ใน result โดยตรง
        # getattr() จะพยายามดึง result.user ก่อน ถ้าไม่เจอ → ใช้ result
        user_obj = getattr(result, "user", result)

        # ถ้าไม่มี user เลย → token นี้ใช้ไม่ได้
        if not user_obj:
            raise HTTPException(status_code=401, detail="Invalid token or user not found")

        # ------------------------------------------
        # 5) ดึง id และ email ของผู้ใช้จาก user_obj
        # ------------------------------------------
        # getattr() ใช้เพื่อดึงค่าอย่างปลอดภัย (ถ้าไม่มี field นั้นจะคืน None)
        user_id = getattr(user_obj, "id", None)
        email = getattr(user_obj, "email", None)

        # ถ้าไม่มี user_id แสดงว่า token ไม่มีข้อมูลผู้ใช้ → ใช้ไม่ได้
        if not user_id:
            raise HTTPException(status_code=401, detail="User id not found in token")

        # คืนข้อมูลผู้ใช้กลับไปให้ router อื่นใช้งาน
        return {"id": user_id, "email": email}

    except Exception as e:
        # ถ้าเกิดข้อผิดพลาดอื่น ๆ เช่น token หมดอายุ, token ปลอม ฯลฯ
        print("❌ verify_token error:", e)
        raise HTTPException(status_code=401, detail=f"Token validation failed: {e}")
