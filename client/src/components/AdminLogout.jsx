// ✅ AdminLogout.jsx (เวอร์ชันแก้แล้ว ใช้ Portal เพื่อ modal อยู่บนสุดแน่นอน)
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactDOM from "react-dom";
import logout from "../assets/logout.png";
import {supabase} from "../config/supabase";

const LogoutModal = ({ onCancel, onConfirm }) => {
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center 
                 bg-black/60 backdrop-blur-sm z-[99999]"
    >
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
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>,
    document.body // ✅ Render modal ที่ root ของ DOM
  );
};

const AdminLogout = () => {
  const navigate = useNavigate();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleLogoutClick = () => setShowConfirmModal(true);
  const handleCancelLogout = () => setShowConfirmModal(false);

  const handleConfirmLogout = async () => {
    await supabase.auth.signOut();

    setShowConfirmModal(false);
    navigate("/"); // ✅ เปลี่ยนหน้าออกจากระบบ
  };

  return (
    <>
      {/* ปุ่มออกจากระบบ */}
      <div
        className="fixed bottom-6 left-8 bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm
                   transition-all duration-300 w-44 h-12 md:w-48 md:h-12 lg:w-56 lg:h-14 z-40"
      >
        <button
          onClick={handleLogoutClick}
          className="inline-flex items-center justify-center gap-2
                     w-full h-full text-black font-medium
                     hover:bg-[#FE2B2B] hover:text-white
                     rounded-[20px] transition-colors duration-200
                     text-sm md:text-base"
        >
          <img
            className="w-4 h-4 md:w-3.5 md:h-3.5"
            src={logout}
            alt="logout"
          />
          ออกจากระบบ
        </button>
      </div>

      {/* ✅ Modal จะ render ผ่าน Portal ไม่โดน layout บังแน่นอน */}
      {showConfirmModal && (
        <LogoutModal
          onCancel={handleCancelLogout}
          onConfirm={handleConfirmLogout}
        />
      )}
    </>
  );
};

export default AdminLogout;
