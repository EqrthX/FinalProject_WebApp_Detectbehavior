import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix

df = pd.read_csv("gt_all.csv")

# กันกรณี background ถ้าไม่อยากนับ
# df = df[df["gt_class"] != "background"]

df["correct"] = df["pred_class"] == df["gt_class"]

# accuracy รวม
overall_acc = df["correct"].mean()

# accuracy แยกคลิป
clip_acc = df.groupby("clip")["correct"].mean()

print("📊 Accuracy Summary")
print(f"Overall Accuracy: {overall_acc*100:.2f}%\n")

print("Accuracy per clip:")
print((clip_acc*100).round(2))

print("\nClassification report:")
print(classification_report(df["gt_class"], df["pred_class"]))

print("\nConfusion Matrix:")
print(confusion_matrix(df["gt_class"], df["pred_class"]))
