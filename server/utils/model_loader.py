# utils/model_loader.py

import os
from ultralytics import YOLO

def get_model_path():
    """
    คืน path ของไฟล์ YOLO model (best.pt)
    """
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH = os.path.abspath(os.path.join(
        BASE_DIR,
        "..", "..",
        "dataset_test", "project", "train", "weights", "best.pt"
    ))

    return MODEL_PATH
