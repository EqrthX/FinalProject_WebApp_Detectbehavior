import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";
import Classroom from "../../components/Classroom";
import Breadcrumbs from "../../components/AdminBreadcrumbs";
import { supabase } from "../../config/supabase";
import Schedule from "../../components/schedule";

const AdminClassRoom = () => {
  const location = useLocation();
  const { id } = useParams();

  // 4. สร้าง State เพื่อเก็บข้อมูลอาจารย์
  const [teacher, setTeacher] = useState(location.state?.teacher || null);
  const [loading, setLoading] = useState(!location.state?.teacher);

  // 5. [สำคัญ] จัดการกรณีผู้ใช้รีเฟรชหน้า (state จะหายไป)
  useEffect(() => {
    if (!teacher && id) {
      console.log("⚠️ ไม่พบ state, กำลังดึงข้อมูลจาก ID:", id);
      const fetchTeacherById = async () => {
        try {
          // *** (ต้องปรับแก้ query ให้ตรงกับโครงสร้าง DB ของคุณ) ***
          // นี่คือตัวอย่างการดึงข้อมูลโดยอ้างอิงจากหน้าแรก
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
            )
            .eq("id", id) // ค้นหาด้วย id ที่ได้จาก URL
            .single(); // เอาแค่รายการเดียว

          if (error) throw error;

          if (data) {
            // แปลงข้อมูลให้ตรงกับ format ที่เราใช้
            const formattedTeacher = {
              id: data.id,
              teacherId: data.teacher_id,
              fullname: `${data.first_name} ${data.last_name}`,
              faculty: data.majors?.faculty?.faculty_name || "-",
              faculty_id: data.majors?.faculty?.faculty_id || null,
              major: data.majors?.major_name || "-",
              major_id: data.majors?.major_id || null,
            };
            setTeacher(formattedTeacher);
          }
        } catch (error) {
          console.error("❌ เกิดข้อผิดพลาดในการดึงข้อมูลอาจารย์:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchTeacherById();
    }
  }, [id, teacher]);

  // 6. (Optional) แสดง Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6f4] flex justify-center items-center">
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  // 7. (Optional) แสดงเมื่อไม่พบข้อมูล
  if (!teacher) {
    return (
      <div className="min-h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-4 p-4">
        <aside className="w-full md:w-64">
          <AdminNavbar />
        </aside>
        <main className="flex-1">
          <div className="max-w-screen-2xl mx-auto px-6 md:px-4">
            <div className="mt-5">
              <Breadcrumbs />
            </div>
            <div className="w-full bg-white rounded-[20px] p-6 text-center text-red-500">
              ไม่พบข้อมูลอาจารย์
            </div>
          </div>
        </main>
      </div>
    );
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
          <div className="mt-5">
            <Breadcrumbs />
          </div>

          {/* Top bar */}
          <div className="w-full bg-white rounded-[15px] border border-[#e9e9e9] shadow-sm h-20 md:h-16 px-6 flex items-center justify-between mt-0 flex-shrink-0 sticky top-0 z-20">
            <h1 className="text-[18px] font-semibold text-black">
              ตารางสอน: {teacher.fullname} {/* แสดงชื่ออาจารย์ */}
            </h1>

            <span className="text-sm text-gray-600">
              {teacher.faculty} | {teacher.major}
            </span>
          </div>

          {/* Search bar */}
          <div className="bg-white mt-4 p-4 rounded-[20px] shadow-sm border border-[#e9e9e9]">
            <Classroom teacherData={teacher} />
            <div className="mt-4 p-3 text-sm text-gray-600">
              <p className="italic">*หมายเหตุ</p>
              <p className="mt-1">ข้อมูลตารางสอนมีการเปลี่ยนแปลงทุกภาคเทอม</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminClassRoom;
