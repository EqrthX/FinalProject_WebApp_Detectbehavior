import cv2
import time
import threading
from ultralytics import YOLO

# โหลดโมเดล YOLO
MODEL_PATH = "runs/detect/train/weights/best.pt"  # ← ปรับ path ตามจริง
model = YOLO(MODEL_PATH)

# เก็บสถานะกล้อง
cameras = {}

# ✅ ฟังก์ชันสร้าง dict สำหรับเก็บค่าพฤติกรรม
def create_behavior_dict():
    return {
        "Focused": 0,
        "Drinking": 0,
        "Eating": 0,
        "Lookaways": 0,
        "Sleeping": 0,
        "UsingPhone": 0,
    }

# ✅ ฟังก์ชันคำนวณค่าเฉลี่ย conf
def calculate_average(count_dict, sum_dict):
    result = {}
    for k in count_dict:
        if count_dict[k] > 0:
            result[k] = round(sum_dict[k] / count_dict[k], 3)
        else:
            result[k] = 0.0
    return result

# ✅ เปิดกล้อง
def open_camera_instance(camera_id: str):
    cap = cv2.VideoCapture(int(camera_id), cv2.CAP_MSMF)
    if not cap.isOpened():
        raise Exception(f"❌ ไม่สามารถเปิดกล้อง {camera_id} ได้")

    cameras[camera_id] = {
        "cap": cap,
        "running": True,
        "detecting": False,
        "seconds": 0,
        "count": create_behavior_dict(),
        "sum": {k: 0.0 for k in create_behavior_dict()},
    }
    print(f"✅ เปิดกล้อง {camera_id} สำเร็จ")

# ✅ ปิดกล้อง
def close_camera_instance(camera_id: str):
    cam_state = cameras.get(camera_id)
    if not cam_state:
        print(f"กล้อง {camera_id} ปิดไปแล้ว")
        return

    cam_state["running"] = False
    cap = cam_state["cap"]
    if cap and cap.isOpened():
        cap.release()

    cameras.pop(camera_id, None)
    print(f"🧹 ปิดกล้อง {camera_id} แล้ว")

# ✅ ตรวจจับ YOLO
def camera_loop(camera_id: str):
    cam_state = cameras[camera_id]
    cap = cam_state["cap"]

    cam_state["detecting"] = True
    print(f"🧠 เริ่มตรวจจับพฤติกรรมจากกล้อง {camera_id}")

    last_check_time = time.time()

    while cam_state["running"] and cam_state["detecting"]:
        ret, frame = cap.read()
        if not ret:
            print("ไม่สามารถอ่านภาพจากกล้องได้")
            break

        # 🔹 ใช้ YOLO ตรวจจับ
        results = model.predict(source=frame, conf=0.3, device="cpu", verbose=False)
        annotated = results[0].plot()

        # 🔹 แสดงภาพ (ปิดได้โดยกด q)
        cv2.imshow(f"Camera {camera_id}", annotated)

        now = time.time()
        if now - last_check_time >= 1.0:
            cam_state["seconds"] += 1
            last_check_time = now

            # เก็บ count/conf ของแต่ละคลาส
            for box in results[0].boxes:
                cls = int(box.cls)
                conf = float(box.conf.item())
                label = model.names[cls]
                if conf > 0.5 and label in cam_state["count"]:
                    cam_state["count"][label] += 1
                    cam_state["sum"][label] += conf

            # ทุก 60 วินาที สรุปผล
            if cam_state["seconds"] >= 60:
                avg = calculate_average(cam_state["count"], cam_state["sum"])
                print(f"📊 ค่าเฉลี่ย (1 นาที): {avg}")

                # reset
                cam_state["count"] = create_behavior_dict()
                cam_state["sum"] = {k: 0.0 for k in cam_state["sum"]}
                cam_state["seconds"] = 0

        # ปิดได้ด้วยปุ่ม q
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cam_state["detecting"] = False
    close_camera_instance(camera_id)
    cv2.destroyAllWindows()
    print(f"🛑 หยุดตรวจจับกล้อง {camera_id}")

# ✅ main function สำหรับทดสอบ
def run_test(camera_id=0):
    open_camera_instance(str(camera_id))
    t = threading.Thread(target=camera_loop, args=(str(camera_id),), daemon=True)
    t.start()
    t.join()

array_label = []
def set_model():
    
    labels = list(model.names.values())
    print(labels)
    # cap = cv2.VideoCapture(0)
    # while cap.isOpened:
    #     ret, frame = cap.read()

    #     # 🔹 ใช้ YOLO ตรวจจับ
    #     results = model.predict(source=frame, conf=0.3, device="cpu", verbose=False)
    #     annotated = results[0].plot()

      
    #     if cv2.waitKey(1) & 0xFF == ord('q'):
    #         break



if __name__ == "__main__":
    # run_test(0)
    set_model()
