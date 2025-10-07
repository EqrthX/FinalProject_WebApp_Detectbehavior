import React from "react";
import { useNavigate } from "react-router-dom";
import logout from "../assets/logout.png";

const AdminLogout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("../pages/LoginPage");
  };

  return (
    <div
      className="
    fixed bottom-6 left-8   /* ✅ ตำแหน่งเดิม */
    bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm
    transition-all duration-300
    w-44 h-12              /* จอเล็ก */
    md:w-48 md:h-12        /* โน้ตบุ๊ก */
    lg:w-56 lg:h-14        /* จอใหญ่ */
  "
    >
      <button
        onClick={handleLogout}
        className="
      inline-flex items-center justify-center gap-2
      w-full h-full
      text-black font-medium
      hover:bg-[#FE2B2B] hover:text-white
      rounded-[20px]
      transition-colors duration-200
      text-sm md:text-base
    "
      >
        <img className="w-4 h-4 md:w-3.5 md:h-3.5" src={logout} alt="logout" />
        ออกจากระบบ
      </button>
    </div>
  );
};

export default AdminLogout;
