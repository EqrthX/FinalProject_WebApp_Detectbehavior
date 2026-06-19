import React, { useEffect, useState, useRef } from "react";
import { DownOutlined, CheckOutlined } from "@ant-design/icons";

const CustomSelect = ({ options, value, onChange, prefixIcon, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (opt) => (typeof opt === "object" ? opt.value : opt) === value
  );

  const displayValue = selectedOption
    ? typeof selectedOption === "object" ? selectedOption.label : selectedOption
    : value === "all" ? placeholder : value;

  return (
    <div className="relative group min-w-[160px]" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full p-2 pl-3 pr-3 bg-white border cursor-pointer transition-all duration-200 shadow-sm ${
          isOpen ? "border-blue-500 ring-2 ring-blue-100 rounded-t-2xl rounded-b-none z-50" : "border-gray-300 rounded-full hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {prefixIcon && <span className="text-gray-400">{prefixIcon}</span>}
          <span className={`text-sm truncate ${value === "all" ? "text-gray-500" : "text-gray-700 font-medium"}`}>
            {displayValue}
          </span>
        </div>
        <DownOutlined className={`text-[10px] text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </div>
      {isOpen && (
        <div className="absolute left-0 w-full bg-white border border-t-0 border-gray-200 rounded-b-2xl shadow-xl z-[999] overflow-hidden">
          <ul className="max-h-[200px] overflow-y-auto py-1 custom-scrollbar">
            <li
              onClick={() => { onChange("all"); setIsOpen(false); }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
            >
              <span>{placeholder}</span>
              {value === "all" && <CheckOutlined className="text-green-500" />}
            </li>
            {options.map((option, index) => {
              const optLabel = typeof option === "object" ? option.label : option;
              const optValue = typeof option === "object" ? option.value : option;
              return (
                <li
                  key={index}
                  onClick={() => { onChange(optValue); setIsOpen(false); }}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                >
                  <span className="truncate">{optLabel}</span>
                  {value === optValue && <CheckOutlined className="text-green-500" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
