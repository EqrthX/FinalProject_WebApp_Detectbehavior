import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../config/supabase"; // ตรวจสอบว่า path นี้ถูกต้อง
import toast from "react-hot-toast";

const Classroom = () => {
 const { id } = useParams(); // 'id' นี้คือ UUID ของอาจารย์
 const [schedule, setSchedule] = useState([]);
 const [teacherInfo, setTeacherInfo] = useState(null);
 const [loading, setLoading] = useState(true);

 // กำหนดวันและช่องเวลา (ใช้สำหรับ "สร้าง" แถวตาราง)
 const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
 const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16];

 useEffect(() => {
  const fetchSchedule = async () => {
   if (!id) return;
   setLoading(true);

   try {
    // --- 1. ดึงข้อมูลอาจารย์ (รวมถึง 'teacher_id' ที่เป็นรหัส) ---
    const { data: teacherData, error: teacherError } = await supabase
     .from("teacher")
     .select("teacher_id, first_name, last_name")
     .eq("id", id) // 'id' คือ UUID
     .single();

    if (teacherError) throw new Error("ไม่พบข้อมูลอาจารย์: " + teacherError.message);
    if (!teacherData) throw new Error("ไม่พบข้อมูลอาจารย์");

    const teacherCode = teacherData.teacher_id; // รหัสอาจารย์ (เช่น '6200')
    const teacherName = `${teacherData.first_name} ${teacherData.last_name}`;

    // --- 2. ดึงตารางสอนโดยใช้ 'teacherCode' ---
        // 💡 1. แก้ไขคำสั่ง Select:
        //    (เนื่องจาก subject_name อยู่ในตารางนี้แล้ว)
    const { data: scheduleData, error: scheduleError } = await supabase
     .from("class_schedule")
     .select("*") // <-- ดึงทุกคอลัมน์
     .eq("teacher_id", teacherCode);

    if (scheduleError) throw new Error("ไม่สามารถดึงตารางสอนได้: " + scheduleError.message);

    if (scheduleData && scheduleData.length > 0) {
     setSchedule(scheduleData);
     setTeacherInfo({
      name: scheduleData[0].teacher_name,
      year: scheduleData[0].year,
      semester: scheduleData[0].semester,
     });
    } else {
     setSchedule([]);
     setTeacherInfo({
      name: teacherName,
      year: "2568", // ค่า default
      semester: "1", // ค่า default
     });
    }
   } catch (err) {
    console.error("Error fetching schedule:", err);
    toast.error(err.message || "เกิดข้อผิดพลาดในการดึงข้อมูล");
   } finally {
    setLoading(false);
   }
  };

  fetchSchedule();
 }, [id]);

 const handleCourseClick = (subjectId) => {
  console.log("คลิกวิชา:", subjectId);
 };

 // Function หลักในการสร้างตาราง
 const renderTableBody = () => {
  if (loading) {
   return (
    <tr>
     <td colSpan="10" className="text-center p-8 text-gray-500">
      กำลังโหลดข้อมูลตารางสอน...
     </td>
    </tr>
   );
  }
  if (schedule.length === 0 && teacherInfo) {
   return (
    <tr>
     <td colSpan="10" className="text-center p-8 text-gray-500">
      ไม่พบข้อมูลตารางสอนสำหรับ อ. {teacherInfo.name}
     </td>
    </tr>
   );
  }

  return days.map((day) => {

   const classesForDay = schedule
    .filter((item) => {
     if (!item.day) return false;
     // กรองด้วย String "อังคาร" === "อังคาร"
     return String(item.day).trim() === day;
    })
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

   const cells = [];
   let slotIndex = 0;

   while (slotIndex < timeSlots.length) {
    const currentSlotHour = timeSlots[slotIndex];

    const classItem = classesForDay.find(
     (c) => c.start_time && parseInt(c.start_time.split(":")[0]) === currentSlotHour
    );

    if (classItem) {
     const startHour = parseInt(classItem.start_time.split(":")[0]);
     const endHour = classItem.end_time ? parseInt(classItem.end_time.split(":")[0]) : startHour + 1;

     const colSpan = endHour - startHour;
     const finalColSpan = colSpan > 0 ? colSpan : 1;

     cells.push(
      <td
       key={classItem.subject_id + classItem.group}
       colSpan={finalColSpan}
       className="bg-yellow-400 text-sm cursor-pointer hover:bg-orange-500 transition-colors p-2 border border-gray-300 align-top text-center "
       onClick={() => handleCourseClick(classItem.subject_id)}
      >
                {/* 💡 2. แสดงผลชื่อวิชา (แบบเข้าถึงตรงๆ) */}
       <u>{classItem.subject_id}</u> <br />
                <span >
                  {classItem.subject_name || "(ไม่พบชื่อวิชา)"}
                </span> <br />
       กลุ่ม {classItem.group} | ห้อง {classItem.room} <br />
       [{classItem.start_time} - {classItem.end_time}]
      </td>
     );

     slotIndex += finalColSpan;
    } else {
     cells.push(
      <td
       key={`${day}-${currentSlotHour}`}
       className="border border-gray-300"
      ></td>
     );
     slotIndex++;
    }
   }

   return (
    <tr key={day}>
     <td className="bg-gray-100 border border-gray-300 p-1">{day}</td>
     {cells}
    </tr>
   );
  });
 };

 return (
  <div className="">
   <div className="col-span-2 bg-white rounded-2xl p-6 ">
    <h2 className="flex items-center space-x-2 text-lg font-semibold text-black mb-4">
     <span>📅</span>
     <span>
      ตารางสอน {teacherInfo && `(อ. ${teacherInfo.name})`}
     </span>
    </h2>
    <h2 className="flex justify-center items-center gap-20">
     <span>ปีการศึกษา </span>
     <b>
      <u>{teacherInfo ? teacherInfo.year : "..."}</u>
     </b>
     <span>ภาคการศึกษา</span>
     <b>
      <u>{teacherInfo ? teacherInfo.semester : "..."}</u>
     </b>
    </h2>

    <table className="w-full text-center border-collapse border border-gray-300 mt-10">
     <thead>
      <tr className="bg-gray-200">
       <th className="border border-gray-300 p-0.5">Day/Time</th>
       <th className="border border-gray-300 p-0.5">8:00-9:00</th>
       <th className="border border-gray-300 p-0.5">9:00-10:00</th>
       <th className="border border-gray-300 p-0.5">10:00-11:00</th>
       <th className="border border-gray-300 p-0.5">11:00-12:00</th>
       <th className="border border-gray-300 p-0.5">12:00-13:00</th>
       <th className="border border-gray-300 p-0.5">13:00-14:00</th>
       <th className="border border-gray-300 p-0.5">14:00-15:00</th>
       <th className="border border-gray-300 p-0.5">15:00-16:00</th>
       <th className="border border-gray-300 p-0.5">16:00-17:00</th>
      </tr>
     </thead>
     <tbody>
      {/* Render ตารางแบบไดนามิก */}
      {renderTableBody()}
     </tbody>
    </table>
   </div>
  </div>
 );
};

export default Classroom;