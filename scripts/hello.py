import cv2
import numpy as np
from ultralytics import YOLO

class ClassroomPrivacyMonitor:
    def __init__(self, source=0):
        print("Loading models...")
        self.model_phone = YOLO('yolov8n.pt') 
        self.model_behavior = YOLO('datasetnew_boundingbox/datasetnew_boundingbox/detect/train/weights/best.pt') 
        
        self.cap = cv2.VideoCapture(source)
        
        self.show_overlay = True 
        self.show_text = True    

        self.CLASS_MAP = {
            0: "Looking Away",
            1: "Looking at the board",
            2: "Looking down to write",
            3: "Using Phone",
        }
        
        # ปรับสีให้ตรงกับ Key ใน CLASS_MAP
        self.COLORS = {
            'Looking Away': (0, 0, 255),           # สีแดง
            'Looking at the board': (0, 255, 0),   # สีเขียว
            'Looking down to write': (255, 255, 0),# สีฟ้า
            'Using Phone': (255, 0, 255),          # สีม่วง
            'PHONE': (255, 0, 255),
            'WARN': (0, 255, 255)
        }

    def run(self):
        print("--- Controls ---")
        print("Press 'd' : Toggle Lines/Boxes")
        print("Press 't' : Toggle Text")
        print("Press 'q' : Quit")
        
        while self.cap.isOpened():
            success, frame = self.cap.read()
            if not success: break

            privacy_frame = np.zeros(frame.shape, dtype=np.uint8)

            # 1. Detect Phone
            results_phone = self.model_phone(frame, verbose=False, classes=[67], conf=0.4)
            for r in results_phone:
                for box in r.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    if self.show_overlay:
                        cv2.rectangle(privacy_frame, (x1, y1), (x2, y2), self.COLORS['PHONE'], 2)
                    if self.show_text:
                        cv2.putText(privacy_frame, "Phone", (x1, y1-10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, self.COLORS['PHONE'], 2)

            # 2. Detect Behavior (Bounding Box)
            results_behavior = self.model_behavior(frame, verbose=False, conf=0.5)
            for r in results_behavior:
                for box in r.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cls_id = int(box.cls[0])
                    
                    status = self.CLASS_MAP.get(cls_id, f"Unknown({cls_id})")
                    color = self.COLORS.get(status, self.COLORS['WARN'])

                    if self.show_overlay:
                        cv2.rectangle(privacy_frame, (x1, y1), (x2, y2), color, 2)

                    if self.show_text:
                        cv2.putText(privacy_frame, status, (x1, y1-10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

            # ตรงนี้คือตัวเปิดหน้าต่างโชว์ภาพสดจากกล้อง
            cv2.imshow("Privacy Monitor (BBox)", privacy_frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'): break
            elif key == ord('d'): self.show_overlay = not self.show_overlay
            elif key == ord('t'): self.show_text = not self.show_text

        self.cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    monitor = ClassroomPrivacyMonitor(source=0) # ใช้กล้องเว็บแคม
    monitor.run()