import React, { useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";

const AdminTeachers = () => {
  const [showModal, setShowModal] = useState(false);

  // ตัวอย่างข้อมูลจำลอง
  const teachers = Array.from({ length: 15 }).map((_, i) => ({
    id: i + 1,
    code: "si123-59",
    name: "สอนวิชานานาชาติ",
    year: "2568/1",
    group: "1",
    credit: "3(3-0-6)",
    time: "12:00-16:10",
    teacher: "นาย ก นามสมุด",
  }));

  return (
    <div className="min-h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-4 p-4">
      {/* Sidebar */}
      <aside className="w-full md:w-64">
        <AdminNavbar />
      </aside>

      {/* Main */}
      <main className="flex-1 transition-all lg:pl-[0rem] md:pl-0 sm:pl-0">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-4">
          {/* Top bar */}
          <div className="w-full bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm h-20 md:h-16 px-6 md:px-4 mt-2 md:mt-3 lg:mt-5 flex items-center justify-between">
            <h1 className="text-[22px] md:text-[18px] font-semibold text-black">
              รายวิชา
            </h1>
          </div>

          {/* Search bar */}
          <div className="bg-white mt-4 p-4 rounded-[20px] shadow-sm border border-[#e9e9e9]">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2 font-bold text-gray-800">วิชาสอน</div>
                <input
                  type="text"
                  placeholder="🔍 ค้นหา"
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-full 
                            focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-[#F6F6F4] text-[#ACACAC]"
                />
              </div>

              {/* ปุ่มเปิด Modal */}
              <button
                onClick={() => setShowModal(true)}
                className="bg-[#3D42D3] hover:bg-[#2b28a0] text-white px-4 py-2 
                            rounded-lg text-sm font-medium"
              >
                อัพโหลดตาราง
              </button>
            </div>

            {/* ตาราง */}
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-[#f2f2f2]">
                  <tr>
                    <th className="text-left px-4 py-2 border border-gray-300">รหัสวิชา</th>
                    <th className="text-left px-4 py-2 border border-gray-300">ชื่อวิชา</th>
                    <th className="text-left px-4 py-2 border border-gray-300">ปี/ภาคการศึกษา</th>
                    <th className="text-left px-4 py-2 border border-gray-300">กลุ่ม</th>
                    <th className="text-left px-4 py-2 border border-gray-300">หน่วยกิต</th>
                    <th className="text-left px-4 py-2 border border-gray-300">เวลาเรียน</th>
                    <th className="text-left px-4 py-2 border border-gray-300">ผู้สอน</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-4 py-2 border border-gray-300">{t.code}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.name}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.year}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.group}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.credit}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.time}</td>
                      <td className="px-4 py-2 border border-gray-300">{t.teacher}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ✅ Modal เพิ่มข้อมูลรายวิชา */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-2xl border border-gray-300">
            <h2 className="text-2xl font-bold mb-6">อัพโหลดรายชื่อ</h2>

            <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="รหัสวิชา"
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(e) =>
                  (e.target.value = e.target.value.replace(/[^0-9]/g, ""))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />
              <input
                type="text"
                placeholder="ชื่อวิชา"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />

              <input
                type="text"
                placeholder="ปี/ภาคการศึกษา"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />
              <input
                type="text"
                placeholder="กลุ่ม"
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(e) =>
                  (e.target.value = e.target.value.replace(/[^0-9]/g, ""))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />

              <input
                type="text"
                placeholder="หน่วยกิต"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />
              <input
                type="text"
                placeholder="เวลาเรียน"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />

              <input
                type="text"
                placeholder="ผู้สอน"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />
            </form>

            <div className="flex justify-end mt-6 gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#3F37C9] text-white rounded-md hover:bg-[#2b28a0] transition"
              >
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
