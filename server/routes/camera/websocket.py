import base64
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.camera_thread import CameraThread, camera_threads

router = APIRouter()

# WebSocket สำหรับสตรีมภาพสดจากกล้อง
@router.websocket("/ws/camera/{camera_id}")
async def ws_camera(websocket: WebSocket, camera_id: str):
    await websocket.accept()

    loop = asyncio.get_running_loop()
    teacher_id = websocket.query_params.get("teacher_id")
    subject_id = websocket.query_params.get("subject_id")
    group = websocket.query_params.get("group")

    if camera_id not in camera_threads or not camera_threads[camera_id].is_alive():
        th = CameraThread(camera_id, teacher_id=teacher_id, subject_id=subject_id, group=group)
        th.loop = loop
        th.summary_ready_event = asyncio.Event()
        th.detecting = False
        th.start()

        camera_threads[camera_id] = th
    else:
        th = camera_threads[camera_id]
        if teacher_id:
            th.teacher_id = teacher_id
        if subject_id:
            th.subject_id = subject_id

    th = camera_threads[camera_id]
    th.loop = loop

    try:
        while True:
            # เช็คว่า thread กล้องตายยัง
            if not th.is_alive():
                print(f"⚠️ Thread กล้อง {camera_id} ตายแล้ว ปิด WebSocket")
                break

            with th.lock:
                frame = th.jpeg_buffer

            if frame:
                await websocket.send_text(base64.b64encode(frame).decode())

            await asyncio.sleep(0.04)

    except WebSocketDisconnect:
        print(f"🔌 WS camera disconnected: {camera_id}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

# WebSocket สำหรับส่งข้อมูลสรุป (Summary) แบบ Real-time
@router.websocket("/ws/camera/summary/{camera_id}")
async def ws_summary(websocket: WebSocket, camera_id: str):
    await websocket.accept()

    loop = asyncio.get_running_loop()

    th = camera_threads.get(camera_id)
    if not th:
        await websocket.close()
        return

    th.loop = loop

    if th.summary_ready_event is None:
        th.summary_ready_event = asyncio.Event()

    try:
        while True:
            await th.summary_ready_event.wait()
            th.summary_ready_event.clear()

            with th.lock:
                payload = th.latest_summary.copy()

            if payload:
                await websocket.send_json(payload)

    except WebSocketDisconnect:
        print(f"🔌 WS summary disconnected: {camera_id}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
