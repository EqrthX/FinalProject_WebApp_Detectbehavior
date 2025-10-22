from ultralytics import YOLO
import os

model = None

def get_model():
    global model

    if model is None:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))   
        MODEL_PATH = os.path.join(BASE_DIR, "..", "..", "runs", "detect", "train", "weights", "best.pt")
        model = YOLO(MODEL_PATH)
    else:
        model = None
    
    return model