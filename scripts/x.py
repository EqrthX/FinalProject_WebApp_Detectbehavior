from ultralytics import YOLO
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns

def main():
    # 1. Load model
    model = YOLO('dataset_change_class/project/train/weights/best.pt')
    output_name = 'confusion_matrix_normalized.png'
    # 2. Run validation (ต้องมีไฟล์ data.yaml ที่ถูกต้อง)
    # ใส่ workers=0 หากยังมีปัญหาเรื่อง multiprocessing อยู่
    results = model.val(data='project_detection_Changes 3.v2-train.yolov11/data.yaml', workers=1) 

    # 3. ดึงค่า matrix และรายชื่อ class
    cm = results.confusion_matrix.matrix
    names = list(model.names.values())

    # 4. ตัดแถวและคอลัมน์ที่เป็น background ออก (Index สุดท้าย)
    cm_no_bg = cm[:-1, :-1]

    # 5. ทำ Normalize
    cm_normalized = cm_no_bg.astype('float') / np.maximum(cm_no_bg.sum(axis=1)[:, np.newaxis], 1e-12)

    # 6. Plot
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm_normalized, annot=True, fmt='.2f', cmap='Blues',
                xticklabels=names, yticklabels=names)
    plt.title('Confusion Matrix Normalized')

    plt.yticks(rotation=0)
    plt.xticks(rotation=45)
    plt.xlabel('')
    plt.ylabel('Predicted')
    plt.savefig(output_name, dpi=500, bbox_inches='tight')
    print(f"Successfully saved confusion matrix as: {output_name}")
    # plt.show()

if __name__ == '__main__':
    main()