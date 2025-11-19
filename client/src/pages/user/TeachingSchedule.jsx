import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Schedule from '../../components/schedule';
import { Link } from 'react-router-dom';
import { supabase } from "../../config/supabase";

import MyBreadcrumb from '../../components/MyBreadcrumb';


const TeachingSchedule = () => {
    const [scheduleData, setScheduleData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchSchedule() {
            setLoading(true);
            setError(null);
            
            // ดึงข้อมูลจากตาราง "class_schedule"
            const { data, error } = await supabase
                .from('class_schedule')
                .select('*') 
                .order('start_time', { ascending: true });

            if (error) {
                console.error('Error fetching data:', error);
                setError(error.message);
                setScheduleData([]);
            } else {
                // จัดรูปแบบข้อมูลให้ตรงกับโครงสร้างที่ใช้ในตาราง (code, time, note)
                const formattedData = data.map(item => ({
                    code: item.subject_id,                     
                    group: item.group,
                    room: item.room,
                    building: item.building || 'N/A', 
                    time: `${item.start_time} - ${item.end_time}`, 
                    note: item.note || '',                       
                }));
                setScheduleData(formattedData);
            }
            setLoading(false);
        }

        fetchSchedule();
    }, []);

    if (loading) {
        return (
            <>
                <Navbar />
                <div style={{ padding: 24 }}><MyBreadcrumb /></div>
                <div className="grid place-items-center h-screen">
                    <p>กำลังโหลดตารางสอน...</p>
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <Navbar />
                <div style={{ padding: 24 }}><MyBreadcrumb /></div>
                <div className="grid place-items-center p-6">
                    <p className="text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล: {error}</p>
                </div>
            </>
        );
    }
    
    return (
        <>
            <Navbar />
            <div style={{ padding: 24 }}>
                <MyBreadcrumb />
            </div>
            <div className="grid grid-cols-3 gap-4 p-6">
                <div className="col-span-2 bg-white rounded-2xl shadow p-6 h-130">
                    <Schedule subjects={scheduleData} /> 
                    <h2 className='text-[#767676] text-xs'>*หมายเหตุ : ข้อมูลตารางสอนจะมีการเปลี่ยนแปลงทุกๆ 3 เดือน และไม่สามารถเพิ่ม ลบ แก้ไข ข้อมูลได้ระหว่างภาคเทอม</h2>
                </div>
                <div className="flex flex-col space-y-4">
                    <div className="bg-white rounded-2xl shadow flex flex-col h-130 border border-gray-300">
                        <h2 className="text-left font-bold p-6">วิชาทั้งหมด</h2>
                        <div className="flex flex-col flex-1">
                            <div className="overflow-x-auto">
                                <table className="w-full border-b border-gray-300 text-center text-sm">
                                    <thead className="bg-[#F6F6F4]">
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
                                        {scheduleData.map((item, index) => (
                                            <Link
                                                to={`/user/Record/${item.code}`}
                                                key={index}
                                                className="contents"
                                            >
                                                <tr className="hover:bg-gray-50 cursor-pointer">
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
                                                        {item.note} 
                                                    </td>
                                                </tr>
                                            </Link>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                    {/* ปุ่ม */}
                    {/* <div className="p- pt-4">
                        <Link to="/user/Record">
                            <button
                                type="submit"
                                className="bg-[#3D42D3] text-white w-full py-3 rounded-xl font-semibold hover:bg-blue-900 transition-colors"
                            >
                                ต่อไป
                            </button>
                        </Link>
                    </div> */}
                </div>
            </div>
        </>
    )
}

export default TeachingSchedule