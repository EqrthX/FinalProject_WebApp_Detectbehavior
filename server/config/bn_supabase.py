# โหลดฟังก์ชัน load_dotenv จากไลบรารี dotenv
# หน้าที่ของมันคือใช้ดึงค่าต่างๆ จากไฟล์ .env (ไฟล์เก็บรหัสลับต่างๆ)
from dotenv import load_dotenv

# นำเข้า create_client และ Client จากไลบรารี supabase
# ใช้สำหรับสร้างตัวเชื่อมต่อไปยัง Supabase Database + Auth
from supabase import create_client, Client

# นำเข้าโมดูล os เพื่ออ่านค่าตัวแปรสภาพแวดล้อม (environment variables)
import os

# เรียกฟังก์ชัน load_dotenv() เพื่อโหลดข้อมูลจากไฟล์ .env
# เช่น SUPABASE_URL=..., SUPABASE_KEY=...
# หลังจากนี้เราจะสามารถอ่านค่านี้ด้วย os.getenv()
load_dotenv()

# อ่านค่าตัวแปร SUPABASE_URL จากไฟล์ .env
# เป็น URL สำหรับเชื่อมต่อ Supabase project ของเรา
SUPABASE_URL: str | None = os.getenv("SUPABASE_URL")

# อ่านค่าตัวแปร SUPABASE_KEY จากไฟล์ .env
# KEY นี้คือ service role key หรือ anon key (ขึ้นอยู่กับว่าใช้ตัวไหน)
# ใช้เป็นรหัสลับให้โปรแกรมสามารถเชื่อมต่อ Supabase ได้
SUPABASE_KEY: str | None = os.getenv("SUPABASE_KEY")

# สร้างตัวเชื่อมต่อ supabase client
# create_client( URL, KEY ) จะคืน object ที่เราสามารถใช้:
#   - เข้าถึง Auth (สมัครสมาชิก / login)
#   - เข้าถึง Database (insert, select, update, delete)
#   - ทำงานกับ Storage (อัปโหลดรูป)
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
