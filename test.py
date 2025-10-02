history_1min = []
history_1hr = []
import random
import datetime
# สร้าง array ขนาด 70
array_dicts = []
def generate_random_time():
    """Generates a random datetime.time object."""
    hour = random.randint(0, 23)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return datetime.time(hour, minute, second)

for i in range(12):
    nested_dict = {
        "id": i + 1,
        "data": {
            "a": round(random.uniform(0, 100), 3),  # float ระหว่าง 0-10
            "b": round(random.uniform(0, 100), 3)  # float ระหว่าง 0-100
        }
    }
    array_dicts.append(nested_dict)

# แสดงตัวอย่างบางส่วน
sum_a, sum_b = 0.0, 0.0 

if len(array_dicts) >= 12:
    for i in array_dicts:
        data = i['data']
        sum_a += data['a']
        sum_b += data['b']

avg_a = sum_a / len(array_dicts)
avg_b = sum_b / len(array_dicts)
    
print(f"a {avg_a}")
print(f"a {avg_b}")