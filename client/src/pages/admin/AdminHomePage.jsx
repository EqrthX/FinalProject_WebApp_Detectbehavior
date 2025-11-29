import React, { useState, useEffect } from "react"; 
import AdminNavbar from "../../components/AdminNavbar";
import Adminsubject from "../../components/Adminsubject";
import AdminChart from "../../components/AdminChart";
import { Select } from "antd";
// 🔑 นำเข้า Supabase
import { supabase } from "../../config/supabase.js"; 

const AdminHomePage = () => {
  // 🔑 State สำหรับเก็บหมวดหมู่ที่ถูกเลือกในการกรอง (คงไว้เผื่อใช้ใน Chart/Subject)
  const [selectedCategory, setSelectedCategory] = useState("all"); 
  
  // 🎯 รายชื่อหมวดหมู่สำหรับการกรอง (คงไว้ แต่ไม่ได้ใช้ใน UI)
  const categoryOptions = [
    { value: "all", label: "ทั้งหมด" },
    { value: "faculty", label: "คณะ" },
    { value: "subject", label: "วิชา" },
    { value: "teacher", label: "อาจารย์" },
  ];
  
  // 🔑 State ใหม่สำหรับเก็บจำนวนรวมจาก DB
  const [summaryCounts, setSummaryCounts] = useState({
    totalFaculties: 0,
    totalSubjects: 0,
    totalTeachers: 0,
    isLoading: true,
  });

  // ------------------------------------
  // 🔥 ฟังก์ชันดึงจำนวนรวม (Summary Counts)
  // ------------------------------------
  const fetchSummaryCounts = async () => {
    setSummaryCounts(prev => ({ ...prev, isLoading: true }));
    
    try {
      // 1. นับจำนวนคณะ (Faculty)
      const { count: facultyCount, error: facultyError } = await supabase
        .from('faculty') 
        .select('*', { count: 'exact', head: true });

      // 2. นับจำนวนวิชา (Subjects)
      const { count: subjectCount, error: subjectError } = await supabase
        .from('subjects') 
        .select('*', { count: 'exact', head: true });

      // 3. นับจำนวนอาจารย์ (Teacher)
      const { count: teacherCount, error: teacherError } = await supabase
        .from('teacher') 
        .select('*', { count: 'exact', head: true });
        
      if (facultyError || subjectError || teacherError) {
        console.error("Error fetching summary counts:", facultyError || subjectError || teacherError);
        // แสดง error ใน console เพื่อการ debug RLS
      }

      setSummaryCounts({
        totalFaculties: facultyCount || 0,
        totalSubjects: subjectCount || 0,
        totalTeachers: teacherCount || 0,
        isLoading: false,
      });

    } catch (e) {
      console.error("General error during count fetch:", e);
      setSummaryCounts(prev => ({ ...prev, isLoading: false }));
    }
  };

  // 🔑 เรียกใช้เมื่อ Component โหลดครั้งแรก
  useEffect(() => {
    fetchSummaryCounts();
  }, []);

  // ------------------------------------
  // 🎯 รายการที่จะถูก Map เพื่อแสดงในกล่องสรุป
  // ------------------------------------
  const summaryItems = [
    { title: "คณะทั้งหมด", value: summaryCounts.totalFaculties },
    { title: "วิชาทั้งหมด", value: summaryCounts.totalSubjects },
    { title: "อาจารย์ทั้งหมด", value: summaryCounts.totalTeachers },
  ];

  return (
    <div className="min-h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-1 p-4">
      {/* Sidebar */}
      <aside className="w-full md:w-64">
        <AdminNavbar />
      </aside>

      {/* Main */}
      <main
        className="flex-1 transition-all lg:pl-[0rem] md:pl-0 sm:pl-0 h-full overflow-y-auto"
      >
        <div className="max-w-screen-2xl mx-auto px-6 md:px-4">
          {/* Top bar (Header เหมือนหน้า รายวิชา) */}
          <div
            className="w-full bg-white rounded-[15px] border border-[#e9e9e9] shadow-sm 
                    h-20 md:h-16 px-6 flex items-center justify-start 
                    sticky top-[20px] z-30" 
          >
            <h1 className="text-[22px] md:text-[18px] font-semibold text-black ">
              Dashboard
            </h1>
          </div>

          {/* เนื้อหา */}
          <div
            className="
                grid gap-6 lg:gap-10 
                grid-cols-1 
                md:grid-cols-2      /* Tablet: แบ่งครึ่ง 50/50 เหมือนเดิม */
                lg:grid-cols-3      /* PC: แบ่งเป็น 3 ส่วน */
                items-start
                max-w-screen-2xl mx-auto mt-9
              "
          >
            {/* 🟢 กล่องกราฟ: สั่งให้กินพื้นที่ 2 ส่วน (lg:col-span-2) */}
            <div className="lg:col-span-2 w-full">
              <AdminChart selectedCategory={selectedCategory} />
            </div>

            {/* กล่องรายวิชา: กินพื้นที่ 1 ส่วนที่เหลือ (โดย default) */}
            <div className="w-full">
              <Adminsubject selectedCategory={selectedCategory} />
            </div>

            {/* กล่องสรุปจำนวน */}
            <div
            className="flex flex-wrap justify-start gap-10 w-full col-span-full md:col-span-2"
          >
            {summaryCounts.isLoading ? (
                <div className="flex w-full justify-center p-8 text-gray-500">
                    กำลังโหลดข้อมูล...
                </div>
            ) : (
                summaryItems.map((item, i) => (
                    <div
                        key={i}
                        className="
                          min-w-[200px] flex-1 
                          bg-white rounded-[20px] border border-[#e9e9e9]
                          p-6 shadow-sm flex flex-col items-center  /* 🟢 1. จัดแกนขวางให้อยู่ตรงกลาง (จากเดิม items-start) */
            justify-center /* 🟢 2. จัดแกนตั้งให้อยู่ตรงกลาง (เผื่อกล่องสูงขึ้น) */
            text-center    /* 🟢 3. บังคับให้ text อยู่ตรงกลาง */
                          transition-all
                        "
                        >
                        
                        <p className="text-3xl font-bold text-[#3D42D3]">
                            {item.value}
                        </p>
                        <h2 className="text-sm font-medium text-gray-700 mb-1">
                            {item.title}
                        </h2>
                    </div>
                ))
            )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminHomePage;