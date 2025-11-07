from utils.model_loader import get_model
from typing import List


def new_status_dict():
    try:
        model = get_model()
        if not hasattr(model, "names"):
            raise RuntimeError("YOLO model not loaded")
        labels: List[str] = list(get_model().names.values())
    except Exception as e:
        print(f"⚠️ [new_status_dict] Warning: cannot load model names ({e})")
        labels = ["Book","Focused", "Ipad", "LookingAway", "Looking_at_the_board", "Phone", "Taking_notes", "Talking", "UsingPhone"]


    return {
        "frame_class_count": {cls: 0 for cls in labels},
    }
