import React, { useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import { TimePicker } from "antd";
import dayjs from "dayjs";

import { supabase } from "../../config/supabase.js";

const AdminTeachers = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [subjectList, setSubjectList] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectcredit, setSubjectcredit] = useState("");

  const [newSubject, setNewSubject] = useState({
    subject_id: "",
    subject_name: "",
    credit: "",
    category: "",
  });

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("subject_id, subject_name, credit");

    if (error) console.error(error);
    else setSubjectList(data);
  };

  React.useEffect(() => {
    fetchSubjects();
  }, []);

  React.useEffect(() => {
    const isModalOpen = showAddModal || showUploadModal;
    document.body.style.overflow = isModalOpen ? "hidden" : "unset";
    return () => (document.body.style.overflow = "unset");
  }, [showAddModal, showUploadModal]);

  const handleAddSubject = async (e) => {
    e.preventDefault();

    if (
      !newSubject.subject_id ||
      !newSubject.subject_name ||
      !newSubject.credit ||
      !newSubject.category
    ) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    const { error } = await supabase.from("subjects").insert([
      {
        subject_id: newSubject.subject_id,
        subject_name: newSubject.subject_name,
        credit: newSubject.credit,
        category: newSubject.category,
      },
    ]);

    if (error) {
      alert("เกิดข้อผิดพลาด");
      console.error(error);
    } else {
      alert("เพิ่มรายวิชาสำเร็จ!");
      setNewSubject({
        subject_id: "",
        subject_name: "",
        credit: "",
        category: "",
      });
      setShowAddModal(false);
      fetchSubjects();
    }
  };

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

  const format = "HH:mm:ss";
  const startTime = dayjs("12:08:23", "HH:mm:ss");
  const endTime = dayjs("12:08:23", "HH:mm:ss");

  return (
    <div className="min-h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-4 p-4">
      <aside className="w-full md:w-64">
        <AdminNavbar />
      </aside>

      {/* --------- MAIN CONTENT --------- */}
      <div className="flex-1 transition-all lg:pl-[0rem] md:pl-0 sm:pl-0 h-screen overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-4">
          {/* Header */}
          <div className="w-full bg-white rounded-[15px] border border-[#e9e9e9] shadow-sm h-20 md:h-16 px-6 flex items-center justify-between sticky top-[20px] z-30">
            <h1 className="text-[22px] md:text-[18px] font-semibold">รายวิชา</h1>
          </div>

          {/* Main Table Container */}
          <div className="bg-white mt-9 p-4 rounded-[20px] shadow-sm border border-[#e9e9e9]">
            {/* TOP BAR */}
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2 sticky top-[90px] z-20 bg-white pb-4 border-b border-gray-100 ml-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2 font-bold text-gray-800">วิชาสอน</div>
                <input
                  type="text"
                  placeholder="🔍 ค้นหา"
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-full bg-[#F6F6F4]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-[#38A738] hover:bg-[#2d7c2d] text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  เพิ่มรายวิชา
                </button>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-[#3D42D3] hover:bg-[#2b28a0] text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  อัพโหลดตารางสอน
                </button>
              </div>
            </div>

            {/* TABLE */}
            <div className="max-h-[620px] overflow-y-scroll overflow-x-auto relative">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-[#f2f2f2] sticky top-0 z-[5]">
                  <tr>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      รหัสวิชา
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ชื่อวิชา
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ปีการศึกษา
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ภาคการศึกษา
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      กลุ่ม
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      วัน
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      เวลาเรียน
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ห้องเรียน
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      ตึก
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      หน่วยกิต
                    </th>
                    <th className="text-left px-4 py-2 border border-gray-300">
                      อาจารย์ผู้สอน
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {teachers.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border border-gray-300">
                        {t.code}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.name}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.year}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.semester}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.group}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.day}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.time}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.room}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.building}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.credit}
                      </td>
                      <td className="px-4 py-2 border border-gray-300">
                        {t.teacher}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- */}
      {/*                     MODAL: เพิ่มรายวิชา                     */}
      {/* ---------------------------------------------------------- */}

      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-xl border border-gray-300">
            <h2 className="text-2xl font-bold mb-6">เพิ่มรายวิชา</h2>

            <form onSubmit={handleAddSubject} className="grid grid-cols-1 gap-4">
              <input
                type="text"
                placeholder="กรอกรหัสวิชา"
                required
                value={newSubject.subject_id}
                onChange={(e) =>
                  setNewSubject({ ...newSubject, subject_id: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />

              <input
                type="text"
                placeholder="กรอกชื่อวิชา"
                required
                value={newSubject.subject_name}
                onChange={(e) =>
                  setNewSubject({
                    ...newSubject,
                    subject_name: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />

              <input
                type="number"
                placeholder="หน่วยกิต"
                required
                value={newSubject.credit}
                onChange={(e) =>
                  setNewSubject({ ...newSubject, credit: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />

              <select
                required
                value={newSubject.category}
                onChange={(e) =>
                  setNewSubject({ ...newSubject, category: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              >
                <option value="">เลือกหมวดหมู่</option>
                <option value="วิชาทั่วไป">วิชาทั่วไป</option>
                <option value="วิชาเฉพาะ">วิชาเฉพาะ</option>
                <option value="วิชาเสรี">วิชาเสรี</option>
              </select>

              <div className="flex justify-end mt-6 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewSubject({
                      subject_id: "",
                      subject_name: "",
                      credit: "",
                      category: "",
                    });
                  }}
                  className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-[#38A738] text-white rounded-md hover:bg-[#2d7c2d]"
                >
                  เพิ่ม
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {/*                MODAL: อัพโหลดตารางสอน                      */}
      {/* ---------------------------------------------------------- */}

      {showUploadModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-2xl border border-gray-300">
            <h2 className="text-2xl font-bold mb-6">อัพโหลดตารางสอน</h2>

            <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                value={selectedCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setSelectedCode(code);

                  const selected = subjectList.find(
                    (item) => item.subject_id === code
                  );
                  setSubjectName(selected?.subject_name || "");
                  setSubjectcredit(selected?.credit || "");
                }}
              >
                <option value="">เลือกรหัสวิชา</option>

                {subjectList.map((sub) => (
                  <option key={sub.subject_id} value={sub.subject_id}>
                    {sub.subject_id}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="ชื่อวิชา"
                value={subjectName}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-200"
              />

              <input
                type="text"
                placeholder="ปีการศึกษา"
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                placeholder="ภาคการศึกษา"
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />

              <input
                type="text"
                placeholder="กลุ่ม"
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />

              <input
                type="text"
                placeholder="วัน (จ-อา)"
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />

              <TimePicker.RangePicker
                defaultValue={[startTime, endTime]}
                format={format}
                style={{ width: "100%" }}
              />

              <input
                type="text"
                placeholder="ห้องเรียน"
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />

              <input
                type="text"
                placeholder="ตึก"
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />

              <input
                type="text"
                placeholder="หน่วยกิต"
                value={subjectcredit}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-200"
              />

              <input
                type="text"
                placeholder="อาจารย์ผู้สอน"
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />
            </form>

            <div className="flex justify-end mt-6 gap-2">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedCode("");
                  setSubjectName("");
                  setSubjectcredit("");
                }}
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
