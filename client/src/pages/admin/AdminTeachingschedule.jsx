import React, { useState, useEffect } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import { TimePicker, Pagination, Select } from "antd";
import dayjs from "dayjs";
import toast, { Toaster } from "react-hot-toast";

import { supabase } from "../../config/supabase.js";

const AdminTeachers = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [subjectList, setSubjectList] = useState([]);

  // 🔑 NEW: State สำหรับเก็บข้อมูลวิชาที่จัดกลุ่มตาม Category
  const [groupedSubjects, setGroupedSubjects] = useState({});

  // 1. State สำหรับตารางสอนจริง (แทน teachers)
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // States สำหรับ Modal อัพโหลดตารางสอน
  const [selectedCode, setSelectedCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectcredit, setSubjectcredit] = useState("");

  // 🔑 State ใหม่สำหรับรายชื่ออาจารย์ทั้งหมด
  const [teacherList, setTeacherList] = useState([]);

  // 🔑 State Properties ที่ใช้ชื่อคอลัมน์ใน DB (year, semester, group, day)
  const [classSchedule, setClassSchedule] = useState({
    year: "", // DB column name: year
    semester: "", // DB column name: semester
    group: "", // DB column name: group
    day: "", // DB column name: day
    room: "",
    building: "",
    teacher_id: "", // ⬅️ teacher_id (varchar)
    teacher_name: "", // ⬅️ teacher_name (varchar)
    classTimes: null,
  });

  // States สำหรับ Modal เพิ่มรายวิชา
  const [newSubject, setNewSubject] = useState({
    subject_id: "",
    subject_name: "",
    credit: "",
    category: "",
  });

  // 2. State สำหรับ Pagination และ Search
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");

  const format = "HH:mm:ss";

  const disabledRangeTime = (_, type) => {
    // ฟังก์ชันนี้จะกำหนดชั่วโมงที่ห้ามเลือก
    const disabledHours = () => {
      let hours = [];
      // ปิดใช้งานชั่วโมงตั้งแต่ 00:00 ถึง 04:00
      for (let i = 0; i < 8; i++) {
        hours.push(i);
      }
      // ปิดใช้งานชั่วโมงตั้งแต่ 18:00 ถึง 23:00
      for (let i = 18; i < 24; i++) {
        hours.push(i);
      }
      return hours;
    };

    // เราไม่จำเป็นต้องปิดนาที/วินาทีเฉพาะเจาะจงที่ 05:00 หรือ 17:00
    // เพราะเรากำหนดเป็น RangePicker ทั้งคู่จะถูกจำกัดด้วยชั่วโมง
    return {
      disabledHours,
      disabledMinutes: () => [],
      disabledSeconds: () => [],
    };
  };

  // --- FETCHING DATA ---

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from("teacher")
      // ดึง ID (uuid) และ teacher_id (varchar/text) พร้อมชื่อ
      .select(`id, first_name, last_name, teacher_id`);

    if (error) {
      console.error("Error fetching teachers:", error);
    } else {
      const formattedTeachers = data.map((t) => ({
        // 🔑 ใช้ teacher_id (varchar) เป็น value สำหรับ Foreign Key
        value: t.teacher_id,
        // 🔑 ใช้ชื่อเต็มพร้อมรหัสอาจารย์สำหรับการแสดงผลและการค้นหา
        label: `${t.first_name} ${t.last_name} (${t.teacher_id})`,
        fullName: `${t.first_name} ${t.last_name}`,
        teacherId: t.teacher_id,
      }));
      setTeacherList(formattedTeachers);
    }
  };

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      // 🔑 แก้ไข: เพิ่ม category เข้ามาในการ select
      .select("subject_id, subject_name, credit, category"); 

    if (error) console.error("Error fetching subjects:", error);
    else {
      setSubjectList(data);
      // 🔑 เรียกใช้ฟังก์ชันจัดกลุ่มทันที
      groupSubjectsByCategory(data); 
    }
  };

  // 🔑 NEW: ฟังก์ชันสำหรับจัดกลุ่มวิชาตาม Category
  const groupSubjectsByCategory = (subjects) => {
    const grouped = subjects.reduce((acc, subject) => {
      const category = subject.category || "ไม่ระบุหมวดหมู่"; // จัดการกรณีที่ไม่มี category
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(subject);
      return acc;
    }, {});
    setGroupedSubjects(grouped);
  };

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      // 🔑 ดึงข้อมูลทั้งหมดจาก class_schedule โดยไม่ Join (เพราะข้อมูลซ้ำซ้อนถูกเก็บไว้ในตารางนี้แล้ว)
      const { data, error } = await supabase.from("class_schedule").select(`
    class_schedule_id, 
    subject_id, 
    subject_name, 
    year, 
    semester, 
    "group", 
    day, 
    start_time, 
    end_time, 
    room, 
    building, 
    credit, 
    teacher_id, 
    teacher_name
  `);

      if (error) {
        console.error("Supabase Error fetching schedules:", error);
        // 🚨 แสดง Error พร้อมคำแนะนำ RLS
        toast.error(
          "เกิดข้อผิดพลาดในการดึงข้อมูลตารางสอน (ตรวจสอบ RLS Policy) ⚠️"
        );
        setSchedules([]);
        return;
      }

      const formattedSchedules = data.map((schedule) => {
        const teacherDisplay =
          schedule.teacher_name || schedule.teacher_id || "- ไม่พบอาจารย์ -";

        return {
          id: schedule.class_schedule_id,
          code: schedule.subject_id,
          name: schedule.subject_name || "-",
          year: schedule.year,
          semester: schedule.semester,
          group: schedule.group,
          day: schedule.day,
          time: `${
            schedule.start_time ? schedule.start_time.substring(0, 5) : ""
          } - ${schedule.end_time ? schedule.end_time.substring(0, 5) : ""}`,
          room: schedule.room,
          building: schedule.building,
          credit: schedule.credit,
          teacher: teacherDisplay,
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

  useEffect(() => {
    fetchSubjects();
    fetchTeachers();
    fetchSchedules();
  }, []);

  // 🔑 ลบ useEffect ที่เชื่อมกับ teacherList ออก เพราะตอนนี้เราดึงข้อมูลแบบแยกจากกัน

  useEffect(() => {
    const isModalOpen = showAddModal || showUploadModal;
    document.body.style.overflow = isModalOpen ? "hidden" : "unset";
    return () => (document.body.style.overflow = "unset");
  }, [showAddModal, showUploadModal]);

  // --- HANDLERS ---

  const handleAddSubject = async (e) => {
    e.preventDefault();

    if (
      !newSubject.subject_id ||
      !newSubject.subject_name ||
      !newSubject.credit ||
      !newSubject.category
    ) {
      toast.error("กรุณากรอกข้อมูลให้ครบ ⚠️");
      return;
    }

    // 🔑 NEW: ขั้นตอนที่ 1: ตรวจสอบ Subject ID ซ้ำก่อนเพิ่ม 
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
      // 🔑 ถ้าพบข้อมูลซ้ำ ให้แสดงข้อความเตือนและหยุดการทำงาน
      toast.error(`ไม่สามารถเพิ่มได้: รหัสวิชา ${newSubject.subject_id} มีอยู่ในระบบแล้ว ⚠️`);
      return; 
    }
    
    // 🔑 ขั้นตอนที่ 2: ถ้าไม่พบข้อมูลซ้ำ จึงทำการ Insert
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
      setNewSubject({
        subject_id: "",
        subject_name: "",
        credit: "",
        category: "",
      });
      setShowAddModal(false);
      fetchSubjects();
    }
  };

  const handleUploadSchedule = async (e) => {
    e.preventDefault();

    // 🔑 ตรวจสอบ teacher_id และ subjectName
    if (
      !selectedCode ||
      !subjectName ||
      !classSchedule.year ||
      !classSchedule.semester ||
      !classSchedule.group ||
      !classSchedule.day ||
      !classSchedule.room ||
      !classSchedule.building ||
      !classSchedule.teacher_id || // ⬅️ ตรวจสอบ teacher_id
      !classSchedule.teacher_name || // ⬅️ ตรวจสอบ teacher_name
      !classSchedule.classTimes ||
      !classSchedule.classTimes[0] ||
      !classSchedule.classTimes[1]
    ) {
      toast.error("กรุณากรอกข้อมูลตารางสอนให้ครบถ้วน ⚠️");
      return;
    }

    // เตรียมข้อมูลสำหรับ Supabase (ตาราง class_schedule)
    const dataToInsert = {
      subject_id: selectedCode,
      subject_name: subjectName,
      year: classSchedule.year,
      semester: classSchedule.semester,
      group: classSchedule.group,
      day: classSchedule.day,
      room: classSchedule.room,
      building: classSchedule.building,
      teacher_id: classSchedule.teacher_id, // ⬅️ ส่ง teacher_id (รหัสอาจารย์)
      teacher_name: classSchedule.teacher_name, // ⬅️ ส่ง teacher_name
      credit: subjectcredit, // ⬅️ ส่งหน่วยกิต

      start_time: classSchedule.classTimes[0].format(format),
      end_time: classSchedule.classTimes[1].format(format),
    };

    const { error } = await supabase
      .from("class_schedule")
      .insert([dataToInsert]);

    if (error) {
      // 🚨 แสดงข้อความ Error ที่ละเอียดขึ้น
      toast.error(
        `เกิดข้อผิดพลาดในการอัพโหลดตารางสอน: ตรวจสอบ Foreign Key หรือ RLS ❌`
      );
      console.error("Supabase insert error:", error);
    } else {
      toast.success("อัพโหลดตารางสอนสำเร็จ! ✅");

      // รีเซ็ตฟอร์ม
      setSelectedCode("");
      setSubjectName("");
      setSubjectcredit("");
      setClassSchedule({
        year: "",
        semester: "",
        group: "",
        day: "",
        room: "",
        building: "",
        teacher_id: "",
        teacher_name: "",
        classTimes: null,
      });
      setShowUploadModal(false);
      fetchSchedules();
    }
  };

  // --- FILTERING & PAGINATION LOGIC ---
  const filteredSchedules = schedules.filter((schedule) => {
    const lowerSearchTerm = searchTerm.toLowerCase();

    // ค้นหาจาก รหัสวิชา, ชื่อวิชา, อาจารย์ผู้สอน
    return (
      !searchTerm ||
      schedule.code.toLowerCase().includes(lowerSearchTerm) ||
      schedule.name.toLowerCase().includes(lowerSearchTerm) ||
      schedule.teacher.toLowerCase().includes(lowerSearchTerm)
    );
  });

  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const currentSchedules = filteredSchedules.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  const handlePaginationChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  // --- RENDERING ---

  return (
    // 🔑 1. กำหนด h-screen และ overflow-hidden ให้กับ Container ใหญ่สุด เพื่อล็อกจอ
    <div className="h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-4 p-4 overflow-hidden">
      <Toaster />

      <aside className="w-full md:w-64">
        <AdminNavbar />
      </aside>

      {/* --------- MAIN CONTENT --------- */}
      {/* 🔑 2. กำหนด h-full และ overflow-y-auto ให้กับ Main Content เพื่อให้มี Scrollbar ของตัวเอง ถ้าจำเป็น */}
      <div className="flex-1 transition-all lg:pl-[0rem] md:pl-0 sm:pl-0 h-full overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-4">
          {/* Header */}
          <div className="w-full bg-white rounded-[15px] border border-[#e9e9e9] shadow-sm h-20 md:h-16 px-6 flex items-center justify-between sticky top-[20px] z-30">
            <h1 className="text-[22px] md:text-[18px] font-semibold">
              รายวิชา
            </h1>
          </div>

          {/* Main Table Container - เพิ่ม h-full และ flex flex-col เพื่อควบคุมความสูงภายใน */}
          <div className="bg-white mt-9 p-4 rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full">
            {/* TOP BAR */}
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2 sticky top-[90px] z-20 bg-white pb-4 border-b border-gray-100 ml-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2 font-bold text-gray-800">วิชาสอน</div>
                <input
                  type="text"
                  placeholder="🔍 ค้นหา"
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-full bg-[#F6F6F4] focus:outline-none focus:ring-2 focus:ring-[#38A738]"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-[#38A738] hover:bg-[#2d7c2d] text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  เพิ่มรายวิชา
                </button>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-[#3D42D3] hover:bg-[#2b28a0] text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  อัพโหลดตารางสอน
                </button>
              </div>
            </div>

            {/* TABLE - ใช้ flex-1 เพื่อใช้พื้นที่ที่เหลือทั้งหมด และมี scrollbar ในตัวมันเอง */}
            <div className="flex-1 max-h-[560px] overflow-y-auto overflow-x-auto relative">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-[#f2f2f2] sticky top-0 z-[5]">
                  <tr>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      รหัสวิชา
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ชื่อวิชา
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ปีการศึกษา
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ภาคการศึกษา
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      กลุ่ม
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      วัน
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      เวลาเรียน
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ห้องเรียน
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ตึก
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      หน่วยกิต
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      อาจารย์ผู้สอน
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {/* แสดง Loading หรือ ตาราง */}
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan="11"
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        กำลังดึงข้อมูล...
                      </td>
                    </tr>
                  ) : currentSchedules.length === 0 ? (
                    <tr>
                      <td
                        colSpan="11"
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        {searchTerm
                          ? "ไม่พบข้อมูลรายวิชาที่ค้นหา"
                          : "ไม่พบข้อมูลรายวิชา"}
                      </td>
                    </tr>
                  ) : (
                    currentSchedules.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 border border-gray-300">
                          {t.code}
                        </td>
                        <td className="px-4 py-2 border border-gray-300">
                          {t.name}
                        </td>
                        <td className="px-4 py-2 border border-gray-300">
                          {t.year}
                        </td>
                        <td className="px-4 py-2 border border-gray-300">
                          {t.semester}
                        </td>
                        <td className="px-4 py-2 border border-gray-300">
                          {t.group}
                        </td>
                        <td className="px-4 py-2 border border-gray-300">
                          {t.day}
                        </td>
                        <td className="px-4 py-2 border border-gray-300">
                          {t.time}
                        </td>
                        <td className="px-4 py-2 border border-gray-300">
                          {t.room}
                        </td>
                        <td className="px-4 py-2 border border-gray-300">
                          {t.building}
                        </td>
                        <td className="px-4 py-2 border border-gray-300">
                          {t.credit}
                        </td>
                        <td className="px-4 py-2 border border-gray-300">
                          {t.teacher}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 5. Pagination Component */}
            <div className="flex justify-center mt-4 pb-2">
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
      </div>

      {/* ---------------------------------------------------------- */}
      {/* MODAL: เพิ่มรายวิชา                     */}
      {/* ---------------------------------------------------------- */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-xl border border-gray-300">
            <h2 className="text-2xl font-bold mb-6">เพิ่มรายวิชา</h2>

            <form onSubmit={handleAddSubject} className="space-y-4">
              {/* รหัสวิชา (Floating Label Style) */}
              <div className="relative mt-2">
                <input
                  type="text"
                  id="subject_id"
                  required
                  value={newSubject.subject_id}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, subject_id: e.target.value })
                  }
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                  placeholder="รหัสวิชา"
                />
                <label
                  htmlFor="subject_id"
                  className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all
                    peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                    peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                >
                  รหัสวิชา <span className="text-red-500">*</span>
                </label>
              </div>

              {/* ชื่อวิชา (Floating Label Style) */}
              <div className="relative mt-2">
                <input
                  type="text"
                  id="subject_name"
                  required
                  value={newSubject.subject_name}
                  onChange={(e) =>
                    setNewSubject({
                      ...newSubject,
                      subject_name: e.target.value,
                    })
                  }
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                  placeholder="ชื่อวิชา"
                />
                <label
                  htmlFor="subject_name"
                  className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all
                    peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                    peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                >
                  ชื่อวิชา <span className="text-red-500">*</span>
                </label>
              </div>

              {/* หน่วยกิต (Floating Label Style) */}
              <div className="relative mt-2">
                <input
                  type="number"
                  id="credit"
                  required
                  value={newSubject.credit}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, credit: e.target.value })
                  }
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                  placeholder="หน่วยกิต"
                />
                <label
                  htmlFor="credit"
                  className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all
                    peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                    peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                >
                  หน่วยกิต <span className="text-red-500">*</span>
                </label>
              </div>

              <div className="relative">
                <select
                  id="category"
                  required
                  value={newSubject.category}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, category: e.target.value })
                  }
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md 
             focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 
             appearance-none placeholder-transparent"
                >
                  <option value="" disabled></option>
                  <option value="วิชาทั่วไป">วิชาทั่วไป</option>
                  <option value="วิชาเฉพาะ">วิชาเฉพาะ</option>
                  <option value="วิชาเสรี">วิชาเสรี</option>
                </select>
                <label
                  htmlFor="category"
                  className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none
      ${
        // 🔑 แก้ไข: ให้เช็คค่าของ newSubject.category แทน
        newSubject.category 
          ? "-top-2.5 text-gray-400"
          : "top-2.5 text-gray-400"
      }`}
                >
                  เลือกหมวดหมู่ <span className="text-red-500">*</span>
                </label>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                  <svg
                    className="fill-current h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>

              <div className="flex justify-end mt-6 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewSubject({
                      subject_id: "",
                      subject_name: "",
                      credit: "",
                      category: "",
                    });
                  }}
                  className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-[#38A738] text-white rounded-md hover:bg-[#2d7c2d]"
                >
                  เพิ่ม
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-2xl border border-gray-300">
            <h2 className="text-2xl font-bold mb-6">อัพโหลดตารางสอน</h2>

            {/* 🔑 แก้ไข: เพิ่ม onSubmit ให้กับ form */}
            <form
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              onSubmit={handleUploadSchedule}
            >
              {/* 🔑 แก้ไขส่วนนี้เพื่อใช้ groupedSubjects */}
    <select
        className="w-full px-4 py-2 border border-gray-300 rounded-md"
        value={selectedCode}
        onChange={(e) => {
            const code = e.target.value;
            setSelectedCode(code);

            const selected = subjectList.find(
                (item) => item.subject_id === code
            );
            setSubjectName(selected?.subject_name || "");
            setSubjectcredit(selected?.credit || "");
        }}
    >
        <option value="">เลือกรหัสวิชา</option>

        {/* 🔑 NEW: วนลูปผ่าน groupedSubjects เพื่อสร้าง optgroup */}
        {Object.keys(groupedSubjects).map((category) => (
            <optgroup key={category} label={category}>
                {groupedSubjects[category].map((sub) => (
                    <option key={sub.subject_id} value={sub.subject_id}>
                        {sub.subject_id} - {sub.subject_name}
                    </option>
                ))}
            </optgroup>
        ))}

    </select>

              {/* ชื่อวิชา (แสดงผล) */}
              <input
                type="text"
                placeholder="ชื่อวิชา"
                value={subjectName}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-200"
              />

              {/* หน่วยกิต (แสดงผล) */}
              <input
                type="text"
                placeholder="หน่วยกิต"
                value={subjectcredit}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-200"
              />

              {/* 🔑 Select ของ Ant Design สำหรับการค้นหาอาจารย์ */}
              <div className="relative">
                <Select
                  showSearch
                  placeholder=" "
                  optionFilterProp="children"
                  value={classSchedule.teacher_id || undefined}
                  onChange={(selectedId, option) => {
                    const selectedTeacher = teacherList.find(
                      (t) => t.value === selectedId
                    );

                    setClassSchedule({
                      ...classSchedule,
                      teacher_id: selectedId,
                      teacher_name: selectedTeacher
                        ? selectedTeacher.fullName
                        : "",
                    });
                  }}
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={teacherList.map((t) => ({
                    value: t.teacherId,
                    label: t.label,
                    fullName: t.fullName,
                    teacherId: t.teacherId,
                  }))}
                  style={{ width: "100%", height: "42px" }}
                  className="ant-select-custom"
                />
                <label
                  className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none
      ${
        classSchedule.teacher_id
          ? "-top-2.5 text-gray-400"
          : "top-2.5 text-gray-400"
      }`}
                >
                  อาจารย์ผู้สอน<span className="text-red-500"> *</span>
                </label>
              </div>

              {/* 🔑 เพิ่ม: ปีการศึกษา (Year) ที่เห็นในรูป */}
              <div className="relative">
                <input
                  type="text"
                  id="year"
                  required
                  value={classSchedule.year}
                  onChange={(e) =>
                    setClassSchedule({ ...classSchedule, year: e.target.value })
                  }
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                  placeholder="ปีการศึกษา"
                />
                <label
                  htmlFor="year"
                  className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                >
                  ปีการศึกษา<span className="text-red-500"> *</span>
                </label>
              </div>

              {/* ภาคการศึกษา (Dropdown Floating Label Style) */}
              <div className="relative">
                <select
                  id="semester"
                  required
                  value={classSchedule.semester}
                  onChange={(e) =>
                    setClassSchedule({
                      ...classSchedule,
                      semester: e.target.value,
                    })
                  }
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md 
             focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 
             appearance-none placeholder-transparent"
                >
                  <option value="" disabled></option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
                <label
                  htmlFor="semester"
                  className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none
      ${
        classSchedule.semester
          ? "-top-2.5 text-gray-400"
          : "top-2.5 text-gray-400"
      }`}
                >
                  ภาคการศึกษา <span className="text-red-500">*</span>
                </label>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                  <svg
                    className="fill-current h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>

              {/* กลุ่ม (Group) */}
              <div className="relative">
                <input
                  type="text"
                  id="group"
                  required
                  value={classSchedule.group}
                  onChange={(e) =>
                    setClassSchedule({
                      ...classSchedule,
                      group: e.target.value,
                    })
                  }
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                  placeholder="กลุ่ม"
                />
                <label
                  htmlFor="group"
                  className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                >
                  กลุ่ม<span className="text-red-500"> *</span>
                </label>
              </div>

              {/* วัน (จ-อา) (Floating Label Style) */}
              <div className="relative">
                <select
                  id="day"
                  required
                  value={classSchedule.day}
                  onChange={(e) =>
                    setClassSchedule({ ...classSchedule, day: e.target.value })
                  }
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md 
             focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 
             appearance-none placeholder-transparent"
                >
                  <option value="" disabled></option>
                  <option value="จันทร์">จันทร์</option>
                  <option value="อังคาร">อังคาร</option>
                  <option value="พุธ">พุธ</option>
                  <option value="พฤหัสบดี">พฤหัสบดี</option>
                  <option value="ศุกร์">ศุกร์</option>
                  <option value="เสาร์">เสาร์</option>
                  <option value="อาทิตย์">อาทิตย์</option>
                </select>
                <label
                  htmlFor="day"
                  className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none
      ${
        classSchedule.day ? "-top-2.5 text-gray-400 " : "top-2.5 text-gray-400"
      }`}
                >
                  วัน (จ-อา)<span className="text-red-500"> *</span>
                </label>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                  <svg
                    className="fill-current h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>

              <div className="relative">
    <TimePicker.RangePicker
        value={classSchedule.classTimes}
        onChange={(times) =>
            setClassSchedule({
                ...classSchedule,
                classTimes: times || null,
            })
        }
        format={format}
        style={{ width: "100%" }}
        // 🔑 เพิ่ม Prop นี้
        disabledTime={disabledRangeTime} 
        // 🔑 เพิ่ม className เพื่อควบคุมความสูงและ Border
        className="h-[42px] border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
    />
</div>

              {/* ห้องเรียน (Room) */}
              <div className="relative">
                <input
                  type="text"
                  id="room"
                  required
                  value={classSchedule.room}
                  onChange={(e) =>
                    setClassSchedule({ ...classSchedule, room: e.target.value })
                  }
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                  placeholder="ห้องเรียน"
                />
                <label
                  htmlFor="room"
                  className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                >
                  ห้องเรียน<span className="text-red-500"> *</span>
                </label>
              </div>

              {/* ตึก (Building) */}
              <div className="relative">
                <input
                  type="text"
                  id="building"
                  required
                  value={classSchedule.building}
                  onChange={(e) =>
                    setClassSchedule({
                      ...classSchedule,
                      building: e.target.value,
                    })
                  }
                  className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
                  placeholder="ตึก"
                />
                <label
                  htmlFor="building"
                  className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                >
                  ตึก<span className="text-red-500"> *</span>
                </label>
              </div>

              {/* 🔑 ลบ Button ออกจาก form และย้ายไปด้านนอก (Ant Design form Submission มักทำโดย onClick บน Button ภายนอก) */}
            </form>

            <div className="flex justify-end mt-6 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedCode("");
                  setSubjectName("");
                  setSubjectcredit("");
                  setClassSchedule({
                    year: "",
                    semester: "",
                    group: "",
                    day: "",
                    room: "",
                    building: "",
                    teacher_id: "",
                    teacher_name: "",
                    classTimes: null,
                  });
                }}
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                ยกเลิก
              </button>

              <button
                type="submit"
                // 🔑 ต้องเรียก handleUploadSchedule ผ่าน onClick แทนการใช้ type="submit" บน form
                onClick={handleUploadSchedule}
                className="px-5 py-2 bg-[#3F37C9] text-white rounded-md hover:bg-[#2b28a0]"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeachers;
