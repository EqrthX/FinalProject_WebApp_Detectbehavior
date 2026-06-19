import cv2
import numpy as np
from ultralytics import YOLO
import time
from datetime import datetime

class ClassroomLoggerBBox:
    def __init__(self, source=0):
        print("Loading models with Tracking enabled...")
        
        # 1. โมเดลตรวจจับโทรศัพท์ (ใช้ตัวเดิม)
        self.model_phone = YOLO('yolov8n.pt') 
        
        # 2. โมเดลตรวจจับพฤติกรรม (เปลี่ยนเป็น best.pt)
        self.model_behavior = YOLO('datasetnew_boundingbox/datasetnew_boundingbox/detect/train/weights/best.pt') 
        
        self.cap = cv2.VideoCapture(source)
        
        # ตั้งค่าการบันทึกไฟล์ (Logging Setup)
        self.log_interval = 0.5
        self.last_log_time = time.time()
        
        self.filename = f"classroom_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        self.file = open(self.filename, "w", encoding="utf-8")
        self.file.write("Timestamp | ID | Status | Confidence | Phone_Detected\n")
        self.file.write("-" * 60 + "\n")
        print(f"Logging data to: {self.filename}")

        # --- สำคัญ: แก้เลข Class ให้ตรงกับที่คุณเทรนมา ---
        self.CLASS_MAP = {
            0: "Looking Away",
            1: "Looking at the board",
            2: "Looking down to write",
            3: "Using Phone",
        }
        
        self.COLORS = {
            'Looking Away': (0, 0, 255),           # สีแดง
            'Looking at the board': (0, 255, 0),   # สีเขียว
            'Looking down to write': (255, 255, 0),# สีฟ้า
            'Using Phone': (255, 0, 255),          # สีม่วง
            'PHONE': (255, 0, 255),                # มือถือ (จากอีกโมเดล) สีม่วง
            'WARN': (0, 255, 255)                  # สีสำรอง
        }

        self.show_overlay = True
        self.show_text = True

    def run(self):
        try:
            while self.cap.isOpened():
                success, frame = self.cap.read()
                if not success: break
                
                privacy_frame = np.zeros(frame.shape, dtype=np.uint8)
                current_time = time.time()
                should_log = (current_time - self.last_log_time) >= self.log_interval
                timestamp_str = datetime.now().strftime("%H:%M:%S.%f")[:-3]

                # --- 1. Detect Phone ---
                has_phone = False
                results_phone = self.model_phone(frame, verbose=False, classes=[67], conf=0.4)
                for r in results_phone:
                    for box in r.boxes:
                        has_phone = True
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        if self.show_overlay:
                            cv2.rectangle(privacy_frame, (x1, y1), (x2, y2), self.COLORS['PHONE'], 2)
                        if self.show_text:
                            cv2.putText(privacy_frame, "Phone", (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, self.COLORS['PHONE'], 2)

                # --- 2. Track Behavior (ใช้ Tracker เพื่อให้ได้ ID) ---
                results_behavior = self.model_behavior.track(frame, persist=True, verbose=False, conf=0.5)
                
                if results_behavior[0].boxes is not None and results_behavior[0].boxes.id is not None:
                    boxes = results_behavior[0].boxes
                    track_ids = boxes.id.int().cpu().tolist()
                    classes = boxes.cls.int().cpu().tolist()
                    confs = boxes.conf.cpu().tolist()
                    coords = boxes.xyxy.int().cpu().tolist()

                    for i in range(len(track_ids)):
                        student_id = track_ids[i]
                        cls_id = classes[i]
                        conf = confs[i]
                        x1, y1, x2, y2 = coords[i]
                        
                        status = self.CLASS_MAP.get(cls_id, f"Unknown({cls_id})")
                        color = self.COLORS.get(status, self.COLORS['WARN'])

                        # เขียนลง Log
                        if should_log:
                            log_line = f"{timestamp_str} | ID:{student_id} | {status:<13} | {int(conf*100)}% | Phone:{has_phone}\n"
                            self.file.write(log_line)

                        # วาดกล่อง
                        if self.show_overlay:
                            cv2.rectangle(privacy_frame, (x1, y1), (x2, y2), color, 2)

                        # วาดข้อความ
                        if self.show_text:
                            display_text = f"ID:{student_id} {status}"
                            cv2.putText(privacy_frame, display_text, (x1, y1-10), 
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

                if should_log:
                    self.last_log_time = current_time
                    self.file.flush()

                cv2.imshow("Classroom Logger (BBox)", privacy_frame)
                
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'): break
                elif key == ord('d'): self.show_overlay = not self.show_overlay
                elif key == ord('t'): self.show_text = not self.show_text

        finally:
            print("Closing file...")
            self.file.close()
            self.cap.release()
            cv2.destroyAllWindows()
            print(f"File saved successfully: {self.filename}")

if __name__ == "__main__":
    logger = ClassroomLoggerBBox(source=0)
    logger.run()