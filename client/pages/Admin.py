import streamlit as st
from pages.Admin_Signup import signup 
import pandas as pd
from numpy.random import default_rng as rng

lst = ['Geeks', 'For', 'Geeks', 'is', 
            'portal', 'for', 'Geeks']

df = pd.DataFrame(
    {
        "col1" : rng(0).standard_normal(20),
        "col2" : rng(1).standard_normal(20)
    }
)
if st.session_state.get("authenLogin", False):

    menu = st.sidebar.radio(f"Admin | {st.session_state.fullname}", ["Dashboard", "อาจารย์", "ตารางสอน", "Signup"])

    if menu == "Dashboard":
        st.header("📊 Dashboard")
        st.bar_chart(df, x="col1", y="col2" )
    elif menu == "Signup":
        signup()   
else:
    st.error("กรุณาเข้าสู่ระบบก่อน")
