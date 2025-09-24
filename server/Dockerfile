#สร้าง Base ภาษาที่จะใช้และ version
FROM python:3-13-slim

#ตั้ง work directory 
WORKDIR /app

#ติดตั้ง Dependencies
COPY requirement.txt .
RUN pip install --no-cache-dir -r requirement.txt

#คัดลอกโค้ดทั้งหมด
COPY . .

# set port
EXPOSE 8000

# การรัน command server
CMD [ "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" ]