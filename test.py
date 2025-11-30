

# ตรวจว่าไฟล์ .ftyp เป็น HEIC จริงไหม
# def is_heic_file(path):
#     try:
#         with open(path, "rb") as f:
#             header = f.read(32)
#             return b"ftypheic" in header or b"ftypmif1" in header
#     except:
#         return False


# def load_any_image(path):
#     """
#     โหลดรูปภาพรองรับ:
#     - HEIC (ผ่าน pillow_heif)
#     - JFIF (ผ่าน PIL)
#     - PNG, JPG, JPEG
#     """
#     ext = os.path.splitext(path)[1].lower()

#     # HEIC/FTYP check
#     if ext == ".ftyp" or ext == ".heic" or ext == ".heif":
#         heif_file = pillow_heif.read_heif(path)
#         primary_image = heif_file[0]
#         return Image.frombytes(
#             primary_image.mode,
#             primary_image.size,
#             primary_image.data,
#             "raw",
#         )

#     # JFIF, JPG, PNG
#     return Image.open(path)


# def convert_to_jpg(input_file, output_file):
#     try:
#         image = load_any_image(input_file)
#         image = image.convert("RGB")
#         image.save(output_file, "JPEG", quality=95)
#         return True
#     except Exception as e:
#         print(f"❌ Error converting {input_file}: {e}")
#         return False


# ------------------------
#     MAIN LOOP
# ------------------------

# input_directory = "big"
# output_directory = "big"

# contents = os.listdir(input_directory)
# files_to_convert = []

# for item in contents:
#     ext = item.lower()

#     if ext.endswith((".jfif", ".ftyp")):
#         full_path = os.path.join(input_directory, item)

#         # กรณี .ftyp ต้องเช็คว่าเป็น HEIC จริงไหม
#         if ext.endswith(".ftyp") and not is_heic_file(full_path):
#             print(f"⚠️ Skip {item}: .ftyp file is NOT HEIC format")
#             continue

#         if os.path.isfile(full_path):
#             files_to_convert.append(item)

# print(f"Found {len(files_to_convert)} files to convert.")

# converted = 0
# deleted = 0

# for file_name in files_to_convert:
#     input_path = os.path.join(input_directory, file_name)
#     output_path = os.path.join(input_directory, os.path.splitext(file_name)[0] + ".jpg")

#     print(f"Converting: {file_name}")

#     success = convert_to_jpg(input_path, output_path)

#     if success:
#         print(f"  ✔ Converted to {output_path}")
#         converted += 1

#         try:
#             os.remove(input_path)
#             print(f"  🗑️ Deleted original: {file_name}")
#             deleted += 1
#         except Exception as e:
#             print(f"  ❌ Cannot delete {file_name}: {e}")

#     else:
#         print(f"  ❌ Failed: {file_name}")


# print("---- COMPLETE ----")
# print(f"Converted: {converted}")
# print(f"Deleted:   {deleted}")

from ultralytics import YOLO

m = YOLO("dataset/detect/train/weights/best.pt")
print("Ultralytics:", m.ckpt.get("version"))
print("Torch:", m.ckpt.get("torch_version"))
print("Python:", m.ckpt.get("python_version"))
