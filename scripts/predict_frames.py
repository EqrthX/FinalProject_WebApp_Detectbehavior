from ultralytics import YOLO
import pandas as pd
import os

model = YOLO("dataset_test/project/train/weights/best.pt")

def predict_folder(folder, clip_name):
    rows = []
    for img in sorted(os.listdir(folder)):
        path = os.path.join(folder, img)
        r = model(path)[0]

        if len(r.boxes) == 0:
            pred = "background"
            conf = 0.0
        else:
            box = r.boxes[0]
            pred = model.names[int(box.cls)]
            conf = float(box.conf)

        rows.append({
            "clip": clip_name,
            "filename": img,
            "pred_class": pred,
            "confidence": conf
        })
    return rows

records = []
records += predict_folder("frames_clipA", "A")
records += predict_folder("frames_clipB", "B")
records += predict_folder("frames_clipC", "C")

df = pd.DataFrame(records)
df.to_csv("pred_all.csv", index=False)
print("✅ Saved pred_all.csv")
