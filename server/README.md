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
├── routes/                  # รับ HTTP / WebSocket แล้วส่งต่อให้ service
│   ├── __init__.py          # รวม router ให้ main.py
│   ├── auth_route.py        # ระบบ Authentication (Login/Register)
│   ├── admin_route.py       # ระบบจัดการข้อมูลสำหรับ Admin
│   └── camera/              # ระบบจัดการกล้องและการตรวจจับ
│       ├── __init__.py      
│       ├── rest.py          # REST API (Start, Stop, Get Status, Upload Summary)
│       └── websocket.py     # WebSocket API (Stream ภาพสด + ผลการวิเคราะห์แบบเรียลไทม์)
├── services/                # ขั้นตอนการทำงานที่ย้ายมาจาก routes
│   ├── auth_service.py      # เข้าสู่ระบบและอ่านข้อมูลผู้ใช้
│   ├── teacher_service.py   # สร้างบัญชีและข้อมูลอาจารย์
│   ├── camera_service.py    # สแกน เริ่ม หยุด และปิดกล้อง
│   └── summary_service.py   # อ่าน buffer คำนวณ summary และส่ง Supabase
├── schemas/                 # Pydantic models สำหรับข้อมูลรับเข้า
│   └── teacher.py           # TeacherCreateSchema เดิม
├── utils/                   # ฟังก์ชันตัวช่วยต่างๆ
│   ├── auth.py              # ระบบตรวจสอบความถูกต้องของ JWT Token
│   ├── json_buffer.py       # ระบบบันทึก Log ลงไฟล์สำรองก่อนส่งขึ้น Supabase เพื่อกันข้อมูลสูญหาย
│   └── model_loader.py      # ฟังก์ชันสำหรับค้นหาและโหลดไฟล์น้ำหนักโมเดล (.pt)
├── jsonlogs/                # [Auto-created] โฟลเดอร์เก็บข้อมูลสำรองชั่วคราวระหว่างการตรวจจับ
├── main.py                  # Entrypoint หลักในการรันแอปพลิเคชัน FastAPI
├── tests/                   # ตรวจ API ด้วยกล้องและฐานข้อมูลจำลอง
└── .env                     # ไฟล์กำหนดรหัสผ่านและคีย์สำคัญต่างๆ (ไม่ควรถูกแชร์บน Git)
```

### วิธีอ่านโค้ดหลังจัดโครงสร้าง

เริ่มจาก `main.py` → `routes/__init__.py` → route ที่สนใจ → service ชื่อเดียวกัน

ตัวอย่างการเริ่มตรวจจับ: `routes/camera/rest.py` รับคำขอและตรวจ token ด้วย
`Depends(verify_token)` แล้วเรียก `services/camera_service.py` เพื่อเริ่ม `CameraThread`
ส่วนการส่งภาพและผลสรุปยังอยู่ใน `routes/camera/websocket.py` เพราะเป็นงานของ WebSocket โดยตรง

- **routes** ดูแล URL, HTTP method, Form/Body, dependency และการส่ง response
- **services** รวมขั้นตอนการทำงานเดิม เช่น เปิดกล้อง เข้าสู่ระบบ และบันทึกผล
- **schemas** ระบุ field ที่ API รับเข้าและให้ Pydantic ตรวจรูปแบบข้อมูล
- **core** ดูแลกล้อง การเรียก YOLO การติดตามเป้าหมาย และสรุปพฤติกรรมเดิม
- **config / utils** ดูแลการเชื่อมต่อและเครื่องมือช่วยที่มีอยู่เดิม

รอบนี้ย้ายโค้ดจาก routes เป็นหลัก โดยคงชื่อ endpoint, HTTP method, field ของ JSON,
สูตรคำนวณ, threshold, การทำงานของ thread และขั้นตอนเขียนฐานข้อมูลเดิมไว้
จึงใช้ frontend และคำสั่งรันเดิมได้ และยังใช้ `camera_threads` ชุดเดียวร่วมกันระหว่าง REST และ WebSocket

FastAPI รองรับการแบ่งแอปด้วย `APIRouter`; โฟลเดอร์ `services` และ `schemas` เป็นวิธีจัดหน้าที่
สำหรับโปรเจกต์นี้ ไม่ใช่ชื่อโฟลเดอร์ที่ FastAPI บังคับ
ดู [Bigger Applications — FastAPI](https://fastapi.tiangolo.com/tutorial/bigger-applications/)

### ทดสอบหลังแก้โค้ด

จากโฟลเดอร์ `server` และใช้ Python environment เดิม:

```bash
python -X utf8 -B -m unittest discover -s tests -v
```

ชุดทดสอบใช้กล้อง โมเดล และ Supabase จำลอง ไม่อ่าน `.env` และไม่ติดต่อฐานข้อมูลจริง
ตรวจ API, ข้อมูล login/สร้างอาจารย์, การแชร์สถานะกล้อง, การปิด session,
การอัปโหลด buffer และผลคำนวณเดิม โดยไม่ต้องติดตั้ง test framework เพิ่ม

ข้อสังเกตเรื่องการนับเวลา การถ่วงน้ำหนัก summary การอัปโหลดซ้ำ และการตรวจสิทธิ์
ยังเป็นงานต่อเนื่องแยกจากการจัดโครงสร้างครั้งนี้ ชุดทดสอบไม่ได้ยืนยันการทำงานกับกล้องหรือฐานข้อมูลจริง

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
