import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabase";
import toast from "react-hot-toast";

const Schedule = () => {
    const navigate = useNavigate();
    const [schedule, setSchedule] = useState([]);
    const [teacherInfo, setTeacherInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    // กำหนดวันและช่องเวลา
    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16]; // 8:00 ถึง 16:00

    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);

            try {
                // --- 1. ตรวจสอบการ Login ---
                const token = localStorage.getItem("token");
                const role = localStorage.getItem("role");
                const teacherCode = localStorage.getItem("teacher_id");
                const teacherFullname = localStorage.getItem("fullname");

                if (!token || role !== "teacher" || !teacherCode) {
                    toast.error("กรุณาเข้าสู่ระบบในฐานะอาจารย์ก่อน");
                    navigate("/");
                    return;
                }

                // --- 2. ดึงข้อมูลชื่ออาจารย์ ---
                let finalTeacherName = teacherFullname;
                const { data: teacherData, error: teacherError } = await supabase
                    .from("teacher")
                    .select("first_name, last_name")
                    .eq("teacher_id", teacherCode)
                    .single();

                if (teacherData) {
                    finalTeacherName = `${teacherData.first_name} ${teacherData.last_name}`;
                } else if (teacherError && teacherError.code !== "PGRST116") {
                    console.warn("Teacher data fetch warning:", teacherError.message);
                }
                
                // --- 3. ดึงตารางสอน ---
                const { data: scheduleData, error: scheduleError } = await supabase
                    .from("class_schedule")
                    .select("*")
                    .eq("teacher_id", teacherCode);

                if (scheduleError) throw new Error("ไม่สามารถดึงตารางสอนได้: " + scheduleError.message);

                // --- 4. ตั้งค่า State ---
                const info = {
                    name: finalTeacherName,
                    year: (scheduleData && scheduleData.length > 0) ? scheduleData[0].year : "2568", 
                    semester: (scheduleData && scheduleData.length > 0) ? scheduleData[0].semester : "1",
                };

                setSchedule(scheduleData || []);
                setTeacherInfo(info);

            } catch (err) {
                console.error("Error fetching schedule:", err);
                toast.error(err.message || "เกิดข้อผิดพลาดในการดึงข้อมูล");
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [navigate]);

    // นำทางไปยังหน้า Record
    const handleCourseClick = (subjectId) => {
        navigate(`/user/Record/${subjectId}`);
    };

    // Function สร้าง Body ของตาราง (รวม ColSpan และรองรับการทับซ้อน)
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

        if (!teacherInfo || schedule.length === 0) {
            return (
                <tr>
                    <td colSpan="10" className="text-center p-8 text-gray-500">
                        {teacherInfo ? `ไม่พบข้อมูลตารางสอนสำหรับ อ. ${teacherInfo.name}` : "ไม่พบข้อมูลอาจารย์"}
                    </td>
                </tr>
            );
        }

        return days.map((day) => {
            // กรองและจัดเรียงคาบสอนสำหรับวันนี้
            const classesForDay = schedule
                .filter((item) => String(item.day).trim() === day)
                .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

            const cells = [];
            let slotIndex = 0;

            while (slotIndex < timeSlots.length) {
                const currentSlotHour = timeSlots[slotIndex];
                
                // 1. ค้นหาวิชาทั้งหมดที่ 'เริ่มต้น' ในช่วงเวลาปัจจุบัน
                const startingClasses = classesForDay.filter(
                    (c) => c.start_time && parseInt(c.start_time.split(":")[0]) === currentSlotHour
                );

                if (startingClasses.length > 0) {
                    // 2. คำนวณ ColSpan ที่ใหญ่ที่สุด
                    let maxColSpan = 1;
                    let longestClass = startingClasses[0]; 

                    startingClasses.forEach(classItem => {
                        const startHour = parseInt(classItem.start_time.split(":")[0]);
                        // ใช้ Math.ceil เพื่อปัดเศษขึ้น หากเวลาสิ้นสุดไม่ใช่ชั่วโมงเต็ม (เช่น 11:30 จะนับถึง 12:00)
                        const endHourStr = classItem.end_time || `${startHour + 1}:00`;
                        const endHourPart = parseInt(endHourStr.split(":")[0]);
                        const endMinutePart = parseInt(endHourStr.split(":")[1] || "0");
                        
                        // ถ้านาที > 0 ให้ปัดชั่วโมงขึ้นไปอีก 1 ชั่วโมง (เพื่อให้ครอบคลุมช่องเวลา)
                        let endHour = endHourPart + (endMinutePart > 0 ? 1 : 0);
                        
                        let colSpan = endHour - startHour;
                        
                        // ปรับให้ colSpan ไม่เกินขอบเขตของตารางเวลาที่เหลืออยู่
                        if (slotIndex + colSpan > timeSlots.length) {
                            colSpan = timeSlots.length - slotIndex;
                        }

                        if (colSpan > maxColSpan) {
                            maxColSpan = colSpan;
                            longestClass = classItem;
                        }
                    });

                    // ตรวจสอบให้แน่ใจว่า ColSpan ไม่เป็น 0 หรือค่าลบ
                    const finalColSpan = maxColSpan > 0 ? maxColSpan : 1;
                    
                    // 3. สร้าง Cell สำหรับคาบสอนที่ทับซ้อน/รวมแล้ว
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
                    
                    // 4. ข้ามช่องเวลาตาม colSpan ที่คำนวณได้
                    slotIndex += finalColSpan;
                } else {
                    // 5. ช่องว่าง (Empty slot)
                    cells.push(
                        <td key={`${day}-${currentSlotHour}`} className="border border-gray-300 bg-white/50"></td>
                    );
                    slotIndex++;
                }
            }

            return (
                <tr key={day}>
                    <td className="bg-gray-100 border border-gray-300 p-2 font-semibold text-gray-700">{day}</td>
                    {cells}
                </tr>
            );
        });
    };

    return (
        <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 h-full w-full">
            
            <h2 className="flex items-center space-x-2 text-lg font-semibold text-black mb-4">
                <span>📅</span>
                <span>
                    ตารางสอน {teacherInfo && `(อ. ${teacherInfo.name})`}
                </span>
            </h2>

            {teacherInfo && (
                <h2 className="flex justify-center items-center gap-20 mb-6 text-sm sm:text-base">
                    <div className="flex gap-2">
                        <span>ปีการศึกษา</span>
                        <b className="text-[#38A738] underline">{teacherInfo.year}</b>
                    </div>
                    <div className="flex gap-2">
                        <span>ภาคการศึกษา</span>
                        <b className="text-[#38A738] underline">{teacherInfo.semester}</b>
                    </div>
                </h2>
            )}
            {/* กำหนดหัวตาราง */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-center border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-200 text-gray-700">
                            <th className="border border-gray-300 p-2 w-24">วัน / เวลา</th>
                            {timeSlots.map((t) => (
                                <th key={t} className="border border-gray-300 p-0.5 text-xs sm:text-sm">
                                    {t}:00 - {t + 1}:00
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {renderTableBody()}
                    </tbody>
                </table>
            </div>
            
            {/* หมายเหตุเพิ่มเติม */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
                <p className="font-semibold mb-1">* หมายเหตุ</p>
                <ul className="list-disc list-inside space-y-1">
                    <li>คลิกที่แถบวิชาเพื่อทำการ <b>บันทึกการสอน (Record)</b></li>
                    <li>ข้อมูลตารางสอนมีการเปลี่ยนแปลงทุุกภาคเทอม</li>
                </ul>
            </div>
        </div>
    );
};

export default Schedule;