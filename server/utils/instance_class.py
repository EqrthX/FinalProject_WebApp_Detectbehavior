from utils.model_loader import get_model
from typing import List


def new_status_dict():
    try:
        model = get_model()
        if not hasattr(model, "names"):
            raise RuntimeError("YOLO model not loaded")

        # บังคับให้เป็น list เสมอ
        labels = list(model.names.values())

        # 🔹 ตัด class ที่ไม่ต้องการ
        remove_classes = {"Phone"}
        labels = [cls for cls in labels if cls not in remove_classes]

    except Exception as e:
        print(f"⚠️ [new_status_dict] Warning: cannot load model names ({e})")
        # fallback ถ้าโหลด model ไม่ได้
        labels = [
            "Focused",
            "LookingAway",
            "Looking_at_the_board",
            "Taking_notes",
            "Talking",
            "UsingPhone",
        ]

    return {
        "frame_class_count": {cls: 0 for cls in labels},
    }
