from datetime import datetime
import os
import cv2
import json
from decimal import Decimal, ROUND_HALF_EVEN
from ultralytics import YOLO


def empty_flat_dict_behavior ():
    return {
            "Focused": 0.0,
            "Drinking": 0.0,
            "Eating": 0.0,
            "Lookaways": 0.0,
            "Sleeping": 0.0,
            "UsingPhone": 0.0,
    }

def reset_count():
    return {
        "Focused": 0,
        "Drinking": 0,
        "Eating": 0,
        "Lookaways": 0,
        "Sleeping": 0,
        "UsingPhone": 0,
    }

def calculate_average(dict_count: dict, dict_sum: dict):
    result = {}

    for key in dict_count.keys() & dict_sum.keys():
        num_class = Decimal(str(dict_count[key]))
        sum_class = Decimal(str(dict_sum[key]))

        if num_class != 0:
            value = (sum_class / num_class).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
            result[key] = float(value)
        else:
            result[key] = None
    
    return result
