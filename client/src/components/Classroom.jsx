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

      // เวลาเริ่ม 8:00 (480 นาที) ถึง 17:00 (1020 นาที) = 540 นาที
    const START_MINUTES = 8 * 60;
    const TOTAL_MINUTES = 9 * 60; 

    // แปลงเวลา "HH:MM" เป็นนาที
    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
    };
    
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

        const teacherCode = teacherData.teacher_id;
        const teacherName = `${teacherData.first_name} ${teacherData.last_name}`;

        // --- 2. ดึงตารางสอนโดยใช้ 'teacherCode' ---
        const { data: scheduleData, error: scheduleError } = await supabase
          .from("class_schedule")
          .select("*")
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

   // ✅ แก้ไขส่วน renderTableBody ให้รองรับการซ้อนกัน
    const renderTableBody = () => {
        if (loading) return <tr><td colSpan="10" className="p-8 text-center text-gray-500">กำลังโหลด...</td></tr>;
        if (schedule.length === 0) return <tr><td colSpan="10" className="p-8 text-center text-gray-500">ไม่พบข้อมูล</td></tr>;

        return days.map((day) => {
            // ดึงวิชาของวันนี้
            const classes = schedule
                .filter((item) => String(item.day).trim() === day)
                .sort((a, b) => a.start_time.localeCompare(b.start_time));

            return (
                <tr key={day} className="h-24 border-b border-gray-200">
                    <td className="bg-gray-100 border-r border-gray-300 p-2 font-semibold text-gray-700 w-24 align-middle">
                        {day}
                    </td>

                    <td colSpan={9} className="p-0 relative align-top h-full">
                        {/* 1. Grid พื้นหลัง */}
                        <div className="absolute inset-0 flex w-full h-full pointer-events-none z-0">
                            {timeSlots.map((_, i) => (
                                <div key={i} className={`flex-1 border-r border-gray-200 ${i === timeSlots.length - 1 ? 'border-none' : ''}`}></div>
                            ))}
                        </div>

                        {/* 2. กล่องวิชา (คำนวณการซ้อนทับ) */}
                        <div className="relative w-full h-full min-h-[96px] z-10"> 
                            {classes.map((item, idx) => {
                                // A. คำนวณตำแหน่งแนวนอน (ซ้าย/ขวา)
                                const startMin = timeToMinutes(item.start_time);
                                const endMin = timeToMinutes(item.end_time);
                                const duration = endMin - startMin;
                                const widthPercent = (duration / TOTAL_MINUTES) * 100;
                                const leftPercent = ((startMin - START_MINUTES) / TOTAL_MINUTES) * 100;

                                // B. 🟢 คำนวณตำแหน่งแนวตั้ง (บน/ล่าง) กรณีชนกัน
                                // หาเพื่อนที่เวลาชนกับเราเป๊ะๆ (Same Start & Same End)
                                const overlappingItems = classes.filter(c => 
                                    c.start_time === item.start_time && c.end_time === item.end_time
                                );
                                
                                const totalOverlaps = overlappingItems.length;
                                const myIndexInOverlap = overlappingItems.indexOf(item); // เราเป็นคนที่เท่าไหร่ในกลุ่มที่ชนกัน

                                // ถ้าชนกัน 2 วิชา -> สูงคนละ 50%, top 0% กับ 50%
                                // ถ้าชนกัน 3 วิชา -> สูงคนละ 33.3%, top 0%, 33%, 66%
                                const heightPercent = 100 / totalOverlaps;
                                const topPercent = heightPercent * myIndexInOverlap;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleCourseClick(item.subject_id)}
                                        // 🟢 เอา absolute top/bottom ออก แล้วใช้ style คุมแทน
                                        className="absolute bg-yellow-400 hover:bg-orange-500 hover:text-white 
                                                   border border-gray-300 shadow-sm cursor-pointer 
                                                   flex flex-col justify-center items-center text-center 
                                                   rounded-sm overflow-hidden p-1 transition-all hover:z-50"
                                        style={{
                                            left: `${leftPercent}%`,
                                            width: `${widthPercent}%`,
                                            
                                            // 🟢 กำหนดความสูงและตำแหน่งแนวตั้ง
                                            height: `${heightPercent}%`,
                                            top: `${topPercent}%`,
                                            
                                            // เพิ่ม z-index เล็กน้อยตามลำดับเพื่อไม่ให้เงาบังกันเอง
                                            zIndex: 10 + myIndexInOverlap 
                                        }}
                                        title={`${item.subject_name} (${item.start_time} - ${item.end_time})`}
                                    >
                                        <div className="flex flex-col justify-center h-full w-full">
                                            <u className="font-bold text-m">{item.subject_id}</u>
                                            <span className="font-medium text-[13px] truncate w-full px-1 block">
                                                {item.subject_name || "(ไม่มีชื่อ)"}
                                            </span>
                                            {/* ถ้าซ้อนกันเยอะ ซ่อนรายละเอียดบางอย่าง */}
                                            {totalOverlaps <= 2 && (
                                                <div className="text-[11px] leading-tight mt-0.5 opacity-90 hidden sm:block ">
                                                    <div>กลุ่ม {item.group} | {item.room}</div>
                                                    <div>[{item.start_time} - {item.end_time}]</div>
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

  //     return (
  //       <tr key={day}>
  //         <td className="bg-gray-100 border border-gray-300 p-1">{day}</td>
  //         {cells}
  //       </tr>
  //     );
  //   });
  // };

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
            {renderTableBody()}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Classroom;