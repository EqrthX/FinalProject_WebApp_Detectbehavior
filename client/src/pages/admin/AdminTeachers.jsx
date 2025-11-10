import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";
import { supabase } from "../../config/supabase";
import toast from "react-hot-toast";
import axios from "../../util/axios";

const AdminTeachingschedule = () => {

  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [faculty, setFaculty] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedMajor, setSelectedMajor] = useState('');
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teacherId, setTeacherId] = useState('');

  useEffect(() => {
    const fetechFacultyAndMajor = async () => {
      try {
        const { data, error } = await supabase.from('faculty')
        .select(`*,
                majors (*)`);

        if (error) {
          throw error
        }

        setFaculty(data)

      } catch (error) {
        console.error("Fetch Faculty and Major error:", error)
      }

    }
    fetechFacultyAndMajor();
  }, [])

  // ตัวอย่างข้อมูลจำลอง
  const teachers = Array.from({ length: 15 }).map((_, i) => ({
    id: i + 1,
    code: "0123456789012",
    name: "นายสมศักดิ์ พงศ์ดี",
    faculty: "วิทยาศาสตร์และเทคโนโลยี",
    major: "เทคโนโลยีสารสนเทศและการสื่อสาร",
  }));

  // ✅ ฟังก์ชันเมื่อคลิกแถว
  const handleClick = (t) => {
    navigate(`/admin/AdminClassRoom/${t.id}`, {
      state: { teacher: t },
    });
  };

  // ✅ ฟังก์ชันปิด modal
  const closeModal = () => setShowModal(false);
  const majorsToShow = faculty.find((f) => f.faculty_id === selectedFacultyId)?.majors || [];

  const onCreateTeacher = async (event) => {
    event.preventDefault();
    try {
      
      if (!email || !password || !teacherId || !fullname || !faculty || !selectedMajor) return toast.error("กรุณากรอกข้อมูลให้ครบ");

      const formData = new FormData();

      formData.append("email", email);
      formData.append("password", password);
      formData.append("teacher_id", teacherId);
      formData.append("fullname", fullname);
      formData.append("major", selectedMajor);
      
      const response = await axios.post(`admin/create-teacher`, formData, {
        headers: {"Content-Type": "multipart/form-data"}
      });
      
      toast.success(response.data.detail || "เพิ่มข้อมูลอาจารย์เสร็จสิ้น ✅");
      
    } catch (error) {

      const message = error.response?.data?.detail || "เกิดข้อผิดพลาดในการเพิ่มข้อมูล ❌"
      console.error("Error to create teacher", error)
      toast.error(message);
      
    }
  }

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
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2 font-bold text-gray-800">รายชื่ออาจารย์</div>
                <input
                  type="text"
                  placeholder="🔍 ค้นหา"
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-full 
                            focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-[#F6F6F4] text-[#ACACAC]"
                />
              </div>

              {/* ✅ ปุ่มอัพโหลด */}
              <button
                onClick={() => setShowModal(true)}
                className="bg-[#3D42D3] hover:bg-[#2b28a0] text-white px-4 py-2 
                            rounded-lg text-sm font-medium"
              >
                อัพโหลดรายชื่อ
              </button>
            </div>

            {/* ตาราง */}
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-[#f2f2f2]">
                  <tr>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      รหัสประจำตัว
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ชื่อ - นามสกุล
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      คณะ
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      สาขา
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => handleClick(t)}
                      className="hover:bg-gray-100 cursor-pointer transition-colors duration-150"
                    >
                      <td className="px-4 py-2 border border-gray-300">
                        {t.code}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.name}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.faculty}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.major}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ✅ Modal */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 
                     bg-black/60 backdrop-blur-sm"
        >
          <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-md border border-gray-300">
            <h2 className="text-2xl font-bold mb-6">อัพโหลดรายชื่อ</h2>

            <form className="space-y-4" method="POST" onSubmit={onCreateTeacher}>
              <input
                type="text"
                placeholder="อีเมล"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />
              <input
                type="text"
                placeholder="รหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="รหัสประจำตัว"
                value={teacherId}
                onChange={(e) => {
                  setTeacherId(e.target.value.replace(/[^0-9]/g, ""));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />

              <input
                type="text"
                placeholder="ชื่อ - นามสกุล"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
              />

              <select
                type="text"
                placeholder="คณะ"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
              >

                {/* 2. (แนะนำ) เพิ่มตัวเลือกเริ่มต้นที่เลือกไม่ได้ */}
                <option value="" disabled selected>
                  กรุณาเลือกคณะ
                </option>

                {/* 3. โค้ดของคุณที่แก้ไขแล้ว */}
                {faculty.map((item) => (
                  <option key={item.faculty_id} value={item.faculty_id}>
                    {item.faculty_name}
                  </option>
                ))}

              </select>

              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                disabled={!selectedFacultyId}
                value={selectedMajor}
                onChange={(e) => setSelectedMajor(e.target.value)}
              >
                <option value="" disabled selected>
                  กรุณาเลือกสาขา
                </option>
                {majorsToShow.map((major) => (
                  <option key={major.major_id} value={major.major_id}>
                    {major.major_name}
                  </option>
                ))}
              </select>

              <div className="flex justify-end mt-6 gap-2">
                <button
                  type="button"
                  onClick={closeModal}
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

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeachingschedule;
