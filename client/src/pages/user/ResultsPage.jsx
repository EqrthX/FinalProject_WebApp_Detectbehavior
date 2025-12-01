import React, { useEffect, useState, useRef } from 'react'
import Navbar from '../../components/Navbar' // นำเข้า Navbar Component
// นำเข้า Icon ต่างๆ จาก Ant Design
import { 
  BarChartOutlined, 
  PieChartOutlined, 
  CalendarOutlined, 
  DownOutlined, 
  CheckOutlined, 
  BookOutlined 
} from '@ant-design/icons';
// นำเข้ากราฟและเครื่องมือจาก Recharts
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../../config/supabase"; // การเชื่อมต่อฐานข้อมูล Supabase

// --- 1. สร้าง Component Dropdown แบบ Custom (เพื่อให้ UI สวยงามตามดีไซน์) ---
const CustomSelect = ({ options, value, onChange, prefixIcon, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false); // State สำหรับเช็คว่า Dropdown เปิดหรือปิดอยู่
  const containerRef = useRef(null); // Ref สำหรับอ้างอิง Element ของ Dropdown นี้ (ใช้เช็คการคลิก)

  // useEffect: สำหรับจัดการ Event คลิกเมาส์
  useEffect(() => {
    // ฟังก์ชันเช็คว่าคลิกตรงไหน
    const handleClickOutside = (event) => {
      // ถ้าคลิกนอกพื้นที่ของ Dropdown นี้ (containerRef) ให้ปิด Dropdown
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    // เพิ่ม Event Listener เมื่อ Component ถูกสร้าง
    document.addEventListener("mousedown", handleClickOutside);
    // ลบ Event Listener เมื่อ Component ถูกทำลาย (Cleanup)
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Logic: หา Label ของตัวเลือกที่ถูกเลือกอยู่ (เพื่อนำมาแสดงผลแทนค่า value)
  const selectedOption = options.find(opt => 
    (typeof opt === 'object' ? opt.value : opt) === value
  );
  
  // กำหนดค่าที่จะแสดง: ถ้ามีค่าเลือกไว้ให้แสดง Label, ถ้าเป็น 'all' ให้แสดง Placeholder
  const displayValue = selectedOption 
    ? (typeof selectedOption === 'object' ? selectedOption.label : selectedOption) 
    : (value === 'all' ? placeholder : value);

  return (
    <div className="relative group min-w-[160px]" ref={containerRef}>
      {/* --- ส่วนหัวของ Dropdown (ส่วนที่คลิกเพื่อเปิด) --- */}
      <div 
        onClick={() => setIsOpen(!isOpen)} // คลิกแล้วสลับสถานะ เปิด/ปิด
        className={`
          flex items-center justify-between w-full p-2 pl-3 pr-3
          bg-white border cursor-pointer transition-all duration-200 shadow-sm
          ${isOpen 
            ? 'border-blue-500 ring-2 ring-blue-100 rounded-t-2xl rounded-b-none z-50' // สไตล์ตอนเปิด
            : 'border-gray-300 rounded-full hover:border-blue-400 hover:bg-gray-50'    // สไตล์ตอนปิด
          }
        `}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {/* แสดง Icon นำหน้าถ้ามีส่งมา */}
          {prefixIcon && <span className="text-gray-400">{prefixIcon}</span>}
          {/* แสดงข้อความที่เลือก */}
          <span className={`text-sm truncate ${value === 'all' ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>
            {displayValue}
          </span>
        </div>
        {/* Icon ลูกศรลง (หมุนเมื่อเปิด) */}
        <DownOutlined className={`text-[10px] text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* --- รายการตัวเลือก (Dropdown List) จะแสดงเมื่อ isOpen เป็น true --- */}
      {isOpen && (
        <div className="absolute left-0 w-full bg-white border border-t-0 border-gray-200 rounded-b-2xl shadow-xl z-[999] overflow-hidden">
          <ul className="max-h-[200px] overflow-y-auto py-1 custom-scrollbar">
            {/* ตัวเลือกที่ 1: เลือกทั้งหมด (Reset) */}
            <li 
              onClick={() => { onChange('all'); setIsOpen(false); }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
            >
              <span>{placeholder}</span>
              {/* ถ้าเลือก 'all' อยู่ ให้แสดงเครื่องหมายถูก */}
              {value === 'all' && <CheckOutlined className="text-green-500" />}
            </li>

            {/* วนลูปแสดงตัวเลือกอื่นๆ จาก props options */}
            {options.map((option, index) => {
              const optLabel = typeof option === 'object' ? option.label : option;
              const optValue = typeof option === 'object' ? option.value : option;
              
              return (
                <li 
                  key={index} 
                  onClick={() => { onChange(optValue); setIsOpen(false); }} // คลิกแล้วส่งค่ากลับไปและปิด Dropdown
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                >
                  <span className='truncate'>{optLabel}</span>
                  {/* แสดงเครื่องหมายถูกถ้าค่าตรงกัน */}
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

// --- 2. Main Component (หน้าแสดงผลหลัก) ---
const ResultsPage = () => {
  // ดึง teacher_id จาก LocalStorage เพื่อระบุตัวตนครู
  const teacher_id = localStorage.getItem("teacher_id")

  // --- State Variables ---
  const [result, setResult] = useState([]) // เก็บข้อมูลดิบทั้งหมดที่ดึงมาจาก API
  const [groupCameras, setGroupCameras] = useState({}); // เก็บข้อมูลที่ถูกจัดกลุ่มตาม Camera ID แล้ว
  const [uniqueSubjects, setUniqueSubjects] = useState([]); // เก็บรายชื่อวิชาที่ไม่ซ้ำ (สำหรับตัวกรอง)
  
  // 🆕 State สำหรับตัวกรองวันที่
  const [uniqueDates, setUniqueDates] = useState([]); // เก็บรายชื่อวันที่ไม่ซ้ำ
  const [selectedDate, setSelectedDate] = useState("all"); // ค่าวันที่ที่ถูกเลือกปัจจุบัน

  // State สำหรับตัวกรองวิชา
  const [selectedSubject, setSelectedSubject] = useState("all"); // ค่าวิชาที่ถูกเลือกปัจจุบัน

  // --- Effect 1: ดึงข้อมูลจาก Supabase เมื่อโหลดหน้าเว็บ ---
  useEffect(() => {
    const fetchData = async () => {
      if (!teacher_id) return; // ถ้าไม่มี id ครู ให้จบการทำงาน

      try {
        // Query ข้อมูลจากตาราง camera_logs
        const { data: response, error } = await supabase
          .from("camera_logs")
          .select("*")
          .eq("teacher_id", teacher_id) // กรองเฉพาะของครูคนนี้
          .order("created_at", { ascending: false }) // เรียงจากล่าสุดไปเก่าสุด
          .limit(1000); // จำกัด 1000 แถวเพื่อประสิทธิภาพ

        if (error) {
          console.error("Error loading data:", error);
          return;
        }

        if (response) {
          const sortedResponse = response.reverse(); // กลับลำดับข้อมูล (ถ้าต้องการให้กราฟเรียงจากซ้ายไปขวาตามเวลา)
          setResult(sortedResponse); // บันทึกข้อมูลดิบลง State

          // แยกรายชื่อวิชาทั้งหมดที่ไม่ซ้ำกันออกมา
          const subjects = [...new Set(sortedResponse.map(item => item.subject_id))].filter(Boolean);
          setUniqueSubjects(subjects);

          // 🆕 แยกรายชื่อวันที่ทั้งหมดที่ไม่ซ้ำกันออกมา (แปลงเป็น format วันที่ไทย)
          const dates = [...new Set(sortedResponse.map(item => 
            new Date(item.created_at).toLocaleDateString('th-TH')
          ))];
          setUniqueDates(dates);
        }
      } catch (err) {
        console.error("System error:", err);
      }
    }
    fetchData();
  }, [teacher_id]);

  // --- Effect 2: Logic การกรองข้อมูล (ทำงานเมื่อมีการเปลี่ยนตัวกรอง หรือข้อมูลเปลี่ยน) ---
  useEffect(() => {
    if (!result) return;

    // 1. เริ่มต้นด้วยข้อมูลทั้งหมด
    let filtered = result;

    // 2. กรองตามวิชา (ถ้าไม่ได้เลือก 'all')
    if (selectedSubject !== "all") {
        filtered = filtered.filter(row => row.subject_id === selectedSubject);
    }

    // 3. กรองตามวันที่ (ถ้าไม่ได้เลือก 'all')
    if (selectedDate !== "all") {
        filtered = filtered.filter(row => 
            new Date(row.created_at).toLocaleDateString('th-TH') === selectedDate
        );
    }

    // 4. จัดกลุ่มข้อมูลตาม Camera ID (เพื่อให้แสดงผลแยกทีละกล้องได้)
    const grouped = filtered.reduce((acc, row) => {
      if (!acc[row.camera_id]) acc[row.camera_id] = []; // ถ้ายังไม่มี key นี้ให้สร้าง array ว่าง
      acc[row.camera_id].push(row); // ยัดข้อมูลลงไป
      return acc;
    }, {});
    
    setGroupCameras(grouped); // อัปเดตข้อมูลที่พร้อมแสดงผล
  }, [result, selectedSubject, selectedDate]); 

  // --- Helper Functions (ฟังก์ชันคำนวณ) ---

  // คำนวณค่าเฉลี่ยความตั้งใจ (Attention) ของกล้องนั้นๆ
  const getAvgAttentionPerCamera = (logs) => {
    if (!logs || logs.length === 0) return { att: 0, non: 0 }
    let totalAtt = 0, totalNon = 0
    logs.forEach(l => { 
        totalAtt += Number(l.Attention) || 0; 
        totalNon += Number(l.Non_Attention) || 0; 
    })
    // คืนค่าเป็นค่าเฉลี่ย
    return { att: totalAtt / logs.length, non: totalNon / logs.length }
  }

  // แปลงข้อมูลสำหรับ Pie Chart (รวมยอดพฤติกรรมทั้งหมดของแต่ละกล้อง)
  const groupCamerasWithPie = Object.fromEntries(
    Object.entries(groupCameras).map(([camId, logs]) => {
      // ตัวแปรเก็บผลรวมของแต่ละพฤติกรรม
      const totals = { Focused: 0, Looking_at_the_board: 0, Taking_notes: 0, LookingAway: 0, Talking: 0, UsingPhone: 0 };
      
      logs.forEach(log => {
        const ratios = log.class_json || {}; // ดึง JSON พฤติกรรมออกมา
        // บวกค่าสะสม
        totals.Focused += ratios.Focused || 0;
        totals.Looking_at_the_board += ratios.Looking_at_the_board || 0;
        totals.Taking_notes += ratios.Taking_notes || 0;
        totals.LookingAway += ratios.LookingAway || 0;
        totals.Talking += ratios.Talking || 0;
        totals.UsingPhone += ratios.UsingPhone || 0;
      });

      const totalCount = logs.length || 1;
      // สร้าง Array Data สำหรับ Pie Chart ของ Recharts
      const pieChartData = [
        { name: "Focused", value: totals.Focused / totalCount },
        { name: "Look Board", value: totals.Looking_at_the_board / totalCount },
        { name: "Take Notes", value: totals.Taking_notes / totalCount },
        { name: "Look Away", value: totals.LookingAway / totalCount },
        { name: "Phone", value: totals.UsingPhone / totalCount },
      ].filter(item => item.value > 0); // กรองเอาเฉพาะที่มีค่า > 0

      return [camId, { logs, pieChartData }];
    })
  );

  // ค่าคงที่สำหรับ Pie Chart
  const RADIAN = Math.PI / 180;
  const COLORS = ['#0068c9', '#00B7EB', '#8622FF', '#FF8000', '#FE0056', '#FFFF00']; // ชุดสีของกราฟ
  
  // ฟังก์ชัน Custom Label สำหรับ Pie Chart (แสดง %)
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
    return (
      <text x={x} y={y} fill="white" fontSize={10} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  // --- ส่วน Render JSX ---
  return (
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      
      <Navbar /> {/* แถบเมนูด้านบน */}
      
      <div className="flex-1 p-6 overflow-hidden">
        
        {/* Layout Grid แบ่งหน้าจอ: ซ้าย 2 ส่วน (Line Chart), ขวา 1 ส่วน (Pie Chart) */}
        <div className="grid grid-cols-3 gap-4 h-full">

          {/* --- ฝั่งซ้าย: แสดงกราฟเส้นและตัวกรอง --- */}
          <div className="col-span-2 bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full overflow-hidden">
            
            {/* Header ของฝั่งซ้าย */}
            <div className="p-6 border-b border-[#f0f0f0] flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 z-20 relative">
              <div className='flex items-center gap-2'>
                  <BarChartOutlined className="text-2xl text-blue-500" />
                  <h2 className="text-xl font-semibold text-gray-700">ผลรวมการสอน (ล่าสุด)</h2>
              </div>
              
              {/* --- 🆕 ส่วน Dropdown UI ใหม่ (เรียกใช้ Component CustomSelect) --- */}
              <div className="flex flex-wrap items-center gap-3">
                  
                  {/* Dropdown เลือกวันที่ */}
                  <CustomSelect 
                    placeholder="-- ทุกวัน --"
                    options={uniqueDates}
                    value={selectedDate}
                    onChange={setSelectedDate}
                    prefixIcon={<CalendarOutlined />}
                  />

                  {/* Dropdown เลือกวิชา */}
                  <CustomSelect 
                    placeholder="-- ทุกวิชา --"
                    options={uniqueSubjects.map(sub => ({ value: sub, label: `วิชา ${sub}` }))} // แปลง format ให้มีคำว่า "วิชา"
                    value={selectedSubject}
                    onChange={setSelectedSubject}
                    prefixIcon={<BookOutlined />}
                  />
              </div>

            </div>

            {/* ส่วนแสดงรายการกราฟ (Scroll ได้) */}
            <div className="p-6 overflow-y-auto flex-1 scrollbar-hide z-10">
              <div className="w-full">
                {/* เช็คว่ามีข้อมูลหรือไม่ */}
                {Object.entries(groupCameras).length > 0 ? (
                  // วนลูปแสดงข้อมูลทีละกล้อง
                  Object.entries(groupCameras).map(([camId, logs]) => {
                    const avg = getAvgAttentionPerCamera(logs); // คำนวณค่าเฉลี่ย
                    const lastLogDate = new Date(logs[logs.length-1].created_at).toLocaleDateString('th-TH');

                    return (
                      <div key={camId} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 last:mb-0">
                        {/* หัวข้อของแต่ละ Card กราฟ */}
                        <div className='flex justify-between items-center mb-4'>
                          <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">CAM {camId}</span>
                                  <h3 className="text-lg font-semibold text-gray-700">วิชา {logs[0].subject_id}</h3>
                              </div>
                              <span className="text-xs text-gray-400 ml-1">วันที่: {lastLogDate}</span>
                          </div>
                          {/* Badge แสดง % ความตั้งใจ */}
                          <div className="text-sm flex gap-3">
                            <span className="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 font-bold">
                              ตั้งใจ: {(avg.att * 100).toFixed(1)}%
                            </span>
                            <span className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 font-bold">
                              ไม่ตั้งใจ: {(avg.non * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* ตัวกราฟเส้น (Line Chart) */}
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={logs.map(l => ({
                            time: new Date(l.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                            ตั้งใจ: (Number(l.Attention) * 100).toFixed(2),
                            ไม่ตั้งใจ: (Number(l.Non_Attention) * 100).toFixed(2),
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ borderRadius: '8px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                            <Line type="monotone" dataKey="ตั้งใจ" stroke="#38A738" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="ไม่ตั้งใจ" stroke="#FF3300" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })
                ) : (
                  // กรณีไม่พบข้อมูล
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                      <BarChartOutlined className="text-4xl mb-2 opacity-50" />
                      <p>ไม่พบข้อมูล (ลองเปลี่ยนตัวกรอง)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* --- ฝั่งขวา: แสดง Pie Chart พฤติกรรมรวม --- */}
          <div className="col-span-1 h-full flex flex-col space-y-4 overflow-hidden">
            <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full overflow-hidden">
              
              <div className="p-6 border-b border-[#f0f0f0] flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                   <PieChartOutlined className="text-2xl text-purple-500" />
                   พฤติกรรมรวม 
                   {selectedSubject !== "all" && <span className="text-sm font-normal text-gray-500">({selectedSubject})</span>}
                </h2>
              </div>

              <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1 scrollbar-hide">
                {/* เช็คว่ามีข้อมูล Pie Chart หรือไม่ */}
                {Object.entries(groupCamerasWithPie).length > 0 ? (
                  Object.entries(groupCamerasWithPie).map(([camId, logs]) => (
                    <div key={camId} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative">
                      <div className="absolute top-3 left-3 z-10">
                            <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                            CAM {Number(camId)}
                          </span>
                      </div>

                      {/* ตัวกราฟวงกลม (Pie Chart) */}
                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={logs.pieChartData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              innerRadius={50}
                              paddingAngle={2}
                              dataKey="value"
                              labelLine={false}
                              label={renderCustomizedLabel}
                            >
                              {logs.pieChartData.map((entry, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${(value * 100).toFixed(1)}%`} />
                            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <p>ไม่พบข้อมูล</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default ResultsPage