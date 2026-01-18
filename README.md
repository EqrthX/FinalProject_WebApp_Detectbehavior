# FinalProject_WebApp_Detectbehavior

เว็บแอปพลิเคชันสำหรับตรวจจับพฤติกรรม (Behavior Detection Web Application)

## 📋 ความต้องการของระบบ (Prerequisites)

ก่อนเริ่มใช้งาน โปรดตรวจสอบให้แน่ใจว่าเครื่องของคุณได้ติดตั้งโปรแกรมดังต่อไปนี้ในเวอร์ชันที่กำหนด:

- **Node.js**: เวอร์ชัน 24 (หรือใหม่กว่า)
- **Python**: เวอร์ชัน 3.11.9
- **Git**

---

## 🛠️ ขั้นตอนการติดตั้ง (Installation Guide)

### 1. Clone โปรเจกต์
ดึงโค้ดลงมาที่เครื่องของคุณ:
```bash
git clone [https://github.com/EqrthX/FinalProject_WebApp_Detectbehavior.git](https://github.com/EqrthX/FinalProject_WebApp_Detectbehavior.git)
cd FinalProject_WebApp_Detectbehavior

```

# 1.การติดตั้ง Python 3.11.9 และเตรียม Backend
1.1 ดาวน์โหลด Python 3.11.9 จากเว็บไซต์หลัก: Python 3.11.9 [Download](https://www.python.org/downloads/release/python-3119/)
1.2 ตอนติดตั้ง อย่าลืมติ๊กถูก ช่อง Add Python to PATH
1.3 ตรวจสอบเวอร์ชัน python --version
ต้องขึ้นว่าเป็น Python 3.11.9

# ตั้งค่า Environment และลง Library
เข้าไปที่โฟลเดอร์ Backend (สมมติว่าชื่อ backend หรือถ้าอยู่ที่ root ให้ข้ามคำสั่ง cd)
## สร้าง Virtual Environment
```bash
py -3.11 -m venv venv
```

## เปิดใช้งาน Virtual Environment
## Windows:
.\venv\Scripts\activate

## Mac/Linux:
source venv/bin/activate

## ติดตั้ง Library ที่จำเป็น
pip install -r requirements.txt

### หมายเหตุ: หากในโปรเจกต์ไม่มีไฟล์ requirements.txt คุณอาจต้องติดตั้ง library หลักๆ เอง เช่น pip install flask opencv-python numpy เป็นต้น

# 2. การติดตั้ง Node.js 24 และเตรียม Frontend
ติดตั้ง Node.js
2.1 ไปที่ [Node.js](https://nodejs.org/en)
2.2 ดาวน์โหลดและติดตั้งเวอร์ชัน 24.x (Current/Latest)
2.3 ตรวจสอบ version
```bash
node -v
ต้องขึ้นว่าเป็น v24.x.x
```


# ติดตั้ง Dependencies
เข้าไปที่โฟลเดอร์ Frontend (สมมติว่าชื่อ frontend หรือ client)
```bash 
cd frontend
# ติดตั้ง node_modules
npm install
```

# การรันโปรเจกต์ (Usage)
คุณต้องรันทั้ง Backend และ Frontend ควบคู่กัน (แนะนำให้เปิด Terminal 2 หน้าต่าง)
## Terminal 1: รัน Backend (Python)
```bash 
# ตรวจสอบว่าอยู่ใน venv แล้ว
# Windows: .\venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

python app.py
# หรือ main.py (ขึ้นอยู่กับชื่อไฟล์หลักของโปรเจกต์คุณ)
```
Backend มักจะรันอยู่ที่ http://localhost:8000


## Terminal 2: รัน Frontend (Node.js)
```bash 
cd frontend
npm run dev
# หรือ npm start
```

Frontend มักจะรันอยู่ที่ http://localhost:5173

