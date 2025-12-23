import cv2
import numpy as np
import mediapipe as mp
from PIL import Image
import os

INPUT_DIR = "ice_before"
OUTPUT_DIR = "ice_after"

os.makedirs(OUTPUT_DIR, exist_ok=True)

mp_selfie_segmentation = mp.solutions.selfie_segmentation

def load_image_unicode(path):
    """อ่านภาพแบบรองรับชื่อไฟล์ภาษาไทย (ใช้ PIL)"""
    pil_img = Image.open(path).convert("RGB")  
    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)


def blur_background(img):
    with mp_selfie_segmentation.SelfieSegmentation(model_selection=1) as model:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        result = model.process(rgb)
        mask = result.segmentation_mask

        bg_blur = cv2.GaussianBlur(img, (55, 55), 0)
        mask_3d = np.stack((mask,) * 3, axis=-1)

        return (mask_3d * img + (1 - mask_3d) * bg_blur).astype(np.uint8)


for filename in os.listdir(INPUT_DIR):
    if filename.lower().endswith((".jpg", ".jpeg", ".png")):
        print("Processing:", filename)

        inp_path = os.path.join(INPUT_DIR, filename)
        out_path = os.path.join(OUTPUT_DIR, filename)

        try:
            img = load_image_unicode(inp_path)  # อ่านแบบรองรับไฟล์ไทย
        except Exception as e:
            print(f"❌ อ่านภาพไม่ได้: {inp_path}  | error: {e}")
            continue

        result = blur_background(img)
        cv2.imwrite(out_path, result)

print("🎉 สำเร็จ! รองรับชื่อไฟล์ไทยทั้งหมดแล้ว")
