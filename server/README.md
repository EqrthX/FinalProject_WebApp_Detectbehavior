# ⚙️ ClassLens — Backend (server)

> **ส่วนประมวลผลหลังบ้าน (Backend) และระบบ AI ตรวจจับพฤติกรรมผู้เรียนแบบ Real-time ด้วย FastAPI และ YOLOv8**

---

## 🏗️ เทคโนโลยีที่ใช้ (Backend Tech Stack)

- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (ความเร็วสูง, ประสิทธิภาพดีเลิศสำหรับ Async/WebSocket)
- **AI Core:** [YOLOv8 (Ultralytics)](https://github.com/ultralytics/ultralytics) + ByteTrack Multi-Object Tracking
- **Computer Vision:** OpenCV (สำหรับดึงภาพจากกล้องและสร้างเฟรมวิดีโอ)
- **Database Wrapper:** Supabase Python Client (PostgreSQL)
- **Server Runner:** Uvicorn

---

## 📁 โครงสร้างโฟลเดอร์ของ Server

```text
server/
├── config/                  # การตั้งค่าการเชื่อมต่อฐานข้อมูล
│   └── bn_supabase.py       # จัดการ Supabase client (ใช้ Service Key สำหรับการจัดเก็บข้อมูล)
├── core/                    # ส่วนการประมวลผลหลักของระบบ AI
│   └── camera_thread.py     # Thread จัดการกล้อง, โหลด YOLO และรันตรวจจับพฤติกรรม
├── routes/                  # API Endpoints แยกตามโมดูล
│   ├── auth_route.py        # ระบบ Authentication (Login/Register)
│   ├── admin_route.py       # ระบบจัดการข้อมูลสำหรับ Admin
│   └── camera/              # ระบบจัดการกล้องและการตรวจจับ
│       ├── __init__.py      
│       ├── rest.py          # REST API (Start, Stop, Get Status, Upload Summary)
│       └── websocket.py     # WebSocket API (Stream ภาพสด + ผลการวิเคราะห์แบบเรียลไทม์)
├── utils/                   # ฟังก์ชันตัวช่วยต่างๆ
│   ├── auth.py              # ระบบตรวจสอบความถูกต้องของ JWT Token
│   ├── json_buffer.py       # ระบบบันทึก Log ลงไฟล์สำรองก่อนส่งขึ้น Supabase เพื่อกันข้อมูลสูญหาย
│   └── model_loader.py      # ฟังก์ชันสำหรับค้นหาและโหลดไฟล์น้ำหนักโมเดล (.pt)
├── jsonlogs/                # [Auto-created] โฟลเดอร์เก็บข้อมูลสำรองชั่วคราวระหว่างการตรวจจับ
├── main.py                  # Entrypoint หลักในการรันแอปพลิเคชัน FastAPI
└── .env                     # ไฟล์กำหนดรหัสผ่านและคีย์สำคัญต่างๆ (ไม่ควรถูกแชร์บน Git)
```

---

## ⚙️ การตั้งค่า Environment Variables (`server/.env`)

สร้างไฟล์ `.env` ที่โฟลเดอร์ `server/` แล้วกำหนดค่าเชื่อมต่อฐานข้อมูล Supabase:

```env
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

> **ข้อควรระวัง:** `SUPABASE_SERVICE_KEY` เป็นคีย์สิทธิ์สูงสุด (Service Role Bypass Row Level Security) ห้ามนำไปแชร์ให้บุคคลภายนอก หรือนำไปใส่ในโค้ดฝั่ง Client เด็ดขาด

---

## 🚀 ขั้นตอนการติดตั้งและการใช้งาน

### 1️⃣ เตรียม Python Environment
แนะนำให้ใช้ **Python 3.11.9** ในการพัฒนาแอปพลิเคชันนี้

**สร้าง Virtual Environment:**
```bash
py -3.11 -m venv venv
```

**การเปิดใช้งาน (Activate):**
- **Windows:**
  ```bash
  .\venv\Scripts\activate
  ```
- **Mac / Linux:**
  ```bash
  source venv/bin/activate
  ```

---

### 2️⃣ ติดตั้ง Dependencies
เลือกติดตั้งไฟล์ Requirement ตามลักษณะฮาร์ดแวร์ของเครื่อง:

- **กรณีเครื่องใช้การ์ดจอ Nvidia (รองรับ CUDA เพื่อให้ AI รันเร็วขึ้น):**
  ```bash
  pip install -r requirement_gpu.txt
  ```
- **กรณีเครื่องประมวลผลด้วย CPU ทั่วไป:**
  ```bash
  pip install -r requirement_cpu.txt
  ```

---

### 3️⃣ รัน Backend Server
ตรวจสอบให้แน่ใจว่าได้เปิดใช้งาน Virtual Environment อยู่ จากนั้นรันคำสั่ง:
```bash
uvicorn main:app --reload --port 8000
```
- ระบบจะรัน Backend ขึ้นมาที่: `http://localhost:8000`
- เข้าไปทดสอบหน้า API Playground (Swagger UI) ได้ที่: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## ⚠️ หมายเหตุทางเทคนิค (Important Technical Notes)

1. **Model Weights:** ตัวระบบจะมองหาโมเดลตรวจจับในโฟลเดอร์หลักของโปรเจกต์ที่เส้นทาง:
   `datasetnew_boundingbox/datasetnew_boundingbox/detect/train/weights/best.pt`
   *กรุณาตรวจสอบว่ามีไฟล์โมเดลอยู่ที่ตำแหน่งนี้เพื่อไม่ให้ระบบเกิด Error ตอนเริ่มรันกล้อง*
2. **Buffer System:** เนื่องจากระบบบันทึกความสนใจของนักเรียนทุกๆ วินาที เพื่อป้องกันไม่ให้ยิง Query เข้าสู่ฐานข้อมูล Supabase บ่อยเกินไป ข้อมูลล็อกจะถูกเขียนเก็บไว้ใน `server/jsonlogs/` เป็นลำดับแรก และจะถูกส่งขึ้น Supabase รวดเดียวเมื่ออาจารย์กดปุ่ม **"จบการตรวจจับ"** เท่านั้น

---

## 👥 สมาชิกผู้พัฒนา (Credits)

- **Nontprawitch**
- **Chaianun**
- **Chanidapha**
