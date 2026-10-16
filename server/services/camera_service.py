"""สแกน เริ่ม หยุด และปิดกล้อง โดยใช้ CameraThread และ state ชุดเดิม."""

import asyncio
import time
from typing import Optional

import cv2

from config.bn_supabase import supabase_client
from core.camera_thread import CameraThread, available_cameras, camera_threads


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


async def start_all_detections(
    subject_id: Optional[str] = None,
    group: Optional[str] = None,
    *,
    user: dict,
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


async def stop_all_detections():
    for th in camera_threads.values():
        th.detecting = False
    return {"message": "Stopped detection for all cameras"}


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
