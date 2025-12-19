import React, { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import MyBreadcrumb from "../../components/MyBreadcrumb";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import toast from "react-hot-toast";

const TeachingSchedule = () => {
  const navigate = useNavigate();

  // State
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState("");

  // [เพิ่ม] State เก็บปีและเทอม (Default เทอม 1)
  const [semesterInfo, setSemesterInfo] = useState({
    year: "...",
    semester: "1",
  });
  const [selectedTerm, setSelectedTerm] = useState("1");

  // Constants สำหรับตาราง
  const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
  const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16];

  // Breadcrumb
  const breadcrumbItems = [
    { title: "หน้าหลัก", href: "/user/home" },
    { title: "ตารางสอน", href: "/user/teachingSchedule" },
  ];

  // เวลาเริ่ม 8:00 (480 นาที) ถึง 17:00 (1020 นาที) = 540 นาที
  const START_MINUTES = 8 * 60;
  const TOTAL_MINUTES = 9 * 60;

  // แปลงเวลา "HH:MM" เป็นนาที
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  // [แก้ไข] เพิ่ม selectedTerm ใน dependency array
  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      try {
        const role = localStorage.getItem("role");
        const teacherCode = localStorage.getItem("teacher_id");
        const storedName = localStorage.getItem("fullname");

        if (role !== "teacher" || !teacherCode) {
          toast.error("กรุณาเข้าสู่ระบบในฐานะอาจารย์ก่อน");
          navigate("/");
          return;
        }

        setTeacherName(storedName || "อาจารย์");

        // [แก้ไข] ดึงข้อมูลโดย Filter ตาม semester ที่เลือก (selectedTerm)
        const { data: scheduleData, error: scheduleError } = await supabase
          .from("class_schedule")
          .select("*")
          .eq("teacher_id", teacherCode)
          .eq("semester", selectedTerm); // กรองเทอมตรงนี้

        if (scheduleError) throw scheduleError;

        if (scheduleData && scheduleData.length > 0) {
          setSchedule(scheduleData);
          setSemesterInfo({
            year: scheduleData[0].year,
            semester: selectedTerm,
          });
        } else {
          setSchedule([]);
          // ถ้าไม่มีข้อมูล ให้คงปีไว้ (หรือตั้ง default) แต่เทอมตามที่เลือก
          setSemesterInfo((prev) => ({ ...prev, semester: selectedTerm }));
        }
      } catch (err) {
        console.error("Fetch schedule failed:", err.message);
        toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [navigate, selectedTerm]); // โหลดใหม่เมื่อเปลี่ยนเทอม

  const handleCourseClick = (subjectId, group) => {
    navigate(`/user/Record/${subjectId}/${group}`);
  };


  // [คงเดิมตาม Request] ใช้ Logic Render แบบเดิมเป๊ะๆ
  const renderTableBody = () => {
    if (loading)
      return (
        <tr>
          <td colSpan="10" className="p-8 text-center text-gray-500">
            กำลังโหลด...
          </td>
        </tr>
      );
    if (schedule.length === 0)
      return (
        <tr>
          <td colSpan="10" className="p-8 text-center text-gray-500">
            ไม่พบข้อมูลในเทอม {selectedTerm}
          </td>
        </tr>
      );

    return days.map((day) => {
      const classes = schedule
        .filter((item) => String(item.day).trim() === day)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));

      return (
        <tr key={day} className="h-24 border-b border-gray-200">
          <td className="bg-gray-100 border-r border-gray-300 font-semibold text-gray-700 align-middle text-center w-[100px] p-2">
            {day}
          </td>
          {/* ใช้ colSpan=9 เพื่อคลุม TimeSlots ทั้งหมด */}
          <td colSpan={9} className="p-0 relative align-top h-full w-auto">
            {/* Grid พื้นหลัง */}
            <div className="absolute inset-0 flex w-full h-full pointer-events-none z-0">
              {timeSlots.map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 border-r border-gray-200 ${i === timeSlots.length - 1 ? "border-none" : ""
                    }`}
                ></div>
              ))}
            </div>

            {/* กล่องวิชา */}
            <div className="relative w-full h-full min-h-[96px] z-10">
              {classes.map((item, idx) => {
                const startMin = timeToMinutes(item.start_time);
                const endMin = timeToMinutes(item.end_time);
                const duration = endMin - startMin;
                const widthPercent = (duration / TOTAL_MINUTES) * 100;
                const leftPercent =
                  ((startMin - START_MINUTES) / TOTAL_MINUTES) * 100;

                const overlappingItems = classes.filter(
                  (c) =>
                    c.start_time === item.start_time &&
                    c.end_time === item.end_time
                );
                const totalOverlaps = overlappingItems.length;
                const myIndexInOverlap = overlappingItems.indexOf(item);
                const heightPercent = 100 / totalOverlaps;
                const topPercent = heightPercent * myIndexInOverlap;

                return (
                  <div
                    key={idx}
                    onClick={() => handleCourseClick(item.subject_id, item.group)}
                    className="absolute bg-yellow-400 hover:bg-orange-500 hover:text-white 
                    border border-gray-300 shadow-sm cursor-pointer 
                    flex flex-col justify-center items-center text-center 
                    rounded-sm overflow-hidden p-1 transition-all hover:z-50"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      height: `${heightPercent}%`,
                      top: `${topPercent}%`,
                      zIndex: 10 + myIndexInOverlap,
                    }}
                    title={`${item.subject_name} (${item.start_time} - ${item.end_time})`}
                  >
                    <div className="flex flex-col justify-center h-full w-full">
                      <u className="font-bold text-xs sm:text-m">
                        {item.subject_id}
                      </u>
                      <span className="font-medium text-[10px] md:text-[13px] truncate w-full px-1 block">
                        {item.subject_name || "(ไม่มีชื่อ)"}
                      </span>
                      {totalOverlaps <= 2 && (
                        <div className="text-[9px] md:text-[11px] leading-tight mt-0.5 opacity-90 hidden sm:block ">
                          <div>
                            กลุ่ม {item.group} | {item.room}
                          </div>
                          <div>
                            [{item.start_time.slice(0, 5)} -{" "}
                            {item.end_time.slice(0, 5)}]
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="flex-1 p-6 md:px-10">
        <div className="mb-6">
          <MyBreadcrumb items={breadcrumbItems} />
        </div>

        <div className="max-w-7xl mx-auto">
          {/* Header Card */}
          <div
            className="w-full bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm p-6 mb-4 flex flex-col 
          md:flex-row items-center justify-between"
          >
            <div>
              <h1 className="text-xl font-bold text-black">ตารางสอนของคุณ</h1>
              <p className="text-gray-500 text-sm mt-1">{teacherName}</p>
            </div>

            {/* [แก้ไข] ส่วนแสดงผลข้อมูลปีและปุ่มเลือกเทอม */}
            <div className="mt-4 md:mt-0 flex gap-8 text-sm md:text-base items-center">
              <div className="text-center">
                <span className="block text-gray-500 text-xs">ปีการศึกษา</span>
                <span className="font-bold underline text-[#38A738]">
                  {semesterInfo.year || "2568"}
                </span>
              </div>

              <div className="flex gap-2 items-center">
                <span className="text-gray-500 text-xs md:text-sm">
                  ภาคการศึกษา
                </span>
                <div className="flex space-x-1 bg-gray-100 px-2 py-1 rounded-lg">
                  {["1", "2", "3"].map((term) => (
                    <button
                      key={term}
                      onClick={() => setSelectedTerm(term)}
                      className={`font-bold px-3 py-1 rounded-md transition-all text-xs md:text-sm ${selectedTerm === term
                          ? "text-[#38A738] underline cursor-default bg-white shadow-sm"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 overflow-x-auto">
            {/* [สำคัญ] ใช้โครงสร้าง Table แบบ Fixed ตามที่ต้องการ */}
            <table className="w-full min-w-[800px] border-collapse border border-gray-300 table-fixed">
              <thead>
                <tr className="bg-gray-200 text-gray-700">
                  {/* หัวตาราง Column แรก */}
                  <th className="border border-gray-300 p-2 w-[100px] text-center">
                    วัน / เวลา
                  </th>

                  {/* หัวตาราง Time Slots (วนลูป th ตามต้นฉบับ) */}
                  {timeSlots.map((t) => (
                    <th
                      key={t}
                      className="border border-gray-300 p-1 text-xs sm:text-sm font-semibold text-center"
                    >
                      {t}:00 - {t + 1}:00
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{renderTableBody()}</tbody>
            </table>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
              <p className="font-semibold mb-1">* หมายเหตุ</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  คลิกที่แถบวิชาเพื่อทำการ <b>บันทึกการสอน (Record)</b>
                </li>
                <li>ข้อมูลตารางสอนมีการเปลี่ยนแปลงทุกภาคเทอม</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeachingSchedule;
