from fastapi import FastAPI
# from routes.user_route import router
from routes.camera_route import camera_router

app = FastAPI()

app.include_router(camera_router)