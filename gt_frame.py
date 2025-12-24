import cv2, os

video_path = "C.mp4"
out_dir = "frames_clipC"
os.makedirs(out_dir, exist_ok=True)

cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)

sec_interval = 1
frame_interval = int(fps * sec_interval)

frame_id = 0
save_id = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # 🔧 แก้ภาพกลับหัว
    frame = cv2.rotate(frame, cv2.ROTATE_180)

    if frame_id % frame_interval == 0:
        cv2.imwrite(f"{out_dir}/frame_{save_id:03d}.jpg", frame)
        save_id += 1

    frame_id += 1

cap.release()
print(f"✅ Saved {save_id} frames")
