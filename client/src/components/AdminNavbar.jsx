import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import ReactDOM from "react-dom";
import { supabase } from "../config/supabase";

// Import รูปภาพ
import Profile from "../assets/Profile.png";
import menuDB from "../assets/menuDB.png";
import menuCL from "../assets/menuCL.png";
import menuTC from "../assets/menuTC.png";
import logoutIcon from "../assets/logout.png";

// ----------------------------------------------------
// 1. ส่วน Modal (เหมือนเดิม)
// ----------------------------------------------------
const LogoutModal = ({ onCancel, onConfirm }) => {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[99999]">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-center mb-2">ยืนยันการออกจากระบบ</h3>
        <p className="text-gray-600 text-center mb-6">คุณต้องการออกจากระบบใช่หรือไม่?</p>
        <div className="flex space-x-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium">ยกเลิก</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">ออกจากระบบ</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ----------------------------------------------------
// 2. Main Component
// ----------------------------------------------------
const AdminNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // --- Logic Navbar ---
  const isTeacherSectionActive = (isActive) => isActive || location.pathname.startsWith("/admin/AdminClassRoom");

  // Helper สำหรับ Class ของ Link
  const getLinkClass = (isActive) => {
    const baseClass = "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 text-sm md:text-base w-full group";
    const activeClass = "bg-[#38a738] text-white shadow-sm";
    const inactiveClass = "text-gray-700 hover:bg-gray-100";
    return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
  };

  // Helper สำหรับ Filter สีไอคอน (ดำ <-> ขาว)
  const getIconStyle = (isActive) => {
    return {
      filter: isActive 
        ? "brightness(0) invert(1)" // สีขาว (เมื่อ Active)
        : "brightness(0) invert(0)"  // สีดำ (เมื่อปกติ)
    };
  };

  // --- Logic Logout ---
  const handleLogoutClick = () => setShowConfirmModal(true);
  const handleCancelLogout = () => setShowConfirmModal(false);
  const handleConfirmLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Logout:", error);
    localStorage.clear();
    await new Promise((res) => setTimeout(res, 300));
    setShowConfirmModal(false);
    navigate("/");
  };

  return (
    <>
      <aside
        className="
          bg-white border-r border-[#e9e9e9] shadow-sm
          flex flex-col
          transition-all duration-300
          
          /* ✅ ขนาดความกว้าง (Responsive) */
          w-44 md:w-48 lg:w-56

          /* ✅ จัดตำแหน่ง: ติดซ้าย ติดบน ยืดถึงล่างสุด */
          fixed top-0 left-0 bottom-0
          h-screen
          z-50
        "
      >
        <div className="p-4 flex flex-col h-full">
          
          {/* --- 1. โปรไฟล์ --- */}
          <div className="flex items-center gap-3 mb-6 mt-2 px-2">
            <img className="w-11 h-11" src={Profile} alt="Profile" />
            <div className="flex flex-col">
              <span className="text-black text-base font-bold">แอดมิน</span>
              <span className="text-gray-400 text-xs">ผู้ดูแลระบบ</span>
            </div>
          </div>

          <hr className="mb-4 border-t border-[#e9e9e9]" />

          {/* --- 2. เมนู (แนวยาวลงมา) --- */}
          <nav className="flex flex-col gap-2 w-full">
            
            {/* Dashboard */}
            <NavLink to="/admin/AdminHomePage" className={({ isActive }) => getLinkClass(isActive)}>
              {({ isActive }) => (
                <>
                  <img 
                    className="w-5 h-5 transition-all duration-200" 
                    src={menuDB} 
                    alt="menuDB" 
                    style={getIconStyle(isActive)} /* ✅ ใช้ Logic สีขาว/ดำ ตรงนี้ */
                  />
                  <span className="truncate">Dashboard</span>
                </>
              )}
            </NavLink>

            {/* อาจารย์ */}
            <NavLink to="/admin/AdminTeachers" className={({ isActive }) => getLinkClass(isTeacherSectionActive(isActive))}>
              {({ isActive }) => (
                <>
                  <img 
                    className="w-5 h-5 transition-all duration-200" 
                    src={menuCL} 
                    alt="menuCL" 
                    style={getIconStyle(isTeacherSectionActive(isActive))} /* ✅ ใช้ Logic สีขาว/ดำ ตรงนี้ */
                  />
                  <span className="truncate">อาจารย์</span>
                </>
              )}
            </NavLink>

            {/* ตารางสอน */}
            <NavLink to="/admin/AdminTeachingschedule" className={({ isActive }) => getLinkClass(isActive)}>
              {({ isActive }) => (
                <>
                  <img 
                    className="w-5 h-5 transition-all duration-200" 
                    src={menuTC} 
                    alt="menuTC" 
                    style={getIconStyle(isActive)} /* ✅ ใช้ Logic สีขาว/ดำ ตรงนี้ */
                  />
                  <span className="truncate">ตารางสอน</span>
                </>
              )}
            </NavLink>

          </nav>

          {/* --- 3. ปุ่ม Logout (ติดล่างสุด) --- */}
          {/* ใช้ mt-auto เพื่อดันส่วนนี้ลงไปติดขอบล่างของหน้าจอ */}
          <div className="mt-auto w-full pb-4">
             <button
              onClick={handleLogoutClick}
              className="group flex items-center justify-center gap-3
                 w-full px-3 py-3
                 bg-gray-50 border border-[#e9e9e9] 
                 text-gray-700 font-medium text-sm md:text-base
                 rounded-xl
                 hover:bg-[#FE2B2B] hover:text-white hover:border-[#FE2B2B]
                 transition-all duration-200"
            >
              <img
                className="w-5 h-5 transition-all 
                   group-hover:filter group-hover:brightness-0 group-hover:invert"
                src={logoutIcon}
                alt="logout"
              />
              <span className="truncate">ออกจากระบบ</span>
            </button>
          </div>

        </div>
      </aside>

      {/* Modal */}
      {showConfirmModal && (
        <LogoutModal onCancel={handleCancelLogout} onConfirm={handleConfirmLogout} />
      )}
    </>
  );
};

export default AdminNavbar;