import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import axios from "../util/axios"; // ตรวจสอบ path ให้ถูกต้อง
import { supabase } from "../config/supabase"; // ตรวจสอบ path ให้ถูกต้อง

export const TeacherActionModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  teacherData = null, // ถ้ามีค่า = แก้ไข, ไม่มี = เพิ่มใหม่
  facultyList = [] 
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

  const isEditMode = !!teacherData;

  // Load data when opening in edit mode
  useEffect(() => {
    if (isOpen) {
      if (teacherData) {
        setFormData({
          email: teacherData.email || "", // อาจจะว่างถ้าไม่มี field ใน DB
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
    setFormData(prev => ({
        ...prev, 
        [field]: value,
        ...(field === "facultyId" ? { majorId: "" } : {}) // Reset major if faculty changes
    }));
  };

  // Filter majors based on selected faculty
  const majorsToShow = facultyList.find(f => f.faculty_id === formData.facultyId)?.majors || [];

  // Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password, teacherId, fullname, facultyId, majorId } = formData;

    if (!teacherId || !fullname || !facultyId || !majorId) {
      return toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
    }

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
        if (!email || !password) return toast.error("กรุณากรอกอีเมลและรหัสผ่าน");

        const payload = new FormData();
        payload.append("email", email);
        payload.append("password", password);
        payload.append("teacher_id", teacherId);
        payload.append("fullname", fullname);
        payload.append("majorId", majorId);

        const response = await axios.post(`admin/create-teacher`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(response.data.detail || "เพิ่มข้อมูลสำเร็จ");
      }

      onSuccess(); // Refresh data in parent
      onClose();   // Close modal

    } catch (error) {
      console.error(isEditMode ? "Update Error:" : "Create Error:", error);
      const msg = error.response?.data?.detail || error.message || "เกิดข้อผิดพลาด";
      toast.error(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-md border border-gray-300">
        <h2 className="text-2xl font-bold mb-6">
            {isEditMode ? "แก้ไขรายชื่ออาจารย์" : "อัพโหลดรายชื่อ"}
        </h2>

        <form className="space-y-4" onSubmit={handleSubmit}>
          
          
          

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
              <label htmlFor="password" className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">
                รหัสผ่าน <span className="text-red-500">*</span>
              </label>
            </div>
          )}

          {/* Teacher ID */}
          <div className="relative mt-2">
            <input
              type="text"
              id="teacherId"
              inputMode="numeric"
              value={formData.teacherId}
              /* 🟢 2. สั่ง disable เมื่อเป็นโหมดแก้ไข */
              disabled={isEditMode}
              onChange={(e) => setFormData({...formData, teacherId: e.target.value.replace(/[^0-9]/g, "")})}
              className="peer w-full px-4 py-2 border border-gray-300 rounded-md text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
              placeholder="รหัสประจำตัว"
            />
            <label htmlFor="teacherId" className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">
              {/* 🟢 3. เปลี่ยนข้อความ Label ให้ผู้ใช้รู้ */}
              รหัสประจำตัว {isEditMode ? "(แก้ไขไม่ได้)" : <span className="text-red-500">*</span>}
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
            <label htmlFor="fullname" className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">
              ชื่อ - นามสกุล <span className="text-red-500">*</span>
            </label>
          </div>

          {/* Faculty Select */}
          <div className="relative mt-2">
            <select
              value={formData.facultyId}
              onChange={(e) => handleSelectChange("facultyId", e.target.value)}
              className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 appearance-none placeholder-transparent"
            >
              <option value="" disabled></option>
              {facultyList.map((f) => (
                <option key={f.faculty_id} value={f.faculty_id}>{f.faculty_name}</option>
              ))}
            </select>
            <label className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none ${formData.facultyId ? "-top-2.5 text-gray-400" : "top-2.5 text-gray-400"}`}>
              กรุณาเลือกคณะ <span className="text-red-500">*</span>
            </label>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
            </div>
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
                <option key={m.major_id} value={m.major_id}>{m.major_name}</option>
              ))}
            </select>
            <label className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none ${formData.majorId ? "-top-2.5 text-gray-400" : "top-2.5 text-gray-400"}`}>
              กรุณาเลือกสาขา <span className="text-red-500">*</span>
            </label>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
            </div>
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
              type="submit"
              className="px-5 py-2 bg-[#3F37C9] text-white rounded-md hover:bg-[#2b28a0] transition"
            >
              {isEditMode ? "บันทึกการแก้ไข" : "ยืนยัน"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

// 🟢 ฟังก์ชันลบแยกออกมาให้เรียกใช้ง่ายๆ (ไม่ต้องเป็น Component ก็ได้)
export const deleteTeacher = async (id) => {
    if (window.confirm("คุณต้องการลบข้อมูลอาจารย์ท่านนี้ใช่หรือไม่?")) {
        try {
            const { error } = await supabase.from("teacher").delete().eq("id", id);
            if (error) throw error;
            toast.success("ลบข้อมูลเรียบร้อย");
            return true; // ส่งค่าบอกว่าลบสำเร็จ
        } catch (err) {
            console.error("Delete Error:", err);
            toast.error("ลบข้อมูลไม่สำเร็จ");
            return false;
        }
    }
    return false;
};