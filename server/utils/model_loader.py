# utils/model_loader.py

import os
import torch
from ultralytics import YOLO

_model = None

def get_model():
    global _model
    if _model is not None:
        return _model

    try:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        MODEL_PATH = os.path.abspath(os.path.join(
            BASE_DIR,
            "..", "..",
            "dataset", "detect", "train", "weights", "best.pt"
        ))

        print(f"[model_loader] Loading model from: {MODEL_PATH}")

        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

        # โหลดโมเดล YOLO v8/v11 อย่างปลอดภัย
        _model = YOLO(MODEL_PATH)
        print("[model_loader] Model loaded successfully.")
        return _model

    except Exception as e:
        print(f"❌ [model_loader] Failed to load YOLO model: {e}")
        raise RuntimeError("Cannot load YOLO model")
