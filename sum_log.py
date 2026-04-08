import os
import glob
from datetime import datetime

def analyze_and_save_report():
    # --- 1. ค้นหาไฟล์ Log ต้นฉบับ ---
    list_of_files = glob.glob('classroom_log_*.txt') 
    if not list_of_files:
        print("ไม่พบไฟล์ Log (.txt) ในโฟลเดอร์นี้")
        return

    # เลือกไฟล์ที่ใหม่ที่สุด
    latest_file = max(list_of_files, key=os.path.getctime)
    
    # สร้างชื่อไฟล์ปลายทาง (Output) โดยเติมคำว่า summary_ ไว้ข้างหน้า
    # เช่น input: classroom_log_2026xxxx.txt -> output: summary_classroom_log_2026xxxx.txt
    input_filename = os.path.basename(latest_file)
    output_filename = f"summary_{input_filename}"

    print(f"Reading from: {input_filename}")
    print(f"Saving to:   {output_filename}")
    print("-" * 50)

    # --- 2. ตัวแปรเก็บข้อมูล ---
    summary_data = {}
    phone_data = {} 
    LOG_INTERVAL = 0.5 

    # --- 3. อ่านและประมวลผลข้อมูล ---
    try:
        with open(latest_file, 'r', encoding='utf-8') as f:
            # ข้าม Header
            next(f)
            next(f)

            for line in f:
                line = line.strip()
                if not line: continue

                parts = line.split('|')
                if len(parts) >= 5:
                    student_id = parts[1].strip()      
                    status = parts[2].strip()          
                    phone_usage = parts[4].strip()     

                    # คำนวณเวลากิจกรรม
                    if student_id not in summary_data:
                        summary_data[student_id] = {}
                    
                    if status not in summary_data[student_id]:
                        summary_data[student_id][status] = 0.0
                    
                    summary_data[student_id][status] += LOG_INTERVAL

                    # คำนวณเวลาใช้มือถือ
                    if student_id not in phone_data:
                        phone_data[student_id] = 0.0
                    
                    if "True" in phone_usage:
                        phone_data[student_id] += LOG_INTERVAL

    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # --- 4. เขียนรายงานลงไฟล์และหน้าจอ ---
    
    # เปิดไฟล์ Output เพื่อเตรียมเขียน
    with open(output_filename, "w", encoding="utf-8") as out_file:
        
        # ฟังก์ชันช่วย: พิมพ์ลงจอด้วย และ เขียนลงไฟล์ด้วย
        def output(text):
            print(text)                  # แสดงบนจอ
            out_file.write(text + "\n")  # เขียนลงไฟล์

        # เริ่มเขียนเนื้อหา
        output(f"REPORT SUMMARY")
        output(f"Source File: {input_filename}")
        output(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        output("=" * 75)
        output(f"{'STUDENT ID':<12} | {'ACTIVITY':<20} | {'DURATION (Sec)':<15} | {'DURATION (Min)':<15}")
        output("=" * 75)

        sorted_ids = sorted(summary_data.keys())

        for s_id in sorted_ids:
            activities = summary_data[s_id]
            
            # 4.1 แสดงกิจกรรมทั่วไป
            for act, seconds in activities.items():
                minutes = seconds / 60
                output(f"{s_id:<12} | {act:<20} | {seconds:>10.1f} วินาที | {minutes:>10.2f} นาที")
            
            # 4.2 แสดงการใช้โทรศัพท์
            phone_sec = phone_data.get(s_id, 0)
            if phone_sec > 0:
                phone_min = phone_sec / 60
                output(f"{s_id:<12} | {'>> PHONE USAGE <<':<20} | {phone_sec:>10.1f} วินาที | {phone_min:>10.2f} นาที")
            
            output("-" * 75) # ขีดคั่น

    print(f"\n[Success] บันทึกไฟล์สรุปเรียบร้อยแล้วที่: {output_filename}")

if __name__ == "__main__":
    analyze_and_save_report()
    input("กด Enter เพื่อปิดโปรแกรม...")