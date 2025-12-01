import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";
import { supabase } from "../../config/supabase";
import toast, { Toaster } from "react-hot-toast";
import { Pagination } from "antd";
import Breadcrumbs from "../../components/AdminBreadcrumbs";

<<<<<<< HEAD
// นำเข้าไฟล์ที่แยกไว้
import { TeacherActionModal, deleteTeacher } from "../../components/TeacherAction"; 
=======
import { TeacherActionModal, deleteTeacher } from "../../components/TeacherAction";
>>>>>>> chaianun

// --- Style สำหรับ Custom Scrollbar ---
const scrollbarStyle = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #c1c1c1;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: #a8a8a8;
  }
  /* ทำให้มุมตารางโค้งมนเมื่อมี scrollbar */
  .custom-scrollbar {
     border-radius: 0.5rem; 
  }
`;

// --- 1. Custom Dropdown (เหมือนเดิม) ---
const CustomDropdown = ({ options, value, onChange, placeholder, disabled, searchable = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`relative w-full md:w-64 ${disabled ? "opacity-50 pointer-events-none" : ""}`} ref={containerRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between w-full px-4 py-2 
          bg-[#F6F6F4] border border-gray-300 rounded-full cursor-pointer 
          hover:border-[#38A738] transition-colors
          ${isOpen ? "ring-2 ring-[#38A738] border-[#38A738]" : ""}
        `}
      >
        <span className={`text-sm truncate ${selectedOption ? "text-black" : "text-gray-500"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-[20px] shadow-lg overflow-hidden animate-fadeIn">
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                placeholder="ค้นหา..."
                className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#38A738]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className={`
                    flex items-center justify-between px-3 py-2 text-sm rounded-xl cursor-pointer transition-colors
                    ${value === opt.value ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700 hover:bg-gray-50"}
                  `}
                >
                  <span>{opt.label}</span>
                  {value === opt.value && (
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  )}
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">ไม่พบข้อมูล</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};


// --- 2. Main Component ---
const AdminTeachers = () => {
  const navigate = useNavigate();

  // States
  const [showModal, setShowModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [faculty, setFaculty] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
<<<<<<< HEAD
  const [pageSize, setPageSize] = useState(20);
  
=======
  const [pageSize, setPageSize] = useState(10);

>>>>>>> chaianun
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

  const handlePaginationChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const facultyOptions = faculty.map(f => ({ label: f.faculty_name, value: f.faculty_id }));
  const majorOptions = filterMajorsToShow.map(m => ({ label: m.major_name, value: m.major_id }));

  return (
<<<<<<< HEAD
    // 🟢 Container หลัก: ใช้ h-screen และ overflow-hidden เพื่อกำหนดกรอบตายตัว
    <div className="h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-1 p-4 overflow-hidden">
=======
    // 🟢 1. Container หลัก
    <div className="h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-1 p-4 overflow-hidden">
      <style>{scrollbarStyle}</style>
>>>>>>> chaianun
      <Toaster />

<<<<<<< HEAD
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
=======
      <aside className="w-full md:w-64 flex-shrink-0"> <AdminNavbar /> </aside>

      {/* 🟢 2. Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden lg:pl-[0rem]">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-4 w-full h-full flex flex-col pb-4">

          <div className="mt-5 flex-shrink-0"> <Breadcrumbs /> </div>

          <div className="w-full bg-white rounded-[15px] border border-[#e9e9e9] shadow-sm h-20 md:h-16 px-6 flex items-center justify-between mt-0 flex-shrink-0 sticky top-0 z-20">
            <h1 className="text-[18px] font-semibold text-black">อาจารย์</h1>
          </div>

          {/* 🟢 3. White Box Container */}
          <div className="bg-white mt-4 p-4 rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col flex-1 overflow-hidden min-h-0">

            {/* Toolbar Filter */}
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2 flex-shrink-0">
>>>>>>> chaianun
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2 font-bold text-gray-800">รายชื่ออาจารย์</div>

                <input
                  type="text" placeholder="🔍 ค้นหา"
                  className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-[#F6F6F4] text-black"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
<<<<<<< HEAD
                
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
=======

                <CustomDropdown
                  placeholder="-- คณะทั้งหมด --"
                  options={[{ label: "-- คณะทั้งหมด --", value: "" }, ...facultyOptions]}
                  value={filterFacultyId}
                  onChange={(val) => { setFilterFacultyId(val); setFilterMajorId(""); setCurrentPage(1); }}
                  searchable={true}
                />

                <CustomDropdown
                  placeholder="-- สาขาทั้งหมด --"
                  options={[{ label: "-- สาขาทั้งหมด --", value: "" }, ...majorOptions]}
>>>>>>> chaianun
                  value={filterMajorId}
                  onChange={(val) => { setFilterMajorId(val); setCurrentPage(1); }}
                  disabled={!filterFacultyId}
                  searchable={true}
                />
              </div>

              <button
                onClick={() => { setSelectedTeacher(null); setShowModal(true); }}
                className="bg-[#3D42D3] hover:bg-[#2b28a0] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-transform active:scale-95"
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