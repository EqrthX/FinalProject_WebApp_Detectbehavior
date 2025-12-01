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
          return String(item.day).trim() === day;
        })
        .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

      const cells = [];
      let slotIndex = 0;

      while (slotIndex < timeSlots.length) {
        const currentSlotHour = timeSlots[slotIndex];

        // 1. เปลี่ยนจาก find เป็น filter เพื่อหา 'ทุกวิชา' ที่เริ่มเวลานี้
        const startingClasses = classesForDay.filter(
          (c) => c.start_time && parseInt(c.start_time.split(":")[0]) === currentSlotHour
        );

        if (startingClasses.length > 0) {
          // 2. หาวิชาที่เรียนนานที่สุดในกลุ่มนี้ เพื่อกำหนด colSpan ของ td หลัก
          let maxDuration = 1;
          let longestClass = startingClasses[0]; // ใช้อ้างอิงสำหรับ key หรือข้อมูลหลักหากจำเป็น

          startingClasses.forEach((c) => {
            const s = parseInt(c.start_time.split(":")[0]);
            const e = c.end_time ? parseInt(c.end_time.split(":")[0]) : s + 1;
            const duration = e - s;
            if (duration > maxDuration) {
              maxDuration = duration;
              longestClass = c;
            }
          });

          const finalColSpan = maxDuration;

          // 3. ใช้ Code HTML ที่คุณให้มา
          cells.push(
            <td
              key={longestClass.subject_id + longestClass.group + currentSlotHour}
              colSpan={finalColSpan}
              className="bg-yellow-400 text-xs cursor-pointer transition-all duration-200 border border-gray-300 align-top text-center shadow-sm p-0.5"
              style={{ position: 'relative' }}
            >
              {/* แสดงทุกวิชาที่เริ่มต้น ณ จุดนี้ในเซลล์เดียว */}
              {startingClasses.map((classItem, index) => (
                <div
                  key={classItem.subject_id + classItem.group + index}
                  className={`
                    hover:bg-orange-500 hover:text-white 
                    transition-all duration-200 
                    p-0.5 rounded // 4. ลด padding ภายในเหลือ p-0.5
                    ${index > 0 ? "mt-1 border-t border-yellow-500/50" : ""}
                    ${startingClasses.length > 1 ? "bg-yellow-500/30" : "bg-transparent"}
                  `}
                  onClick={() => handleCourseClick(classItem.subject_id)}
                  title="คลิกเพื่อบันทึกการสอน"
                >
                  <u className="font-bold">{classItem.subject_id}</u> <br />
                  {/* 5. ลดขนาดชื่อวิชา */}
                  <span className="font-medium text-[10px]">
                    {classItem.subject_name || "(ไม่พบชื่อวิชา)"}
                  </span> <br />
                  {/* 6. ลดขนาดกลุ่ม/ห้อง/เวลา ให้เล็กที่สุด */}
                  <span className="text-[9px]">กลุ่ม {classItem.group} | ห้อง {classItem.room}</span> <br />
                  <span className="text-[9px]">[{classItem.start_time} - {classItem.end_time}]</span>
                </div>
              ))}
            </td>
          );

          // ข้าม Slot ตามความยาวของวิชาที่นานที่สุด
          slotIndex += finalColSpan;
        } else {
          // กรณีไม่มีเรียนในเวลานี้
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
            {renderTableBody()}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Classroom;