import React, { useEffect, useState, useRef } from 'react'
import Navbar from '../../components/Navbar' 
import { 
  BarChartOutlined, 
  PieChartOutlined, 
  CalendarOutlined, 
  DownOutlined, 
  CheckOutlined, 
  BookOutlined,
  TeamOutlined 
} from '@ant-design/icons';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../../config/supabase"; 

// --- 1. Custom Select (คงเดิม) ---
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

  const selectedOption = options.find(opt => (typeof opt === 'object' ? opt.value : opt) === value);
  const displayValue = selectedOption ? (typeof selectedOption === 'object' ? selectedOption.label : selectedOption) : (value === 'all' ? placeholder : value);

  return (
    <div className="relative group min-w-[160px]" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between w-full p-2 pl-3 pr-3 bg-white border cursor-pointer transition-all duration-200 shadow-sm ${isOpen ? 'border-blue-500 ring-2 ring-blue-100 rounded-t-2xl rounded-b-none z-50' : 'border-gray-300 rounded-full hover:border-blue-400 hover:bg-gray-50'}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          {prefixIcon && <span className="text-gray-400">{prefixIcon}</span>}
          <span className={`text-sm truncate ${value === 'all' ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>{displayValue}</span>
        </div>
        <DownOutlined className={`text-[10px] text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute left-0 w-full bg-white border border-t-0 border-gray-200 rounded-b-2xl shadow-xl z-[999] overflow-hidden">
          <ul className="max-h-[200px] overflow-y-auto py-1 custom-scrollbar">
            <li onClick={() => { onChange('all'); setIsOpen(false); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors">
              <span>{placeholder}</span>{value === 'all' && <CheckOutlined className="text-green-500" />}
            </li>
            {options.map((option, index) => {
              const optLabel = typeof option === 'object' ? option.label : option;
              const optValue = typeof option === 'object' ? option.value : option;
              return (
                <li key={index} onClick={() => { onChange(optValue); setIsOpen(false); }} className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors">
                  <span className='truncate'>{optLabel}</span>{value === optValue && <CheckOutlined className="text-green-500" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

const BEHAVIOR_COLORS = {
  "ตั้งใจเรียน": "#22c55e",       
  "มองกระดาน": "#3b82f6",        
  "จดเลคเชอร์": "#a855f7",       
  "มองทางอื่น": "#f59e0b",       
  "คุยกัน": "#f97316",           
  "เล่นมือถือ": "#ef4444",                   
};

// --- 2. Main Component ---
const ResultsPage = () => {
  const teacher_id = localStorage.getItem("teacher_id")

  const [rawLogs, setRawLogs] = useState([]);        
  const [summaries, setSummaries] = useState([]);    
  const [groupedData, setGroupedData] = useState({}); 

  // State Filters
  const [uniqueSubjects, setUniqueSubjects] = useState([]); 
  const [uniqueDates, setUniqueDates] = useState([]); 
  const [uniqueSections, setUniqueSections] = useState([]); // 🟢 เพิ่ม State กลุ่มเรียน

  const [selectedDate, setSelectedDate] = useState("all"); 
  const [selectedSubject, setSelectedSubject] = useState("all"); 
  const [selectedSection, setSelectedSection] = useState("all"); // 🟢 เพิ่ม Selected Section

  // --- Effect 1: Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      if (!teacher_id) return; 

      try {
        const logsReq = supabase
          .from("camera_logs") 
          .select("*")
          .eq("teacher_id", teacher_id) 
          .order("created_at", { ascending: false }) 
          .limit(3000); // เพิ่ม limit นิดหน่อยเผื่อข้อมูลเยอะ

        const summaryReq = supabase
          .from("camera_daily_summary")
          .select("*")
          .eq("teacher_id", teacher_id)
          .order("summary_date", { ascending: false });

        const [logsRes, summaryRes] = await Promise.all([logsReq, summaryReq]);

        if (logsRes.error) console.error("Error logs:", logsRes.error);
        if (summaryRes.error) console.error("Error summary:", summaryRes.error);

        if (logsRes.data && summaryRes.data) {
          const sortedLogs = logsRes.data.reverse(); 
          setRawLogs(sortedLogs);
          setSummaries(summaryRes.data);

          // 1. Extract Unique Subjects
          const subjects = [...new Set(summaryRes.data.map(item => item.subject_id))].filter(Boolean);
          setUniqueSubjects(subjects);

          // 2. Extract Unique Dates
          const dates = [...new Set(summaryRes.data.map(item => 
            new Date(item.summary_date).toLocaleDateString('th-TH')
          ))];
          setUniqueDates(dates);

          // 3. 🟢 Extract Unique Sections (สมมติว่าใน DB มี field ชื่อ 'section')
          // *หมายเหตุ: ถ้าใน DB ไม่มี column 'section' ให้แก้ตรง item.section เป็น field ที่ถูกต้อง หรือเว้นว่างไว้
          const sections = [...new Set(summaryRes.data.map(item => item.section))].filter(Boolean);
          setUniqueSections(sections);
        }
      } catch (err) {
        console.error("System error:", err);
      }
    }
    fetchData();
  }, [teacher_id]);

  // --- Helper: กราฟเส้น (3 นาที - เส้นเฉลี่ยเดียว) ---
  const processDataTo3MinIntervals = (logs) => {
    const buckets = {};
    logs.forEach(log => {
      const date = new Date(log.created_at);
      const coeff = 1000 * 60 * 3; // 3 นาที
      const roundedDate = new Date(Math.floor(date.getTime() / coeff) * coeff);
      const timeStr = roundedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      if (!buckets[timeStr]) buckets[timeStr] = { time: timeStr, totalAtt: 0, count: 0 };
      
      // เก็บแค่ค่าความตั้งใจ
      buckets[timeStr].totalAtt += Number(log.Attention || 0);
      buckets[timeStr].count += 1;
    });

    return Object.values(buckets).map(b => ({
      time: b.time,
      score: ((b.totalAtt / b.count) * 100).toFixed(0) // ค่าเฉลี่ยจุดเดียว
    }));
  };

  // --- Helper: Pie Chart ---
  const processSummaryData = (summaryList) => {
    const totals = { 
        Focused: 0, Looking_at_the_board: 0, Taking_notes: 0, 
        LookingAway: 0, Talking: 0, UsingPhone: 0 
    };
    
    let sumAvgAtt = 0;
    let count = 0;

    summaryList.forEach(item => {
        sumAvgAtt += Number(item.avg_attention || 0);
        count++;

        const json = item.class_json_summary || {};
        totals.Focused += Number(json.Focused || 0);
        totals.Looking_at_the_board += Number(json.Looking_at_the_board || 0);
        totals.Taking_notes += Number(json.Taking_notes || 0);
        totals.LookingAway += Number(json.LookingAway || 0);
        totals.Talking += Number(json.Talking || 0);
        totals.UsingPhone += Number(json.UsingPhone || 0);
    });

    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    const pieChartData = [
      { name: "ตั้งใจเรียน", value: totals.Focused / grandTotal },
      { name: "มองกระดาน", value: totals.Looking_at_the_board / grandTotal },
      { name: "จดเลคเชอร์", value: totals.Taking_notes / grandTotal },
      { name: "มองทางอื่น", value: totals.LookingAway / grandTotal },
      { name: "เล่นมือถือ", value: totals.UsingPhone / grandTotal },
      { name: "คุยกัน", value: totals.Talking / grandTotal },
    ].filter(item => item.value > 0);

    const avgAtt = count > 0 ? ((sumAvgAtt / count) * 100).toFixed(0) : 0;

    return { pieChartData, avgAtt };
  };

// --- Effect 2: Mapping Logic & Filtering ---
useEffect(() => {
  if (rawLogs.length === 0 && summaries.length === 0) return;

  let filteredSummaries = summaries;
  let filteredLogs = rawLogs;

  // Filter Subject
  if (selectedSubject !== "all") {
      filteredSummaries = filteredSummaries.filter(s => s.subject_id === selectedSubject);
      filteredLogs = filteredLogs.filter(l => l.subject_id === selectedSubject);
  }
  // Filter Date
  if (selectedDate !== "all") {
      filteredSummaries = filteredSummaries.filter(s => 
          new Date(s.summary_date).toLocaleDateString('th-TH') === selectedDate
      );
      filteredLogs = filteredLogs.filter(l => 
          new Date(l.created_at).toLocaleDateString('th-TH') === selectedDate
      );
  }
  // Filter Section
  if (selectedSection !== "all") {
      filteredSummaries = filteredSummaries.filter(s => s.section === selectedSection);
      // เช็คเผื่อว่า logs ไม่มี field section
      filteredLogs = filteredLogs.filter(l => l.section === selectedSection); 
  }

  const grouped = {};

  // 1. สร้างโครงกล่อง (Card) จาก Summary
  filteredSummaries.forEach(sum => {
      // สร้าง Key ระบุตัวตนของแต่ละ Card
      const key = `${sum.subject_id}|${sum.section || 'N/A'}|${sum.camera_id}|${new Date(sum.summary_date).toDateString()}`;
      if (!grouped[key]) {
          grouped[key] = { summaries: [], logs: [] };
      }
      grouped[key].summaries.push(sum);
  });

  // 2. ยัด Logs ลงกล่อง (แก้ไขการจับคู่)
  filteredLogs.forEach(log => {
      const logDate = new Date(log.created_at).toDateString();
      
      // วนหา Key ที่ถูกต้อง
      const matchKey = Object.keys(grouped).find(k => {
          const [sub, sec, cam, d] = k.split('|');
          
          // 🟢 แก้ไขจุดสำคัญ: แปลงเป็น String ก่อนเปรียบเทียบ (กันพลาดเรื่อง Type Number/String)
          return (
              String(sub) === String(log.subject_id) && 
              String(cam) === String(log.camera_id) && 
              d === logDate
          );
      });

      if (matchKey && grouped[matchKey]) {
          grouped[matchKey].logs.push(log);
      }
  });

  const finalData = Object.fromEntries(
      Object.entries(grouped).map(([key, data]) => {
          const [subjectId, section, cameraId] = key.split('|');
          const { pieChartData, avgAtt } = processSummaryData(data.summaries);
          const lineChartData = processDataTo3MinIntervals(data.logs);

          return [key, {
              subjectId, section, cameraId,
              pieChartData, avgAtt, lineChartData,
              date: new Date(data.summaries[0].summary_date).toLocaleDateString('th-TH')
          }];
      })
  );

  setGroupedData(finalData); 
}, [rawLogs, summaries, selectedSubject, selectedDate, selectedSection]);
  const COLORS = ['#0068c9','#4299E1', '#63B3ED', '#FE0056', '#FF8000', '#F6E05E'];
  const RADIAN = Math.PI / 180;
  
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if(percent < 0.05) return null;
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
      
      {/* 🟢 แก้ไขตรงนี้: เพิ่ม div ครอบ Navbar และใส่ z-index สูงๆ */}
      <div className="relative z-[1000]"> 
        <Navbar /> 
      </div>

      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        
        {/* --- Header & Filters --- */}
        {/* ตรงนี้เดิมมี z-50 ถ้า Navbar ไม่สูงกว่านี้ เมนูจะจม */}
        <div className="bg-white rounded-[20px] p-4 shadow-sm border border-[#e9e9e9] flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 flex-shrink-0 z-50">
           {/* ... code ภายใน Header ... */}
           <div className='flex items-center gap-2'>
              <BarChartOutlined className="text-2xl text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-700">ผลลัพธ์การเรียนการสอน</h2>
           </div>
           <div className="flex flex-wrap items-center gap-3">
              <CustomSelect placeholder="-- ทุกวัน --" options={uniqueDates} value={selectedDate} onChange={setSelectedDate} prefixIcon={<CalendarOutlined />} />
              <CustomSelect placeholder="-- ทุกวิชา --" options={uniqueSubjects.map(sub => ({ value: sub, label: `วิชา ${sub}` }))} value={selectedSubject} onChange={setSelectedSubject} prefixIcon={<BookOutlined />} />
              <CustomSelect placeholder="-- ทุกกลุ่ม --" options={uniqueSections.map(sec => ({ value: sec, label: `กลุ่ม ${sec}` }))} value={selectedSection} onChange={setSelectedSection} prefixIcon={<TeamOutlined />} />
           </div>
        </div>

        {/* --- Content Area (List of Paired Charts) --- */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
          {Object.values(groupedData).length > 0 ? (
            <div className="flex flex-col gap-6">
              {Object.values(groupedData).map((data, index) => (
                // 🟢 Card ใหญ่ 1 ใบ ต่อ 1 Session
                <div key={index} className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6">
                  
                  {/* Card Header */}
                  <div className='flex justify-between items-start mb-6 border-b border-gray-100 pb-4'>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-gray-800">วิชา {data.subjectId}</h3>
                            {data.section && data.section !== 'N/A' && (
                                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full">
                                    กลุ่ม {data.section}
                                </span>
                            )}
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">CAM {data.cameraId}</span>
                        </div>
                        <span className="text-sm text-gray-500 ml-1">
                           <CalendarOutlined className='mr-2'/>{data.date}
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-gray-400 text-xs mb-1">คะแนนเฉลี่ยรวม</span>
                      <span className={`text-2xl font-bold ${Number(data.avgAtt) >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                        {data.avgAtt}%
                      </span>
                    </div>
                  </div>

                  {/* 🟢 Chart Area: แบ่งซ้ายขวา (Grid) */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left: Line Chart (Timeline) - เอาพื้นที่ 2 ส่วน */}
                    <div className="lg:col-span-2">
                        <h4 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
                            <BarChartOutlined /> Timeline ความตั้งใจ (เฉลี่ยทุก 3 นาที)
                        </h4>
                        <div className="h-[250px] bg-gray-50 rounded-xl border border-gray-100 p-2">
                            <ResponsiveContainer width="100%" height="100%">
                                {data.lineChartData.length > 0 ? (
                                    <LineChart data={data.lineChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                                    <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                                        formatter={(value) => [`${value}%`, 'ความสนใจเฉลี่ย']}
                                    />
                                    {/* 🟢 กราฟเส้นเดียว */}
                                    <Line 
                                        type="monotone" 
                                        dataKey="score" 
                                        stroke="#0068c9" 
                                        strokeWidth={3} 
                                        dot={{ r: 3, fill: '#0068c9', strokeWidth: 0 }} 
                                        activeDot={{ r: 6, strokeWidth: 0 }} 
                                    />
                                    </LineChart>
                                ) : <div className="flex items-center justify-center h-full text-gray-400">ไม่พบข้อมูล Timeline</div>}
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right: Pie Chart */}
                    <div className="lg:col-span-1 border-l border-gray-100 pl-0 lg:pl-8">
                         <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                            <PieChartOutlined /> สัดส่วนพฤติกรรม
                        </h4>
                        <div className="h-[250px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                <Pie
                                    data={data.pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={3}
                                    dataKey="value"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                >
                                    {/* 2. 🟢 วนลูปสร้าง Cell โดยดึงสีจากชื่อ */}
                                    {data.pieChartData.map((entry, index) => (
                                    <Cell 
                                        key={index} 
                                        fill={BEHAVIOR_COLORS[entry.name] || BEHAVIOR_COLORS["default"]} 
                                        stroke="none" 
                                    />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `${(value * 100).toFixed(1)}%`} />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{fontSize: '11px', paddingTop: '10px'}}/>
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Text ตรงกลางโดนัท */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-4 text-center pointer-events-none">
                                <div className="text-gray-400 text-[10px]">รวม</div>
                                <div className="text-gray-700 font-bold text-lg">100%</div>
                            </div>
                        </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-[500px] text-gray-400 bg-white rounded-[20px] border border-gray-200">
                <BarChartOutlined className="text-6xl mb-4 opacity-20" />
                <p className="text-lg">ไม่พบข้อมูลการเรียนการสอน</p>
                <p className="text-sm">ลองปรับเปลี่ยนตัวกรองวันที่ หรือ วิชา</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default ResultsPage