import React from "react";
import AdminNavbar from "../../components/AdminNavbar";
import Classroom from '../../components/Classroom';

const AdminClassRoom = () => {
  // ตัวอย่างข้อมูลจำลอง
  const teachers = Array.from({ length: 15 }).map((_, i) => ({
    id: i + 1,
    code: "0000000000000",
    name: "นายสมศักดิ์ พงศ์ดี",
    faculty: "วิทยาศาสตร์และเทคโนโลยี",
    major: "เทคโนโลยีสารสนเทศและการสื่อสาร",
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
              อาจารย์
            </h1>
          </div>

          {/* Search bar */}
          <div className="bg-white mt-4 p-4 rounded-[20px] shadow-sm border border-[#e9e9e9]">
            <Classroom/>
            <div className="mt-4 p-3 text-sm text-gray-600">
              <p className="italic">
                *หมายเหตุ
              </p>
              <p className="mt-1">
                ข้อมูลตารางสอนอาจมีการเปลี่ยนแปลงทุก 3 เดือน 
                และไม่สามารถเพิ่ม ลบ หรือแก้ไขข้อมูลได้ระหว่างภาคเรียน 
              </p>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
};

export default AdminClassRoom;
