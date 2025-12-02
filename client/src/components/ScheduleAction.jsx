import React, { useState, useEffect } from "react";
import { TimePicker, Select } from "antd"; 
import toast from "react-hot-toast"; 
import dayjs from "dayjs"; // 🟢 เพิ่ม dayjs เพื่อจัดการเวลา
import { supabase } from "../config/supabase.js"; 

const format = "HH:mm"; 

const disabledRangeTime = (_, type) => {
  const disabledHours = () => {
    let hours = [];
    for (let i = 0; i < 8; i++) hours.push(i); 
    for (let i = 18; i < 24; i++) hours.push(i); 
    return hours;
  };
  return {
    disabledHours,
    disabledMinutes: () => [],
  };
};

// ==========================================
// 2. Component: UploadScheduleAction (อัพโหลดตารางสอน)
// ==========================================
export const UploadScheduleAction = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    subjectList = [], 
    groupedSubjects = {}, 
    teacherList = []  
}) => {
  const [selectedCode, setSelectedCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectcredit, setSubjectcredit] = useState("");

  const [isTeacherFocused, setIsTeacherFocused] = useState(false);
  const [isSubjectFocused, setIsSubjectFocused] = useState(false);

  const [classSchedule, setClassSchedule] = useState({
    year: "",
    semester: "",
    group: "",
    day: "",
    room: "",
    building: "",
    teacher_id: "",
    teacher_name: "",
    classTimes: null,
  });

  useEffect(() => {
    if (isOpen) {
        setSelectedCode("");
        setSubjectName("");
        setSubjectcredit("");
        setIsTeacherFocused(false);
        setIsSubjectFocused(false);
        setClassSchedule({
            year: "",
            semester: "",
            group: "",
            day: "",
            room: "",
            building: "",
            teacher_id: "",
            teacher_name: "",
            classTimes: null,
        });
    }
  }, [isOpen]);

  const handleUploadSchedule = async (e) => {
    e.preventDefault();

    // 1. Validation พื้นฐาน (เหมือนเดิม)
    if (
      !selectedCode || !subjectName || !classSchedule.year || !classSchedule.semester ||
      !classSchedule.group || !classSchedule.day || !classSchedule.room || !classSchedule.building ||
      !classSchedule.teacher_id || !classSchedule.teacher_name || !classSchedule.classTimes
    ) {
      toast.error("กรุณากรอกข้อมูลตารางสอนให้ครบถ้วน ⚠️");
      return;
    }

    const startStr = classSchedule.classTimes[0].format(format);
    const endStr = classSchedule.classTimes[1].format(format);

    // ----------------------------------------------------
    // 🔴 ส่วนตรวจสอบตาราง (ฉบับสมบูรณ์: Co-teaching + Multitasking)
    // ----------------------------------------------------
    try {
      const { data: existingSchedules, error: checkError } = await supabase
        .from("class_schedule")
        .select("*")
        .eq("year", classSchedule.year)
        .eq("semester", classSchedule.semester)
        .eq("day", classSchedule.day);

      if (checkError) throw checkError;

      const newStart = dayjs(`2000-01-01 ${startStr}`);
      const newEnd = dayjs(`2000-01-01 ${endStr}`);

      for (const existing of existingSchedules) {
        
        // 1. เช็ค Duplicate เป๊ะๆ (วิชาเดิม + กลุ่มเดิม + อาจารย์คนเดิม)
        if (
            existing.subject_id === selectedCode && 
            existing.group === classSchedule.group &&
            existing.teacher_id === classSchedule.teacher_id
        ) {
            toast.error(`ข้อมูลซ้ำ: อาจารย์ ${classSchedule.teacher_name} มีตารางสอนวิชานี้ กลุ่มนี้ อยู่แล้ว`);
            return;
        }

        // 2. เช็คเวลาชน (Time Overlap)
        const existStart = dayjs(`2000-01-01 ${existing.start_time}`);
        const existEnd = dayjs(`2000-01-01 ${existing.end_time}`);
        const isTimeOverlap = newStart.isBefore(existEnd) && newEnd.isAfter(existStart);

        if (isTimeOverlap) {
            
            // 🟢 CASE A: เช็คอาจารย์ชน (Teacher Conflict)
            if (existing.teacher_id === classSchedule.teacher_id) {
                // อาจารย์คนเดียวกัน เวลาชนกัน...
                
                // เช็คว่า "ห้องเดียวกัน" ไหม?
                if (existing.room === classSchedule.room && existing.building === classSchedule.building) {
                    // ✅ ถ้าห้องเดียวกัน -> อนุญาต! (อาจารย์สอน 2 วิชาในห้องเดิมพร้อมกัน)
                    // ไม่ต้องทำอะไร ปล่อยผ่านไปเช็ค Loop ถัดไป
                    continue; 
                } else {
                    // ❌ ถ้าคนละห้อง -> ห้าม! (อาจารย์แยกร่างไปสอนอีกห้องไม่ได้)
                    toast.error(`ไม่สามารถเพิ่มได้: อาจารย์ ${classSchedule.teacher_name} ติดสอนอยู่ที่ห้อง ${existing.room} ในเวลานี้`);
                    return;
                }
            }

            // 🟢 CASE B: เช็คห้องชน (Room Conflict) - กรณีคนละอาจารย์ (เพราะถ้าอาจารย์เดียวกัน Case A จัดการไปแล้ว)
            if (existing.room === classSchedule.room && existing.building === classSchedule.building) {
                
                // เช็คว่าเป็น "วิชาเดียวกัน + กลุ่มเดียวกัน" ไหม? (Co-teaching)
                const isSameSubjectAndGroup = (existing.subject_id === selectedCode && existing.group === classSchedule.group);

                if (isSameSubjectAndGroup) {
                    // ✅ อนุญาต: Co-teaching (วิชาเดิม คนละอาจารย์ ห้องเดิม)
                    continue;
                } else {
                    // ❌ ไม่อนุญาต: มีคนอื่นใช้ออกอยู่สอนวิชาอื่น
                    toast.error(`ห้อง ${classSchedule.room} ไม่ว่าง (มีสอนวิชา ${existing.subject_id})`);
                    return;
                }
            }
        }
      }

    } catch (err) {
      console.error("Check duplicate error:", err);
      toast.error("เกิดข้อผิดพลาดในการตรวจสอบ");
      return;
    }
    // ----------------------------------------------------

    // ถ้าผ่านหมด ก็ Insert ตามปกติ
    const dataToInsert = {
      subject_id: selectedCode,
      subject_name: subjectName,
      year: classSchedule.year,
      semester: classSchedule.semester,
      group: classSchedule.group,
      day: classSchedule.day,
      room: classSchedule.room,
      building: classSchedule.building,
      teacher_id: classSchedule.teacher_id,
      teacher_name: classSchedule.teacher_name,
      credit: subjectcredit,
      start_time: startStr,
      end_time: endStr,
    };

    const { error } = await supabase.from("class_schedule").insert([dataToInsert]);

    if (error) {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    } else {
      toast.success("เพิ่มอาจารย์เข้าสู่ตารางสอนเรียบร้อย!"); // เปลี่ยนข้อความให้สื่อความหมาย
      onSuccess(); 
      onClose();   
    }
  };

  const subjectOptions = Object.keys(groupedSubjects).map(category => ({
    label: category,
    options: groupedSubjects[category].map(sub => ({
        label: `${sub.subject_id} - ${sub.subject_name}`,
        value: sub.subject_id,
    }))
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
        <style>{`
            .ant-select-custom .ant-select-selector {
                background-color: #f9fafb !important; /* bg-gray-50 */
                border-color: #d1d5db !important; /* border-gray-300 */
                border-radius: 0.375rem !important; /* rounded-md */
                height: 42px !important;
                display: flex !important;
                align-items: center !important;
            }
            .ant-select-custom .ant-select-selector input {
                height: 100% !important;
            }
        `}</style>

      <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-2xl border border-gray-300">
        <h2 className="text-2xl font-bold mb-6">อัพโหลดตารางสอน</h2>

        <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="relative">
            <Select
                showSearch
                placeholder=" "
                optionFilterProp="label" 
                value={selectedCode || undefined}
                onFocus={() => setIsSubjectFocused(true)}
                onBlur={() => setIsSubjectFocused(false)}
                onChange={(code) => {
                    setSelectedCode(code);
                    const selected = subjectList.find((item) => item.subject_id === code);
                    setSubjectName(selected?.subject_name || "");
                    setSubjectcredit(selected?.credit || "");
                }}
                options={subjectOptions} 
                style={{ width: "100%", height: "42px" }}
                className="ant-select-custom" 
            />
            <label className={`absolute left-3 bg-gray-50 px-1 transition-all pointer-events-none
              ${selectedCode || isSubjectFocused 
                  ? "-top-2.5 text-sm text-[#38A738]" 
                  : "top-2.5 text-base text-gray-400"
              }
            `}>
              เลือกรหัสวิชา<span className="text-red-500"> *</span>
            </label>
          </div>

          <div className="relative">
            <Select
              showSearch
              placeholder=" "
              optionFilterProp="children"
              value={classSchedule.teacher_id || undefined}
              onFocus={() => setIsTeacherFocused(true)}
              onBlur={() => setIsTeacherFocused(false)}
              onChange={(selectedId) => {
                const selectedTeacher = teacherList.find((t) => t.value === selectedId);
                setClassSchedule({
                  ...classSchedule,
                  teacher_id: selectedId,
                  teacher_name: selectedTeacher ? selectedTeacher.fullName : "",
                });
              }}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
              options={teacherList}
              style={{ width: "100%", height: "42px" }}
              className="ant-select-custom" 
            />
            <label className={`absolute left-3 bg-gray-50 px-1 transition-all pointer-events-none
              ${classSchedule.teacher_id || isTeacherFocused 
                  ? "-top-2.5 text-sm text-[#38A738]" 
                  : "top-2.5 text-base text-gray-400"
              }
            `}>
              อาจารย์ผู้สอน<span className="text-red-500"> *</span>
            </label>
          </div>

          <input type="text" placeholder="ชื่อวิชา" value={subjectName} readOnly className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-200" />

          <input type="text" placeholder="หน่วยกิต" value={subjectcredit} readOnly className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-200" />

          <div className="relative">
            <input
              type="text"
              id="year"
              required
              value={classSchedule.year}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, ''); 
                setClassSchedule({ ...classSchedule, year: value });
              }}
              className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
              placeholder="ปีการศึกษา"
            />
            <label htmlFor="year" className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">
              ปีการศึกษา<span className="text-red-500"> *</span>
            </label>
          </div>

          <div className="relative">
            <select
              id="semester"
              required
              value={classSchedule.semester}
              onChange={(e) => setClassSchedule({ ...classSchedule, semester: e.target.value })}
              className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 appearance-none placeholder-transparent"
            >
              <option value="" disabled></option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
            <label htmlFor="semester" className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none ${classSchedule.semester ? "-top-2.5 text-gray-400" : "top-2.5 text-gray-400"}`}>
              ภาคการศึกษา <span className="text-red-500">*</span>
            </label>
          </div>

          <div className="relative">
            <input
              type="text"
              id="group"
              required
              value={classSchedule.group}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, ''); 
                setClassSchedule({ ...classSchedule, group: value });
              }}
              className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
              placeholder="กลุ่ม"
            />
            <label htmlFor="group" className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">
              กลุ่ม<span className="text-red-500"> *</span>
            </label>
          </div>

          <div className="relative">
            <select
              id="day"
              required
              value={classSchedule.day}
              onChange={(e) => setClassSchedule({ ...classSchedule, day: e.target.value })}
              className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 appearance-none placeholder-transparent"
            >
              <option value="" disabled></option>
              <option value="จันทร์">จันทร์</option>
              <option value="อังคาร">อังคาร</option>
              <option value="พุธ">พุธ</option>
              <option value="พฤหัสบดี">พฤหัสบดี</option>
              <option value="ศุกร์">ศุกร์</option>
              <option value="เสาร์">เสาร์</option>
              <option value="อาทิตย์">อาทิตย์</option>
            </select>
            <label htmlFor="day" className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none ${classSchedule.day ? "-top-2.5 text-gray-400 " : "top-2.5 text-gray-400"}`}>
              วัน (จ-อา)<span className="text-red-500"> *</span>
            </label>
          </div>

          <div className="relative">
            <TimePicker.RangePicker
              value={classSchedule.classTimes}
              onChange={(times) => setClassSchedule({ ...classSchedule, classTimes: times || null })}
              format={format}
              style={{ width: "100%" }}
              disabledTime={disabledRangeTime} 
              className="h-[42px] border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <input
              type="text"
              id="room"
              required
              value={classSchedule.room}
              onChange={(e) => {
                const value = e.target.value.replace(/[^A-Za-z0-9]/g, ''); 
                setClassSchedule({ ...classSchedule, room: value });
              }}
              className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
              placeholder="ห้องเรียน"
            />
            <label htmlFor="room" className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">
              ห้องเรียน<span className="text-red-500"> *</span>
            </label>
          </div>

          <div className="relative">
            <input
              type="text"
              id="building"
              required
              value={classSchedule.building}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 2); // 🟢 จำกัดตัวอักษร 2 ตัว
                setClassSchedule({ ...classSchedule, building: value });
              }}
              className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50"
              placeholder="ตึก"
            />
            <label htmlFor="building" className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">
              ตึก<span className="text-red-500"> *</span>
            </label>
          </div>
        </form>

        <div className="flex justify-end mt-6 gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">
            ยกเลิก
          </button>
          <button type="button" onClick={handleUploadSchedule} className="px-5 py-2 bg-[#3F37C9] text-white rounded-md hover:bg-[#2b28a0]">
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. Component: EditScheduleAction (แก้ไขตารางสอน) 🟢 NEW
// ==========================================
export const EditScheduleAction = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  scheduleData, 
  subjectList = [], 
  groupedSubjects = {}, 
  teacherList = []  
}) => {
  // States
  const [selectedCode, setSelectedCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectcredit, setSubjectcredit] = useState("");
  
  const [isTeacherFocused, setIsTeacherFocused] = useState(false);
  const [isSubjectFocused, setIsSubjectFocused] = useState(false);

  const [classSchedule, setClassSchedule] = useState({
    year: "", semester: "", group: "", day: "", room: "", building: "", teacher_id: "", teacher_name: "", classTimes: null,
  });

  // 🟢 Load data on open
  useEffect(() => {
    if (isOpen && scheduleData) {
      setSelectedCode(scheduleData.code);
      setSubjectName(scheduleData.name);
      setSubjectcredit(scheduleData.credit);
      
      let times = null;
      if (scheduleData.startTimeStr && scheduleData.endTimeStr) {
        times = [dayjs(scheduleData.startTimeStr, "HH:mm:ss"), dayjs(scheduleData.endTimeStr, "HH:mm:ss")];
      }

      setClassSchedule({
        year: scheduleData.year,
        semester: scheduleData.semester,
        group: scheduleData.group,
        day: scheduleData.day,
        room: scheduleData.room,
        building: scheduleData.building,
        teacher_id: scheduleData.teacherIdRaw,
        teacher_name: scheduleData.teacher,
        classTimes: times,
      });
    }
  }, [isOpen, scheduleData]);

  const handleUpdateSchedule = async (e) => {
    e.preventDefault();

    // Basic Validation
    if (!selectedCode || !classSchedule.teacher_id || !classSchedule.year) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน ⚠️");
      return;
    }

    const dataToUpdate = {
      subject_id: selectedCode,
      subject_name: subjectName,
      year: classSchedule.year,
      semester: classSchedule.semester,
      group: classSchedule.group,
      day: classSchedule.day,
      room: classSchedule.room,
      building: classSchedule.building,
      teacher_id: classSchedule.teacher_id,
      teacher_name: classSchedule.teacher_name,
      credit: subjectcredit,
      start_time: classSchedule.classTimes ? classSchedule.classTimes[0].format("HH:mm:ss") : null,
      end_time: classSchedule.classTimes ? classSchedule.classTimes[1].format("HH:mm:ss") : null,
    };

    const { error } = await supabase
        .from("class_schedule")
        .update(dataToUpdate)
        .eq("class_schedule_id", scheduleData.id);

    if (error) {
      toast.error(`เกิดข้อผิดพลาดในการแก้ไข: ${error.message}`);
    } else {
      toast.success("แก้ไขข้อมูลสำเร็จ!");
      onSuccess();
      onClose();
    }
  };

  const subjectOptions = Object.keys(groupedSubjects).map(category => ({
    label: category,
    options: groupedSubjects[category].map(sub => ({
        label: `${sub.subject_id} - ${sub.subject_name}`,
        value: sub.subject_id,
    }))
  }));

  if (!isOpen) return null;

  // Reuse similar UI structure as Upload
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm">
        <style>{`
            .ant-select-custom .ant-select-selector {
                background-color: #f9fafb !important; 
                border-color: #d1d5db !important; 
                border-radius: 0.375rem !important; 
                height: 42px !important;
                display: flex !important;
                align-items: center !important;
            }
            .ant-select-custom .ant-select-selector input {
                height: 100% !important;
            }
        `}</style>

      <div className="bg-[#f8f8f8] p-8 rounded-lg shadow-lg w-[90%] max-w-2xl border border-gray-300">
        <h2 className="text-2xl font-bold mb-6">แก้ไขตารางสอน</h2>

        <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subject Select */}
          <div className="relative">
            <Select
                showSearch
                placeholder=" "
                optionFilterProp="label"
                value={selectedCode || undefined}
                onFocus={() => setIsSubjectFocused(true)}
                onBlur={() => setIsSubjectFocused(false)}
                onChange={(code) => {
                    setSelectedCode(code);
                    const selected = subjectList.find((item) => item.subject_id === code);
                    setSubjectName(selected?.subject_name || "");
                    setSubjectcredit(selected?.credit || "");
                }}
                options={subjectOptions}
                style={{ width: "100%", height: "42px" }}
                className="ant-select-custom"
            />
            <label className={`absolute left-3 bg-gray-50 px-1 transition-all pointer-events-none ${selectedCode || isSubjectFocused ? "-top-2.5 text-sm text-[#38A738]" : "top-2.5 text-base text-gray-400"}`}>
              เลือกรหัสวิชา<span className="text-red-500"> *</span>
            </label>
          </div>

          <input type="text" value={subjectName} readOnly className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-200" />
          <input type="text" value={subjectcredit} readOnly className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-200" />

          {/* Teacher Select */}
          <div className="relative">
            <Select
              showSearch
              placeholder=" "
              optionFilterProp="children"
              value={classSchedule.teacher_id || undefined}
              onFocus={() => setIsTeacherFocused(true)}
              onBlur={() => setIsTeacherFocused(false)}
              onChange={(selectedId) => {
                const selectedTeacher = teacherList.find((t) => t.value === selectedId);
                setClassSchedule({
                  ...classSchedule,
                  teacher_id: selectedId,
                  teacher_name: selectedTeacher ? selectedTeacher.fullName : "",
                });
              }}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
              options={teacherList}
              style={{ width: "100%", height: "42px" }}
              className="ant-select-custom"
            />
            <label className={`absolute left-3 bg-gray-50 px-1 transition-all pointer-events-none ${classSchedule.teacher_id || isTeacherFocused ? "-top-2.5 text-sm text-[#38A738]" : "top-2.5 text-base text-gray-400"}`}>
              อาจารย์ผู้สอน<span className="text-red-500"> *</span>
            </label>
          </div>

          {/* Year */}
          <div className="relative">
            <input type="text" required value={classSchedule.year} onChange={(e) => setClassSchedule({ ...classSchedule, year: e.target.value.replace(/[^0-9]/g, '') })} className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50" placeholder="ปีการศึกษา" />
            <label className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">ปีการศึกษา</label>
          </div>

          {/* Semester */}
          <div className="relative">
            <select required value={classSchedule.semester} onChange={(e) => setClassSchedule({ ...classSchedule, semester: e.target.value })} className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 appearance-none placeholder-transparent">
              <option value="" disabled></option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
            </select>
            <label className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none ${classSchedule.semester ? "-top-2.5 text-gray-400" : "top-2.5 text-gray-400"}`}>ภาคการศึกษา</label>
          </div>

          {/* Group */}
          <div className="relative">
            <input type="text" required value={classSchedule.group} onChange={(e) => setClassSchedule({ ...classSchedule, group: e.target.value.replace(/[^0-9]/g, '') })} className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50" placeholder="กลุ่ม" />
            <label className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">กลุ่ม</label>
          </div>

          {/* Day */}
          <div className="relative">
            <select required value={classSchedule.day} onChange={(e) => setClassSchedule({ ...classSchedule, day: e.target.value })} className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] bg-gray-50 appearance-none placeholder-transparent">
              <option value="" disabled></option><option value="จันทร์">จันทร์</option><option value="อังคาร">อังคาร</option><option value="พุธ">พุธ</option><option value="พฤหัสบดี">พฤหัสบดี</option><option value="ศุกร์">ศุกร์</option><option value="เสาร์">เสาร์</option><option value="อาทิตย์">อาทิตย์</option>
            </select>
            <label className={`absolute left-3 bg-gray-50 px-1 text-sm transition-all pointer-events-none ${classSchedule.day ? "-top-2.5 text-gray-400 " : "top-2.5 text-gray-400"}`}>วัน</label>
          </div>

          {/* Time */}
          <div className="relative">
            <TimePicker.RangePicker value={classSchedule.classTimes} onChange={(times) => setClassSchedule({ ...classSchedule, classTimes: times || null })} format={format} style={{ width: "100%" }} disabledTime={disabledRangeTime} className="h-[42px] border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Room */}
          <div className="relative">
            <input type="text" required value={classSchedule.room} onChange={(e) => setClassSchedule({ ...classSchedule, room: e.target.value.replace(/[^A-Za-z0-9]/g, '') })} className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50" placeholder="ห้องเรียน" />
            <label className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">ห้องเรียน</label>
          </div>

          {/* Building */}
          <div className="relative">
            <input type="text" required value={classSchedule.building} onChange={(e) => setClassSchedule({ ...classSchedule, building: e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() })} className="peer w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738] placeholder-transparent bg-gray-50" placeholder="ตึก" />
            <label className="absolute left-3 -top-2.5 bg-gray-50 px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-[#38A738]">ตึก</label>
          </div>
        </form>

        <div className="flex justify-end mt-6 gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">ยกเลิก</button>
          <button type="button" onClick={handleUpdateSchedule} className="px-5 py-2 bg-[#3F37C9] text-white rounded-md hover:bg-[#2b28a0]">บันทึกการแก้ไข</button>
        </div>
      </div>
    </div>
  );
};