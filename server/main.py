from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.camera_route import camera_router, cameras
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

@app.on_event("shutdown")
async def shutdown_event():
    print("🛑 Shutting down... closing all cameras")
    for cam_id, cam_state in list(cameras.items()):
        try:
            cam_state["running"] = False
            cap = cam_state.get("cap")
            if cap and cap.isOpened():
                cap.release()
        except Exception as e:
            print(f"Error closing {cam_id}: {e}")
    cameras.clear()
    print("✅ All cameras released")