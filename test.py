from datetime import datetime
import random
import json

history_1min = []
history_1hr = []
file_log = f"log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"  # กันชื่อไฟล์ซ้ำ

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

data = []
with open("log_1min_20251003_144257.json", 'r', encoding='utf-8') as f:
    data = json.load(f)

values_list = [d for d in data]
sum_Focused = {}
result = {}

for item in values_list:
    attention_values_High_Attention = item['average']['High_Attention'].items()
    for key, value in attention_values_High_Attention:
        if key in attention_values_High_Attention:
            sum_Focused[key] += value
        else:
            sum_Focused[key] = value

    attention_values_Low_Attention = item['average']['Low_Attention'].items()
    for key, value in attention_values_Low_Attention:
        
        if key in result:
            result[key] += value
        else:
            result[key] = value

        
for key in sum_Focused:
    sum_Focused[key] /= len(values_list)

for key in result:
    result[key] /= len(values_list)

print(f"Result {sum_Focused}")
print(f"Result {result}")