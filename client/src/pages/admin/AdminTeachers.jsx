import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";
import { supabase } from "../../config/supabase";
import toast from "react-hot-toast";
import axios from "../../util/axios";
import { Pagination } from "antd";
import Breadcrumbs from "../../components/AdminBreadcrumbs";

const AdminTeachingschedule = () => {
     const navigate = useNavigate();
     const [showModal, setShowModal] = useState(false);
     const [searchTerm, setSearchTerm] = useState("");

     const [faculty, setFaculty] = useState([]);
     const [teachers, setTeachers] = useState([]);
     const [selectedFacultyId, setSelectedFacultyId] = useState("");
     const [selectedMajor, setSelectedMajor] = useState("");
     const [fullname, setFullname] = useState("");
     const [email, setEmail] = useState("");
     const [password, setPassword] = useState("");
     const [teacherId, setTeacherId] = useState("");

     const [currentPage, setCurrentPage] = useState(1);
     const [pageSize, setPageSize] = useState(10);

     const [filterFacultyId, setFilterFacultyId] = useState("");
     const [filterMajorId, setFilterMajorId] = useState("");

     useEffect(() => {
          const fetchFacultyAndMajor = async () => {
               try {
                    const { data, error } = await supabase
                         .from("faculty")
                         .select(`*, majors (*)`);

                    if (error) {
                         throw error;
                    }

                    setFaculty(data);
               } catch (error) {
                    console.error("Fetch Faculty and Major error:", error);
               }
          };
          fetchFacultyAndMajor();
     }, []);

     useEffect(() => {
          const fetchTeachers = async () => {
               try {
                    console.log("🔍 กำลังดึงข้อมูลอาจารย์...");

                    const { data, error } = await supabase
                         .from("teacher")
                         .select(
                              `
            id,
            teacher_id,
            first_name,
            last_name,
            majors (
              major_id, 
              major_name,
              faculty (
                faculty_name,
                faculty_id 
              )
            )
          `
                         );

                    console.log("📊 Response:", { data, error });

                    if (error) {
                         console.error("❌ Supabase Error:", error);
                         toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
                         throw error;
                    }

                    if (!data || data.length === 0) {
                         console.warn("⚠️ ไม่พบข้อมูลอาจารย์ในฐานข้อมูล");
                         setTeachers([]);
                         return;
                    }

                    const formattedTeachers = data.map((teacher) => {
                         console.log("👨‍🏫 Teacher:", teacher);
                         return {
                              id: teacher.id,
                              teacherId: teacher.teacher_id,
                              fullname: `${teacher.first_name} ${teacher.last_name}`,
                              faculty: teacher.majors?.faculty?.faculty_name || "-",
                              faculty_id: teacher.majors?.faculty?.faculty_id || null,
                              major: teacher.majors?.major_name || "-",
                              major_id: teacher.majors?.major_id || null,
                         };
                    });

                    console.log("✅ Teachers formatted:", formattedTeachers);
                    setTeachers(formattedTeachers);
               } catch (error) {
                    console.error("❌ Fetch Teachers error:", error);
                    toast.error("เกิดข้อผิดพลาดในการดึงข้อมูลอาจารย์");
               }
          };

          fetchTeachers();
     }, []);

     // ฟังก์ชันเมื่อคลิกแถว
     const handleClick = (t) => {
          navigate(`/admin/AdminClassRoom/${t.id}`, {
               state: { teacher: t },
          });
     };

     const closeModal = () => setShowModal(false);

     const majorsToShow =
          faculty.find((f) => f.faculty_id === selectedFacultyId)?.majors || [];

     const filterMajorsToShow =
          faculty.find((f) => f.faculty_id === filterFacultyId)?.majors || [];

     const onCreateTeacher = async (event) => {
          event.preventDefault();
          try {
               if (
                    !email ||
                    !password ||
                    !teacherId ||
                    !fullname ||
                    !selectedFacultyId ||
                    !selectedMajor
               )
                    return toast.error("กรุณากรอกข้อมูลให้ครบ");

               const formData = new FormData();

               formData.append("email", email);
               formData.append("password", password);
               formData.append("teacher_id", teacherId);
               formData.append("fullname", fullname);
               formData.append("major", selectedMajor);

               const response = await axios.post(`admin/create-teacher`, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
               });

               toast.success(response.data.detail || "เพิ่มข้อมูลอาจารย์เสร็จสิ้น ✅");

               closeModal();

               const { data: teachersData, error: fetchError } = await supabase
                    .from("teacher")
                    .select(
                         `
            id,
            teacher_id,
            first_name,
            last_name,
            majors (
              major_id, 
              major_name,
              faculty (
                faculty_name,
                faculty_id 
              )
            )
          `
                    );

               if (!fetchError && teachersData) {
                    const formattedTeachers = teachersData.map((teacher) => ({
                         id: teacher.id,
                         teacherId: teacher.teacher_id,
                         fullname: `${teacher.first_name} ${teacher.last_name}`,
                         faculty: teacher.majors?.faculty?.faculty_name || "-",
                         faculty_id: teacher.majors?.faculty?.faculty_id || null,
                         major: teacher.majors?.major_name || "-",
                         major_id: teacher.majors?.major_id || null,
                    }));
                    setTeachers(formattedTeachers);
                    setCurrentPage(1);
               }
          } catch (error) {
               const message =
                    error.response?.data?.detail || "เกิดข้อผิดพลาดในการเพิ่มข้อมูล ❌";
               console.error("Error to create teacher", error);
               toast.error(message);
          }
     };

     const filteredTeachers = teachers.filter((teacher) => {
          const lowerSearchTerm = searchTerm.toLowerCase();
          const facultyMatch =
               !filterFacultyId || teacher.faculty_id === filterFacultyId;
          const majorMatch = !filterMajorId || teacher.major_id === filterMajorId;
          const searchMatch =
               !searchTerm ||
               teacher.teacherId.toLowerCase().includes(lowerSearchTerm) ||
               teacher.fullname.toLowerCase().includes(lowerSearchTerm) ||
               teacher.faculty.toLowerCase().includes(lowerSearchTerm) ||
               teacher.major.toLowerCase().includes(lowerSearchTerm);
          return facultyMatch && majorMatch && searchMatch;
     });

     const indexOfLastItem = currentPage * pageSize;
     const indexOfFirstItem = indexOfLastItem - pageSize;
     const currentTeachers = filteredTeachers.slice(
          indexOfFirstItem,
          indexOfLastItem
     );

     const handlePaginationChange = (page, size) => {
          setCurrentPage(page);
          setPageSize(size);
     };

     return (
          <div className="min-h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-4 p-4">
               <aside className="w-full md:w-64">
                    <AdminNavbar />
               </aside>

               <main className="flex-1 transition-all lg:pl-[0rem] md:pl-0 sm:pl-0">
                    <div className="max-w-screen-2xl mx-auto px-6 md:px-4">
                         <div className="mt-5">
                              <Breadcrumbs />
                         </div>

          <div className="w-full bg-white rounded-[15px] border border-[#e9e9e9] shadow-sm h-20 md:h-16 px-6 flex items-center justify-between sticky top-[20px] z-30">
                              <h1 className="text-[22px] md:text-[18px] font-semibold text-black">
                                   อาจารย์
                              </h1>
                         </div>

                         <div className="bg-white mt-4 p-4 rounded-[20px] shadow-sm border border-[#e9e9e9]">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2 sticky top-[90px] z-20 bg-white pb-4 border-b border-gray-100 ml-3">
                                   <div className="flex items-center gap-3 flex-wrap">
                                        <div className="p-2 font-bold text-gray-800">
                                             รายชื่ออาจารย์
                                        </div>
                                        <input
                                             type="text"
                                             placeholder="🔍 ค้นหา"
                                             className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-full 
                            focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-[#F6F6F4] text-black"
                                             value={searchTerm}
                                             onChange={(e) => {
                                                  setSearchTerm(e.target.value);
                                                  setCurrentPage(1);
                                             }}
                                        />

                                        <select
                                             className="w-full md:w-56 px-5 py-2 border border-gray-300 rounded-full 
                                  focus:outline-none focus:ring-2 focus:ring-[#b6b6b6] bg-[#F6F6F4] text-black"
                                             value={filterFacultyId}
                                             onChange={(e) => {
                                                  setFilterFacultyId(e.target.value);
                                                  setFilterMajorId("");
                                                  setCurrentPage(1);
                                             }}
                                        >
                                             <option value="">-- คณะทั้งหมด --</option>
                                             {faculty.map((f) => (
                                                  <option key={f.faculty_id} value={f.faculty_id}>
                                                       {f.faculty_name}
                                                  </option>
                                             ))}
                                        </select>

                                        <select
                                             className="w-full md:w-56 px-5 py-2 border border-gray-300 rounded-full 
                                  focus:outline-none focus:ring-2 focus:ring-[#b6b6b6] bg-[#F6F6F4] text-black
                                  disabled:bg-gray-100 disabled:text-gray-400"
                                             value={filterMajorId}
                                             onChange={(e) => {
                                                  setFilterMajorId(e.target.value);
                                                  setCurrentPage(1);
                                             }}
                                             disabled={!filterFacultyId}
                                        >
                                             <option value="">-- สาขาทั้งหมด --</option>
                                             {filterMajorsToShow.map((major) => (
                                                  <option key={major.major_id} value={major.major_id}>
                                                       {major.major_name}
                                                  </option>
                                             ))}
                                        </select>
                                   </div>

                                   <button
                                        onClick={() => setShowModal(true)}
                                        className="bg-[#3D42D3] hover:bg-[#2b28a0] text-white px-4 py-2 
                              rounded-lg text-sm font-medium"
                                   >
                                        อัพโหลดรายชื่อ
                                   </button>
                              </div>

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
                                             {currentTeachers.length === 0 ? (
                                                  <tr>
                                                       <td
                                                            colSpan="4"
                                                            className="px-4 py-8 text-center text-gray-500"
                                                       >
                                                            {searchTerm || filterFacultyId || filterMajorId
                                                                 ? "ไม่พบข้อมูลที่ค้นหา"
                                                                 : "ไม่พบข้อมูลอาจารย์"}
                                                       </td>
                                                  </tr>
                                             ) : (
                                                  currentTeachers.map((t) => (
                                                       <tr
                                                            key={t.id}
                                                            onClick={() => handleClick(t)}
                                                            className="hover:bg-gray-100 cursor-pointer transition-colors duration-150"
                                                       >
                                                            <td className="px-4 py-2 border border-gray-300">
                                                                 {t.teacherId}
                                                            </td>
                                                            <td className="px-4 py-2 border border-gray-300">
                                                                 {t.fullname}
                                                            </td>
                                                            <td className="px-4 py-2 border border-gray-300">
                                                                 {t.faculty}
                                                            </td>
                                                            <td className="px-4 py-2 border border-gray-300">
                                                                 {t.major}
                                                            </td>
                                                       </tr>
                                                  ))
                                             )}
                                        </tbody>
                                   </table>
                              </div>

                              <div className="flex justify-center mt-4 pb-2">
                                   <Pagination
                                        current={currentPage}
                                        pageSize={pageSize}
                                        total={filteredTeachers.length}
                                        showSizeChanger
                                        pageSizeOptions={["5", "10", "20", "50", "100"]}
                                        onChange={handlePaginationChange}
                                        showTotal={(total) => `ทั้งหมด ${total} รายการ`}
                                   />
                              </div>
                         </div>
                    </div>
               </main>

               {/* ... (Modal code remains the same) ... */}
               {showModal && (
                    <div
                         className="fixed inset-0 flex items-center justify-center z-50 
               bg-black/60 backdrop-blur-sm"
                    >
                         <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-md border border-gray-300">
                              <h2 className="text-2xl font-bold mb-6">อัพโหลดรายชื่อ</h2>

                              <form
                                   className="space-y-4"
                                   method="POST"
                                   onSubmit={onCreateTeacher}
                              >
                                   <div className="relative mt-2">
                                        <input
                                             type="text"
                                             id="email"
                                             value={email}
                                             onChange={(e) => setEmail(e.target.value)}
                                             className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent"
                                             placeholder="อีเมล"
                                        />
                                        <label
                                             htmlFor="email"
                                             className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all
                    peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                    peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                                        >
                                             อีเมล <span className="text-red-500">*</span>
                                        </label>
                                   </div>

                                   <div className="relative mt-2">
                                        <input
                                             type="text"
                                             id="password"
                                             value={password}
                                             onChange={(e) => setPassword(e.target.value)}
                                             className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent"
                                             placeholder="รหัสผ่าน"
                                        />
                                        <label
                                             htmlFor="password"
                                             className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all
                    peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                    peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                                        >
                                             รหัสผ่าน <span className="text-red-500">*</span>
                                        </label>
                                   </div>

                                   <div className="relative mt-2">
                                        <input
                                             type="text"
                                             id="teacherId"
                                             inputMode="numeric"
                                             pattern="[0-9]*"
                                             value={teacherId}
                                             onChange={(e) => {
                                                  setTeacherId(e.target.value.replace(/[^0-9]/g, ""));
                                             }}
                                             className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent"
                                             placeholder="รหัสประจำตัว"
                                        />
                                        <label
                                             htmlFor="teacherId"
                                             className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all
                    peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                    peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                                        >
                                             รหัสประจำตัว <span className="text-red-500">*</span>
                                        </label>
                                   </div>

                                   <div className="relative mt-2">
                                        <input
                                             type="text"
                                             id="fullname"
                                             value={fullname}
                                             onChange={(e) => setFullname(e.target.value)}
                                             className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent"
                                             placeholder="ชื่อ - นามสกุล"
                                        />
                                        <label
                                             htmlFor="fullname"
                                             className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all
                    peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                    peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]"
                                        >
                                             ชื่อ - นามสกุล <span className="text-red-500">*</span>
                                        </label>
                                   </div>

                                   <select
                                        type="text"
                                        placeholder="คณะ"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
                                        value={selectedFacultyId}
                                        onChange={(e) => {
                                             setSelectedFacultyId(e.target.value);
                                             setSelectedMajor("");
                                        }}
                                   >
                                        <option value="" disabled>
                                             กรุณาเลือกคณะ
                                        </option>

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
                                        <option value="" disabled>
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