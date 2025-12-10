import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../config/supabase";
import toast from "react-hot-toast";

const Classroom = () => {
  const { id } = useParams();
  const [schedule, setSchedule] = useState([]);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // [ส่วนที่ 1] เพิ่ม State สำหรับเลือกเทอม
  const [selectedTerm, setSelectedTerm] = useState("1");

  const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
  const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16];
  const START_MINUTES = 8 * 60;
  const TOTAL_MINUTES = 9 * 60;

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  // [ส่วนที่ 2] เพิ่ม selectedTerm ใน dependency array
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!id) return;
      setLoading(true);

      try {
        const { data: teacherData, error: teacherError } = await supabase
          .from("teacher")
          .select("teacher_id, first_name, last_name")
          .eq("id", id)
          .single();

        if (teacherError) throw new Error("ไม่พบข้อมูลอาจารย์: " + teacherError.message);
        if (!teacherData) throw new Error("ไม่พบข้อมูลอาจารย์");

        const teacherCode = teacherData.teacher_id;
        const teacherName = `${teacherData.first_name} ${teacherData.last_name}`;

        // [ส่วนที่ 3] เพิ่มเงื่อนไข .eq("semester", selectedTerm)
        const { data: scheduleData, error: scheduleError } = await supabase
          .from("class_schedule")
          .select("*")
          .eq("teacher_id", teacherCode)
          .eq("semester", selectedTerm); // กรองตามเทอมที่เลือก

        if (scheduleError) throw new Error("ไม่สามารถดึงตารางสอนได้: " + scheduleError.message);

        // อัปเดตข้อมูล (ใช้ปีจากข้อมูลที่ดึงมา หรือ default แต่ใช้เทอมจาก state)
        if (scheduleData && scheduleData.length > 0) {
          setSchedule(scheduleData);
          setTeacherInfo({
            name: teacherName, // ใช้ชื่อที่ดึงมาเองชัวร์กว่า
            year: scheduleData[0].year,
            semester: selectedTerm,
          });
        } else {
          setSchedule([]);
          setTeacherInfo({
            name: teacherName,
            year: "2568",
            semester: selectedTerm,
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
  }, [id, selectedTerm]); // เมื่อ id หรือ selectedTerm เปลี่ยน ให้โหลดใหม่

  const handleCourseClick = (subjectId) => {
    console.log("คลิกวิชา:", subjectId);
  };

  const renderTableBody = () => {
    if (loading) return <tr><td colSpan="10" className="p-8 text-center text-gray-500">กำลังโหลด...</td></tr>;
    if (schedule.length === 0) return <tr><td colSpan="10" className="p-8 text-center text-gray-500">ไม่พบข้อมูลในเทอม {selectedTerm}</td></tr>;

    return days.map((day) => {
        const classes = schedule
            .filter((item) => String(item.day).trim() === day)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

        return (
            <tr key={day} className="h-24 border-b border-gray-200">
                <td className="bg-gray-100 border-r border-gray-300 p-2 font-semibold text-gray-700 w-24 align-middle">
                    {day}
                </td>
                <td colSpan={9} className="p-0 relative align-top h-full">
                    <div className="absolute inset-0 flex w-full h-full pointer-events-none z-0">
                        {timeSlots.map((_, i) => (
                            <div key={i} className={`flex-1 border-r border-gray-200 ${i === timeSlots.length - 1 ? 'border-none' : ''}`}></div>
                        ))}
                    </div>
                    <div className="relative w-full h-full min-h-[96px] z-10"> 
                        {classes.map((item, idx) => {
                            const startMin = timeToMinutes(item.start_time);
                            const endMin = timeToMinutes(item.end_time);
                            const duration = endMin - startMin;
                            const widthPercent = (duration / TOTAL_MINUTES) * 100;
                            const leftPercent = ((startMin - START_MINUTES) / TOTAL_MINUTES) * 100;
                            const overlappingItems = classes.filter(c => 
                                c.start_time === item.start_time && c.end_time === item.end_time
                            );
                            const totalOverlaps = overlappingItems.length;
                            const myIndexInOverlap = overlappingItems.indexOf(item);
                            const heightPercent = 100 / totalOverlaps;
                            const topPercent = heightPercent * myIndexInOverlap;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleCourseClick(item.subject_id)}
                                    className="absolute bg-yellow-400 hover:bg-orange-500 hover:text-white 
                                               border border-gray-300 shadow-sm cursor-pointer 
                                               flex flex-col justify-center items-center text-center 
                                               rounded-sm overflow-hidden p-1 transition-all hover:z-50"
                                    style={{
                                        left: `${leftPercent}%`,
                                        width: `${widthPercent}%`,
                                        height: `${heightPercent}%`,
                                        top: `${topPercent}%`,
                                        zIndex: 10 + myIndexInOverlap 
                                    }}
                                    title={`${item.subject_name} (${item.start_time} - ${item.end_time})`}
                                >
                                    <div className="flex flex-col justify-center h-full w-full">
                                        <u className="font-bold text-m">{item.subject_id}</u>
                                        <span className="font-medium text-[13px] truncate w-full px-1 block">
                                            {item.subject_name || "(ไม่มีชื่อ)"}
                                        </span>
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
          <div className="flex gap-2">
             <span>ปีการศึกษา </span>
             <b className="text-[#38A738]"><u>{teacherInfo ? teacherInfo.year : "..."}</u></b>
          </div>
          
          {/* [ส่วนที่ 4] แก้ไข UI ส่วนเลือกภาคการศึกษา */}
          <div className="flex gap-2 items-center">
             <span>ภาคการศึกษา</span>
             <div className="flex space-x-2 bg-gray-100 px-2 py-1 rounded-lg">
                {["1", "2", "3"].map((term) => (
                    <button
                        key={term}
                        onClick={() => setSelectedTerm(term)}
                        className={`font-bold px-2 rounded-md transition-all ${
                            selectedTerm === term
                                ? "text-[#38A738] underline cursor-default bg-white shadow-sm"
                                : "text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        {term}
                    </button>
                ))}
             </div>
          </div>
        </h2>

        <table className="w-full text-center border-collapse border border-gray-300 mt-10 table-fixed">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-300 p-0.5 w-24">Day/Time</th>
              {timeSlots.map((t) => (
                  <th key={t} className="border border-gray-300 p-0.5">
                      {t}:00-{t+1}:00
                  </th>
              ))}
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