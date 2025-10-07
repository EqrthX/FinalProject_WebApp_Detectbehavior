import React from 'react'
import Navbar from '../../components/Navbar'
import Classroom from '../../components/Classroom'
import { Link } from 'react-router-dom';
import MyBreadcrumb from '../../components/MyBreadcrumb';


const TeachingSchedule = () => {
    const subjects = [
        { code: "SI235-1", group: "1", room: "7501", building: "07", time: "12:20 – 16:10", note: "OO" },
        { code: "SI230-1", group: "1", room: "5401", building: "05", time: "08:30 – 11:00", note: "OO" },
        { code: "SI423-59", group: "1", room: "1205B", building: "01", time: "13:10 – 16:10", note: "OO" },
        { code: "SP348-1", group: "1", room: "5401", building: "05", time: "08:30 – 11:00", note: "OO" },
        { code: "SP338-1", group: "2", room: "1205A", building: "01", time: "08:30 – 12:20", note: "OO" },
        { code: "SP338-1", group: "1", room: "1205A", building: "01", time: "12:20 – 16:10", note: "OO" },
    ];
    return (
        <>
            <Navbar />
            <div style={{ padding: 24 }}>
                <MyBreadcrumb />

            </div>
            <div className="grid grid-cols-3 gap-4 p-6">
                <div className="col-span-2 bg-white rounded-2xl shadow p-6 h-130">
                    <Classroom />
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
                                            <th className="border-b border-[#E9E9E9] p-2">รหัสวิชา</th>
                                            <th className="border-b border-[#E9E9E9] p-2">กลุ่ม</th>
                                            <th className="border-b border-[#E9E9E9] p-2">ห้อง</th>
                                            <th className="border-b border-[#E9E9E9] p-2">อาคาร</th>
                                            <th className="border-b border-[#E9E9E9] p-2">เวลา</th>
                                            <th className="border-b border-[#E9E9E9] p-2">บันทึกไป</th>
                                        </tr>
                                    </thead>
                                    {/* ข้อมูลในตาราง */}
                                    <tbody>
                                        {subjects.map((item, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="border-b border-[#E9E9E9] p-2 text-left">{item.code}</td>
                                                <td className="border-b border-[#E9E9E9] p-2">{item.group}</td>
                                                <td className="border-b border-[#E9E9E9] p-2">{item.room}</td>
                                                <td className="border-b border-[#E9E9E9] p-2">{item.building}</td>
                                                <td className="border-b border-[#E9E9E9] p-2">{item.time}</td>
                                                <td className="border-b border-[#E9E9E9] p-2">{item.note}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                    {/* ปุ่ม */}
                    <div className="p- pt-4">
                        <Link to="/user/Record">
                            <button
                                type="submit"
                                className="bg-[#3D42D3] text-white w-full py-3 rounded-xl font-semibold hover:bg-blue-900 transition-colors"
                            >
                                ต่อไป
                            </button>
                        </Link>

                    </div>
                </div>
            </div>
        </>
    )
}

export default TeachingSchedule