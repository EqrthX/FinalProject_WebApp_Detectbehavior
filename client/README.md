# 💻 ClassLens — Frontend (client)

> **ส่วนติดต่อผู้ใช้งาน (Frontend) สำหรับระบบตรวจจับพฤติกรรมผู้เรียนในห้องเรียนแบบ Real-time**

🌐 **Live Website (Frontend):** [https://final-project-web-app-detectbehavio.vercel.app/](https://final-project-web-app-detectbehavio.vercel.app/)

---

## 🏗️ เทคโนโลยีที่ใช้ (Frontend Tech Stack)

- **Core:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) (เพื่อความรวดเร็วในการโหลดและการพัฒนา)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) + [Ant Design](https://ant.design/) (UI Components)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Charts / Data Visualization:** [Recharts](https://recharts.org/) (สำหรับแสดงกราฟความสนใจในหน้าสรุปผล)
- **API Call & Connection:** [Axios](https://axios-http.com/) + Native WebSocket

---

## 📁 โครงสร้างโฟลเดอร์ของ Client

```text
client/
├── public/                  # Static assets (เช่น icon.svg, โลโก้)
├── src/
│   ├── components/          # Components ที่ใช้ร่วมกัน (เช่น SessionCard, Navbar, DeleteConfirmModal)
│   ├── pages/               # หน้าเว็บหลัก
│   │   ├── LoginPage.jsx    # หน้าล็อกอิน
│   │   ├── admin/           # ระบบหลังบ้านสำหรับแอดมิน (จัดการตารางสอน, สมาชิก)
│   │   └── user/            # ระบบสำหรับอาจารย์ (หน้าตรวจจับแบบสด, หน้าประวัติ/สรุปผล)
│   ├── util/                # ฟังก์ชันตัวช่วย, constants, และ hooks (เช่น dataProcessors, custom hooks)
│   ├── App.jsx              # Routing & โครงสร้างแอปหลัก
│   ├── index.css            # Global CSS (Tailwind imports)
│   └── main.jsx             # Entrypoint ของ React
├── .env                     # ไฟล์กำหนด Environment Variables
├── package.json             # รายการ Dependencies และ Scripts
└── vite.config.js           # Configuration ของ Vite
```

---

## ⚙️ การตั้งค่า Environment Variables (`client/.env`)

สร้างไฟล์ `.env` ที่โฟลเดอร์ `client/` แล้วกำหนดค่าตามนี้:

```env
# URL ของ FastAPI Backend
VITE_API_BASE=http://localhost:8000/api

# ข้อมูลเชื่อมต่อ Supabase Client
VITE_SUPABASE_URL_CLIENT=https://your-supabase-url.supabase.co
VITE_SUPABASE_KEY_CLIENT=your-anon-key
```

> **หมายเหตุ:** หากต้องการรันระบบผ่านการแชร์เน็ต/อินเทอร์เน็ตภายนอก (เช่น ngrok หรือ Cloudflare Tunnel) ให้แก้ไข `VITE_API_BASE` ให้เป็น URL ที่ได้จาก Tunnel นั้นๆ เช่น `https://xxxx.ngrok-free.app/api`

---

## 🚀 ขั้นตอนการติดตั้งและการใช้งาน

### 1️⃣ ติดตั้ง Dependencies
เปิด Terminal ในโฟลเดอร์ `client/` แล้วรันคำสั่ง:
```bash
npm install
```

### 2️⃣ รันในโหมด Development (เขียนโค้ดและทดสอบ)
```bash
npm run dev
```
เปิดบราวเซอร์ไปที่: [http://localhost:5173](http://localhost:5173)

### 3️⃣ Build สำหรับนำไปใช้งานจริง (Production Build)
```bash
npm run build
```
ผลลัพธ์จะถูกเซฟไว้ในโฟลเดอร์ `dist/` ซึ่งสามารถนำไปอัปโหลดขึ้นบริการโฮสติ้ง เช่น **Vercel** หรือ **Netlify** ได้ทันที

---

## 👥 สมาชิกผู้พัฒนา (Credits)

- **Nontprawitch**
- **Chaianun**
- **Chanidapha**