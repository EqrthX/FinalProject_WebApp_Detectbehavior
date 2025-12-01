from dotenv import load_dotenv
from supabase import create_client, Client
import os

# 1. โหลดค่าจาก .env ทันที
load_dotenv()

# 2. ดึงค่าตัวแปร
SUPABASE_URL: str | None = os.getenv("SUPABASE_URL")
SUPABASE_KEY: str | None = os.getenv("SUPABASE_KEY")
# 🟢 เพิ่มบรรทัดนี้: ดึง Key ลับ (Service Role)
SUPABASE_SERVICE_KEY: str | None = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# 3. สร้าง Client
# ตัวที่ 1: Client ทั่วไป (ใช้ Key ปกติ)
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 🟢 ตัวที่ 2: Client แอดมิน (ใช้ Service Key) - ต้องมีตัวนี้ถึงจะสร้าง User ได้!
# เราจะเช็คก่อนว่ามี Key ไหม เพื่อกัน Error
if SUPABASE_SERVICE_KEY:
    supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    print("⚠️ Warning: ไม่พบ SUPABASE_SERVICE_ROLE_KEY ในไฟล์ .env")
    supabase_admin = None