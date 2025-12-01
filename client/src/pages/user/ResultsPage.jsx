import React, { useEffect, useState, useRef } from 'react'
import Navbar from '../../components/Navbar' 
import { 
  BarChartOutlined, 
  PieChartOutlined, 
  CalendarOutlined, 
  DownOutlined, 
  CheckOutlined, 
  BookOutlined 
} from '@ant-design/icons';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../../config/supabase"; 
import dayjs from "dayjs"; // แนะนำให้ใช้ dayjs หรือจัดการ Date ด้วย JS native

// --- 1. Custom Select Component (คงเดิม) ---
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

  const selectedOption = options.find(opt => 
    (typeof opt === 'object' ? opt.value : opt) === value
  );
  
  const displayValue = selectedOption 
    ? (typeof selectedOption === 'object' ? selectedOption.label : selectedOption) 
    : (value === 'all' ? placeholder : value);

  return (
    <div className="relative group min-w-[160px]" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={`
          flex items-center justify-between w-full p-2 pl-3 pr-3
          bg-white border cursor-pointer transition-all duration-200 shadow-sm
          ${isOpen 
            ? 'border-blue-500 ring-2 ring-blue-100 rounded-t-2xl rounded-b-none z-50' 
            : 'border-gray-300 rounded-full hover:border-blue-400 hover:bg-gray-50'
          }
        `}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {prefixIcon && <span className="text-gray-400">{prefixIcon}</span>}
          <span className={`text-sm truncate ${value === 'all' ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>
            {displayValue}
          </span>
        </div>
        <DownOutlined className={`text-[10px] text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute left-0 w-full bg-white border border-t-0 border-gray-200 rounded-b-2xl shadow-xl z-[999] overflow-hidden">
          <ul className="max-h-[200px] overflow-y-auto py-1 custom-scrollbar">
            <li 
              onClick={() => { onChange('all'); setIsOpen(false); }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
            >
              <span>{placeholder}</span>
              {value === 'all' && <CheckOutlined className="text-green-500" />}
            </li>
            {options.map((option, index) => {
              const optLabel = typeof option === 'object' ? option.label : option;
              const optValue = typeof option === 'object' ? option.value : option;
              return (
                <li 
                  key={index} 
                  onClick={() => { onChange(optValue); setIsOpen(false); }} 
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                >
                  <span className='truncate'>{optLabel}</span>
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

// --- 2. Main Component ---
const ResultsPage = () => {
  const teacher_id = localStorage.getItem("teacher_id")

  const [result, setResult] = useState([]) 
  const [groupedData, setGroupedData] = useState({}); 
  const [uniqueSubjects, setUniqueSubjects] = useState([]); 
  const [uniqueDates, setUniqueDates] = useState([]); 
  const [selectedDate, setSelectedDate] = useState("all"); 
  const [selectedSubject, setSelectedSubject] = useState("all"); 

  // --- Effect 1: ดึงข้อมูลจากตาราง camera_logs (ข้อมูลดิบ) ---
  useEffect(() => {
    const fetchData = async () => {
      if (!teacher_id) return; 

      try {
        // 🟢 กลับมาใช้ camera_logs เพื่อให้ได้ Time Stamp ละเอียด
        const { data: response, error } = await supabase
          .from("camera_logs") 
          .select("*")
          .eq("teacher_id", teacher_id) 
          .order("created_at", { ascending: false }) // เอาล่าสุดก่อน
          .limit(2000); // 🟢 ดึงเยอะหน่อยเพราะ 1 คาบอาจมี log เยอะ (ปรับตามความเหมาะสม)

        if (error) {
          console.error("Error loading data:", error);
          return;
        }

        if (response) {
          // เรียงกลับให้เป็น อดีต -> ปัจจุบัน เพื่อให้กราฟวิ่งซ้ายไปขวา
          const sortedResponse = response.reverse(); 
          setResult(sortedResponse); 

          const subjects = [...new Set(sortedResponse.map(item => item.subject_id))].filter(Boolean);
          setUniqueSubjects(subjects);

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

  // --- 🟢 ฟังก์ชันจัดกลุ่มข้อมูลเป็นช่วงละ 5 นาที ---
  const processDataTo5MinIntervals = (logs) => {
    const buckets = {};

    logs.forEach(log => {
      const date = new Date(log.created_at);
      
      // สูตรปัดเศษเวลาลงให้เป็นล็อคละ 5 นาที
      // เช่น 10:03 -> 10:00, 10:07 -> 10:05
      const coeff = 1000 * 60 * 5; 
      const roundedDate = new Date(Math.floor(date.getTime() / coeff) * coeff);
      
      // สร้าง Key เป็นเวลา HH:mm (หรือจะรวมวันที่ด้วยก็ได้ถ้าดูหลายวันพร้อมกัน)
      // แต่ถ้าดูแยกวันใช้แค่ HH:mm จะดูง่ายกว่า
      const timeStr = roundedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      // ถ้าอยากให้ Key แยกวันด้วย (กรณีเลือก All Days) ให้ใช้แบบนี้แทน:
      // const timeKey = `${roundedDate.getDate()}/${roundedDate.getMonth()+1} ${timeStr}`;
      const timeKey = timeStr; // เอาแค่เวลาก่อน เพื่อโชว์ในกราฟ

      if (!buckets[timeKey]) {
        buckets[timeKey] = {
          time: timeKey,
          totalAtt: 0,
          totalNon: 0,
          count: 0,
          fullDate: roundedDate // เก็บไว้อ้างอิง
        };
      }

      buckets[timeKey].totalAtt += Number(log.Attention || 0);
      buckets[timeKey].totalNon += Number(log.Non_Attention || 0);
      buckets[timeKey].count += 1;
    });

    // แปลง Buckets กลับเป็น Array แล้วหาค่าเฉลี่ยในแต่ละช่วง 5 นาที
    return Object.values(buckets).map(b => ({
      time: b.time,
      fullDate: b.fullDate,
      // ค่าเฉลี่ยของช่วง 5 นาทีนั้น * 100 เป็น %
      ตั้งใจ: ((b.totalAtt / b.count) * 100).toFixed(2),
      ไม่ตั้งใจ: ((b.totalNon / b.count) * 100).toFixed(2)
    }));
  };

  // --- Effect 2: Logic การกรองและจัดกลุ่มข้อมูล ---
  useEffect(() => {
    if (!result) return;

    let filtered = result;

    if (selectedSubject !== "all") {
        filtered = filtered.filter(row => row.subject_id === selectedSubject);
    }

    if (selectedDate !== "all") {
        filtered = filtered.filter(row => 
            new Date(row.created_at).toLocaleDateString('th-TH') === selectedDate
        );
    }

    // Grouping by Subject + Camera + Date
    // 🟢 แยกตามวันที่ด้วย เพราะกราฟรายนาทีไม่ควรเอาหลายวันมาทับกัน (นอกจากอยากดู Pattern รวม)
    // แต่ในที่นี้แยกเป็น Subject|Camera ตามเดิม เพื่อให้ Card หนึ่งใบแสดง 1 วิชา/ห้อง
    const grouped = filtered.reduce((acc, row) => {
      const groupKey = `${row.subject_id}|${row.camera_id}`;
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(row);
      return acc;
    }, {});
    
    setGroupedData(grouped); 
  }, [result, selectedSubject, selectedDate]); 

  // --- Helper Functions ---

  const getAvgStats = (logs) => {
    if (!logs || logs.length === 0) return { att: 0, non: 0 }
    let totalAtt = 0, totalNon = 0
    logs.forEach(l => { 
        totalAtt += Number(l.Attention) || 0; 
        totalNon += Number(l.Non_Attention) || 0; 
    })
    return { att: totalAtt / logs.length, non: totalNon / logs.length }
  }

  const processedChartData = Object.fromEntries(
    Object.entries(groupedData).map(([key, logs]) => {
      const [subjectId, cameraId] = key.split('|');

      // 1. เตรียมข้อมูล Pie Chart (รวมทั้งหมด)
      const totals = { Focused: 0, Looking_at_the_board: 0, Taking_notes: 0, LookingAway: 0, Talking: 0, UsingPhone: 0 };
      logs.forEach(log => {
        const ratios = log.class_json || {}; 
        totals.Focused += ratios.Focused || 0;
        totals.Looking_at_the_board += ratios.Looking_at_the_board || 0;
        totals.Taking_notes += ratios.Taking_notes || 0;
        totals.LookingAway += ratios.LookingAway || 0;
        totals.Talking += ratios.Talking || 0;
        totals.UsingPhone += ratios.UsingPhone || 0;
      });

      const sumBehaviors = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
      const pieChartData = [
        { name: "Focused", value: totals.Focused / sumBehaviors },
        { name: "Look Board", value: totals.Looking_at_the_board / sumBehaviors },
        { name: "Take Notes", value: totals.Taking_notes / sumBehaviors },
        { name: "Look Away", value: totals.LookingAway / sumBehaviors },
        { name: "Phone", value: totals.UsingPhone / sumBehaviors },
      ].filter(item => item.value > 0);

      // 🟢 2. เตรียมข้อมูล Line Chart (แบบ 5 นาที)
      const lineChartData = processDataTo5MinIntervals(logs);

      return [key, { logs, pieChartData, lineChartData, subjectId, cameraId }];
    })
  );

  const COLORS = ['#0068c9','#fe2b2b', '#8622FF', '#739206ff', '#FE0056', '#00B7EB', '#FF8000', '#00FFCE', '#FFFF00'];
  const RADIAN = Math.PI / 180;
  
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

  return (
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      
      <Navbar /> 
      
      <div className="flex-1 p-6 overflow-hidden">
        
        <div className="grid grid-cols-3 gap-4 h-full">

          {/* --- ฝั่งซ้าย: แสดงกราฟเส้นและตัวกรอง --- */}
          <div className="col-span-2 bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full overflow-hidden">
            
            <div className="p-4 border-b border-[#f0f0f0] flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 z-30 relative">
              <div className='flex items-center gap-2'>
                  <BarChartOutlined className="text-2xl text-blue-500" />
                  <h2 className="text-xl font-semibold text-gray-700">Timeline การเรียน (ทุก 5 นาที)</h2>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                  <CustomSelect 
                    placeholder="-- ทุกวัน --"
                    options={uniqueDates}
                    value={selectedDate}
                    onChange={setSelectedDate}
                    prefixIcon={<CalendarOutlined />}
                  />
                  <CustomSelect 
                    placeholder="-- ทุกวิชา --"
                    options={uniqueSubjects.map(sub => ({ value: sub, label: `วิชา ${sub}` }))}
                    value={selectedSubject}
                    onChange={setSelectedSubject}
                    prefixIcon={<BookOutlined />}
                  />
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 scrollbar-hide z-10">
              <div className="w-full">
                {Object.entries(processedChartData).length > 0 ? (
                  Object.entries(processedChartData).map(([key, data]) => {
                    const avg = getAvgStats(data.logs);
                    
                    return (
                      <div key={key} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 last:mb-0">
                        
                        <div className='flex justify-between items-center mb-4'>
                          <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                  <h3 className="text-lg font-bold text-gray-800">วิชา {data.subjectId}</h3>
                                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">CAM {data.cameraId}</span>
                              </div>
                              <span className="text-xs text-gray-400 ml-1">
                                {selectedDate !== 'all' ? `วันที่ ${selectedDate}` : `ข้อมูลรวม ${data.logs.length} จุด`}
                              </span>
                          </div>
                          
                          <div className="text-sm flex gap-3">
                            <span className="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 font-bold">
                              เฉลี่ยรวม: {(avg.att * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* กราฟเส้น แสดงราย 5 นาที */}
                        <ResponsiveContainer width="100%" height={200}>
                          {/* 🟢 ใช้ lineChartData ที่ผ่านการ bucket 5 นาทีแล้ว */}
                          <LineChart data={data.lineChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            {/* แกน X เป็น เวลา (HH:mm) */}
                            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ borderRadius: '8px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                            <Line type="monotone" dataKey="ตั้งใจ" stroke="#38A738" strokeWidth={2} dot={true} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="ไม่ตั้งใจ" stroke="#FF3300" strokeWidth={2} dot={true} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                      <BarChartOutlined className="text-4xl mb-2 opacity-50" />
                      <p>ไม่พบข้อมูล (ลองเปลี่ยนตัวกรอง หรือเลือกวันที่)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* --- ฝั่งขวา: แสดง Pie Chart พฤติกรรมรวม --- */}
          <div className="col-span-1 h-full flex flex-col space-y-4 overflow-hidden">
            <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full overflow-hidden">
              
              <div className="p-5.5 border-b border-[#f0f0f0] flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                   <PieChartOutlined className="text-2xl text-purple-500" />
                   พฤติกรรมรวม
                </h2>
              </div>

              <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1 scrollbar-hide">
                {Object.entries(processedChartData).length > 0 ? (
                  Object.entries(processedChartData).map(([key, data]) => (
                    <div key={key} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative">
                      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                           <span className="font-bold text-gray-700 text-sm">วิชา {data.subjectId}</span>
                           <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm w-fit">
                            CAM {data.cameraId}
                          </span>
                      </div>

                      <div className="h-[250px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data.pieChartData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              innerRadius={50}
                              paddingAngle={2}
                              dataKey="value"
                              labelLine={false}
                              label={renderCustomizedLabel}
                            >
                              {data.pieChartData.map((entry, index) => (
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