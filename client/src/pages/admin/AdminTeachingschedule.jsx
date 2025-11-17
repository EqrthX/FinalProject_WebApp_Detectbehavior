// Updated AdminTeachers component with "เพิ่มรายวิชา" button and modal

import React, { useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import { TimePicker } from 'antd'; // Added antd import
import dayjs from 'dayjs'; // Added dayjs import



const AdminTeachers = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const teachers = Array.from({ length: 15 }).map((_, i) => ({
    id: i + 1,
    code: "si123-59",
    name: "สอนวิชานานาชาติ",
    year: "2568",
    semester: "1",
    group: "1",
    day: "อังคาร",
    time: "12:00-16:10",
    room: "1303",
    building: "1",
    credit: "3(3-0-6)",
    teacher: "นาย ก นามสมุด",
  }));

  // Added from user's first code block for TimePicker
  const format = 'HH:mm:ss';
  const startTime = dayjs('12:08:23', 'HH:mm:ss');
  const endTime = dayjs('12:08:23', 'HH:mm:ss');

  return (
    <div className="min-h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-4 p-4">
      <aside className="w-full md:w-64">
        <AdminNavbar />
      </aside>

      <main className="flex-1 transition-all lg:pl-[0rem] md:pl-0 sm:pl-0">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-4">
          <div className="w-full bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm h-20 md:h-16 px-6 md:px-4 mt-2 md:mt-3 lg:mt-5 flex items-center justify-between">
            <h1 className="text-[22px] md:text-[18px] font-semibold text-black">รายวิชา</h1>
          </div>

          <div className="bg-white mt-4 p-4 rounded-[20px] shadow-sm border border-[#e9e9e9]">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2 font-bold text-gray-800">วิชาสอน</div>
                <input
                  type="text"
                  placeholder="🔍 ค้นหา"
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-[#F6F6F4] text-[#ACACAC]"
                />
              </div>

              <div className="flex gap-2">
                {/* เพิ่มรายวิชา */}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-[#38A738] hover:bg-[#2d7c2d] text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  เพิ่มรายวิชา
                </button>

                {/* อัพโหลดรายวิชา */}
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-[#3D42D3] hover:bg-[#2b28a0] text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  อัพโหลดตารางสอน
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-[#f2f2f2]">
                  <tr>
                    <th className="text-left px-4 py-2 border border-gray-300">รหัสวิชา</th>
                    <th className="text-left px-4 py-2 border border-gray-300">ชื่อวิชา</th>
                    <th className="text-left px-4 py-2 border border-gray-300">ปีการศึกษา</th>
                    <th className="text-left px-4 py-2 border border-gray-300">ภาคการศึกษา</th>
                    <th className="text-left px-4 py-2 border border-gray-300">กลุ่ม</th>
                    <th className="text-left px-4 py-2 border border-gray-300">วัน</th>
                    <th className="text-left px-4 py-2 border border-gray-300">เวลาเรียน</th>
                    <th className="text-left px-4 py-2 border border-gray-300">ห้องเรียน</th>
                    <th className="text-left px-4 py-2 border border-gray-300">ตึก</th>
                    <th className="text-left px-4 py-2 border border-gray-300">หน่วยกิต</th>
                    <th className="text-left px-4 py-2 border border-gray-300">อาจารย์ผู้สอน</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border border-gray-300">{t.code}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.name}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.year}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.semester}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.group}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.day}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.time}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.room}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.building}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.credit}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.teacher}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Modal เพิ่มรายวิชา */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-xl border border-gray-300">
            <h2 className="text-2xl font-bold mb-6">เพิ่มรายวิชา</h2>

            <form className="grid grid-cols-1 gap-4">
              <input
                type="text"
                placeholder="รหัสวิชา"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]"
              />

              <input
                type="text"
                placeholder="ชื่อวิชา"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]"
              />

              {/* หมวดหมู่ */}
              <select className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]">
                <option>เลือกหมวดหมู่</option>
                <option>วิชาทั่วไป</option>
                <option>วิชาเฉพาะ</option>
                <option>วิชาเสรี</option>
              </select>
            </form>

            <div className="flex justify-end mt-6 gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                ยกเลิก
              </button>
              <button className="px-5 py-2 bg-[#38A738] text-white rounded-md hover:bg-[#2d7c2d]">
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal อัพโหลดรายวิชา */}
      {showUploadModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-2xl border border-gray-300">
            <h2 className="text-2xl font-bold mb-6">อัพโหลดตารางสอน</h2>

            <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="ปีการศึกษา" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]" />
              <input type="text" placeholder="ภาคการศึกษา" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]" />

              <input type="text" placeholder="กลุ่ม" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]" />

              <select className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]">
                <option>กรุณาเลือกวัน</option>
                <option value="วันจันทร์">วันจันทร์</option>
                <option value="วันอังคาร">วันอังคาร</option>
                <option value="วันพุธ">วันพุธ</option>
                <option value="วันพฤหัสบดี">วันพฤหัสบดี</option>
                <option value="วันศุกร์">วันศุกร์</option>
                <option value="วันเสาร์">วันเสาร์</option>
                <option value="วันอาทิตย์">วันอาทิตย์</option>
              </select>
              <input type="text" placeholder="ห้องเรียน" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]" />

              <TimePicker.RangePicker 
                defaultValue={[startTime, endTime]} 
                format={format} 
                style={{ width: '100%' }}
              />

              <input type="text" placeholder="ตึก" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]" />

              <input type="text" placeholder="หน่วยกิต" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]" />
              <input type="text" placeholder="อาจารย์ผู้สอน" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#38A738]" />
            </form>

            <div className="flex justify-end mt-6 gap-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                ยกเลิก
              </button>
              <button className="px-5 py-2 bg-[#3F37C9] text-white rounded-md hover:bg-[#2b28a0]">
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeachers;