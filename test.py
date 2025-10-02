from datetime import datetime
import random
import json

history_1min = []
history_1hr = []
file_log = f"log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"  # กันชื่อไฟล์ซ้ำ

def add_minute_record(avg_min):
    record_min = {
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "interval_minutes": 5,
        "average": avg_min
    }
    history_1min.append(record_min)

    # เช็คว่าครบ 12 record (5 นาที * 12 = 60 นาที)
    if len(history_1min) == 12:
        avg_hr = sum(r["average"] for r in history_1min) / 12
        record_hr = {
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "interval_minutes": 60,
            "average": avg_hr
        }
        history_1hr.append(record_hr)
        history_1min.clear()  # reset


# --- ทดลอง ---
for _ in range(24):  # สมมติรัน 2 ชั่วโมง (24 * 5 นาที)
    avg_min = round(random.uniform(0, 100), 2)
    add_minute_record(avg_min)

# เขียน log
with open(file_log, 'a', encoding="utf-8") as file:
    file.write("---- 5min ----\n")
    for rec in history_1min:
        file.write(json.dumps(rec) + "\n")

    file.write("---- 1hr ----\n")
    for rec in history_1hr:
        file.write(json.dumps(rec) + "\n")

print("บันทึก log เรียบร้อย:", file_log)
