from fastapi import APIRouter, HTTPException, Depends, status, Response
from ultralytics import YOLO
import cv2
import threading
import time
import datetime
import base64

camera_router = APIRouter(prefix="/api/camera", tags=["camera"])

model = YOLO("yolov8n.pt")

