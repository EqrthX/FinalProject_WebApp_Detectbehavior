from fastapi import APIRouter
from .rest import router as rest_router
from .websocket import router as ws_router

# รวม REST และ WebSocket router เข้าด้วยกันภายใต้ prefix /api/camera
camera_router = APIRouter(prefix="/api/camera", tags=["camera"])
camera_router.include_router(rest_router)
camera_router.include_router(ws_router)
