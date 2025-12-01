import React, { useState, useEffect } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../config/supabase.js";
import { SubjectDetailModal } from "../components/SubjectDetailModal"; // 🟢 อย่าลืม Import Modal

// ==========================================
// 1. Constants & Helpers
// ==========================================

const BASE_CATEGORIES = [
  "หมวดวิชาศึกษาทั่วไป",
  "หมวดวิชาเฉพาะ",
  "หมวดวิชาเสรี",
];

// ฟังก์ชันจัดกลุ่มหมวดหมู่ (Mapping ชื่อจาก DB ให้เข้ากลุ่มหลัก)
const normalizeCategory = (dbCategory) => {
  if (!dbCategory) return null;
  const lower = dbCategory.toLowerCase().trim();

  if (lower.includes("ทั่วไป")) return "หมวดวิชาศึกษาทั่วไป";
  if (lower.includes("เฉพาะ") || lower.includes("เอก")) return "หมวดวิชาเฉพาะ";
  if (lower.includes("เสรี")) return "หมวดวิชาเสรี";

  return "หมวดวิชาศึกษาทั่วไป"; // Default Fallback
};

const getCategoryDescription = (title) => {
  switch (title) {
    case "หมวดวิชาศึกษาทั่วไป":
      return "วิชาพื้นฐานที่นักศึกษาทุกคณะต้องเรียน (GE)";
    case "หมวดวิชาเฉพาะ":
      return "วิชาบังคับและวิชาเลือกในสาขาวิชา";
    case "หมวดวิชาเสรี":
      return "วิชาที่นักศึกษาสามารถเลือกเรียนได้ตามความสนใจ";
    default:
      return "";
  }
};

// ==========================================
// 2. Sub-Component: CategoryItem
// ==========================================
const CategoryItem = ({
  title,
  subjects = [],
  description,
  onSubjectClick,
  isSearching,
}) => {
  // รับ prop เพิ่ม
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 🟢 แก้เงื่อนไข: เปิดเฉพาะเมื่อ "กำลังค้นหา (isSearching)" และมีผลลัพธ์
    if (isSearching && subjects.length > 0) {
      setIsOpen(true);
    } else if (!isSearching) {
      // (Optional) ถ้าเคลียร์ช่องค้นหา อยากให้พับเก็บเหมือนเดิมไหม? ถ้าใช่ใส่บรรทัดนี้
      setIsOpen(false);
    }
  }, [isSearching, subjects.length]);

  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex justify-between items-center w-full py-3 px-2 text-left text-[15px] font-semibold text-gray-800 
                    hover:bg-gray-50 rounded-lg transition-colors duration-200 ${
                      isOpen ? "bg-gray-50" : ""
                    }`}
      >
        <span className="flex items-center gap-2">
          {title}
          <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {subjects.length}
          </span>
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="pl-4 pb-3 pt-1 animate-fadeIn">
          <p className="text-xs text-gray-500 mb-2 pl-2 border-l-2 border-gray-200">
            {description}
          </p>

          {subjects.length > 0 ? (
            <ul className="grid grid-cols-1 md:grid-cols-1 mt-1">
              {subjects.map((s) => (
                <li
                  key={s.code}
                  onClick={() => onSubjectClick(s)} // 🟢 ส่ง event กลับไปหน้าหลัก
                  className="cursor-pointer group flex items-center justify-between p-2 rounded-md hover:bg-[#EEF2FF] border border-transparent hover:border-[#3D42D3]/20 transition-all duration-200"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-[#3D42D3] text-sm group-hover:underline">
                      {s.code}
                    </span>
                    <span
                      className="text-sm text-gray-700 truncate w-full max-w-[200px] md:max-w-[180px]"
                      title={s.name}
                    >
                      {s.name}
                    </span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Search className="w-4 h-4 text-[#3D42D3]" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 italic text-sm pl-2">
              - ไม่พบรายวิชาในหมวดนี้ -
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. Main Component: Adminsubject
// ==========================================
const Adminsubject = () => {
  // State Data
  const [searchTerm, setSearchTerm] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // --- Fetch Data ---
  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("subject_id, subject_name, category");

      if (error) throw error;

      // เตรียมโครงสร้าง Category ว่างๆ
      const grouped = BASE_CATEGORIES.map((cat) => ({
        title: cat,
        description: getCategoryDescription(cat),
        subjects: [],
      }));

      // Map Data เข้า Category
      if (data) {
        data.forEach((item) => {
          const categoryTitle = normalizeCategory(item.category);
          const group = grouped.find((g) => g.title === categoryTitle);

          if (group) {
            group.subjects.push({
              code: item.subject_id,
              name: item.subject_name,
              category: categoryTitle,
            });
          }
        });
      }

      setCategories(grouped);
    } catch (err) {
      console.error("Error fetching subjects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // --- Handlers ---
  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    setShowDetailModal(true);
  };

  // --- Search Logic ---
  const filteredCategories = categories.map((cat) => ({
    ...cat,
    subjects: cat.subjects.filter((s) =>
      (s.name + s.code).toLowerCase().includes(searchTerm.toLowerCase())
    ),
  }));

  // --- Render ---
  return (
    <>
      {/* Container หลัก */}
      <div className="w-full bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm p-6 h-[560px] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[18px] font-semibold text-gray-800">
            หมวดหมู่วิชา
          </h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
            รวม{" "}
            {categories.reduce((acc, curr) => acc + curr.subjects.length, 0)}{" "}
            วิชา
          </span>
        </div>

        {/* ช่องค้นหา */}
        <div className="relative mb-4 shrink-0 text-gray-500">
          <input
            type="text"
            placeholder="ค้นหารหัสวิชา หรือ ชื่อวิชา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#38A738] focus:border-transparent outline-none transition-all bg-[#F6F6F4]"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>

        {/* รายการหมวดหมู่ (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3D42D3]"></div>
              <p className="text-sm">กำลังโหลดข้อมูล...</p>
            </div>
          ) : filteredCategories.every((c) => c.subjects.length === 0) ? (
            <div className="text-center py-10 text-gray-400">
              <p>ไม่พบรายวิชาที่ค้นหา</p>
            </div>
          ) : (
            filteredCategories.map(
              (cat) =>
                // แสดงหมวดหมู่เฉพาะที่มีวิชาข้างใน (ถ้าค้นหาแล้วไม่เจอวิชาในหมวดนั้น ก็ซ่อนหมวดนั้นไปเลย)
                (searchTerm === "" || cat.subjects.length > 0) && (
                  // ... (ใน loop filteredCategories.map)
                  <CategoryItem
                    key={cat.title}
                    title={cat.title}
                    description={cat.description}
                    subjects={cat.subjects}
                    onSubjectClick={handleSubjectClick}
                    isSearching={searchTerm.length > 0} // 🟢 ส่ง flag ว่ากำลังค้นหาอยู่ไหม
                  />
                )
            )
          )}
        </div>
      </div>

      {/* 🟢 Modal จะแสดงเมื่อ State เป็น true */}
      <SubjectDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSubject(null);
        }}
        subject={selectedSubject}
      />
    </>
  );
};

export default Adminsubject;
