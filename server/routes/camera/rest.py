"""HTTP endpoints สำหรับควบคุมกล้องและบันทึกผลสรุป."""

from typing import Optional

from fastapi import APIRouter, Depends

from services import camera_service, summary_service
from utils.auth import verify_token

router = APIRouter()


@router.get("/list-camera")
async def list_camera():
    return await camera_service.list_camera()


@router.get("/start-all")
async def start_all_detections(
    subject_id: Optional[str] = None,
    group: Optional[str] = None,
    user=Depends(verify_token),
):
    return await camera_service.start_all_detections(
        subject_id=subject_id, group=group, user=user,
    )


@router.get("/stop-all")
async def stop_all_detections():
    return await camera_service.stop_all_detections()


@router.get("/close-all")
async def close_all_cameras():
    return await camera_service.close_all_cameras()


@router.get("/summary-to-supabase")
async def summary_to_supabase_route():
    return await summary_service.summary_to_supabase()
