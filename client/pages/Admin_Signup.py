from datetime import time
import streamlit as st
import requests
import re
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("API_URL")

def signup():
    
    if "signup_success" not in st.session_state:
        st.session_state.signup_success = False
    if "reset" not in st.session_state:
        st.session_state.reset = False
    if st.session_state.get("reset", False):
        st.session_state["username"] = ""
        st.session_state["password"] = ""
        st.session_state["name"] = ""
        st.session_state["surname"] = ""
        st.session_state["passwordCon"] = ""
        st.session_state["selectRole"] = "Teacher"
        st.session_state["reset"] = False
        
    st.header("สมัครสมาชิก")
    st.title("")

    def password_validation(password: str, passwordCon: str):
        errors = []
        
        if len(password) < 6:
            errors.append("รหัสผ่านคุณน้อยกว่า 6 ตัวอักษร")
        elif not re.search(r"\d", password):
            errors.append("รหัสผ่านของคุณควรมีตัวเลขอย่างน้อย 1 ตัว")
        elif password != passwordCon:
            errors.append("รหัสผ่านไมตรงกัน")
        
        return errors

    with st.form("signup"):
        
        username = st.text_input("ชื่อผู้ใช้", key="username")
        name = st.text_input("ชื่อ", key="name")
        surname = st.text_input("นามสกุล", key="surname")
        password = st.text_input("รหัสผ่าน", key="password", type="password")
        passwordCon = st.text_input("ยืนยันรหัสผ่าน", key="passwordCon", type="password")
        selectRole = st.selectbox("เลือก", ["Teacher"])
        submited = st.form_submit_button(label="Submit")
        
        fullname = name + " " + surname
        
        if submited:
            if not username and not password and not passwordCon and not name and not surname:
                st.error("กรุณากรอกข้อมูลให้ครบถ้วน")
            elif len(password_validation(password, passwordCon)) > 0:
                error = password_validation(password, passwordCon)
                st.error(error[0])   
            else:
                try:
                    res = requests.post(f"{api_key}/users/signup", json={
                        "username": username,
                        "fullname": fullname,
                        "password": password,
                        "userRole": selectRole
                    })
                    if res.status_code == 200:
                        st.session_state.signup_success = True
                        st.session_state.reset = True 
                        st.rerun()
                    else:
                        st.error(res.json().get("detail", "สมัครสมาชิกไม่สำเร็จ"))
                except Exception as e:
                    st.error(f"เกิดข้อผิดพลาด: {e}")
                    
    if st.session_state.signup_success:
        st.success("สมัครสมาชิกเสร็จสิ้น")
        st.session_state.signup_success = False
        st.switch_page("Login.py")
        
