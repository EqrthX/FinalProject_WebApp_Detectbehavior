import React from "react";

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, title = "ลบข้อมูล" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] bg-black/40 backdrop-blur-[2px]">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-[90%] max-w-sm border border-gray-200 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-center mb-4 text-red-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-12 h-12"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-center text-gray-800 mb-2">
          ยืนยันการ{title}
        </h3>
        <p className="text-center text-gray-600 mb-6">
          คุณต้องการลบข้อมูลนี้ใช่หรือไม่? <br />
          <span className="text-xs text-red-400">
            (การกระทำนี้ไม่สามารถเรียกคืนได้)
          </span>
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 w-full font-medium"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 w-full font-medium shadow-md"
          >
            ลบข้อมูล
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
