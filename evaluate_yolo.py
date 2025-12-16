from ultralytics import YOLO
import json

def evaluate(model_path, data_yaml, save_json=True, json_path="metrics.json"):
    model = YOLO(model_path)

    metrics = model.val(
        data=data_yaml,
        imgsz=640,
        split="val",
        verbose=True,
        device="cpu"
    )

    box = metrics.box  # shorthand

    # ----------------- Metrics รวม -----------------
    result = {
        "overall": {
            "precision": float(box.mp),      # mean precision
            "recall": float(box.mr),         # mean recall
            "mAP50": float(box.map50),       # mean AP50
            "mAP50_95": float(box.map)       # mean AP50-95
        },
        "per_class": []
    }

    class_names = model.names
    num_classes = len(class_names)

    # Per-class arrays (ทุกตัวเป็น ndarray)
    precisions = box.p
    recalls = box.r
    ap50s = box.ap50
    aps = box.ap

    for i in range(num_classes):
        result["per_class"].append({
            "class_id": i,
            "class_name": class_names[i],
            "precision": float(precisions[i]),
            "recall": float(recalls[i]),
            "AP50": float(ap50s[i]),
            "AP50_95": float(aps[i])
        })

    # ----------------- Confusion Matrix -----------------
    try:
        result["confusion_matrix"] = box.confusion_matrix.tolist()
    except:
        result["confusion_matrix"] = None

    # Save JSON
    if save_json:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"📁 Saved → {json_path}")

    return result


if __name__ == "__main__":
    result = evaluate(
        model_path="dataset/detect/train/weights/best.pt",
        data_yaml="Project_Detection.v11-model-v4-color.yolov11/data.yaml",
        json_path="metrics_output.json"
    )

    print("\n======== SUMMARY ========")
    print(json.dumps(result["overall"], indent=2))
