import React, { useState, useEffect, useMemo } from "react";
import AdminNavbar from "../../components/AdminNavbar"; 
import { Pagination, Select } from "antd"; // 🟢 เพิ่ม Select ของ Antd
import toast, { Toaster } from "react-hot-toast"; 
import { supabase } from "../../config/supabase.js"; 

import { UploadScheduleAction, EditScheduleAction } from "../../components/ScheduleAction.jsx";
import { AddSubjectAction } from "../../components/AddSubjectAction.jsx";

const AdminTeachingSchedule = () => {
  // --- State Management ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  const [schedules, setSchedules] = useState([]);      
  const [subjectList, setSubjectList] = useState([]);  
  const [teacherList, setTeacherList] = useState([]);  
  const [groupedSubjects, setGroupedSubjects] = useState({}); 
  const [isLoading, setIsLoading] = useState(false);   

  const [currentPage, setCurrentPage] = useState(1);   
  const [pageSize, setPageSize] = useState(10);        
  const [searchTerm, setSearchTerm] = useState("");    

  // 🟢 Filter State
  const [filterTeacher, setFilterTeacher] = useState(null); // เปลี่ยนเป็น null เพื่อรองรับการ clear
  const [isFilterFocused, setIsFilterFocused] = useState(false); // 🟢 State สำหรับ Animation Label

  // --- FETCHING DATA FUNCTIONS ---
  const fetchTeachers = async () => {
    const { data, error } = await supabase.from("teacher").select(`id, first_name, last_name, teacher_id`);
    if (error) console.error("Error fetching teachers:", error);
    else {
      const formattedTeachers = data.map((t) => ({
        value: t.teacher_id,
        label: `${t.first_name} ${t.last_name} (${t.teacher_id})`, // search จากชื่อหรือรหัสได้
        fullName: `${t.first_name} ${t.last_name}`,
        teacherId: t.teacher_id,
      }));
      setTeacherList(formattedTeachers);
    }
  };

  const fetchSubjects = async () => {
    const { data, error } = await supabase.from("subjects").select("subject_id, subject_name, credit, category");
    if (error) console.error("Error fetching subjects:", error);
    else {
      setSubjectList(data); 
      groupSubjectsByCategory(data); 
    }
  };

  const groupSubjectsByCategory = (subjects) => {
    const grouped = subjects.reduce((acc, subject) => {
      const category = subject.category || "ไม่ระบุหมวดหมู่";
      if (!acc[category]) acc[category] = [];
      acc[category].push(subject);
      return acc;
    }, {});
    setGroupedSubjects(grouped);
  };

  const fetchSchedules = async () => {
    setIsLoading(true); 
    try {
      const { data, error } = await supabase.from("class_schedule").select(`*`);

      if (error) {
        toast.error("เกิดข้อผิดพลาดในการดึงข้อมูลตารางสอน ⚠️");
        setSchedules([]);
        return;
      }

      const formattedSchedules = data.map((schedule) => {
        const teacherDisplay = schedule.teacher_name || schedule.teacher_id || "- ไม่พบอาจารย์ -";
        return {
          id: schedule.class_schedule_id,
          code: schedule.subject_id,
          name: schedule.subject_name || "-",
          year: schedule.year,
          semester: schedule.semester,
          group: schedule.group,
          day: schedule.day,
          time: `${schedule.start_time ? schedule.start_time.substring(0, 5) : ""} - ${
            schedule.end_time ? schedule.end_time.substring(0, 5) : ""
          }`,
          room: schedule.room,
          building: schedule.building,
          credit: schedule.credit,
          teacher: teacherDisplay,
          teacherIdRaw: schedule.teacher_id, 
          startTimeStr: schedule.start_time,
          endTimeStr: schedule.end_time,
        };
      });

      setSchedules(formattedSchedules);
    } catch (error) {
      console.error("Fetch Schedules error:", error);
      toast.error("เกิดข้อผิดพลาดในการประมวลผลข้อมูล");
    } finally {
      setIsLoading(false); 
    }
  };

  // --- ACTION HANDLERS ---
  const handleEditClick = (schedule) => {
    setSelectedSchedule(schedule);
    setShowEditModal(true);
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm("คุณต้องการลบตารางสอนนี้ใช่หรือไม่? ⚠️")) {
        const { error } = await supabase.from("class_schedule").delete().eq("class_schedule_id", id);
        if (error) toast.error("ลบข้อมูลไม่สำเร็จ ❌");
        else {
            toast.success("ลบข้อมูลเรียบร้อย ✅");
            fetchSchedules(); 
        }
    }
  };

  useEffect(() => {
    fetchSubjects();
    fetchTeachers();
    fetchSchedules();
  }, []);

  useEffect(() => {
    const isModalOpen = showAddModal || showUploadModal || showEditModal;
    document.body.style.overflow = isModalOpen ? "hidden" : "unset";
    return () => (document.body.style.overflow = "unset");
  }, [showAddModal, showUploadModal, showEditModal]);


  // --- FILTERING LOGIC ---
  const filteredSchedules = schedules.filter((schedule) => {
    const lowerSearchTerm = searchTerm.toLowerCase();

    // 1. กรองคำค้นหา
    const searchMatch = 
      !searchTerm ||
      schedule.code.toLowerCase().includes(lowerSearchTerm) ||
      schedule.name.toLowerCase().includes(lowerSearchTerm) ||
      schedule.teacher.toLowerCase().includes(lowerSearchTerm);

    // 2. กรองอาจารย์ (จาก Dropdown ใหม่)
    const teacherMatch = !filterTeacher || schedule.teacherIdRaw === filterTeacher;

    return searchMatch && teacherMatch;
  });

  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const currentSchedules = filteredSchedules.slice(indexOfFirstItem, indexOfLastItem);

  const handlePaginationChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  // --- RENDERING ---

  return (
    // 🟢 1. Main Container: ใช้ h-screen (เต็มจอ) และ overflow-hidden (ห้าม scroll หน้าหลัก)
    <div className="h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-1 p-4 overflow-hidden">
      <Toaster /> 

      <style>{`
            /* CSS สำหรับ Dropdown ของ Ant Design ให้สวยงาม */
            .ant-select-custom .ant-select-selector {
                background-color: #f9fafb !important;
                border-color: #d1d5db !important;
                border-radius: 9999px !important;
                height: 42px !important;
                display: flex !important;
                align-items: center !important;
                padding-left: 1rem !important;
            }
            .ant-select-custom .ant-select-selector input {
                height: 100% !important;
            }
            .ant-select-custom .ant-select-selection-item {
                line-height: 40px !important;
            }
      `}</style>

      <aside className="w-full md:w-64 shrink-0">
        <AdminNavbar />
      </aside>

      {/* 🟢 2. Content Zone: ใช้ flex-col และ h-full เพื่อให้เนื้อหาข้างในขยายได้ */}
      <main className="flex-1 transition-all lg:pl-[0rem] h-full flex flex-col min-w-0">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-4 w-full h-full flex flex-col mt-5">
          
          

          {/* Header Bar */}
          <div className="w-full bg-white rounded-[15px] border border-[#e9e9e9] shadow-sm h-20 md:h-16 px-6 flex items-center justify-between sticky top-[20px] z-30 shrink-0">
            <h1 className="text-[22px] md:text-[18px] font-semibold">ตารางสอน</h1>
          </div>

          {/* 🟢 3. White Card: ใช้ flex-1 เพื่อให้ยืดเต็มพื้นที่ที่เหลือ (แก้ปัญหาจอเล็ก) */}
          <div className="bg-white mt-4 p-4 rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col flex-1 overflow-hidden">
            
            {/* Toolbar (Search & Filter) */}
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2 shrink-0 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3 flex-wrap w-full xl:w-auto">
                <div className="p-2 font-bold text-gray-800">วิชาสอน</div>
                
                <input
                  type="text"
                  placeholder="🔍 ค้นหา"
                  className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-full bg-[#F6F6F4] focus:outline-none focus:ring-2 focus:ring-[#38A738] h-[42px]"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />

                <div className="relative w-full md:w-64">
                    <Select
                        showSearch
                        allowClear
                        placeholder=" "
                        optionFilterProp="label"
                        value={filterTeacher}
                        onFocus={() => setIsFilterFocused(true)}
                        onBlur={() => setIsFilterFocused(false)}
                        onChange={(val) => { setFilterTeacher(val); setCurrentPage(1); }}
                        options={teacherList}
                        className="ant-select-custom w-full"
                        style={{ height: "42px" }}
                        filterOption={(input, option) =>
                            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                        }
                    />
                    <label className={`absolute left-4 bg-[#f9fafb] px-1 transition-all pointer-events-none rounded-sm z-10
                        ${filterTeacher || isFilterFocused 
                            ? "-top-2.5 text-xs  text-gray-400 font-medium" 
                            : "top-2.5 text-base text-gray-400"
                        }
                    `}>
                        อาจารย์ผู้สอน
                    </label>
                </div>
              </div>

              <div className="flex gap-2 mt-2 xl:mt-0">
                <button onClick={() => setShowAddModal(true)} className="bg-[#38A738] hover:bg-[#2d7c2d] text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
                  เพิ่มรายวิชา
                </button>
                <button onClick={() => setShowUploadModal(true)} className="bg-[#3D42D3] hover:bg-[#2b28a0] text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
                  อัพโหลดตารางสอน
                </button>
              </div>
            </div>

            {/* 🟢 4. Table Wrapper: ใช้ flex-1 และ overflow-auto (ลบ h- fixed ออก) */}
            {/* min-h-0 สำคัญมาก เพื่อให้ flex item หดตัวได้ใน Firefox/Safari */}
            <div className="flex-1 overflow-y-auto overflow-x-auto relative shadow-inner border border-gray-300 rounded-lg min-h-0">
              <table className="min-w-full border-separate border-spacing-0 text-sm"> 
                <thead className="bg-[#f2f2f2] sticky top-0 z-[30] text-gray-700 font-semibold"> 
                  <tr>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 whitespace-nowrap sticky left-0 z-40 bg-[#f2f2f2] w-[120px] min-w-[120px]">รหัสวิชา</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[250px] sticky left-[120px] z-40 bg-[#f2f2f2] shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]">ชื่อวิชา</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[40px]">ปี</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[40px]">เทอม</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[40px]">กลุ่ม</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[80px]">วัน</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[120px] whitespace-nowrap">เวลา</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[100px]">ห้อง</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[60px]">ตึก</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[80px]">หน่วยกิต</th>
                    <th className="text-center px-4 py-3 border-b border-r border-gray-300 min-w-[200px] whitespace-nowrap">ผู้สอน</th>
                    <th className="text-center px-4 py-3 border-b border-gray-300 w-[100px] sticky right-0 z-40 bg-[#f2f2f2] shadow-[-4px_0_5px_-2px_rgba(0,0,0,0.1)]">จัดการ</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr><td colSpan="12" className="px-4 py-8 text-center text-gray-500 border-b border-gray-300">กำลังดึงข้อมูล...</td></tr>
                  ) : currentSchedules.length === 0 ? (
                    <tr><td colSpan="12" className="px-4 py-8 text-center text-gray-500 border-b border-gray-300">ไม่พบข้อมูล</td></tr>
                  ) : (
                    currentSchedules.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 group transition-colors">
                        <td className="px-4 py-3 border-b border-r border-gray-300 sticky left-0 z-20 bg-white group-hover:bg-gray-50 font-semibold text-gray-700">{t.code}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300 sticky left-[120px] z-20 bg-white group-hover:bg-gray-50 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)] font-semibold text-gray-700">{t.name}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300 text-center">{t.year}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300 text-center">{t.semester}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300 text-center">{t.group}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300 text-center">{t.day}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300 text-center font-semibold text-gray-700">{t.time}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300 text-center font-semibold text-gray-700">{t.room}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300 text-center">{t.building}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300 text-center">{t.credit}</td>
                        <td className="px-4 py-3 border-b border-r border-gray-300 font-semibold text-gray-700">{t.teacher}</td>
                        <td className="px-4 py-3 border-b border-gray-300 text-center sticky right-0 z-20 bg-white group-hover:bg-gray-50 shadow-[-4px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center justify-center gap-2">
                             <button onClick={() => handleEditClick(t)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-md hover:bg-blue-100 transition-all hover:scale-110"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                             <button onClick={() => handleDeleteClick(t.id)} className="text-red-600 hover:text-red-800 p-1.5 rounded-md hover:bg-red-100 transition-all hover:scale-110"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination: ให้มันลอยอยู่ด้านล่างเสมอ และไม่ดันตารางจนตกขอบ */}
            <div className="flex justify-center mt-4 pb-2 shrink-0">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredSchedules.length}
                showSizeChanger
                pageSizeOptions={["5", "10", "20", "50", "100"]}
                onChange={handlePaginationChange}
                showTotal={(total) => `ทั้งหมด ${total} รายการ`}
              />
            </div>

          </div>
        </div>
      </main>

      <AddSubjectAction
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        onSuccess={() => fetchSubjects()}
      />

      <UploadScheduleAction
        isOpen={showUploadModal} 
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => fetchSchedules()}
        subjectList={subjectList}
        groupedSubjects={groupedSubjects}
        teacherList={teacherList}
      />

      <EditScheduleAction
        isOpen={showEditModal}
        onClose={() => {
            setShowEditModal(false);
            setSelectedSchedule(null);
        }}
        onSuccess={() => fetchSchedules()}
        scheduleData={selectedSchedule}
        subjectList={subjectList}
        groupedSubjects={groupedSubjects}
        teacherList={teacherList}
      />
    </div>
  );
};

export default AdminTeachingSchedule;