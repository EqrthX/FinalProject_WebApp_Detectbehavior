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
    const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16];

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
                    .select("teacher_id, first_name, last_name")
                    .eq("teacher_id", teacherCode)
                    .single();

                if (teacherError && teacherError.code !== "PGRST116") {
                    console.warn("Teacher data fetch warning:", teacherError.message);
                }

                if (teacherData) {
                    finalTeacherName = `${teacherData.first_name} ${teacherData.last_name}`;
                }

                // --- 3. ดึงตารางสอน ---
                const { data: scheduleData, error: scheduleError } = await supabase
                    .from("class_schedule")
                    .select("*")
                    .eq("teacher_id", teacherCode);

                if (scheduleError) throw new Error("ไม่สามารถดึงตารางสอนได้: " + scheduleError.message);

                // --- 4. ตั้งค่า State ---
                if (scheduleData && scheduleData.length > 0) {
                    setSchedule(scheduleData);
                    setTeacherInfo({
                        name: finalTeacherName, // ใช้ชื่อที่หามาได้
                        year: scheduleData[0].year,
                        semester: scheduleData[0].semester,
                    });
                } else {
                    setSchedule([]);
                    setTeacherInfo({
                        name: finalTeacherName,
                        year: "2568", // Default
                        semester: "1", // Default
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
    }, [navigate]);

    // นำทางไปยังหน้า Record
    const handleCourseClick = (subjectId) => {
        navigate(`/user/Record/${subjectId}`);
    };

    // Function สร้าง Body ของตาราง
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

        if (!teacherInfo) {
            return (
                <tr>
                    <td colSpan="10" className="text-center p-8 text-red-500">
                        ไม่พบข้อมูลอาจารย์
                    </td>
                </tr>
            );
        }

        if (schedule.length === 0) {
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
                .filter((item) => String(item.day).trim() === day)
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
                            className="bg-yellow-400 text-sm cursor-pointer hover:bg-orange-500 hover:text-white transition-all duration-200 p-2 border border-gray-300 align-top text-center shadow-sm"
                            onClick={() => handleCourseClick(classItem.subject_id)}
                            title="คลิกเพื่อบันทึกการสอน"
                        >
                            <u className="font-bold">{classItem.subject_id}</u> <br />
                            <span className="font-medium">
                                {classItem.subject_name || "(ไม่พบชื่อวิชา)"}
                            </span> <br />
                            <span className="text-xs">กลุ่ม {classItem.group} | ห้อง {classItem.room}</span> <br />
                            <span className="text-xs">[{classItem.start_time} - {classItem.end_time}]</span>
                        </td>
                    );
                    slotIndex += finalColSpan;
                } else {
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
        // 🔹 ปรับ CSS Container ให้เหมือน Classroom เป๊ะๆ (Rounded, Shadow, Border)
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

            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-center border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-200 text-gray-700">
                            <th className="border border-gray-300 p-2 w-24">วัน / เวลา</th>
                            {timeSlots.map((t) => (
                                <th key={t} className="border border-gray-300 p-2">
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