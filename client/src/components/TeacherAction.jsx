import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import axios from "../util/axios"; // ตรวจสอบ path ให้ถูกต้อง
import { supabase } from "../config/supabase"; // ตรวจสอบ path ให้ถูกต้อง

export const TeacherActionModal = ({
  isOpen,
  onClose,
  onSuccess,
  teacherData = null, // ถ้ามีค่า = แก้ไข, ไม่มี = เพิ่มใหม่
  facultyList = [],
}) => {
  // Form States
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    teacherId: "",
    fullname: "",
    facultyId: "",
    majorId: "",
  });

  // 🟢 State สำหรับควบคุม Modal ยืนยัน
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const isEditMode = !!teacherData;

  // Load data when opening in edit mode
  useEffect(() => {
    if (isOpen) {
      // รีเซ็ตสถานะ Modal ยืนยันทุกครั้งที่เปิด
      setShowConfirmModal(false);

      if (teacherData) {
        setFormData({
          email: teacherData.email || "",
          password: "",
          teacherId: teacherData.teacherId,
          fullname: teacherData.fullname,
          facultyId: teacherData.faculty_id,
          majorId: teacherData.major_id,
        });
      } else {
        // Reset form for create mode
        setFormData({
          email: "",
          password: "",
          teacherId: "",
          fullname: "",
          facultyId: "",
          majorId: "",
        });
      }
    }
  }, [isOpen, teacherData]);

  // Handle Input Change
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSelectChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "facultyId" ? { majorId: "" } : {}), // Reset major if faculty changes
    }));
  };

  // Filter majors based on selected faculty
  const majorsToShow =
    facultyList.find((f) => f.faculty_id === formData.facultyId)?.majors || [];

  // 🟢 1. ฟังก์ชันตรวจสอบข้อมูลก่อนบันทึก (Pre-Check)
  const handlePreCheck = (e) => {
    e.preventDefault();
    const { email, password, teacherId, fullname, facultyId, majorId } =
      formData;

    // Validation (คงโค้ดเดิมไว้)
    if (!teacherId || !fullname || !facultyId || !majorId) {
      return toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
    }

    if (!isEditMode) {
      if (!email || !password) return toast.error("กรุณากรอกอีเมลและรหัสผ่าน");
    }

    // ถ้าผ่าน Validation ให้เปิด Modal ยืนยัน
    setShowConfirmModal(true);
  };

  // 🟢 2. ฟังก์ชันทำงานจริงเมื่อกดยืนยัน (Execute Logic เดิม)
  const executeSubmit = async () => {
    // ปิด Modal ก่อน
    setShowConfirmModal(false);

    const { email, password, teacherId, fullname, facultyId, majorId } =
      formData;

    const nameParts = fullname.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    try {
      if (isEditMode) {
        // --- UPDATE ---
        const { error } = await supabase
          .from("teacher")
          .update({
            teacher_id: teacherId,
            first_name: firstName,
            last_name: lastName,
            major_id: majorId,
          })
          .eq("id", teacherData.id);

        if (error) throw error;
        toast.success("แก้ไขข้อมูลสำเร็จ");
      } else {
        // --- CREATE ---
        // Payload เดิม
        const payload = {
          email: email,
          password: password,
          teacher_id: teacherId,
          fullname: fullname,
          major_id: majorId,
        };

        // Axios Call เดิม
        const response = await axios.post(`admin/create-teacher`, payload);

        toast.success(response.data.detail || "เพิ่มข้อมูลสำเร็จ");
      }

      onSuccess(); // Refresh data in parent
      onClose(); // Close modal
    } catch (error) {
      console.error(isEditMode ? "Update Error:" : "Create Error:", error);

      let msg = "เกิดข้อผิดพลาดในการดำเนินการ";

      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          msg = detail.map((item) => item.msg).join(", ");
        } else if (typeof detail === "string") {
          msg = detail;
        } else {
          msg = JSON.stringify(detail);
        }
      } else if (error.message) {
        msg = error.message;
      }

      toast.error(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* --- Main Form Modal --- */}
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
        <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-md border border-gray-300 relative">
          <h2 className="text-2xl font-bold mb-6">
            {isEditMode ? "แก้ไขรายชื่ออาจารย์" : "อัปโหลดรายชื่อ"}
          </h2>

          <form className="space-y-4">
            {/* Email */}
            <div
              className={`relative mt-2 ${
                isEditMode ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              <input
                type="text"
                id="email"
                value={formData.email}
                disabled={isEditMode}
                onChange={handleChange}
                className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                placeholder="อีเมล"
              />
              <label
                htmlFor="email"
                className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
              >
                อีเมล{" "}
                {isEditMode ? (
                  "(แก้ไขไม่ได้)"
                ) : (
                  <span className="text-red-500">*</span>
                )}
              </label>
            </div>

            {/* Password (Create Only) */}
            {!isEditMode && (
              <div className="relative mt-2">
                <input
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                  placeholder="รหัสผ่าน"
                />
                <label
                  htmlFor="password"
                  className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                >
                  รหัสผ่าน <span className="text-red-500">*</span>
                </label>
              </div>
            )}

            {/* Teacher ID */}
            <div
              className={`relative mt-2 ${
                isEditMode ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              <input
                type="text"
                id="teacherId"
                inputMode="numeric"
                value={formData.teacherId}
                disabled={isEditMode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    teacherId: e.target.value.replace(/[^0-9]/g, ""),
                  })
                }
                className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                placeholder="รหัสประจำตัว"
              />
              <label
                htmlFor="teacherId"
                className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
              >
                รหัสประจำตัว{" "}
                {isEditMode ? (
                  "(แก้ไขไม่ได้)"
                ) : (
                  <span className="text-red-500">*</span>
                )}
              </label>
            </div>

            {/* Full Name */}
            <div className="relative mt-2">
              <input
                type="text"
                id="fullname"
                value={formData.fullname}
                onChange={handleChange}
                className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                placeholder="ชื่อ - นามสกุล"
              />
              <label
                htmlFor="fullname"
                className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
              >
                ชื่อ - นามสกุล <span className="text-red-500">*</span>
              </label>
            </div>

            {/* Faculty Select */}
            <div className="relative mt-2">
              <select
                value={formData.facultyId}
                onChange={(e) =>
                  handleSelectChange("facultyId", e.target.value)
                }
                className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 appearance-none placeholder-transparent"
              >
                <option value="" disabled></option>
                {facultyList.map((f) => (
                  <option key={f.faculty_id} value={f.faculty_id}>
                    {f.faculty_name}
                  </option>
                ))}
              </select>
              <label
                className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none ${
                  formData.facultyId
                    ? "-top-2.5 text-gray-400"
                    : "top-2.5 text-gray-400"
                }`}
              >
                กรุณาเลือกคณะ <span className="text-red-500">*</span>
              </label>
            </div>

            {/* Major Select */}
            <div className="relative mt-2">
              <select
                disabled={!formData.facultyId}
                value={formData.majorId}
                onChange={(e) => handleSelectChange("majorId", e.target.value)}
                className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 appearance-none placeholder-transparent disabled:bg-gray-100"
              >
                <option value="" disabled></option>
                {majorsToShow.map((m) => (
                  <option key={m.major_id} value={m.major_id}>
                    {m.major_name}
                  </option>
                ))}
              </select>
              <label
                className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none ${
                  formData.majorId
                    ? "-top-2.5 text-gray-400"
                    : "top-2.5 text-gray-400"
                }`}
              >
                กรุณาเลือกสาขา <span className="text-red-500">*</span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex justify-end mt-6 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                // 🟢 เปลี่ยนจาก type="submit" เป็น onClick ที่เรียก handlePreCheck
                onClick={handlePreCheck}
                className="px-5 py-2 bg-[#3F37C9] text-white rounded-md hover:bg-[#2b28a0] transition"
              >
                {isEditMode ? "บันทึกการแก้ไข" : "ยืนยัน"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 🟢 CONFIRMATION MODAL (หน้าลอยสำหรับยืนยัน)               */}
      {/* ========================================================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-[90%] max-w-sm transform scale-100 transition-transform animate-in fade-in zoom-in duration-200 border border-gray-200">
            {/* Icon */}
            <div className="flex justify-center mb-4 text-[#3F37C9]">
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
                  d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12"
                />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-center text-gray-800 mb-2">
              ยืนยันการบันทึก
            </h3>
            <p className="text-center text-gray-600 mb-6">
              คุณต้องการบันทึกข้อมูลใช่หรือไม่?
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 w-full font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={executeSubmit}
                className="px-4 py-2 text-white bg-[#3F37C9] rounded-lg hover:bg-[#332dab] w-full font-medium shadow-md"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// 🟢 ฟังก์ชันลบแยกออกมา (เหมือนเดิม)
export const deleteTeacher = async (id) => {
  if (window.confirm("คุณต้องการลบข้อมูลอาจารย์ท่านนี้ใช่หรือไม่?")) {
    try {
      const { error } = await supabase.from("teacher").delete().eq("id", id);
      if (error) throw error;
      toast.success("ลบข้อมูลเรียบร้อย");
      return true;
    } catch (err) {
      console.error("Delete Error:", err);
      toast.error("ลบข้อมูลไม่สำเร็จ");
      return false;
    }
  }
  return false;
};