// components/SubjectModals.jsx
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { supabase } from "../config/supabase.js";

// ==========================================
// 1. Component: AddSubjectAction (เพิ่มรายวิชา)
// ==========================================
export const AddSubjectAction = ({ isOpen, onClose, onSuccess }) => {
    const [newSubject, setNewSubject] = useState({
      subject_id: "",
      subject_name: "",
      credit: "",
      category: "",
    });
  
    useEffect(() => {
      if (isOpen) {
          setNewSubject({
              subject_id: "",
              subject_name: "",
              credit: "",
              category: "",
          });
      }
    }, [isOpen]);
  
    const handleAddSubject = async (e) => {
      e.preventDefault();
  
      if (!newSubject.subject_id || !newSubject.subject_name || !newSubject.credit || !newSubject.category) {
        toast.error("กรุณากรอกข้อมูลให้ครบ ⚠️");
        return;
      }
  
      const { data: existingSubjects, error: selectError } = await supabase
        .from("subjects")
        .select("subject_id")
        .eq("subject_id", newSubject.subject_id);
  
      if (selectError) {
        console.error("Supabase Select Error:", selectError);
        toast.error("เกิดข้อผิดพลาดในการตรวจสอบข้อมูล ❌");
        return;
      }
  
      if (existingSubjects && existingSubjects.length > 0) {
        toast.error(`ไม่สามารถเพิ่มได้: รหัสวิชา ${newSubject.subject_id} มีอยู่ในระบบแล้ว ⚠️`);
        return;
      }
  
      const { error: insertError } = await supabase.from("subjects").insert([
        {
          subject_id: newSubject.subject_id,
          subject_name: newSubject.subject_name,
          credit: newSubject.credit,
          category: newSubject.category,
        },
      ]);
  
      if (insertError) {
        toast.error("เกิดข้อผิดพลาดในการเพิ่มรายวิชา ❌");
        console.error(insertError);
      } else {
        toast.success("เพิ่มรายวิชาสำเร็จ! ✅");
        onSuccess(); 
        onClose();   
      }
    };
  
    if (!isOpen) return null;
  
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
        <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-xl border border-gray-300">
          <h2 className="text-2xl font-bold mb-6">เพิ่มรายวิชา</h2>
          
          <form onSubmit={handleAddSubject} className="space-y-4">
            <div className="relative mt-2">
              <input
                type="text"
                id="subject_id"
                required
                value={newSubject.subject_id}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  setNewSubject({ ...newSubject, subject_id: value });
                }}
                className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                placeholder="รหัสวิชา"
              />
              <label htmlFor="subject_id" className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">
                รหัสวิชา <span className="text-red-500">*</span>
              </label>
            </div>
  
            <div className="relative mt-2">
              <input
                type="text"
                id="subject_name"
                required
                value={newSubject.subject_name}
                onChange={(e) => setNewSubject({ ...newSubject, subject_name: e.target.value })}
                className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                placeholder="ชื่อวิชา"
              />
              <label htmlFor="subject_name" className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">
                ชื่อวิชา <span className="text-red-500">*</span>
              </label>
            </div>
  
            <div className="relative mt-2">
              <select
                id="credit"
                required
                value={newSubject.credit}
                onChange={(e) => setNewSubject({ ...newSubject, credit: e.target.value })}
                className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 appearance-none placeholder-transparent"
              >
                <option value="" disabled></option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
              </select>
              <label htmlFor="credit" className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none ${newSubject.credit ? "-top-2.5 text-gray-400" : "top-2.5 text-gray-400"}`}>
                หน่วยกิต <span className="text-red-500">*</span>
              </label>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
              </div>
            </div>
  
            <div className="relative">
              <select
                id="category"
                required
                value={newSubject.category}
                onChange={(e) => setNewSubject({ ...newSubject, category: e.target.value })}
                className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 appearance-none placeholder-transparent"
              >
                <option value="" disabled></option>
                <option value="วิชาทั่วไป">วิชาทั่วไป</option>
                <option value="วิชาเฉพาะ">วิชาเฉพาะ</option>
                <option value="วิชาเสรี">วิชาเสรี</option>
              </select>
              <label htmlFor="category" className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none ${newSubject.category ? "-top-2.5 text-gray-400" : "top-2.5 text-gray-400"}`}>
                เลือกหมวดหมู่ <span className="text-red-500">*</span>
              </label>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
              </div>
            </div>
  
            <div className="flex justify-end mt-6 gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">
                ยกเลิก
              </button>
              <button type="submit" className="px-5 py-2 bg-[#38A738] text-white rounded-md hover:bg-[#2d7c2d]">
                เพิ่ม
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };