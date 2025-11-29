from ultralytics import YOLO
import cv2
import time
import numpy as np

def test_fps(model, video_path, target_fps=15, test_minutes=60):
    cap = cv2.VideoCapture(video_path)

    model_fps = int(cap.get(cv2.CAP_PROP_FPS))
    if model_fps == 0:
        model_fps = 30  # fallback

    skip_rate = model_fps // target_fps

    total_predictions = 0
    score_sum = 0

    start_time = time.time()
    test_seconds = test_minutes * 60

    while time.time() - start_time < test_seconds:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        # ข้ามเฟรมตาม FPS ที่ต้องการ
        for _ in range(skip_rate):
            cap.grab()

        results = model(frame, verbose=False, device="cpu")
        boxes = results[0].boxes

        # เก็บค่า confidence เฉลี่ยเพื่อดูความเสถียร
        if len(boxes) > 0:
            score_sum += float(np.mean(boxes.conf.cpu().numpy()))
            total_predictions += 1

    cap.release()

    if total_predictions == 0:
        return 0

    return score_sum / total_predictions


if __name__ == "__main__":
    model = YOLO("dataset/detect/train/weights/best.pt")
    video = "test.mp4"

    print("⏳ Testing 15 FPS...")
    acc_15fps = test_fps(model, video, target_fps=15, test_minutes=1)

    print("⏳ Testing 30 FPS...")
    acc_30fps = test_fps(model, video, target_fps=30, test_minutes=1)

    print("\n============= RESULTS =============")
    print(f"15 FPS Accuracy Score: {acc_15fps:.4f}")
    print(f"30 FPS Accuracy Score: {acc_30fps:.4f}")
    print("FPS ที่มี accuracy สูงกว่า:", "30 FPS" if acc_30fps > acc_15fps else "15 FPS")
