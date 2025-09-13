import streamlit as st
from dotenv import load_dotenv
import os
import requests
import base64
from PIL import Image
import io
import pandas as pd
from streamlit_cookies_manager import EncryptedCookieManager

cookies = EncryptedCookieManager(prefix="myapp", password="secret_Key")
if not cookies.ready():
    st.stop()
    
token = cookies.get("token")

load_dotenv()

st.set_page_config(page_title="Face Detection App", initial_sidebar_state="collapsed", layout="wide")

api_key = os.getenv("API_URL")

st.markdown("""
<style>
    /* Hide default Streamlit header */
    .stApp > header {
        background-color: transparent;
    }
    
    /* Custom navigation bar */
    .nav-container {
        background: linear-gradient(90deg, #2E8B57, #4CAF50);
        padding: 1rem 2rem;
        border-radius: 10px;
        margin-bottom: 2rem;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .nav-title {
        color: white;
        font-size: 1.5rem;
        font-weight: bold;
        margin: 0;
    }
    
    .nav-pills {
        display: flex;
        gap: 0.5rem;
    }
    
    .nav-pill {
        background: rgba(255,255,255,0.2);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        text-decoration: none;
        transition: all 0.3s ease;
        border: none;
        cursor: pointer;
    }
    
    .nav-pill:hover {
        background: rgba(255,255,255,0.3);
        transform: translateY(-2px);
    }
    
    .nav-pill.active {
        background: white;
        color: #2E8B57;
        font-weight: bold;
    }
    
    .user-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        color: white;
    }
    
    .user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: #2E8B57;
    }
    
    .logout-btn {
        background: rgba(255,255,255,0.2);
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        padding: 0.3rem 0.8rem;
        border-radius: 15px;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .logout-btn:hover {
        background: rgba(255,255,255,0.3);
    }
    
    /* Statistics cards */
    .stats-card {
        background: white;
        padding: 1.5rem;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        text-align: center;
        border-left: 4px solid;
    }
    
    .stats-card.present {
        border-left-color: #28a745;
    }
    
    .stats-card.absent {
        border-left-color: #dc3545;
    }
    
    .stats-card.late {
        border-left-color: #007bff;
    }
    
    .stats-number {
        font-size: 2.5rem;
        font-weight: bold;
        margin: 0;
    }
    
    .stats-label {
        color: #666;
        margin: 0.5rem 0;
    }
    
    .present { color: #28a745; }
    .absent { color: #dc3545; }
    .late { color: #007bff; }
    
    /* Hide Streamlit menu and footer */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    .stDeployButton {display:none;}
</style>
""", unsafe_allow_html=True)

if 'current_page' not in st.session_state:
    st.session_state.current_page = "หน้าแรก"
    
if 'user_data' not in st.session_state:
    st.session_state.user_data = {
        'fullname': 'อาจารย์สมชาย ใจดี',
        'username': 'somchai123',
        'email': 'somchai@university.edu',
        'department': 'คณะวิทยาการสารสนเทศ',
        'avatar_text': 'ส'
    }
    
if token:
    user_data = st.session_state.user_data
    
    nav_html = f"""
        <div class="nav-container">
            <h1 class="nav-title">ระบบตรวจจับใบหน้า</h1>
            <div class="user-info">
                <div class="user-avatar">{user_data['avatar_text']}</div>
                <div>
                    <div style="font-weight: bold;">{user_data['fullname']}</div>
                    <div style="font-size: 0.8rem; opacity: 0.8;">{user_data['department']}</div>
                </div>
            </div>
        </div>
    """
    st.markdown(nav_html, unsafe_allow_html=True)

    col1, col2, col3, col4 = st.columns([2, 2, 2, 2 ])
    
    with col1:
        if st.button("🏠 หน้าแรก", key="nav_home", use_container_width=True):
            st.session_state.current_page = "หน้าแรก"
    with col2:
        if st.button("📅 ตารางสอน", key="nav_schedule", use_container_width=True):
            st.session_state.current_page = "ตารางสอน"
    with col3:
        if st.button("📊 สรุปผล", key="nav_summary", use_container_width=True):
            st.session_state.current_page = "สรุปผล"
    with col4:
        if st.button("🚪 ออกจากระบบ", key="logout", use_container_width=True):
            cookies["token"] = ""
            cookies["role"] = ""
            cookies["fullname"] = ""
            cookies.save()
            st.switch_page("App.py")
    
    left_space, center, right_space = st.columns([1, 6, 1])
    
    with center:
        intent, unintent, mean_today = st.columns([3, 3, 3])
        with intent:
            st.markdown("""
                <div style="
                    font-size: 30px; 
                    text-align: center; 
                    border-radius: 15px; 
                    padding: 20px;
                    margin: 10px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    border: 1px solid;
                ">
                    ตั้งใจเรียน
                    <div style="font-size: 50px; margin-top: 10px;">60%</div>
                </div>
                """, unsafe_allow_html=True)

        with unintent:
            st.markdown("""
                <div style="
                    font-size: 30px; 
                    text-align: center; 
                    border-radius: 15px; 
                    padding: 20px;
                    margin: 10px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    border: 1px solid ;
                ">
                    ไม่ตั้งใจเรียน
                    <div style="font-size: 50px; margin-top: 10px;">50%</div>
                </div>
                """, unsafe_allow_html=True)

        with mean_today:
            st.markdown("""
                <div style="
                    font-size: 30px; 
                    text-align: center; 
                    border-radius: 15px; 
                    padding: 20px;
                    margin: 10px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    border: 1px solid black;
                ">
                    ตั้งใจเรียน
                    <div style="font-size: 50px; margin-top: 10px;">54.56%</div>
                </div>
                """, unsafe_allow_html=True)

    
        st.markdown("------") 
    
    if st.session_state.current_page == "หน้าแรก":
        st.header("50000")
    elif st.session_state.current_page == "ตารางสอน":
        st.header("500000000")
    elif st.session_state.current_page == "สรุปผล":
        st.header("awdwadawd")
else: 
    st.warning("กรุณาเข้าสู่ระบบก่อน")
    st.stop()

