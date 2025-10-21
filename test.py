
import cv2

for i in range(10):
    cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
    print(f"index {i} opened:", cap.isOpened())
    cap.release()
