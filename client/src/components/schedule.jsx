import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabase";
import toast from "react-hot-toast";
import { CloseOutlined, BookOutlined, InfoCircleOutlined } from "@ant-design/icons"; // ใช้ไอคอนเพิ่มความสวยงาม

const Schedule = () => {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState([]);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState("1");

  // --- State สำหรับ Modal ---
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
  const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16];
  const START_MINUTES = 8 * 60;
  const TOTAL_MINUTES = 9 * 60;

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
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

        let finalTeacherName = teacherFullname;
        const { data: teacherData } = await supabase
          .from("teacher")
          .select("first_name, last_name")
          .eq("teacher_id", teacherCode)
          .single();
        if (teacherData)
          finalTeacherName = `${teacherData.first_name} ${teacherData.last_name}`;

        const { data: scheduleData, error: scheduleError } = await supabase
          .from("class_schedule")
          .select("*")
          .eq("teacher_id", teacherCode)
          .eq("semester", selectedTerm);

        if (scheduleError) throw scheduleError;

        const info = {
          name: finalTeacherName,
          year: scheduleData && scheduleData.length > 0 ? scheduleData[0].year : "2568",
          semester: selectedTerm,
        };

        setSchedule(scheduleData || []);
        setTeacherInfo(info);
      } catch (err) {
        console.error("Error:", err);
        toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [navigate, selectedTerm]);

  // --- ฟังก์ชันเมื่อกดที่วิชา (เปิด Modal) ---
  const handleCourseClick = async (scheduleItem) => {
    setModalLoading(true);
    setShowModal(true);
    
    // ตั้งค่าข้อมูลเบื้องต้นจาก Schedule ไปก่อน (เผื่อโหลด subjects ไม่ทัน)
    setModalData({
      ...scheduleItem,
      credit: "-",
      category: "-",
      full_subject_name: scheduleItem.subject_name // กันเหนียว
    });

    try {
      // ดึงรายละเอียดเพิ่มเติมจากตาราง subjects
      const { data: subjectDetail, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("subject_id", scheduleItem.subject_id)
        .single();

      if (!error && subjectDetail) {
        setModalData(prev => ({
          ...prev,
          full_subject_name: subjectDetail.subject_name,
          category: subjectDetail.category,
          credit: subjectDetail.credit
        }));
      }
    } catch (error) {
      console.error("Error fetching subject details:", error);
    } finally {
      setModalLoading(false);
    }
  };

  // --- ฟังก์ชันปิด Modal ---
  const closeModal = () => {
    setShowModal(false);
    setModalData(null);
  };

  // --- ฟังก์ชันไปหน้า Record (จากใน Modal) ---
  const handleNavigateToRecord = () => {
    if (modalData && modalData.subject_id) {
      navigate(`/user/Record/${modalData.subject_id}`);
    }
  };

  const renderTableBody = () => {
    if (loading) return <tr><td colSpan="10" className="p-8 text-center text-gray-500">กำลังโหลด...</td></tr>;
    if (schedule.length === 0) return <tr><td colSpan="10" className="p-8 text-center text-gray-500">ไม่พบข้อมูลตารางสอนในเทอม {selectedTerm}</td></tr>;

    return days.map((day) => {
      const classes = schedule
        .filter((item) => String(item.day).trim() === day)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));

      return (
        <tr key={day} className="h-24 border-b border-gray-200">
          <td className="bg-gray-100 border-r border-gray-300 font-semibold text-gray-700 align-middle text-center w-[100px] p-2">
            {day}
          </td>
          <td colSpan={9} className="p-0 relative align-top h-full w-auto">
            <div className="absolute inset-0 flex w-full h-full pointer-events-none z-0">
              {timeSlots.map((_, i) => (
                <div key={i} className={`flex-1 border-r border-gray-200 ${i === timeSlots.length - 1 ? "border-none" : ""}`}></div>
              ))}
            </div>
            <div className="relative w-full h-full min-h-[96px] z-10">
              {classes.map((item, idx) => {
                const startMin = timeToMinutes(item.start_time);
                const endMin = timeToMinutes(item.end_time);
                const duration = endMin - startMin;
                const widthPercent = (duration / TOTAL_MINUTES) * 100;
                const leftPercent = ((startMin - START_MINUTES) / TOTAL_MINUTES) * 100;
                const overlappingItems = classes.filter((c) => c.start_time === item.start_time && c.end_time === item.end_time);
                const totalOverlaps = overlappingItems.length;
                const myIndexInOverlap = overlappingItems.indexOf(item);
                const heightPercent = 100 / totalOverlaps;
                const topPercent = heightPercent * myIndexInOverlap;

                return (
                  <div
                    key={idx}
                    // เปลี่ยน onClick เป็นเรียก Modal
                    onClick={() => handleCourseClick(item)}
                    className="absolute bg-yellow-400 hover:bg-orange-500 hover:text-white border border-gray-300 shadow-sm cursor-pointer 
                    flex flex-col justify-center items-center text-center rounded-sm overflow-hidden p-1 transition-all hover:z-50 hover:scale-[1.02]"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      height: `${heightPercent}%`,
                      top: `${topPercent}%`,
                      zIndex: 10 + myIndexInOverlap,
                    }}
                    title="คลิกเพื่อดูรายละเอียด"
                  >
                    <div className="flex flex-col justify-center h-full w-full pointer-events-none">
                      <u className="font-bold text-xs sm:text-sm">{item.subject_id}</u>
                      <span className="font-medium text-[10px] sm:text-xs truncate w-full px-1 block">
                        {item.subject_name || "(ไม่มีชื่อ)"}
                      </span>
                      {totalOverlaps <= 2 && (
                        <div className="text-[9px] sm:text-[10px] leading-tight mt-0.5 opacity-90 hidden sm:block">
                          <div>กลุ่ม {item.group} | {item.room}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 h-full w-full flex flex-col relative">
      <h2 className="flex items-center space-x-2 text-lg font-semibold text-black mb-4">
        <span>📅</span>
        <span>ตารางสอน {teacherInfo && `(อ. ${teacherInfo.name})`}</span>
      </h2>

      {teacherInfo && (
        <h2 className="flex justify-center items-center gap-10 sm:gap-20 mb-6 text-sm sm:text-base">
          <div className="flex gap-2">
            <span>ปีการศึกษา</span>
            <b className="text-[#38A738] underline">{teacherInfo.year}</b>
          </div>
          <div className="flex gap-2 items-center">
            <span>ภาคการศึกษา</span>
            <div className="flex space-x-2 bg-gray-100 px-2 py-1 rounded-lg">
              {["1", "2", "3"].map((term) => (
                <button
                  key={term}
                  onClick={() => setSelectedTerm(term)}
                  className={`font-bold px-2 rounded-md transition-all ${
                    selectedTerm === term ? "text-[#38A738] underline cursor-default bg-white shadow-sm" : "text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </h2>
      )}

      <div className="overflow-x-auto w-full">
        <table className="w-full min-w-[800px] border-collapse border border-gray-300 table-fixed">
          <thead>
            <tr className="bg-gray-200 text-gray-700">
              <th className="border border-gray-300 p-2 w-[100px] text-center">วัน / เวลา</th>
              {timeSlots.map((t) => (
                <th key={t} className="border border-gray-300 p-1 text-xs sm:text-sm font-semibold text-center">
                  {t}:00 - {t + 1}:00
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{renderTableBody()}</tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
        <p className="font-semibold mb-1">* หมายเหตุ</p>
        <ul className="list-disc list-inside space-y-1">
          <li>คลิกที่แถบวิชาเพื่อดู <b>รายละเอียดรายวิชา</b> และทำการบันทึกการสอน</li>
        </ul>
      </div>

      {/* --- MODAL POPUP --- */}
      {showModal && modalData && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-opacity duration-300">
          <div 
            className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all scale-100 border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: เลียนแบบแถบสีเทาเข้มด้านบนของรูปตัวอย่าง */}
            <div className="bg-[#666666] text-white px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2 text-base font-semibold truncate">
                <BookOutlined />
                <span>{modalData.subject_id} - {modalData.group}</span>
              </div>
              <button onClick={closeModal} className="text-white/80 hover:text-white transition-colors">
                <CloseOutlined className="text-lg" />
              </button>
            </div>

            {/* Content Body: จัดวางแบบ Grid */}
            <div className="p-6 bg-white">
                <h3 className="text-xl font-bold text-gray-800 mb-1">
                    {modalData.full_subject_name}
                </h3>
                <hr className="border-gray-200 my-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    {/* แถว 1 */}
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-700">หมวดวิชา (Category)</span>
                        <span className="text-gray-600">{modalData.category || "-"}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-700">หน่วยกิต (Credit)</span>
                        <span className="text-gray-600">{modalData.credit || "-"}</span>
                    </div>

                    {/* แถว 2 */}
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-700">ห้องเรียน (Room)</span>
                        <span className="text-gray-600">{modalData.room || "-"}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-700">เวลาเรียน (Time)</span>
                        <span className="text-gray-600">
                            {modalData.start_time?.slice(0,5)} - {modalData.end_time?.slice(0,5)}
                        </span>
                    </div>

                    {/* แถว 3 สถานะ (Hardcode ไว้ก่อน หรือใช้ Logic เช็ค) */}
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-700">สถานะรายวิชา</span>
                        <span className="text-green-600 font-medium">ใช้งาน</span>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button 
                        onClick={closeModal}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                        ปิดหน้าต่าง
                    </button>
                    <button 
                        onClick={handleNavigateToRecord}
                        className="px-6 py-2 rounded-lg bg-[#38A738] text-white hover:bg-green-600 shadow-md hover:shadow-lg transition-all text-sm font-medium flex items-center gap-2"
                    >
                        <span>ไปหน้าบันทึกการสอน</span>
                        <span>→</span>
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;