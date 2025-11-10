import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react"; // ใช้ไอคอนจาก lucide-react (ติดตั้งด้วย npm i lucide-react)
import Profile from "../assets/Profile.png";
import {supabase} from "../config/supabase"

const Navbar = () => {

  const location = useLocation();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // localStorage
  const name = localStorage.getItem("fullname")
  const major = localStorage.getItem("major");

  const isTeachingActive = [
    '/user/TeachingSchedule',
    '/user/Record',
    '/user/summarize'
  ].includes(location.pathname);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLogout(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  

  const handleLogoutClick = () => {
    setShowLogout(false);
    setShowConfirmModal(true);
    

  };

  const handleConfirmLogout = async () => {

    await supabase.auth.signOut();

    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("fullname");
    localStorage.removeItem("teacher_id");
    localStorage.removeItem("major"); 

    setShowConfirmModal(false);
    navigate('/');
  };

  const handleCancelLogout = () => setShowConfirmModal(false);

  return (
    <>
      {/* 🔹 Navbar Container */}
      <nav className="relative bg-[#F6F6F4] px-4 sm:px-6 py-3 flex items-center justify-between border-b border-gray-200">

        {/* 🔹 Left: Hamburger (เฉพาะมือถือ) */}
        <button
          className="lg:hidden flex items-center text-gray-700"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>

        {/* 🔹 Center: เมนูหลัก */}
        <div className="hidden lg:flex bg-white border border-[#E9E9E9] rounded-full p-2 px-3 space-x-3 mx-auto">
          <NavLink
            to="/user/Homepage"
            className={({ isActive }) =>
              isActive
                ? 'bg-[#38A738] text-white px-8 py-1.5 rounded-2xl font-medium'
                : 'text-gray-700 px-8 py-1.5 rounded-2xl hover:text-[#38A738]'
            }
          >
            หน้าแรก
          </NavLink>

          <NavLink
            to="/user/TeachingSchedule"
            className={() =>
              isTeachingActive
                ? 'bg-[#38A738] text-white px-8 py-1.5 rounded-2xl font-medium'
                : 'text-gray-700 px-8 py-1.5 rounded-2xl hover:text-[#38A738]'
            }
          >
            ตารางสอน
          </NavLink>

          <NavLink
            to="/user/ResultsPage"
            className={({ isActive }) =>
              isActive
                ? 'bg-[#38A738] text-white px-8 py-1.5 rounded-2xl font-medium'
                : 'text-gray-700 px-8 py-1.5 rounded-2xl hover:text-[#38A738]'
            }
          >
            สรุปผล
          </NavLink>
        </div>

        {/* 🔹 ขวา: โปรไฟล์ */}
        <div className="relative ml-auto" ref={dropdownRef}>
          <button
            onClick={() => setShowLogout(!showLogout)}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-full border border-[#E9E9E9] hover:border-[#38A738] transition"
          >
            <img src={Profile} alt="profile" className="w-8 h-8 rounded-full object-cover" />
            <div className="hidden sm:flex flex-col text-sm">
              <span className="font-medium">{name}</span>
              <span className="text-gray-500 text-xs">{major}</span>
            </div>
          </button>

          {showLogout && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E9E9E9] rounded-lg shadow-lg z-50">
              <button
                onClick={handleLogoutClick}
                className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition flex items-center space-x-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>ออกจากระบบ</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* 🔹 Mobile menu (เมื่อกด hamburger) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200 shadow-md px-6 py-4 space-y-3">
          <NavLink
            to="/user/Homepage"
            className={({ isActive }) =>
              isActive
                ? 'block bg-[#38A738] text-white px-4 py-2 rounded-lg font-medium'
                : 'block text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100'
            }
            onClick={() => setIsMobileMenuOpen(false)}
          >
            หน้าแรก
          </NavLink>

          <NavLink
            to="/user/TeachingSchedule"
            className={() =>
              isTeachingActive
                ? 'block bg-[#38A738] text-white px-4 py-2 rounded-lg font-medium'
                : 'block text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100'
            }
            onClick={() => setIsMobileMenuOpen(false)}
          >
            ตารางสอน
          </NavLink>

          <NavLink
            to="/user/ResultsPage"
            className={({ isActive }) =>
              isActive
                ? 'block bg-[#38A738] text-white px-4 py-2 rounded-lg font-medium'
                : 'block text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100'
            }
            onClick={() => setIsMobileMenuOpen(false)}
          >
            สรุปผล
          </NavLink>
        </div>
      )}

      {/* 🔹 Modal ยืนยันออกจากระบบ */}
      {showConfirmModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>

            <h3 className="text-lg font-semibold text-center mb-2">
              ยืนยันการออกจากระบบ
            </h3>
            <p className="text-gray-600 text-center mb-6">
              คุณต้องการออกจากระบบใช่หรือไม่?
            </p>

            <div className="flex space-x-3">
              <button
                onClick={handleCancelLogout}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
