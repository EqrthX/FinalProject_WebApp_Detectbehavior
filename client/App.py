import streamlit as st
import requests
import os
from dotenv import load_dotenv

st.set_page_config(page_title="Face Detection App", layout="centered")

load_dotenv()
api_key = os.getenv("API_URL")

if "authenLogin" not in st.session_state:
    st.session_state.authenLogin = False
if "login_success" not in st.session_state:
    st.session_state.login_success = False
if "role" not in st.session_state:
    st.session_state.role = None
if "fullname" not in st.session_state:
    st.session_state.fullname = None
    
st.title("เข้าสู่ระบบ")

with st.form("login"):
    username = st.text_input("ชื่อผู้ใช้")
    password = st.text_input("รหัสผ่าน", type="password")
    submitted = st.form_submit_button("Login")
    
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
                    print(data)
                    st.session_state.role = data["userRole"]
                    st.session_state.fullname = data["fullname"]
                    st.session_state.login_success = True
                    
                    if st.session_state.role == "Admin":
                        st.session_state.login_success = False
                        st.session_state.authenLogin = True
                        st.switch_page("pages/Admin.py")
                    else:
                        st.session_state.login_success = False
                        st.session_state.authenLogin = True
                        st.switch_page("pages/Home.py")
                else:
                    st.error("เข้าสู่ระบบไม่สำเร็จ")
            except Exception as e:
                st.error(f"{e}")
