import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";
import { supabase } from "../../config/supabase";
import toast, { Toaster } from "react-hot-toast"; 
import { Pagination } from "antd";
import Breadcrumbs from "../../components/AdminBreadcrumbs";

// นำเข้าไฟล์ที่แยกไว้
import { TeacherActionModal, deleteTeacher } from "../../components/TeacherAction"; 

const AdminTeachers = () => {
  const navigate = useNavigate();
  
  // States
  const [showModal, setShowModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [faculty, setFaculty] = useState([]);
  const [teachers, setTeachers] = useState([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const [filterFacultyId, setFilterFacultyId] = useState("");
  const [filterMajorId, setFilterMajorId] = useState("");

  // --- Fetch Data ---
  const fetchFacultyAndMajor = async () => {
    try {
      const { data, error } = await supabase.from("faculty").select(`*, majors (*)`);
      if (error) throw error;
      setFaculty(data);
    } catch (error) {
      console.error("Fetch Faculty error:", error);
    }
  };

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from("teacher")
        .select(`
            id, teacher_id, first_name, last_name,
            majors ( major_id, major_name, faculty ( faculty_name, faculty_id ) )
        `);

      if (error) {
        console.error("Supabase Error:", error);
        toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
        return;
      }

      if (data) {
        const formatted = data.map((t) => ({
          id: t.id,
          teacherId: t.teacher_id,
          fullname: `${t.first_name} ${t.last_name}`,
          faculty: t.majors?.faculty?.faculty_name || "-",
          faculty_id: t.majors?.faculty?.faculty_id || "",
          major: t.majors?.major_name || "-",
          major_id: t.majors?.major_id || "",
          email: "", 
        }));
        setTeachers(formatted);
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }
  };

  useEffect(() => {
    fetchFacultyAndMajor();
    fetchTeachers();
  }, []);

  // --- Handlers ---
  const handleEditClick = (e, teacher) => {
    e.stopPropagation();
    setSelectedTeacher(teacher);
    setShowModal(true);
  };

  const handleDeleteClick = async (e, id) => {
    e.stopPropagation();
    const success = await deleteTeacher(id);
    if (success) fetchTeachers();
  };

  const handleClick = (t) => {
    navigate(`/admin/AdminClassRoom/${t.id}`, { state: { teacher: t } });
  };

  // --- Filter & Pagination Logic ---
  const filteredTeachers = teachers.filter((t) => {
    const lowerSearch = searchTerm.toLowerCase();
    const facultyMatch = !filterFacultyId || t.faculty_id === filterFacultyId;
    const majorMatch = !filterMajorId || t.major_id === filterMajorId;
    const searchMatch = !searchTerm || 
        t.teacherId.toLowerCase().includes(lowerSearch) ||
        t.fullname.toLowerCase().includes(lowerSearch) ||
        t.faculty.toLowerCase().includes(lowerSearch) ||
        t.major.toLowerCase().includes(lowerSearch);
    
    return facultyMatch && majorMatch && searchMatch;
  });

  const filterMajorsToShow = faculty.find((f) => f.faculty_id === filterFacultyId)?.majors || [];
  const currentTeachers = filteredTeachers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Pagination Handler
  const handlePaginationChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  return (
    // 🟢 Container หลัก: ใช้ h-screen และ overflow-hidden เพื่อกำหนดกรอบตายตัว
    <div className="h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-1 p-4 overflow-hidden">
      <Toaster />
      <aside className="w-full md:w-64"> <AdminNavbar /> </aside>

      {/* 🟢 Main Content: ใช้ flex flex-col และ h-full เพื่อให้เนื้อหาข้างในขยายเต็ม */}
      <main className="flex-1 transition-all lg:pl-[0rem] md:pl-0 sm:pl-0 h-full flex flex-col">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-4 w-full h-full flex flex-col">
          
          <div className="mt-5 shrink-0"> <Breadcrumbs /> </div>

          <div className="w-full bg-white rounded-[15px] border border-[#e9e9e9] shadow-sm h-20 md:h-16 px-6 flex items-center justify-between sticky top-[20px] z-30 shrink-0">
            <h1 className="text-[18px] font-semibold text-black">อาจารย์</h1>
          </div>

          {/* 🟢 Card Container: ใช้ flex-1 และ overflow-hidden เพื่อให้ส่วนนี้กินพื้นที่ที่เหลือทั้งหมด */}
          <div className="bg-white mt-4 p-4 rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col flex-1 overflow-hidden">
            
            {/* Toolbar Filter (ส่วนหัว) */}
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2 font-bold text-gray-800">รายชื่ออาจารย์</div>
                <input
                  type="text" placeholder="🔍 ค้นหา"
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-[#F6F6F4] text-black"
                  value={searchTerm} 
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
                
                <select
                  className="w-full md:w-56 px-5 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#b6b6b6] bg-[#F6F6F4] text-black"
                  value={filterFacultyId}
                  onChange={(e) => { setFilterFacultyId(e.target.value); setFilterMajorId(""); setCurrentPage(1); }}
                >
                  <option value="">-- คณะทั้งหมด --</option>
                  {faculty.map((f) => <option key={f.faculty_id} value={f.faculty_id}>{f.faculty_name}</option>)}
                </select>

                <select
                  className="w-full md:w-56 px-5 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#b6b6b6] bg-[#F6F6F4] text-black disabled:bg-gray-100 disabled:text-gray-400"
                  value={filterMajorId}
                  disabled={!filterFacultyId}
                  onChange={(e) => { setFilterMajorId(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">-- สาขาทั้งหมด --</option>
                  {filterMajorsToShow.map((m) => <option key={m.major_id} value={m.major_id}>{m.major_name}</option>)}
                </select>
              </div>

              <button
                onClick={() => { setSelectedTeacher(null); setShowModal(true); }}
                className="bg-[#3D42D3] hover:bg-[#2b28a0] text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                อัพโหลดรายชื่อ
              </button>
            </div>

            {/* 🟢 Table Wrapper: ใช้ flex-1 และ overflow-auto เพื่อให้ตารางเลื่อนได้ในกรอบที่เหลือ */}
            <div className="h-full overflow-y-auto overflow-x-auto relative shadow-inner border border-gray-300 rounded-lg"> {/* 🟢 เพิ่ม border รอบนอก */}
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead className="bg-[#f2f2f2] sticky top-0 z-[30] text-gray-700 font-semibold">
                  <tr>
                    {/* 1. รหัสประจำตัว (Sticky ซ้ายสุด) */}
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 whitespace-nowrap sticky left-0 z-40 bg-[#f2f2f2] w-[140px] min-w-[140px]">
                      รหัสประจำตัว
                    </th>
                    
                    {/* 2. ชื่อ - นามสกุล (Sticky ถัดมา) */}
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[220px] sticky left-[140px] z-40 bg-[#f2f2f2]">
                      ชื่อ - นามสกุล
                    </th>

                    {/* คอลัมน์ทั่วไป */}
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[200px]">คณะ</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[200px]">สาขา</th>
                    
                    {/* 3. จัดการ (Sticky ขวาสุด) */}
                    <th className="text-center px-4 py-3 border-b border-gray-300 w-[120px] sticky right-0 z-40 bg-[#f2f2f2]">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentTeachers.length === 0 ? (
                    <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-gray-500 border-b border-gray-300">
                            {searchTerm || filterFacultyId || filterMajorId
                                ? "ไม่พบข้อมูลที่ค้นหา"
                                : "ไม่พบข้อมูลอาจารย์"}
                        </td>
                    </tr>
                  ) : (
                    currentTeachers.map((t) => (
                      <tr key={t.id} onClick={() => handleClick(t)} className="hover:bg-gray-50 cursor-pointer transition-colors duration-150 group">
                        
                        {/* 1. รหัสประจำตัว (Sticky Body) */}
                        <td className="px-4 py-3 border-b border-r border-gray-300 font-semibold text-gray-700">
                          {t.teacherId}
                        </td>

                        {/* 2. ชื่อ (Sticky Body) */}
                        <td className="px-4 py-3 border-b border-r border-gray-300 font-semibold text-gray-900">
                          {t.fullname}
                        </td>

                        {/* ข้อมูลทั่วไป */}
                        <td className="px-4 py-3 border-b border-r border-gray-300">{t.faculty}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300">{t.major}</td>

                        {/* 3. จัดการ (Sticky Body) */}
                        <td className="px-4 py-3 border-b border-gray-300 text-center]">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                                onClick={(e) => handleEditClick(e, t)} 
                                className="text-blue-600 hover:text-blue-800 p-1.5 rounded-md hover:bg-blue-100 transition-all duration-200 hover:scale-110"
                                title="แก้ไขข้อมูล"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button 
                                onClick={(e) => handleDeleteClick(e, t.id)} 
                                className="text-red-600 hover:text-red-800 p-1.5 rounded-md hover:bg-red-100 transition-all duration-200 hover:scale-110"
                                title="ลบข้อมูล"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination (Shrink เพื่อไม่ให้ดันตาราง) */}
            <div className="flex justify-center mt-4 pb-2 shrink-0">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredTeachers.length}
                showSizeChanger
                pageSizeOptions={["5", "10", "20", "50", "100"]}
                onChange={handlePaginationChange}
                showTotal={(total) => `ทั้งหมด ${total} รายการ`}
              />
            </div>
          </div>
        </div>
      </main>

      <TeacherActionModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => fetchTeachers()} 
        teacherData={selectedTeacher}
        facultyList={faculty}
      />
    </div>
  );
};

export default AdminTeachers;