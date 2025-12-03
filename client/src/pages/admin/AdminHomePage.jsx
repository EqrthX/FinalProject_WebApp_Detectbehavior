import React, { useState, useEffect } from "react"; 
import AdminNavbar from "../../components/AdminNavbar";
import Adminsubject from "../../components/Adminsubject";
import AdminChart from "../../components/AdminChart";
import { supabase } from "../../config/supabase.js"; 

const AdminHomePage = () => {
  // 🔑 State สำหรับเก็บหมวดหมู่ที่ถูกเลือก
  const [selectedCategory, setSelectedCategory] = useState("all"); 
  
  // 🔑 State สำหรับเก็บจำนวนรวม
  const [summaryCounts, setSummaryCounts] = useState({
    totalFaculties: 0,
    totalSubjects: 0,
    totalTeachers: 0,
    isLoading: true,
  });

  // --- Fetch Data Function (เหมือนเดิม) ---
  const fetchSummaryCounts = async () => {
    setSummaryCounts(prev => ({ ...prev, isLoading: true }));
    try {
      const { count: facultyCount, error: fErr } = await supabase.from('faculty').select('*', { count: 'exact', head: true });
      const { count: subjectCount, error: sErr } = await supabase.from('subjects').select('*', { count: 'exact', head: true });
      const { count: teacherCount, error: tErr } = await supabase.from('teacher').select('*', { count: 'exact', head: true });
        
      if (fErr || sErr || tErr) console.error("Error fetching counts");

      setSummaryCounts({
        totalFaculties: facultyCount || 0,
        totalSubjects: subjectCount || 0,
        totalTeachers: teacherCount || 0,
        isLoading: false,
      });
    } catch (e) {
      console.error("General error:", e);
      setSummaryCounts(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    fetchSummaryCounts();
  }, []);

  const summaryItems = [
    { title: "คณะทั้งหมด", value: summaryCounts.totalFaculties },
    { title: "วิชาทั้งหมด", value: summaryCounts.totalSubjects },
    { title: "อาจารย์ทั้งหมด", value: summaryCounts.totalTeachers },
  ];

  return (
    // 🟢 1. Main Container: ใช้ h-screen + overflow-hidden (เหมือนหน้าตารางสอน)
    // เพื่อให้ Navbar อยู่กับที่ และไม่เกิด Scrollbar ซ้อน
    <div className="h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-1 p-4 overflow-hidden">
      
      {/* Sidebar: Fix ขนาดให้เท่าหน้าอื่น */}
      <aside className="w-full md:w-64 shrink-0">
        <AdminNavbar />
      </aside>

      {/* 🟢 2. Main Content: ให้ Scrollbar อยู่ที่นี่แทน (overflow-y-auto) */}
      <main className="flex-1 transition-all h-full overflow-y-auto">
      <div className="max-w-screen-2xl mx-auto px-6 md:px-4 pb-10 mt-5">
            
          

          {/* Top bar (Dashboard Header) */}
          <div
            className="w-full bg-white rounded-[15px] border border-[#e9e9e9] shadow-sm 
                    h-20 md:h-16 px-6 flex items-center justify-start 
                    sticky top-[0px] z-30 mb-4" 
            // 🟢 เปลี่ยน top-[20px] เป็น top-[0px] เพราะเรา scroll ใน main container แล้ว
          >
            <h1 className="text-[22px] md:text-[18px] font-semibold text-black ">
              Dashboard
            </h1>
          </div>

          {/* เนื้อหา Grid */}
          <div className="grid gap-6 lg:gap-10 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-start mt-4">
            
            {/* กล่องกราฟ */}
            <div className="lg:col-span-2 w-full">
              <AdminChart selectedCategory={selectedCategory} />
            </div>

            {/* กล่องรายวิชา */}
            <div className="w-full">
              <Adminsubject selectedCategory={selectedCategory} />
            </div>

            {/* กล่องสรุปจำนวน */}
            <div className="flex flex-wrap justify-start gap-6 w-full col-span-full md:col-span-2 mt-4">
                {summaryCounts.isLoading ? (
                    <div className="flex w-full justify-center p-8 text-gray-500">กำลังโหลดข้อมูล...</div>
                ) : (
                    summaryItems.map((item, i) => (
                        <div key={i} className="min-w-[200px] flex-1 bg-white rounded-[20px] border border-[#e9e9e9] p-6 shadow-sm flex flex-col items-center justify-center text-center transition-all">
                            <p className="text-3xl font-bold text-[#3D42D3]">{item.value}</p>
                            <h2 className="text-sm font-medium text-gray-700 mb-1">{item.title}</h2>
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