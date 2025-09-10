import streamlit as st
from pages.Admin_Signup import signup 
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from numpy.random import default_rng as rng

st.set_page_config(
    page_title="Admin DashBoard",
    page_icon="📊",
    layout="wide"
)

st.markdown("""
            
            <style>
                .main-header{
                    background-color: #f0f2f6;
                    padding: 1rem;
                    border-radius: 10px;
                    margin-bottom: 2rem;
                }
                .metric-card{
                    background-color: white;
                    padding: 1rem;
                    border-radius: 10px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    text-align: center; 
                }
                .sidebar-content {
                    background-color: #f8f9fa;
                }
            </style>
            
            """, unsafe_allow_html=True)

if st.session_state.get("authenLogin", False):

    with st.sidebar:
        st.markdown(f"### Admin {st.session_state.fullname}")
        menu_options = ["ภาพรวม", "อาจารย์", "ตารางสอน", "ลงทะเบียน"]
        selected_menu = st.radio("เมนู", menu_options, index=0)
        
        st.markdown("----------------")
        if st.button("Logout", type="secondary"):
            st.warning("ออกจากระบบ")
    
    if selected_menu == "ภาพรวม":
        st.markdown("""
                    <div class="main-header">
                        <h1>
                            📊 Dashboard
                        </h1>
                    </div>
                    """, unsafe_allow_html=True)
        
        col1, col2 = st.columns([2, 1])
        with col1:
            chart_data = {
                'categories': ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน'],
                'Facebook': [45, 35, 50, 48, 30, 42],
                'Admin': [38, 25, 42, 35, 28, 35],
                'Online Registration': [42, 30, 45, 40, 25, 40],
                'Walk-in': [50, 40, 60, 45, 35, 50],
                'University Form': [30, 20, 35, 25, 20, 30],
                'Website': [48, 35, 52, 50, 40, 55]
            }
            df = pd.DataFrame(chart_data)
            st.bar_chart(df)
        with col2:
            
            st.markdown("### อันดับ")
            
            rankings = [
                {"name": "คณะ", "percentage": "85%"},
                {"name": "คณะ", "percentage": "72%"},
                {"name": "คณะ", "percentage": "68%"},
                {"name": "คณะ", "percentage": "45%"},
                {"name": "คณะ", "percentage": "32%"}
            ]
            
            for item in rankings:
                st.markdown(f"""
                            <div style="background-color: #f0f6f8; padding: 10px; margin: 5px 0; border-radius: 10px;">
                                <strong>{item["name"]}</strong>
                                <div>{item["percentage"]}</div>
                            </div>
                            """, unsafe_allow_html=True)
        
        st.markdown("--------")
        
        col3, col4 = st.columns(2)
        
        with col3:
            st.markdown("คณะทั้งหมด")
        with col4:
            st.markdown("อาจารย์ทั้งหมด")
            
    elif selected_menu == "ลงทะเบียน":
        signup()   
        

else:
    st.error("กรุณาเข้าสู่ระบบก่อน")
