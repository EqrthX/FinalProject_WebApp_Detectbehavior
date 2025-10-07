import React, { useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

const CategoryItem = ({ title, children }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex justify-between items-center w-full py-2 text-left text-[15px] font-medium text-gray-800 hover:bg-gray-50"
      >
        {title}
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-600" />
        )}
      </button>

      {open && <div className="pl-3 pb-2 text-sm text-gray-600">{children}</div>}
    </div>
  );
};

const Adminsubject = () => {
  return (
    <div className="w-full lg:h-[350px] bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm p-6 sm:p-5 md:p-6 ">
      <h2 className="text-[16px] font-semibold mb-3">หมวดหมู่วิชา</h2>

      {/* ช่องค้นหา */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="ค้นหา"
          className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-gray-200 outline-none"
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>

      {/* Accordion หมวดหมู่ */}
      <div className="flex-1">
        <CategoryItem title="หมวดวิชาศึกษาทั่วไป">
          วิชาทั่วไป เช่น GE ต่างๆ
        </CategoryItem>

        <CategoryItem title="หมวดวิชาเฉพาะ">
          วิชาเฉพาะตามคณะ เช่น วิศวกรรม, บัญชี, การตลาด
        </CategoryItem>

        <CategoryItem title="หมวดวิชาเสรี">
          วิชาเลือกเสรี
        </CategoryItem>
      </div>
    </div>
  );
};

export default Adminsubject;
