import React from "react";
import { NavLink } from "react-router-dom";
import Profile from "../assets/Profile.png";
import menuDB from "../assets/menuDB.png";
import menuCL from "../assets/menuCL.png";
import menuTC from "../assets/menuTC.png";
import AdminLogout from "./AdminLogout.jsx";

const AdminNavbar = () => {
  return (
    <div className="flex min-h-screen bg-[#F6F6F4]">
      <aside
        className="
    bg-white border border-[#e9e9e9] rounded-[20px] shadow-sm
    lg:fixed lg:top-2 lg:left-1      /* fixed เฉพาะ lg ขึ้นไป */
    md:static md:mt-6 md:ml-8        /* โน้ตบุ๊กให้เป็น static + มีระยะห่าง */
    flex flex-col justify-between
    w-44 lg:w-56 md:w-48 h-[85vh] 
    md:h-auto lg:min-h-[85vh] lg:max-h-[85vh]
    transition-all
  "
      >
        <div className="p-4">
          {/* ส่วนโปรไฟล์ */}
          <div className="flex items-center gap-3 mb-3">
            <img
              className="w-10 h-10 rounded-full md:w-9 md:h-9"
              src={Profile}
              alt="Profile"
            />
            <div className="text-black text-base font-medium">แอดมิน</div>
          </div>

          <hr className="p-3 border-t border-[#e9e9e9]" />

          {/* เมนูด้านใน */}
          <nav className="flex flex-col items-center gap-2">
            <NavLink
              to="/admin/AdminHomePage"
              className={
                ({ isActive }) =>
                  (isActive
                    ? "bg-[#38a738] text-white"
                    : "text-gray-700 hover:bg-gray-100") +
                  " w-40 h-9 px-3 rounded-md flex items-center gap-2 text-sm " + // <-- ฐาน (จอเล็ก)
                  " md:w-48 md:h-10 md:px-4 md:gap-3 md:text-base " + // <-- โน้ตบุ๊ก
                  " lg:w-52 lg:h-10 lg:px-4 lg:gap-3" // <-- จอใหญ่
              }
            >
              <img
                className="w-3 h-3 md:w-3.5 md:h-3.5"
                src={menuDB}
                alt="menuDB"
              />
              Dashboard
            </NavLink>

            <NavLink
              to="/admin/TeachingSchedule"
              className={({ isActive }) =>
                (isActive
                  ? "bg-[#38a738] text-white"
                  : "text-gray-700 hover:bg-gray-100") +
                " w-40 h-9 px-3 rounded-md flex items-center gap-2 text-sm " +
                " md:w-48 md:h-10 md:px-4 md:gap-3 md:text-base " +
                " lg:w-52 lg:h-10 lg:px-4 lg:gap-3"
              }
            >
              <img
                className="w-4 h-4 md:w-5 md:h-5"
                src={menuCL}
                alt="menuCL"
              />
              ตารางสอน
            </NavLink>

            <NavLink
              to="/admin/Teachers"
              className={({ isActive }) =>
                (isActive
                  ? "bg-[#38a738] text-white"
                  : "text-gray-700 hover:bg-gray-100") +
                " w-40 h-9 px-3 rounded-md flex items-center gap-2 text-sm " +
                " md:w-48 md:h-10 md:px-4 md:gap-3 md:text-base " +
                " lg:w-52 lg:h-10 lg:px-4 lg:gap-3"
              }
            >
              <img
                className="w-3.5 h-3.5 md:w-4 md:h-4"
                src={menuTC}
                alt="menuTC"
              />
              อาจารย์
            </NavLink>

            <AdminLogout />
          </nav>
        </div>
      </aside>
    </div>
  );
};

export default AdminNavbar;
