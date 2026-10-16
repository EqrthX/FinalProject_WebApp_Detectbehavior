"""จุดเริ่มต้น FastAPI: สร้างแอป ตั้งค่า middleware และเชื่อม router."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import api_router

app = FastAPI(
    title="Behavior Detection API",
    version="1.0.0",
    description="Real-time classroom behavior detection system",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
