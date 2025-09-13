import streamlit as st
import requests
import os
from dotenv import load_dotenv
from streamlit_cookies_manager import EncryptedCookieManager

cookies = EncryptedCookieManager(prefix="myapp", password="secret_Key")
if not cookies.ready():
    st.stop()
    
st.set_page_config(page_title="Face Detection App", layout="wide", initial_sidebar_state="collapsed")

load_dotenv()
api_key = os.getenv("API_URL")

if "authenLogin" not in st.session_state:
    st.session_state.authenLogin = False
if "login_success" not in st.session_state:
    st.session_state.login_success = False
if "role" not in st.session_state:
    st.session_state.role = None
if "fullname" not in st.session_state:
    st.session_state.fullname = ""
    
st.markdown(
    """
    <style>
        .stApp {
            background: linear-gradient(to right, white, #ccffcc);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        .content-wrapper {
            display: flex;
            width: 80%;
            max-width: 1200px;
            gap: 50px;  /* ระยะห่างระหว่าง text กับ form */
        }
    }
    </style>
    """,
    unsafe_allow_html=True
)

st.markdown("<div class='content-wrapper'>", unsafe_allow_html=True)

col1, col2 = st.columns([1, 1])

with col1:
    st.markdown("""
    <div class="left-content">
        <h1 class="title">ระบบตรวจจับบุคคลิกกรรม</h1>
    </div>
    """, unsafe_allow_html=True)

with col2:
    with st.form("login"):
        
        st.markdown("<div class=''>", unsafe_allow_html=True)
        st.markdown("## 🔐 Login")
        username = st.text_input("ชื่อผู้ใช้")
        password = st.text_input("รหัสผ่าน", type="password")
        submitted = st.form_submit_button("Login")
        reset = st.form_submit_button("ลืมรหัสผ่าน")
        st.markdown("</div>", unsafe_allow_html=True)
        col_left, col_right = st.columns([3, 1])
        
        with col_left:
            if submitted:
                if not username or not password:
                    st.error("กรุณากรอกข้อมูลให้ครบ")
                else:
                    try:
                        res = requests.post(f"{api_key}/users/login", json={
                            "username": username,
                            "password": password
                        })
                        if res.status_code == 200:
                            data = res.json()
                            
                            cookies["token"] = data["access_token"]
                            cookies["role"] = data["userRole"]
                            cookies["fullname"] = data["fullname"]
                            cookies.save()
                            
                            st.session_state.role = data["userRole"]
                            st.session_state.fullname = data["fullname"]
                            st.session_state.login_success = True
                            
                            if st.session_state.role == "Admin":
                                st.session_state.authenLogin = True
                                st.switch_page("pages/Admin.py")
                            else:
                                st.session_state.authenLogin = True
                                st.switch_page("pages/Home.py")
                        else:
                            st.error("เข้าสู่ระบบไม่สำเร็จ")
                    except Exception as e:
                        st.error(f"{e}")
                pass
        
        with col_right:
            if reset:
                st.switch_page("pages/Reset_password.py")
st.markdown("</div>", unsafe_allow_html=True)
