import React, { useState, useEffect } from "react"; 
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabase.js";

// 🔑 หมวดหมู่หลัก (ใช้เป็น Title) - ชื่อที่ใช้ในโค้ด
const BASE_CATEGORIES = [
  "หมวดวิชาศึกษาทั่วไป",
  "หมวดวิชาเฉพาะ",
  "หมวดวิชาเสรี",
];

// 💡 ฟังก์ชันแปลงชื่อหมวดหมู่จาก DB ให้เข้ากับ BASE_CATEGORIES
const normalizeCategory = (dbCategory) => {
    if (!dbCategory) return null; // จัดการ NULL หรือค่าว่าง
    const lowerCaseCategory = dbCategory.toLowerCase().trim();

    // 🔑 แก้ไข: ให้ครอบคลุม 'ทั่วไป' (แบบสั้น)
    if (lowerCaseCategory === 'ทั่วไป' || lowerCaseCategory.includes('ทั่วไป')) {
        return "หมวดวิชาศึกษาทั่วไป";
    }
    // 🔑 แก้ไข: ให้ครอบคลุม 'วิชาเฉพาะ'
    if (lowerCaseCategory.includes('เฉพาะ')) {
        return "หมวดวิชาเฉพาะ";
    }
    // 🔑 แก้ไข: ให้ครอบคลุม 'วิชาเสรี'
    if (lowerCaseCategory.includes('เสรี')) {
        return "หมวดวิชาเสรี";
    }
    return null; 
}

// 🔑 ฟังก์ชันบรรยายหมวด
const getCategoryDescription = (title) => {
  switch (title) {
    case "หมวดวิชาศึกษาทั่วไป":
      return "วิชาทั่วไป เช่น GE ต่างๆ";
    case "หมวดวิชาเฉพาะ":
      return "วิชาเฉพาะตามคณะ";
    case "หมวดวิชาเสรี":
      return "วิชาเลือกเสรี";
    default:
      return "";
  }
};

// 🔹 หน่วยย่อยของหมวดหมู่
const CategoryItem = ({ title, subjects = [], description }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = (subject) => {
    console.log("open subject:", subject);
  };

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className={`flex justify-between items-center w-full py-2 text-left text-[15px] font-semibold text-gray-900 
                    hover:bg-gray-50 transition ${
                      open ? "sticky top-0 bg-white z-10 shadow-sm" : ""
                    }`}
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="pl-4 pb-3 text-sm">
          <p className="text-gray-500 mb-2">{description}</p>

          {subjects.length > 0 ? (
            <ul className="space-y-1">
              {subjects.map((s) => (
                <li
                  // 🔑 แก้ไข: ใช้ s.code (subject_id) เป็น Key แทน s.id 
                  // เนื่องจาก s.code ไม่ซ้ำกันและถูกดึงมาใน Query
                  key={s.code}
                  onClick={() => handleClick(s)}
                  className="cursor-pointer hover:bg-gray-100 p-1 rounded-md"
                >
                  {s.code} - {s.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 italic">
                {/* ข้อความนี้จะแสดงเมื่อมีการกดขยาย แต่ไม่มีวิชาในหมวดหมู่นั้น */}
                ไม่พบวิชาที่ค้นหาในหมวดหมู่นี้
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// 🔥 คอมโพเนนต์หลัก
const Adminsubject = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null); 
  const [hasData, setHasData] = useState(false); 

  // --------------------
  // 🔥 ดึงข้อมูลจาก Supabase
  // --------------------
  const fetchSubjects = async () => {
    setLoading(true);
    setFetchError(null);

    const { data, error } = await supabase
      .from("subjects")
      // 🔑 แก้ไข: ใช้ subject_id เป็น Key หลักและตรวจสอบว่าคอลัมน์นี้มีอยู่ในตารางจริง
      .select("subject_id, subject_name, category"); 

    if (error) {
      console.error("Supabase error:", error);
      setFetchError("เกิดข้อผิดพลาดในการดึงข้อมูลวิชา (Bad Request / RLS Error)"); 
      setHasData(false);
      setLoading(false);
      
      // 🔑 ต้องตั้งค่า Categories เป็นโครงสร้างหลัก 3 อัน แม้ Error
      setCategories(BASE_CATEGORIES.map((cat) => ({
        title: cat,
        description: getCategoryDescription(cat),
        subjects: [],
      })));
      return;
    }

    const subjectsFetched = data && data.length > 0;
    setHasData(subjectsFetched);
    
    // สร้างฐานหมวดหมู่ว่างก่อนเสมอ
    const grouped = BASE_CATEGORIES.map((cat) => ({
      title: cat,
      description: getCategoryDescription(cat),
      subjects: [],
    }));

    // จัดกลุ่มวิชาเข้าหมวดหมู่
    if (subjectsFetched) {
        data.forEach((item) => {
          const normalizedTitle = normalizeCategory(item.category);
          
          if (normalizedTitle) {
            const group = grouped.find((g) => g.title === normalizedTitle);
            
            if (group) {
              group.subjects.push({
                // 🔑 แก้ไข: ใช้ subject_id เป็นทั้ง id และ code
                id: item.subject_id, 
                code: item.subject_id,
                name: item.subject_name,
              });
            }
          }
        });
    }

    setCategories(grouped);
    setLoading(false);
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // --------------------
  // 🔎 ระบบค้นหา
  // --------------------
  const filtered = categories.map((cat) => ({
    ...cat,
    subjects: cat.subjects.filter((s) =>
      (s.name + s.code).toLowerCase().includes(searchTerm.toLowerCase())
    ),
  }));

  // --------------------
  // 🔄 Rendering Logic
  // --------------------
  const renderCategories = () => {
      // 1. ถ้าไม่มีคำค้นหา (searchTerm เป็นค่าว่าง)
      if (searchTerm === "") {
          return filtered.map((cat) => (
              <CategoryItem
                key={cat.title}
                title={cat.title}
                description={cat.description}
                subjects={cat.subjects}
              />
          ));
      }
      
      // 2. ถ้ามีคำค้นหา (searchTerm ไม่เป็นค่าว่าง)
      let foundMatch = false;
      const categoryItems = filtered.map((cat) => {
          // แสดงเฉพาะหมวดหมู่ที่มีวิชาที่ตรงกับการค้นหาอยู่ภายใน
          if (cat.subjects.length > 0) {
              foundMatch = true;
              return (
                  <CategoryItem
                    key={cat.title}
                    title={cat.title}
                    description={cat.description}
                    // 🔑 สำคัญ: ตั้งค่า open เป็น true เพื่อเปิดหมวดหมู่ที่ค้นหาเจอทันที
                    subjects={cat.subjects}
                  />
              );
          }
          return null;
      }).filter(Boolean); // กรองเอาค่า null ออก

      // 3. ถ้าค้นหาแล้วไม่พบหมวดหมู่ใดๆ เลย
      if (!foundMatch) {
          return (
              <p className="text-center text-gray-500 py-10">
                  ไม่พบวิชาที่ตรงกับคำค้นหาในทุกหมวดหมู่
              </p>
          );
      }
      
      return categoryItems;
  };
  
  return (
    <div className="w-full bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm p-6 h-[350px] flex flex-col">
      <h2 className="text-[16px] font-semibold mb-3">หมวดหมู่วิชา</h2>

      {/* ช่องค้นหา */}
      <div className="relative mb-4 shrink-0">
        <input
          type="text"
          placeholder="ค้นหา"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-gray-200 outline-none"
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>

      {/* รายการหมวดหมู่ */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-center text-gray-500 py-10">กำลังโหลดข้อมูล...</p>
        ) : fetchError && searchTerm === "" ? (
             <p className="text-center text-red-500 py-10 font-medium border-t border-gray-200 mt-2">
                {fetchError} ❌ <br/>
                กรุณาตรวจสอบ RLS Policy และชื่อคอลัมน์ในตาราง 'subjects'
             </p>
        ) : (
          renderCategories()
        )}
      </div>
    </div>
  );
};

export default Adminsubject;