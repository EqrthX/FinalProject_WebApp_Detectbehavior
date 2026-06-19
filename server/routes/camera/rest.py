import os
import json
import time
import asyncio
import cv2
from datetime import datetime
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends

from utils.auth import verify_token
from config.bn_supabase import supabase_client
from utils.json_buffer import get_all_pending_files

from core.camera_thread import (
    CameraThread,
    camera_threads,
    available_cameras,
    ATTENDENCE,
    NON_ATTENDENCE,
)

router = APIRouter()

# API สำหรับสแกนหากล้องที่เชื่อมต่ออยู่ (0-9)
@router.get("/list-camera")
async def list_camera():
    cams = []
    available_cameras.clear()
    for i in range(10):
        cap = None
        try:
            cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
            if cap.isOpened():
                cams.append({
                    "id": i,
                    "name": f"กล้องตัวที่ {i}",
                    "status": "ใช้ได้",
                })
                available_cameras.append({"id": i})
        except Exception as e:
            print(f"quick_scan_camera index {i} error: {e}")
        finally:
            if cap and cap.isOpened():
                cap.release()
    if not cams:
        return {"message": "ไม่เจอ USB ที่กำลังเชื่อมต่อกล้อง"}

    return {"cameras": cams}

# API สำหรับเริ่มการทำงาน (Detection) ของกล้องทั้งหมดที่มี
@router.get("/start-all")
async def start_all_detections(
    subject_id: Optional[str] = None,
    group: Optional[str] = None,
    user=Depends(verify_token),
):
    loop = asyncio.get_running_loop()

    teacher_res = (
        supabase_client.table("teacher")
        .select("teacher_id")
        .eq("id", user["id"])
        .execute()
    )

    t_id = teacher_res.data[0]["teacher_id"] if teacher_res.data else None
    started = []
    cam_ids = (
        [str(cam["id"]) for cam in available_cameras]
    )

    for cid in cam_ids:
        if cid not in camera_threads or not camera_threads[cid].is_alive():
            th = CameraThread(cid, teacher_id=t_id, subject_id=subject_id, group=group)

            th.loop = loop
            th.summary_ready_event = asyncio.Event()
            th.detecting = True

            th.start_time = time.time()

            th.start()
            camera_threads[cid] = th
            print(camera_threads)
        else:
            th = camera_threads[cid]
            th.detecting = True
            if th.start_time is None:
                th.start_time = time.time()
            th.loop = loop

            if th.summary_ready_event is None:
                th.summary_ready_event = asyncio.Event()

            if t_id:
                th.teacher_id = t_id
                if not th.subject_id:
                    th.subject_id = subject_id or "DEFAULT_SUB"

        started.append(cid)

    return {"message": f"Started {len(started)} cameras", "started": started}

# API สำหรับหยุดการตรวจจับ (Detection) ของกล้องทั้งหมด (แต่ Thread ยังทำงานอยู่)
@router.get("/stop-all")
async def stop_all_detections():
    for th in camera_threads.values():
        th.detecting = False
    return {"message": "Stopped detection for all cameras"}

# API สำหรับปิดการทำงานของกล้องทั้งหมดและเคลียร์ Thread
@router.get("/close-all")
async def close_all_cameras():
    for cid, th in list(camera_threads.items()):
        th.detecting = False

        if len(th.interval_results) > 0:
            print(f"💾 Force saving partial data for Cam {cid} ({len(th.interval_results)} items)")
            th.save_summary()

        th.reset_state()
        th.stop()
        del camera_threads[cid]

    return {"message": "All camera threads closed"}

# API สำหรับอ่านไฟล์ JSON Buffer และบันทึกข้อมูลลง Supabase
@router.get("/summary-to-supabase")
async def summary_to_supabase_route():
    files = get_all_pending_files()
    print(f"📂 Found {len(files)} files pending upload")
    
    if not files:
        return {"message": "ไม่มีข้อมูลค้างอยู่", "inserted": 0}

    total_inserted = 0
    total_summary_inserted = 0

    # ✅ วนลูปทำทีละไฟล์ (ทีละ Session) ไม่เอามารวมกันแล้ว
    for path in files:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"❌ Error reading {path}: {e}")
            continue

        # 1. เตรียมข้อมูล Logs
        camera_id = data["camera_id"]
        teacher_id = data["teacher_id"]
        subject_id = (data.get("subject_id") or "").strip()
        group = data["group"]
        records = data["records"]
        session_id = data.get("session_id")
        
        if not records:
            # ไฟล์เปล่า ลบทิ้งเลย
            try: os.remove(path) 
            except: pass
            continue

        insert_payload = []
        for record in records:
            insert_payload.append({
                "camera_id": camera_id,
                "teacher_id": teacher_id,
                "subject_id": subject_id,
                "group": group,
                "session_id": session_id,
                "Attention": record["Attention"],
                "Non_Attention": record["Non_Attention"],
                "class_json": record["class_json"],
                "class_duration": record["class_duration"],
                "created_at": record["created_at"],
            })

        # 2. Insert Logs (บันทึกข้อมูลดิบรายนาที)
        if insert_payload:
            try:
                supabase_client.table("camera_logs").insert(insert_payload).execute()
                total_inserted += len(insert_payload)
            except Exception as e:
                print(f"❌ Error inserting logs for {path}: {e}")
                continue # ถ้า log เข้าไม่ได้ อย่าเพิ่งทำ summary และอย่าเพิ่งลบไฟล์

        # 3. คำนวณ Summary **เฉพาะของไฟล์นี้ (Session นี้)**
        total_att = 0.0
        total_non = 0.0
        count = len(records)
        class_totals = defaultdict(float)
        class_duration_totals = defaultdict(float)

        # หาวันที่ของไฟล์นี้ (เอาจาก record แรก)
        first_dt = records[0]["created_at"]
        if isinstance(first_dt, str):
            dt_obj = datetime.fromisoformat(first_dt.replace("Z", "+00:00"))
            summary_date = dt_obj.date().isoformat()
        else:
            summary_date = datetime.now().date().isoformat()

        for r in records:
            total_att += float(r.get("Attention") or 0.0)
            total_non += float(r.get("Non_Attention") or 0.0)
            
            # รวม class count (%)
            cj = r.get("class_json") or {}
            if isinstance(cj, str): cj = json.loads(cj)
            for k, v in cj.items():
                class_totals[k] += float(v or 0.0)

            # รวม duration (sec)
            cd = r.get("class_duration") or {}
            if isinstance(cd, str): cd = json.loads(cd)
            for k, v in cd.items():
                class_duration_totals[k] += float(v or 0.0)

        # ค่าเฉลี่ยของ Session นี้
        avg_att = total_att / count if count > 0 else 0.0
        avg_non = total_non / count if count > 0 else 0.0
        
        class_summary = {}
        if count > 0:
            for k, v in class_totals.items():
                class_summary[k] = round(v / count, 3)

        daily_row = {
            "teacher_id": teacher_id,
            "subject_id": subject_id,
            "camera_id": camera_id,
            "summary_date": summary_date,
            "avg_attention": round(avg_att, 3),
            "avg_non_attention": round(avg_non, 3),
            "class_json_summary": class_summary,
            "class_duration_summary": {k: round(v, 1) for k, v in class_duration_totals.items()},
            "group": group,
            "session_id": session_id
        }

        # 4. Insert Summary (1 ไฟล์ = 1 แถวสรุป)
        try:
            supabase_client.table("camera_daily_summary").insert(daily_row).execute()
            total_summary_inserted += 1
            
            # ✅ ทำเสร็จแล้วลบไฟล์ทิ้ง
            os.remove(path)
            print(f"✅ Processed and deleted: {path}")

        except Exception as e:
            print(f"❌ Error inserting summary for {path}: {e}")

    return {
        "message": f"บันทึกข้อมูลเสร็จสิ้น แยก {total_summary_inserted} sessions",
        "inserted": total_inserted,
    }
