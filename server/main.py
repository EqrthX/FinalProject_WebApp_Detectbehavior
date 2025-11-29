from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.camera_route import camera_router
from routes.admin_route import admin_route
from routes.auth_rote import auth_route
app = FastAPI()


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
