import React from 'react'
import { NavLink } from "react-router-dom";
import Profile from "../assets/Profile.png";

const Navbar = () => {
  return (
    <nav className="relative flex items-center justify-between bg-[#F6F6F4]  px-6 py-3 h-25">
      {/* เมนูหลัก */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex bg-white border border-[#E9E9E9] rounded-full p-3 items-center justify-center">

        <NavLink to="/user/Homepage"
          className={({ isActive }) =>
            isActive ? 'bg-[#38A738] text-white px-10 py-1 rounded-2xl flex items-center justify-center' : 'text-gray-700 flex items-center justify-center px-10 py-1 hover:[#38A738]'
          }
        >
          หน้าแรก
        </NavLink>
        <NavLink to="/user/TeachingSchedule"
          className={({ isActive }) =>
            isActive ? 'bg-[#38A738] text-white px-10 py-1 rounded-2xl flex items-center justify-center' : 'text-gray-700 flex items-center justify-center px-10 py-1 hover:[#38A738]'
          }
        >
          ตารางสอบ
        </NavLink>
        <NavLink
          to="/user/Results"
          className={({ isActive }) =>
            isActive ? 'bg-[#38A738] text-white px-10 py-1 rounded-2xl flex items-center justify-center' : 'text-gray-700 flex items-center justify-center px-10 py-1 hover:[#38A738]'
          }
        >

          สรุปผล
        </NavLink>

      </div>

      {/* โปรไฟล์ */}
      <div className="ml-auto flex items-center space-x-2 bg-white px-3 py-2  rounded-full border border-[#E9E9E9]">
        <img
          src={Profile}
          alt="profile"
          className="w-8 h-8 rounded-full object-cover"
        />
        <div className="flex flex-col text-sm">
          <span className="font-medium">ตัวฟรี e-sport</span>
          <span className="text-gray-500 text-xs">คณะวิทยาศาสตร์ฯ</span>
        </div>
      </div>
    </nav>
  )
}

export default Navbar 