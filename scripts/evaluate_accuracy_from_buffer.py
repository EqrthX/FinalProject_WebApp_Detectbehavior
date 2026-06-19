import json, os
import pandas as pd
import matplotlib.pyplot as plt
from glob import glob

# -----------------------
# Proxy GT rule
# -----------------------
def generate_proxy_gt(class_json):
    if not class_json:
        return "Uncertain"

    phone = class_json.get("UsingPhone", 0)
    away = class_json.get("LookingAway", 0)
    board = class_json.get("Looking_at_the_board", 0)
    note = class_json.get("Taking_notes", 0)

    if phone >= 0.6:
        return "UsingPhone"
    if away >= 0.6:
        return "LookingAway"
    if board + note >= 0.7:
        return "Attentive"

    return "Uncertain"

# -----------------------
# Path
# -----------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_DIR = os.path.join(os.path.dirname(BASE_DIR), "server", "jsonlogs")
OUTPUT_CSV = "behavior_accuracy.csv"

records = []

# -----------------------
# Load JSON buffers
# -----------------------
for path in glob(os.path.join(JSON_DIR, "*.json")):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    camera_id = data["camera_id"]

    for r in data["records"]:
        class_json = r.get("class_json", {})
        if not class_json:
            continue

        pred_class = max(class_json, key=class_json.get)
        proxy_gt = generate_proxy_gt(class_json)

        records.append({
            "camera_id": camera_id,
            "time": r["created_at"],
            "pred_class": pred_class,
            "proxy_gt": proxy_gt,
            "correct": pred_class == proxy_gt
        })

df = pd.DataFrame(records)

# drop uncertain
df = df[df["proxy_gt"] != "Uncertain"]

# save csv
df.to_csv(OUTPUT_CSV, index=False)
print(f"✅ Saved → {OUTPUT_CSV}")

# accuracy
print(f"🎯 Accuracy: {df['correct'].mean()*100:.2f}%")

# plot
df.groupby("camera_id")["correct"].mean().plot(kind="bar", title="Accuracy per Camera")
plt.ylim(0,1)
plt.show()
