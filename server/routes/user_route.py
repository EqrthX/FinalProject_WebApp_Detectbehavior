# from fastapi import APIRouter, HTTPException, Depends, status
# from datetime import date, timedelta
# from utils.validatorPassword import hash_password, verify_password
# from schemas import UserSignup, UserLogin
# from db import get_connection
# from utils.auth import create_access_token, get_current_user
# router = APIRouter(prefix="/api/users", tags=["users"])

# @router.post("/login")
# async def login(user_data: UserLogin):
#     conn = get_connection()
#     try:
#         with conn.cursor() as cursor:
#             cursor.execute("select * from user where username=%s", (user_data.username))
#             user = cursor.fetchone()
#             if not user:
#                 raise HTTPException(status_code=404, detail="ไม่พบชื่อผู้ใช้นี้")
        
#             if not verify_password(user_data.password, user["password"]):
#                 raise HTTPException(status_code=403, detail="รหัสผ่านไม่ถูกต้อง")
            
#             token_expires = timedelta(minutes=240)
#             access_token = create_access_token(
#                 data={
#                     "sub": user["username"],
#                     "fullname": user["fullname"],
#                     "role": user["userRole"],
#                     "userCode": user["userCode"],
#                 },
#                 expires_delta=token_expires
#             )
            
#             return {
#                 "access_token": access_token,
#                 "token_type": "bearer",
#                 "username": user["username"],
#                 "fullname": user["fullname"],
#                 "userRole": user["userRole"]
#             }
#     finally:
#         conn.close()
        
# @router.post("/signup")
# async def signup(user_data: UserSignup): 
#     conn = get_connection()
#     try:
#         with conn.cursor() as cursor:
#             cursor.execute("select username from user where username=%s", (user_data.username))
#             if cursor.fetchone():
#                 raise HTTPException(status_code=400, detail="มีรหัสผู้ใช้นี้อยู่แล้ว")
            
#             cursor.execute("select count(*) as count from user")
#             user_count = cursor.fetchone()["count"]
#             user_code = f"TICT{user_count+1:02d}"
            
#             hash_pw = hash_password(user_data.password)
            
#             cursor.execute("""
#                 insert into user (username, password, fullname, userCode, userRole) values (%s, %s, %s, %s, %s)
#                            """, (user_data.username, hash_pw, user_data.fullname, user_code, user_data.userRole))
#             conn.commit()
#             user_data.password = ""
            
#             return {
#                 "username": user_data.username,
#                 "fullname": user_data.fullname,
#                 "userCode": user_code,
#                 "userRole": user_data.userRole
#             }
#     finally:
#         conn.close()
        
# @router.get("/me")
# async def read_users_me(current_user: dict = Depends(get_current_user)):
#     return {
#         "username": current_user["username"],
#         "fullname": current_user["fullname"],
#         "role": current_user["role"],
#         "userCode": current_user["userCode"]
#     }