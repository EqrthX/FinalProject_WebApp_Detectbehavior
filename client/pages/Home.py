import streamlit as st
from dotenv import load_dotenv
import os
import requests
import base64
from PIL import Image
import io
import pandas as pd
load_dotenv()

st.set_page_config(page_title="Face Detection App", initial_sidebar_state="collapsed")

api_key = os.getenv("API_URL")

if st.session_state.get("authenLogin", False):
    st.title(f"🚀 ยินดีต้อนรับสู่ระบบตรวจจับใบหน้า คุณ {st.session_state.fullname}")
else: 
    st.warning("กรุณาเข้าสู่ระบบก่อน")
    st.stop()

tab1, tab2 = st.tabs(["Tab1", "Tab2"])

with tab1:
    col1, col2, col3 = st.columns(3)
    with col1:
        if st.button("เปิดกล้อง"):
            openCamera = requests.get(f"{api_key}/camera/open")
        
    with col2:
        if st.button("ปิดกล้อง"):
            closeCamera = requests.get(f"{api_key}/camera/close")

    with col3:
        if st.button("ออกจากระบบ"):
            st.session_state.authenLogin = False
            st.switch_page("./main.py")

    st.header("โชว์ detect")
    response = requests.get(f"{api_key}/camera/face")
    data = response.json()
    c1, c2, c3 = st.columns(3)
    for item in data:
        img_bytes = base64.b64decode(item["image"])
        img = Image.open(io.BytesIO(img_bytes))
        with c1:
            st.write(f"Label {item['label']}")
        with c2:
            st.image(img)
        with c3:
            st.write(f"Conf: {item['time']}")

def fill_schedule(df=None, day="", start_time="", subject="", teacher="", credit=0):
    
    if df is None:
        df = pd.DataFrame()
    
    try:
        col_list = df.columns.tolist()
        idx = col_list.index(start_time)
        
        for i in range(credit):
            if idx + i < len(col_list):
                df.at[day, col_list[idx + i]] = f"{subject}\n({teacher})"
                
    except ValueError:
        st.error(f"เวลา {start_time} ไม่มีอยู่ในตาราง")
with tab2:
    st.header(f"ตารางสอนของ {st.session_state.fullname}")
    
    days = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"]
    
    time_slots = [f"{h:02d}:30" for h in range(8,18)]    
    
    schedule_df = pd.DataFrame(index=days, columns=time_slots).fillna("")
    
    teaching_schedule = [
        {
            "teacher": st.session_state.fullname,
            "subject": "SI423",
            "day": "อังคาร",
            "start_time": "12:30",
            "credit": 3,
        },
        {
            "teacher": st.session_state.fullname,
            "subject": "SI233",
            "day": "พุธ",
            "start_time": "12:30",
            "credit": 3,
        }
    ]
    
    for item in teaching_schedule:
        fill_schedule(
            schedule_df,
            day=item["day"],
            start_time=item["start_time"],
            subject=item["subject"],
            teacher=item["teacher"],
            credit=item["credit"]
        )
    
    st.dataframe(schedule_df, use_container_width=True, width=500)