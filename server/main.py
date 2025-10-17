from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from routes.user_route import router
from routes.camera_route import camera_router

app = FastAPI()
origins = [
    "http://localhost:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins = origins,
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"]
)

app.include_router(camera_router)