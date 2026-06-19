from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.camera import camera_router
from routes.admin_route import admin_route
from routes.auth_route import auth_route

app = FastAPI(
    title="Behavior Detection API",
    version="1.0.0",
    description="Real-time classroom behavior detection system"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(camera_router)
app.include_router(admin_route)
app.include_router(auth_route)

