from ultralytics import YOLO
import os

model = None

def get_model():
    global model

    if model is not None:
        return model
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))   
    MODEL_PATH = os.path.join(BASE_DIR, "..", "..", "dataset", "detect", "train", "weights", "best.pt")
    
    if not os.path.exists(MODEL_PATH):
        print(f"❌ [model_loader] Model file not found at: {MODEL_PATH}")
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
    
    try:
        print(f"[model_loader] ดึงโมเดลจาก {MODEL_PATH}")
        model = YOLO(MODEL_PATH)
        print(f"[model_loader] โหลดโมเดลสำเร็จ ({len(model.names)}) classes")
        return model
    except Exception as e:
        print(f"❌ [model_loader] Failed to load YOLO model: {e}")
        raise RuntimeError("Cannot load YOLO model") from e  