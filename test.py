import pillow_heif
from PIL import Image
import os

def convert_file(input_file, output_file, format="JPEG"):
    """
    แปลงไฟล์ HEIC เป็น Format ที่ระบุ (JPEG, PNG)
    
    Args:
        input_path (str): Path ไปยังไฟล์ .heic ต้นทาง
        output_path (str): Path ที่จะบันทึกไฟล์ใหม่
        format (str): Format ที่ต้องการ ("JPEG", "PNG")
    """
    try:
        # 1. อ่านไฟล์ HEIC (ได้เป็น "ตู้คอนเทนเนอร์" หรือ HeifFile)
        heif_file = pillow_heif.read_heif(input_file)

        # 2. 🔥 จุดแก้ไขสำคัญ 🔥
        # ดึงเอารูปภาพ "รูปแรก" หรือ "รูปหลัก" ออกมาจากตู้
        # (ถ้าไฟล์มีรูปเดียว heif_file[0] ก็คือรูปนั้น)
        primary_image = heif_file[0] 

        # 3. แปลง HeifImage (primary_image) เป็น PIL Image object
        image = Image.frombytes(
            primary_image.mode,
            primary_image.size,
            primary_image.data,
            "raw",
        )
        
        # 4. ดึงข้อมูล EXIF จาก "รูปหลัก"
        exif_data = None
        if hasattr(primary_image, "exif"):
            exif_data = primary_image.exif  # ดึงข้อมูล EXIF (เป็น bytes)

        # 5. กำหนด Format ที่จะบันทึก
        save_format = "JPEG" if format.upper() in ["JPEG", "JPG"] else format.upper()

        # 6. บันทึกไฟล์ (และแก้ typo 'quanlity' เป็น 'quality')
        if save_format == "JPEG":
            if exif_data:
                image.save(output_file, format=save_format, quality=95, exif=exif_data)
            else:
                image.save(output_file, format=save_format, quality=95) # <-- แก้ไข typo
        
        elif save_format == "PNG":
            image.save(output_file, format=save_format)
            
        else:
            print(f"Error: Format '{save_format}' is not supported (only JPEG, JPG, PNG).")
            return

        # ไม่ต้อง print ถ้าสำเร็จ เพื่อไม่ให้ log ยาวเกินไป
        # print(f"✅ Success: Converted '{input_file}' to '{output_file}' as {save_format}")

    except Exception as e:
        # 🔥 พิมพ์ Error ให้ชัดเจนว่าไฟล์ไหนมีปัญหา
        print(f"❌ Error converting file: {input_file}")
        print(f"   Error message: {e}")
        print(f"   Skipping this file...")
        

# --- ส่วนของการวน Loop (โค้ดเดิมของคุณถูกต้องแล้ว) ---

input_directory = "หันหน้า"
output_directory = "หันหน้า" # บันทึกไว้ที่เดิม (หรือเปลี่ยนเป็นโฟลเดอร์ใหม่ก็ได้)
# os.makedirs(output_directory, exist_ok=True) # ถ้าใช้โฟลเดอร์ใหม่

contents = os.listdir(input_directory)

files_to_convert = []
for item in contents:
    if item.lower().endswith((".heic", ".heif")): # รองรับ .heif ด้วย
        full_path = os.path.join(input_directory, item)
        if os.path.isfile(full_path):
            files_to_convert.append(item) 

print(f"Found {len(files_to_convert)} .HEIC/.HEIF files to convert.")
converted_count = 0
deleted_count = 0
# วน Loop เพื่อแปลงไฟล์
for file_name in files_to_convert:
    
    input_path = os.path.join(input_directory, file_name)
    
    base_name = os.path.splitext(file_name)[0]
    output_name = base_name + ".jpg" # ตั้งชื่อ .jpg ไปเลยง่ายๆ
    output_path = os.path.join(output_directory, output_name)
    
    # 3. เรียกใช้ฟังก์ชันด้วย Path ที่ถูกต้อง
    print(f"Converting: {file_name} ...")
    success = convert_file(input_path, output_path, format="JPG")

    if success:
        print(f"Converted to : {output_path}")
        converted_count += 1 
        try:
            os.remove(input_path)
            print(f"  🗑️ Deleted original: {file_name}")
            deleted_count += 1
        except Exception as e:
            print(f"  ❌ Error deleting file {input_path}: {e}")
    else:
        print(f"  Conversion failed for {file_name}. Original file was NOT deleted.")
print("--- Conversion Complete! ---")
print(f"Total files converted: {converted_count}")
print(f"Total original files deleted: {deleted_count}")