import React, { useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CategoryItem = ({ title, subjects = [], description }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // ✅ ฟังก์ชันเมื่อคลิกชื่อวิชา
  const handleClick = (subject) => {
    navigate(`/admin/subject/${subject.id}`, { state: { subject } });
  };

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex justify-between items-center w-full py-2 text-left text-[15px] font-semibold text-gray-800 hover:bg-gray-50"
      >
        {title}
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-600" />
        )}
      </button>

      {open && (
        <div className="pl-3 pb-3 text-sm text-gray-700">
          {description && <p className="mb-2 text-gray-500">{description}</p>}

          {/* ✅ รายชื่อวิชาในหมวด */}
          <ul className="space-y-1">
            {subjects.map((s) => (
              <li
                key={s.id}
                onClick={() => handleClick(s)}
                className="cursor-pointer hover:bg-gray-100 p-1 rounded-md transition"
              >
                {s.code} - {s.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const Adminsubject = () => {
  const [searchTerm, setSearchTerm] = useState("");

  // ✅ ตัวอย่างข้อมูลจำลอง
  const data = [
    {
      title: "หมวดวิชาศึกษาทั่วไป",
      description: "วิชาทั่วไป เช่น GE ต่างๆ",
      subjects: [
        { id: 1, code: "GE101", name: "ภาษาไทยเพื่อการสื่อสาร" },
        { id: 2, code: "GE102", name: "ภาษาอังกฤษพื้นฐาน" },
        { id: 3, code: "GE201", name: "มนุษย์กับสังคม" },
      ],
    },
    {
      title: "หมวดวิชาเฉพาะ",
      description: "วิชาเฉพาะตามคณะ เช่น วิศวกรรม, บัญชี, การตลาด",
      subjects: [
        { id: 4, code: "IT301", name: "โครงสร้างข้อมูลและอัลกอริทึม" },
        { id: 5, code: "IT302", name: "เครือข่ายคอมพิวเตอร์" },
        { id: 6, code: "IT401", name: "ปัญญาประดิษฐ์เบื้องต้น" },
      ],
    },
    {
      title: "หมวดวิชาเสรี",
      description: "วิชาเลือกเสรี",
      subjects: [
        { id: 7, code: "EL101", name: "การถ่ายภาพเบื้องต้น" },
        { id: 8, code: "EL102", name: "พื้นฐานการทำอาหาร" },
      ],
    },
  ];

  // ✅ กรองข้อมูลตามช่องค้นหา
  const filteredData = data.map((cat) => ({
    ...cat,
    subjects: cat.subjects.filter((s) =>
      (s.name + s.code).toLowerCase().includes(searchTerm.toLowerCase())
    ),
  }));

  return (
    <div className="w-full bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm p-6 sm:p-5 md:p-6">
      <h2 className="text-[16px] font-semibold mb-3">หมวดหมู่วิชา</h2>

      {/* 🔍 ช่องค้นหา */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="ค้นหา"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-gray-200 outline-none"
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>

      {/* 🧩 แสดงหมวดหมู่ */}
      <div className="flex-1">
        {filteredData.map((cat) => (
          <CategoryItem
            key={cat.title}
            title={cat.title}
            description={cat.description}
            subjects={cat.subjects}
          />
        ))}
      </div>
    </div>
  );
};

export default Adminsubject;
