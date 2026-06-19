# 🎓 FinalProject — WebApp Detect Behavior

> **เว็บแอปพลิเคชันตรวจจับพฤติกรรมผู้เรียนในห้องเรียน แบบ Real-time ด้วย YOLOv8**

![Python](https://img.shields.io/badge/Python-3.11.9-blue?logo=python)
![Node.js](https://img.shields.io/badge/Node.js-24.x-green?logo=node.js)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-teal?logo=fastapi)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Supabase](https://img.shields.io/badge/Database-Supabase-3ecf8e?logo=supabase)

---

## 📌 ภาพรวมโปรเจกต์

ระบบนี้ช่วยให้อาจารย์สามารถ **ตรวจสอบความตั้งใจของนักเรียน** ผ่านกล้องเว็บแคมในห้องเรียนแบบ Real-time โดยใช้ AI วิเคราะห์พฤติกรรม 4 ประเภท ได้แก่:

| พฤติกรรม | ความหมาย |
|---|---|
| 👀 Looking at the board | มองกระดาน (ตั้งใจเรียน) |
| ✍️ Looking down to write | จดเลคเชอร์ (ตั้งใจเรียน) |
| 😶 Looking Away | หันหน้าออก |
| 📱 Using Phone | เล่นโทรศัพท์ |

---

## 🏗️ Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| **Frontend** | React 19, Vite, TailwindCSS 4, Ant Design |
| **Backend** | Python 3.11, FastAPI, WebSocket |
| **AI Model** | YOLOv8 (Ultralytics) + ByteTrack |
| **Database** | Supabase (PostgreSQL) |
| **Real-time** | WebSocket (ภาพสด + สรุปผล) |

---

## 📁 โครงสร้างโปรเจกต์

```
FinalProject_WebApp_Detectbehavior/
├── client/                        # Frontend (React + Vite)
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── user/              # หน้าสำหรับอาจารย์
│       │   └── admin/             # หน้าสำหรับแอดมิน
│       └── components/
│
├── server/                        # Backend (FastAPI)
│   ├── main.py                    # Entry point
│   ├── core/
│   │   └── camera_thread.py       # Core: YOLOv8 + Threading
│   ├── routes/
│   │   ├── camera/
│   │   │   ├── rest.py            # REST APIs (list/start/stop/close)
│   │   │   └── websocket.py       # WebSocket (stream ภาพ + summary)
│   │   ├── auth_route.py          # Login
│   │   └── admin_route.py         # Admin management
│   ├── config/
│   │   └── bn_supabase.py         # Supabase connection
│   └── utils/
│       ├── auth.py                # JWT Token verification
│       ├── json_buffer.py         # Local buffer ก่อนบันทึก DB
│       └── model_loader.py        # โหลด YOLO model path
│
└── datasetnew_boundingbox/        # โฟลเดอร์เก็บ Model weights (best.pt)
```

---

## ✅ ความต้องการของระบบ (Prerequisites)

ก่อนเริ่ม ให้ตรวจสอบว่าได้ติดตั้งโปรแกรมต่อไปนี้แล้ว:

- **Python 3.11.9** → [ดาวน์โหลดที่นี่](https://www.python.org/downloads/release/python-3119/)
- **Node.js 24.x** → [ดาวน์โหลดที่นี่](https://nodejs.org/en)
- **Git** → [ดาวน์โหลดที่นี่](https://git-scm.com/)
- **กล้องเว็บแคม (USB)** ต่ออยู่กับเครื่อง

---

## 🛠️ ขั้นตอนการติดตั้ง

### 1️⃣ Clone โปรเจกต์

```bash
git clone https://github.com/EqrthX/FinalProject_WebApp_Detectbehavior.git
cd FinalProject_WebApp_Detectbehavior
```

---

### 2️⃣ ตั้งค่า Backend (Python / FastAPI)

**สร้าง Virtual Environment ด้วย Python 3.11:**

```bash
py -3.11 -m venv venv
```

**เปิดใช้งาน Virtual Environment:**

```bash
# Windows
.\venv\Scripts\activate

# Mac / Linux
source venv/bin/activate
```

**ติดตั้ง Dependencies:**

```bash
# สำหรับเครื่องที่มี GPU (CUDA)
pip install -r requirement_gpu.txt

# สำหรับเครื่องที่ใช้ CPU ทั่วไป
pip install -r requirement_cpu.txt
```

**ตั้งค่าไฟล์ `.env` ของ Backend:**

สร้างไฟล์ `server/.env` แล้วใส่ค่าต่อไปนี้:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

> **หมายเหตุ:** ค่าเหล่านี้หาได้จาก Supabase Dashboard → Settings → API

---

### 3️⃣ ตั้งค่า Frontend (React / Vite)

**ติดตั้ง Node Dependencies:**

```bash
cd client
npm install
```

**ตั้งค่าไฟล์ `.env` ของ Frontend:**

สร้างไฟล์ `client/.env` แล้วใส่ค่าต่อไปนี้:

```env
VITE_API_BASE=http://localhost:8000/api
VITE_SUPABASE_URL_CLIENT=https://your-project.supabase.co
VITE_SUPABASE_KEY_CLIENT=your-anon-key
```

---

## 🚀 วิธีรันโปรเจกต์

ต้องเปิด **Terminal 2 หน้าต่าง** พร้อมกัน:

**Terminal 1 — รัน Backend:**

```bash
# ตรวจสอบว่าเปิด venv แล้ว
.\venv\Scripts\activate  # Windows

cd server
uvicorn main:app --reload --port 8000
```

Backend จะรันที่ → `http://localhost:8000`

**Terminal 2 — รัน Frontend:**

```bash
cd client
npm run dev
```

Frontend จะรันที่ → `http://localhost:5173`

---

## 🌐 การ Deploy (แชร์ให้คนอื่นใช้งาน)

เนื่องจากระบบต้องใช้กล้อง USB จริง เครื่องที่ต่อกล้องต้องเปิดอยู่ตลอดเวลา
แนะนำใช้ **Cloudflare Tunnel** เพื่อ Expose Backend ออก Internet ฟรี:

```bash
# ติดตั้ง cloudflared
winget install --id Cloudflare.cloudflared

# Expose backend port 8000
cloudflared tunnel --url http://localhost:8000
# ได้ URL เช่น: https://xxxx.trycloudflare.com
```

จากนั้นอัปเดต `client/.env`:

```env
VITE_API_BASE=https://xxxx.trycloudflare.com/api
```

และ Deploy Frontend ขึ้น **[Vercel](https://vercel.com)** ได้เลยฟรี ✅

---

## 👥 บทบาทของผู้ใช้ (Roles)

| Role | ความสามารถ |
|---|---|
| **อาจารย์ (Teacher)** | เปิดกล้อง, เริ่มตรวจจับ, ดูสรุปผลการสอน |
| **แอดมิน (Admin)** | จัดการข้อมูลอาจารย์, วิชา, ตารางสอน |

---

## ⚠️ หมายเหตุสำคัญ

- Model weights (`best.pt`) ต้องอยู่ใน `datasetnew_boundingbox/datasetnew_boundingbox/detect/train/weights/best.pt`
- กล้อง USB ต้องต่ออยู่กับเครื่องที่รัน Backend เท่านั้น
- ข้อมูลจะถูก Buffer ไว้ใน `server/jsonlogs/` และอัปโหลดไป Supabase เมื่อกด "จบการตรวจจับ"
