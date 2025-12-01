import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import MyBreadcrumb from '../../components/MyBreadcrumb';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../config/supabase";
import toast from "react-hot-toast";

const TeachingSchedule = () => {
    const navigate = useNavigate();
    
    // State
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teacherName, setTeacherName] = useState('');
    const [semesterInfo, setSemesterInfo] = useState({ year: "...", semester: "..." });

    // Constants สำหรับตาราง
    const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16];

    // Breadcrumb
    const breadcrumbItems = [
        { title: 'หน้าหลัก', href: '/user/home' },
        { title: 'ตารางสอน', href: '/user/teachingSchedule' },
    ];

    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);
            try {
                // 1. ดึงข้อมูลจาก LocalStorage (เพราะเป็นอาจารย์ดูของตัวเอง)
                const token = localStorage.getItem("token");
                const role = localStorage.getItem("role");
                const teacherCode = localStorage.getItem("teacher_id");
                const storedName = localStorage.getItem("fullname");

                if (!token || role !== "teacher" || !teacherCode) {
                    toast.error("กรุณาเข้าสู่ระบบในฐานะอาจารย์ก่อน");
                    navigate("/"); 
                    return;
                }

                setTeacherName(storedName || "อาจารย์");

                // 2. ดึงตารางสอน
                const { data: scheduleData, error: scheduleError } = await supabase
                    .from('class_schedule')
                    .select('*')
                    .eq('teacher_id', teacherCode);

                if (scheduleError) throw scheduleError;

                if (scheduleData && scheduleData.length > 0) {
                    setSchedule(scheduleData);
                    setSemesterInfo({
                        year: scheduleData[0].year,
                        semester: scheduleData[0].semester,
                    });
                } else {
                    setSchedule([]);
                    setSemesterInfo({ year: "2568", semester: "1" });
                }

            } catch (err) {
                console.error('Fetch schedule failed:', err.message);
                toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [navigate]);

    // ✅ ฟังก์ชันเมื่อคลิกที่วิชา (ไปหน้า Record)
    const handleCourseClick = (subjectId) => {
        // นำทางไปหน้าบันทึกการสอน
        navigate(`/user/Record/${subjectId}`);
    };

    // ✅ ฟังก์ชันสร้างตาราง (Logic เดียวกับ Classroom)
    const renderTableBody = () => {
        if (loading) {
            return (
                <tr><td colSpan="10" className="text-center p-8 text-gray-500">กำลังโหลดข้อมูล...</td></tr>
            );
        }
        if (schedule.length === 0) {
            return (
                <tr><td colSpan="10" className="text-center p-8 text-gray-500">ไม่พบตารางสอน</td></tr>
            );
        }

        return days.map((day) => {
            // กรองวิชาในวันนั้นๆ
            const classesForDay = schedule
                .filter((item) => String(item.day).trim() === day)
                .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

            const cells = [];
            let slotIndex = 0;

            while (slotIndex < timeSlots.length) {
                const currentSlotHour = timeSlots[slotIndex];
                
                // หาวิชาที่เริ่มในชั่วโมงนี้
                const classItem = classesForDay.find(
                    (c) => c.start_time && parseInt(c.start_time.split(":")[0]) === currentSlotHour
                );

                if (classItem) {
                    const startHour = parseInt(classItem.start_time.split(":")[0]);
                    const endHour = classItem.end_time ? parseInt(classItem.end_time.split(":")[0]) : startHour + 1;
                    const colSpan = endHour - startHour;
                    const finalColSpan = colSpan > 0 ? colSpan : 1;

                    // สร้าง Cell วิชาเรียน
                    cells.push(
                        <td
                            key={classItem.subject_id + classItem.group}
                            colSpan={finalColSpan}
                            className="bg-yellow-400 text-sm cursor-pointer hover:bg-orange-400 transition-colors p-2 border border-gray-300 align-top text-center relative group"
                            onClick={() => handleCourseClick(classItem.subject_id)} // 👈 จุดสำคัญ: คลิกแล้วไป Record
                            title="คลิกเพื่อบันทึกการสอน"
                        >
                            <u>{classItem.subject_id}</u> <br />
                            <span className="font-medium">{classItem.subject_name || "(ไม่พบชื่อวิชา)"}</span> <br />
                            <span className="text-xs">กลุ่ม {classItem.group} | ห้อง {classItem.room}</span> <br />
                            <span className="text-xs">[{classItem.start_time} - {classItem.end_time}]</span>
                            
                            {/* Hover Hint */}
                            <div className="absolute inset-0 bg-black/10 hidden group-hover:flex items-center justify-center text-white font-bold text-xs pointer-events-none">
                                คลิกเพื่อบันทึก
                            </div>
                        </td>
                    );
                    slotIndex += finalColSpan;
                } else {
                    // ช่องว่าง
                    cells.push(
                        <td key={`${day}-${currentSlotHour}`} className="border border-gray-300 bg-white"></td>
                    );
                    slotIndex++;
                }
            }

            return (
                <tr key={day}>
                    <td className="bg-gray-100 border border-gray-300 p-2 font-medium">{day}</td>
                    {cells}
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
                    <div className="w-full bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm p-6 mb-4 flex flex-col md:flex-row items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-black">ตารางสอนของคุณ</h1>
                            <p className="text-gray-500 text-sm mt-1">{teacherName}</p>
                        </div>
                        <div className="mt-4 md:mt-0 flex gap-8 text-sm md:text-base">
                            <div className="text-center">
                                <span className="block text-gray-500 text-xs">ปีการศึกษา</span>
                                <span className="font-bold underline text-[#38A738]">{semesterInfo.year}</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-gray-500 text-xs">ภาคการศึกษา</span>
                                <span className="font-bold underline text-[#38A738]">{semesterInfo.semester}</span>
                            </div>
                        </div>
                    </div>

                    {/* Table Card */}
                    <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 overflow-x-auto">
                        <table className="w-full min-w-[800px] text-center border-collapse border border-gray-300">
                            <thead>
                                <tr className="bg-gray-200 text-gray-700">
                                    <th className="border border-gray-300 p-2 w-24">วัน / เวลา</th>
                                    {timeSlots.map(t => (
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

                        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
                            <p className="font-semibold mb-1">* หมายเหตุ</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>คลิกที่แถบวิชาเพื่อทำการ <b>บันทึกการสอน (Record)</b></li>
                                <li>ข้อมูลตารางสอนมีการเปลี่ยนแปลงทุุกภาคเทอม</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeachingSchedule;