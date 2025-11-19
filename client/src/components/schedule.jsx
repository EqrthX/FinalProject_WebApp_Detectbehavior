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
                // --- 1. ตรวจสอบการ Login (Auth) โดยใช้ localStorage ---
                const token = localStorage.getItem("token");
                const role = localStorage.getItem("role");
                const teacherCode = localStorage.getItem("teacher_id");
                const teacherFullname = localStorage.getItem("fullname");

                // ตรวจสอบว่ามี Token, Role เป็น Teacher และมี teacher_id หรือไม่
                if (!token || role !== "teacher" || !teacherCode) {
                    toast.error("กรุณาเข้าสู่ระบบในฐานะอาจารย์ก่อน");
                    navigate("/"); // เด้งไปหน้า Login ถ้าไม่ผ่านเงื่อนไข
                    return;
                }

                // 2. ดึงข้อมูลอาจารย์ โดยใช้ teacher_id จาก localStorage ---
                let finalTeacherName = teacherFullname;

                const { data: teacherData, error: teacherError } = await supabase
                    .from("teacher")
                    .select("teacher_id, first_name, last_name")
                    .eq("teacher_id", teacherCode)
                    .single();

                if (teacherError && teacherError.code !== "PGRST116") { // PGRST116: No rows returned
                    throw new Error("ไม่พบข้อมูลอาจารย์ที่ผูกกับรหัสนี้");
                }

                if (teacherData) {
                    finalTeacherName = `${teacherData.first_name} ${teacherData.last_name}`;
                } else if (!teacherFullname) {
                    // กรณีไม่มีข้อมูลในตาราง teacher และไม่มี fullname ใน localStorage
                    throw new Error("ไม่พบข้อมูลอาจารย์");
                }


                // --- 3. ดึงตารางสอนโดยใช้ 'teacherCode' ---
                const { data: scheduleData, error: scheduleError } = await supabase
                    .from("class_schedule")
                    .select("*")
                    .eq("teacher_id", teacherCode);

                if (scheduleError) throw new Error("ไม่สามารถดึงตารางสอนได้: " + scheduleError.message);

                // --- 4. จัดการข้อมูลและตั้งค่า State ---
                if (scheduleData && scheduleData.length > 0) {
                    setSchedule(scheduleData);
                    setTeacherInfo({
                        name: scheduleData[0].teacher_name || finalTeacherName,
                        year: scheduleData[0].year,
                        semester: scheduleData[0].semester,
                    });
                } else {
                    setSchedule([]);
                    // ใช้ข้อมูลจาก localStorage/ที่ดึงมา หากไม่พบตารางสอน
                    setTeacherInfo({
                        name: finalTeacherName,
                        year: "2568",
                        semester: "1",
                    });
                }
            } catch (err) {
                console.error("Error fetching schedule:", err);
                toast.error(err.message || "เกิดข้อผิดพลาดในการดึงข้อมูล");
                // navigate("/");
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [navigate]);

    // *****************************************************************
    // 🚀 แก้ไข: นำทางไปยัง /user/Record/ ตามรหัสวิชาที่ส่งมา
    const handleCourseClick = (subjectId) => {
        console.log("คลิกวิชา:", subjectId);
        // ใช้ navigate เพื่อนำทางไปยังเส้นทางพร้อมรหัสวิชา
        navigate(`/user/Record/${subjectId}`);
    };
    // *****************************************************************

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

        // กรณีโหลดเสร็จแต่ไม่มีข้อมูล teacherInfo (เช่น บัญชีนี้ไม่ใช่ teacher)
        if (!teacherInfo) {
            return (
                <tr>
                    <td colSpan="10" className="text-center p-8 text-red-500">
                        บัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูลตารางสอน
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
                .filter((item) => {
                    if (!item.day) return false;
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
                            className="bg-yellow-400 text-sm cursor-pointer hover:bg-orange-400 transition-colors p-2 border border-gray-300 align-top text-center "
                            onClick={() => handleCourseClick(classItem.subject_id)}
                        >
                            <u>{classItem.subject_id}</u> <br />
                            <span>
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

                {/* แสดงข้อมูลปีการศึกษาเมื่อมีข้อมูลแล้ว */}
                {teacherInfo && (
                    <h2 className="flex justify-center items-center gap-20">
                        <span>ปีการศึกษา </span>
                        <b>
                            <u>{teacherInfo.year}</u>
                        </b>
                        <span>ภาคการศึกษา</span>
                        <b>
                            <u>{teacherInfo.semester}</u>
                        </b>
                    </h2>
                )}

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

export default Schedule;