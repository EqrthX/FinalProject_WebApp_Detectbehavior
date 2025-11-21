import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Schedule from '../../components/schedule';
import MyBreadcrumb from '../../components/MyBreadcrumb';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from "../../config/supabase";
import toast from "react-hot-toast";

const TeachingSchedule = () => {
    const [scheduleData, setScheduleData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [teacherName, setTeacherName] = useState('อาจารย์');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);
            setError(null);

            try {
                const token = localStorage.getItem("token");
                const role = localStorage.getItem("role");
                const teacherCode = localStorage.getItem("teacher_id");
                const teacherFullname = localStorage.getItem("fullname");

                if (!token || role !== "teacher" || !teacherCode) {
                    toast.error("กรุณาเข้าสู่ระบบในฐานะอาจารย์ก่อน");
                    navigate("/"); 
                    return;
                }
                
                // ดึงข้อมูลอาจารย์และตั้งชื่อ
                let finalTeacherName = teacherFullname || "อาจารย์ผู้สอน";
                
                // ลองดึงชื่ออาจารย์จากตาราง `teacher` เพื่อความชัวร์ (ถ้ามี)
                const { data: teacherData, error: teacherError } = await supabase
                    .from("teacher")
                    .select("first_name, last_name")
                    .eq("teacher_id", teacherCode)
                    .single();

                if (teacherError && teacherError.code !== "PGRST116") { // PGRST116: No rows returned
                     // ไม่ต้อง throw error รุนแรง อาจจะแค่แจ้งเต้าว่าไม่เจอชื่อในตาราง teacher
                     console.warn("ไม่พบข้อมูลอาจารย์ในตาราง teacher หรือมีข้อผิดพลาดอื่น:", teacherError);
                }

                if (teacherData) {
                    finalTeacherName = `${teacherData.first_name} ${teacherData.last_name}`;
                } else if (!teacherFullname) {
                    // กรณีไม่มีข้อมูลในตาราง teacher และไม่มี fullname ใน localStorage
                    console.error("ไม่พบข้อมูลอาจารย์ที่จำเป็น");
                    toast.error("ไม่พบข้อมูลอาจารย์ กรุณาเข้าสู่ระบบใหม่");
                    navigate("/");
                    return;
                }
                
                setTeacherName(finalTeacherName);
                
                const { data: schedule, error: scheduleError } = await supabase
                    .from('class_schedule')
                    .select(`*`)
                    .eq('teacher_id', teacherCode)
                    .order('start_time', { ascending: true });

                if (scheduleError) {
                    console.error('Error fetching schedule data:', scheduleError);
                    throw new Error(`เกิดข้อผิดพลาดในการดึงตารางสอน: ${scheduleError.message}`);
                }

                // 4. จัดรูปแบบข้อมูล
                const formattedData = schedule.map(item => ({
                    code: item.subject_id,
                    group: item.group,
                    room: item.room,
                    building: item.building || 'N/A', 
                    time: `${item.start_time} - ${item.end_time}`, 
                    note: item.note || '',
                }));
                
                setScheduleData(formattedData);
                
            } catch (err) {
                console.error('Fetch schedule failed:', err.message);
                setError(err.message);
                setScheduleData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [navigate]);

    // --- ส่วนแสดงผล (Render) ---
    const breadcrumbItems = [
        { title: 'หน้าหลัก', href: '/user/home' },
        { title: 'ตารางสอน', href: '/user/teachingSchedule' },
    ];
    
    // Loading State
    if (loading) {
        return (
            <>
                <Navbar />
                <div style={{ padding: 24 }}><MyBreadcrumb items={breadcrumbItems} /></div>
                <div className="grid place-items-center h-screen">
                    <p>กำลังโหลดตารางสอน...</p>
                </div>
            </>
        );
    }

    // Error State
    if (error) {
        return (
            <>
                <Navbar />
                <div style={{ padding: 24 }}><MyBreadcrumb items={breadcrumbItems} /></div>
                <div className="grid place-items-center p-6">
                    <p className="text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล: {error}</p>
                </div>
            </>
        );
    }
    
    // Main Content
    return (
        <>
            <Navbar />
            <div style={{ padding: 24 }}>
                <MyBreadcrumb items={breadcrumbItems} />
            </div>
            <div className="p-6">
                <h1 className='text-xl font-bold mb-4'>ตารางสอนของ {teacherName}</h1>
                <div className="grid grid-cols-3 gap-4">
                    
                    {/* ส่วนตารางสอน (Schedule Component) */}
                    <div className="col-span-2 bg-white rounded-2xl shadow p-6 h-full min-h-[500px]">
                        <h2 className="text-left font-bold mb-4">ตารางสอนรวม</h2>
                        <Schedule subjects={scheduleData} /> 
                        <h2 className='text-[#767676] text-xs mt-4'>*หมายเหตุ : ข้อมูลตารางสอนจะมีการเปลี่ยนแปลงทุกๆ 3 เดือน และไม่สามารถเพิ่ม ลบ แก้ไข ข้อมูลได้ระหว่างภาคเทอม</h2>
                    </div>
                    
                    {/* ส่วนวิชาทั้งหมด (Table) */}
                    <div className="flex flex-col space-y-4">
                        <div className="bg-white rounded-2xl shadow flex flex-col h-full min-h-[500px] border border-gray-300">
                            <h2 className="text-left font-bold p-6 border-b border-gray-200">รายวิชาทั้งหมดที่สอน ({scheduleData.length} วิชา)</h2>
                            <div className="flex flex-col flex-1 overflow-auto">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full border-collapse text-center text-sm"> {/* ปรับ w-full */}
                                        <thead className="bg-[#F6F6F4] sticky top-0 z-10">
                                            <tr className='text-[#767676]'>
                                                <th className="border-b border-[#E9E9E9] p-2 ">รหัสวิชา</th>
                                                <th className="border-b border-[#E9E9E9] p-2">กลุ่ม</th>
                                                <th className="border-b border-[#E9E9E9] p-2">ห้อง</th>
                                                <th className="border-b border-[#E9E9E9] p-2">อาคาร</th>
                                                <th className="border-b border-[#E9E9E9] p-2">เวลา</th>
                                                <th className="border-b border-[#E9E9E9] p-2">บันทึกไป</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {scheduleData.length > 0 ? (
                                                scheduleData.map((item, index) => (
                                                    <tr 
                                                        key={index}
                                                        className="hover:bg-gray-50 cursor-pointer"
                                                    >
                                                        <td className="border-b border-[#E9E9E9] p-2 ">
                                                            {item.code} 
                                                        </td>
                                                        <td className="border-b border-[#E9E9E9] p-2">{item.group}</td>
                                                        <td className="border-b border-[#E9E9E9] p-2">{item.room}</td>
                                                        <td className="border-b border-[#E9E9E9] p-2">{item.building}</td>
                                                        <td className="border-b border-[#E9E9E9] p-2">
                                                            {item.time} 
                                                        </td>
                                                        <td className="border-b border-[#E9E9E9] p-2">
                                                            {/* <Link
                                                                to={`/user/Record/${item.code}`}
                                                                className="text-blue-500 hover:text-blue-700 underline" 
                                                            >
                                                                บันทึกไป
                                                            </Link> */}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="6" className="p-4 text-gray-500">
                                                        ไม่พบตารางสอนสำหรับอาจารย์ท่านนี้
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default TeachingSchedule;