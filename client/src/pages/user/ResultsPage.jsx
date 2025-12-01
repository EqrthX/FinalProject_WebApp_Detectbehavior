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

// --- 2. Main Component ---
const ResultsPage = () => {
  const teacher_id = localStorage.getItem("teacher_id")

  // เก็บข้อมูลแยก 2 ส่วน
  const [rawLogs, setRawLogs] = useState([]);        // สำหรับ Timeline
  const [summaries, setSummaries] = useState([]);    // สำหรับ Pie Chart & Avg
  
  const [groupedData, setGroupedData] = useState({}); 
  const [uniqueSubjects, setUniqueSubjects] = useState([]); 
  const [uniqueDates, setUniqueDates] = useState([]); 
  const [selectedDate, setSelectedDate] = useState("all"); 
  const [selectedSubject, setSelectedSubject] = useState("all"); 

  // --- Effect 1: ดึงข้อมูลทั้ง 2 ตาราง ---
  useEffect(() => {
    const fetchData = async () => {
      if (!teacher_id) return; 

      try {
        // 1. ดึง Log ดิบ (สำหรับกราฟเส้น)
        const logsReq = supabase
          .from("camera_logs") 
          .select("*")
          .eq("teacher_id", teacher_id) 
          .order("created_at", { ascending: false }) 
          .limit(2500);

        // 2. ดึง Summary (สำหรับกราฟวงกลม) 🟢 ใช้ตัวนี้เป็นหลัก
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

          // สร้างตัวเลือก Dropdown จากข้อมูล Summary (เพราะเป็นข้อมูลหลัก)
          const subjects = [...new Set(summaryRes.data.map(item => item.subject_id))].filter(Boolean);
          setUniqueSubjects(subjects);

          const dates = [...new Set(summaryRes.data.map(item => 
            new Date(item.summary_date).toLocaleDateString('th-TH')
          ))];
          setUniqueDates(dates);
        }
      } catch (err) {
        console.error("System error:", err);
      }
    }
    fetchData();
  }, [teacher_id]);

  // --- Helper: กราฟเส้น (5 นาที) ---
  const processDataTo5MinIntervals = (logs) => {
    const buckets = {};
    logs.forEach(log => {
      const date = new Date(log.created_at);
      const coeff = 1000 * 60 * 5; 
      const roundedDate = new Date(Math.floor(date.getTime() / coeff) * coeff);
      const timeStr = roundedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      if (!buckets[timeStr]) buckets[timeStr] = { time: timeStr, totalAtt: 0, totalNon: 0, count: 0 };
      buckets[timeStr].totalAtt += Number(log.Attention || 0);
      buckets[timeStr].totalNon += Number(log.Non_Attention || 0);
      buckets[timeStr].count += 1;
    });
    return Object.values(buckets).map(b => ({
      time: b.time,
      ตั้งใจ: ((b.totalAtt / b.count) * 100).toFixed(0),
      ไม่ตั้งใจ: ((b.totalNon / b.count) * 100).toFixed(0)
    }));
  };

  // --- 🟢 Helper ใหม่: รวมข้อมูลจาก Summary Table (สำหรับ Pie Chart) ---
  const processSummaryData = (summaryList) => {
    const totals = { 
        Focused: 0, Looking_at_the_board: 0, Taking_notes: 0, 
        LookingAway: 0, Talking: 0, UsingPhone: 0 
    };
    
    let sumAvgAtt = 0;
    let sumAvgNon = 0;
    let count = 0;

    summaryList.forEach(item => {
        // รวมคะแนนเฉลี่ย
        sumAvgAtt += Number(item.avg_attention || 0);
        sumAvgNon += Number(item.avg_non_attention || 0);
        count++;

        // รวมพฤติกรรมจาก JSON
        const json = item.class_json_summary || {};
        totals.Focused += Number(json.Focused || 0);
        totals.Looking_at_the_board += Number(json.Looking_at_the_board || 0);
        totals.Taking_notes += Number(json.Taking_notes || 0);
        totals.LookingAway += Number(json.LookingAway || 0);
        totals.Talking += Number(json.Talking || 0);
        totals.UsingPhone += Number(json.UsingPhone || 0);
    });

    // คำนวณ Pie Chart Data
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    const pieChartData = [
      { name: "Focused", value: totals.Focused / grandTotal },
      { name: "Look Board", value: totals.Looking_at_the_board / grandTotal },
      { name: "Take Notes", value: totals.Taking_notes / grandTotal },
      { name: "Look Away", value: totals.LookingAway / grandTotal },
      { name: "Phone", value: totals.UsingPhone / grandTotal },
      { name: "Talking", value: totals.Talking / grandTotal },
    ].filter(item => item.value > 0);

    // คำนวณ Average Scores
    const avgAtt = count > 0 ? ((sumAvgAtt / count) * 100).toFixed(0) : 0;
    const avgNon = count > 0 ? ((sumAvgNon / count) * 100).toFixed(0) : 0;

    return { pieChartData, avgAtt, avgNon };
  };

  // --- Effect 2: Logic การจับคู่ข้อมูล (Mapping) ---
  useEffect(() => {
    if (rawLogs.length === 0 && summaries.length === 0) return;

    // 1. สร้าง Key set ที่เป็นไปได้ทั้งหมด (Subject + Camera + Date)
    // เราใช้ Summary เป็นตัวตั้ง เพราะเป็นข้อมูลหลัก
    let filteredSummaries = summaries;
    let filteredLogs = rawLogs;

    // Filter
    if (selectedSubject !== "all") {
        filteredSummaries = filteredSummaries.filter(s => s.subject_id === selectedSubject);
        filteredLogs = filteredLogs.filter(l => l.subject_id === selectedSubject);
    }
    if (selectedDate !== "all") {
        filteredSummaries = filteredSummaries.filter(s => 
            new Date(s.summary_date).toLocaleDateString('th-TH') === selectedDate
        );
        filteredLogs = filteredLogs.filter(l => 
            new Date(l.created_at).toLocaleDateString('th-TH') === selectedDate
        );
    }

    // 2. จัดกลุ่มข้อมูล
    const grouped = {};

    // วนลูปจาก Summary เพื่อสร้าง Card หลัก
    filteredSummaries.forEach(sum => {
        const key = `${sum.subject_id}|${sum.camera_id}`;
        if (!grouped[key]) {
            grouped[key] = { summaries: [], logs: [] };
        }
        grouped[key].summaries.push(sum);
    });

    // วนลูป Log เพื่อยัดลงกลุ่มให้ตรงกัน (สำหรับกราฟเส้น)
    filteredLogs.forEach(log => {
        const key = `${log.subject_id}|${log.camera_id}`;
        // เฉพาะถ้ามี key นี้ใน summary แล้วค่อยใส่ (หรือจะสร้างใหม่ก็ได้ถ้า log หลุดมา)
        if (grouped[key]) {
            grouped[key].logs.push(log);
        }
    });

    // 3. ประมวลผลขั้นสุดท้าย
    const finalData = Object.fromEntries(
        Object.entries(grouped).map(([key, data]) => {
            const [subjectId, cameraId] = key.split('|');
            
            // 🟢 Pie & Avg: มาจาก Summary (แม่นยำ)
            const { pieChartData, avgAtt, avgNon } = processSummaryData(data.summaries);
            
            // 🟢 Line Chart: มาจาก Logs (ละเอียด)
            const lineChartData = processDataTo5MinIntervals(data.logs);

            return [key, {
                subjectId, cameraId,
                pieChartData, avgAtt, avgNon, lineChartData,
                dataCount: data.summaries.length // จำนวนวันที่สอน
            }];
        })
    );

    setGroupedData(finalData); 
  }, [rawLogs, summaries, selectedSubject, selectedDate]); 

  const COLORS = ['#0068c9','#fe2b2b', '#8622FF', '#739206ff', '#FE0056', '#00B7EB', '#FF8000', '#00FFCE', '#FFFF00'];
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
      <Navbar /> 
      <div className="flex-1 p-6 overflow-hidden">
        <div className="grid grid-cols-3 gap-4 h-full">

          {/* --- Left: Line Charts --- */}
          <div className="col-span-2 bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-[#f0f0f0] flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0 z-50 relative">
              <div className='flex items-center gap-2'>
                  <BarChartOutlined className="text-2xl text-blue-500" />
                  <h2 className="text-xl font-semibold text-gray-700">Timeline การเรียน (ทุก 5 นาที)</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                  <CustomSelect placeholder="-- ทุกวัน --" options={uniqueDates} value={selectedDate} onChange={setSelectedDate} prefixIcon={<CalendarOutlined />} />
                  <CustomSelect placeholder="-- ทุกวิชา --" options={uniqueSubjects.map(sub => ({ value: sub, label: `วิชา ${sub}` }))} value={selectedSubject} onChange={setSelectedSubject} prefixIcon={<BookOutlined />} />
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 scrollbar-hide z-0">
              <div className="w-full">
                {Object.values(groupedData).length > 0 ? (
                  Object.values(groupedData).map((data, index) => (
                    <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 last:mb-0">
                      <div className='flex justify-between items-center mb-4'>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-800">วิชา {data.subjectId}</h3>
                                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">CAM {data.cameraId}</span>
                            </div>
                            <span className="text-xs text-gray-400 ml-1">
                              {selectedDate !== 'all' ? `วันที่ ${selectedDate}` : `ข้อมูล ${data.dataCount} คลาส`}
                            </span>
                        </div>
                        <div className="text-sm flex gap-3">
                          <span className="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 font-bold">
                            ตั้งใจ: {data.avgAtt}%
                          </span>
                          <span className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 font-bold">
                            ไม่ตั้งใจ: {data.avgNon}%
                          </span>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        {data.lineChartData.length > 0 ? (
                            <LineChart data={data.lineChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ borderRadius: '8px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                            <Line type="monotone" dataKey="ตั้งใจ" stroke="#38A738" strokeWidth={2} dot={true} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="ไม่ตั้งใจ" stroke="#FF3300" strokeWidth={2} dot={true} />
                            </LineChart>
                        ) : <div className="text-center text-gray-400 py-10">ไม่พบข้อมูล Timeline (Logs อาจถูกลบไปแล้ว)</div>}
                      </ResponsiveContainer>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                      <BarChartOutlined className="text-4xl mb-2 opacity-50" />
                      <p>ไม่พบข้อมูล (ลองเปลี่ยนตัวกรอง)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* --- Right: Pie Charts --- */}
          <div className="col-span-1 h-full flex flex-col space-y-4 overflow-hidden">
            <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full overflow-hidden">
              <div className="p-5.5 border-b border-[#f0f0f0] flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                   <PieChartOutlined className="text-2xl text-purple-500" />
                   พฤติกรรมรวม
                </h2>
              </div>
              <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1 scrollbar-hide">
                {Object.values(groupedData).length > 0 ? (
                  Object.values(groupedData).map((data, index) => (
                    <div key={index} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative">
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
                              innerRadius={40}
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
                            <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={10} wrapperStyle={{fontSize: '12px'}}/>
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