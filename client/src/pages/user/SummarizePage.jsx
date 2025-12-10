import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import MyBreadcrumb from '../../components/MyBreadcrumb.jsx'
import { 
  BarChartOutlined, 
  PieChartOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../../config/supabase.js"

// --- 1. กำหนดชุดสีมาตรฐาน ---
const BEHAVIOR_COLORS = {
  "ตั้งใจเรียน": "#22c55e",       
  "มองกระดาน": "#3b82f6",        
  "จดเลคเชอร์": "#a855f7",       
  "มองทางอื่น": "#f59e0b",       
  "คุยกัน": "#f97316",           
  "เล่นมือถือ": "#ef4444",                   
  "default": "#cbd5e1"
};

const SummarizePage = () => {
  const teacher_id = localStorage.getItem("teacher_id")

  const [sessionData, setSessionData] = useState([]);
  const [headerInfo, setHeaderInfo] = useState({ subject: "", date: "" });
  const [loading, setLoading] = useState(true);

  // --- 2. ฟังก์ชันจัดกลุ่มข้อมูลกราฟเส้น (3 นาที - เส้นเดียว) ---
  const processDataTo3MinIntervals = (logs) => {
    const buckets = {};
    logs.forEach(log => {
      const date = new Date(log.created_at);
      // ปัดเศษเวลาเป็นช่วงละ 3 นาที
      const coeff = 1000 * 60 * 3; 
      const roundedDate = new Date(Math.floor(date.getTime() / coeff) * coeff);
      const timeStr = roundedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      if (!buckets[timeStr]) {
        buckets[timeStr] = { time: timeStr, totalAtt: 0, count: 0 };
      }
      // เก็บค่าความตั้งใจรวม
      buckets[timeStr].totalAtt += Number(log.Attention || 0);
      buckets[timeStr].count += 1;
    });

    return Object.values(buckets).map(b => ({
      time: b.time,
      // คำนวณค่าเฉลี่ยเป็นเส้นเดียว
      score: ((b.totalAtt / b.count) * 100).toFixed(0)
    }));
  };

  // --- 3. Main Fetch Logic ---
  useEffect(() => {
    const fetchLatestSession = async () => {
      setLoading(true);
      try {
        // A. หา Session ล่าสุด
        const { data: latestRow, error: summaryError } = await supabase
          .from('camera_daily_summary')
          .select('*')
          .eq('teacher_id', teacher_id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (summaryError || !latestRow || latestRow.length === 0) {
          setSessionData([]);
          setLoading(false);
          return;
        }

        const targetSubject = latestRow[0].subject_id;
        const targetDate = latestRow[0].summary_date; 
        const stopTime = new Date(latestRow[0].created_at).toISOString();
        
        setHeaderInfo({
          subject: targetSubject,
          date: new Date(targetDate).toLocaleDateString("th-TH", {
            year: "numeric", month: "long", day: "numeric",
          })
        });

        // B. ดึง Summary ทุกกล้อง
        const { data: allSummaries } = await supabase
          .from('camera_daily_summary')
          .select('*')
          .eq('teacher_id', teacher_id)
          .eq('subject_id', targetSubject)
          .eq('summary_date', targetDate);

        // C. ดึง Logs Timeline
        const startOfDay = new Date(targetDate).toISOString();
        const { data: logs } = await supabase
          .from('camera_logs')
          .select('*')
          .eq('teacher_id', teacher_id)
          .eq('subject_id', targetSubject)
          .gte('created_at', startOfDay)   
          .lte('created_at', stopTime)
          .order('created_at', { ascending: true });

        // D. ประมวลผล
        const processed = allSummaries.map((sumItem) => {
          const camId = sumItem.camera_id;
          
          // -- Timeline Data (3 นาที) --
          const camLogs = logs ? logs.filter(l => l.camera_id === camId) : [];
          const lineChartData = processDataTo3MinIntervals(camLogs);

          // -- Pie Chart Data (Map ชื่อให้ตรงกับสี) --
          const json = sumItem.class_json_summary || {};
          const totalActions = Object.values(json).reduce((a, b) => Number(a) + Number(b), 0) || 1;
          
          const pieChartData = [
            { name: "ตั้งใจเรียน", value: (json.Focused || 0) / totalActions },
            { name: "มองกระดาน", value: (json.Looking_at_the_board || 0) / totalActions },
            { name: "จดเลคเชอร์", value: (json.Taking_notes || 0) / totalActions },
            { name: "มองทางอื่น", value: (json.LookingAway || 0) / totalActions },
            { name: "เล่นมือถือ", value: (json.UsingPhone || 0) / totalActions },
            { name: "คุยกัน", value: (json.Talking || 0) / totalActions },
          ].filter(d => d.value > 0);

          return {
            cameraId: camId,
            avgAtt: (Number(sumItem.avg_attention) * 100).toFixed(0),
            lineChartData,
            pieChartData
          };
        });

        setSessionData(processed);

      } catch (error) {
        console.error("Error fetching latest session:", error);
      } finally {
        setLoading(false);
      }
    };

    if (teacher_id) {
      fetchLatestSession();
    }
  }, [teacher_id]);
  
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    // 1. เพิ่ม overflow-hidden ที่ตัวแม่ เพื่อกันหน้าจอเลื่อนซ้อน
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      <Navbar />
      
      {/* 2. แก้ตรงนี้: ลบ style height: 100vh ออก เปลี่ยนมาใช้ flex-1 แทน */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <MyBreadcrumb />
        
        {/* Main Content Area */}
        {/* ตรงนี้คือส่วนที่ Scroll ได้เพียงจุดเดียว */}
        <div className="flex-1 pt-6 overflow-y-auto scrollbar-hide pb-20">
            
            {/* Header Section */}
            <div className="bg-white rounded-[20px] p-4 shadow-sm border border-[#e9e9e9] flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className='flex items-center gap-2'>
                  <BarChartOutlined className="text-2xl text-blue-500" />
                  <h2 className="text-xl font-semibold text-gray-700">
                    สรุปผลการสอนล่าสุด: <span className="text-[#38A738] ml-2">{headerInfo.subject || "กำลังโหลด..."}</span>
                  </h2>
                </div>
                <div className="text-gray-500 text-sm flex items-center gap-2">
                    <CalendarOutlined /> {headerInfo.date}
                </div>
            </div>

            {/* Cards Container */}
            <div className="flex flex-col gap-6">
                {sessionData.length > 0 ? (
                    // ใช้ key เป็น "เลขกล้อง-ลำดับ"
                    sessionData.map((data, index) => (
                    <div key={`${data.cameraId}-${index}`} className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6">
                        
                        {/* Card Header */}
                        <div className='flex justify-between items-start mb-6 border-b border-gray-100 pb-4'>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-bold text-gray-800">กล้อง {data.cameraId}</h3>
                                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">CAM {data.cameraId}</span>
                                </div>
                                <span className="text-sm text-gray-500">Timeline การสอนวิชา {headerInfo.subject}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-gray-400 text-xs mb-1">คะแนนเฉลี่ยรวม</span>
                                <span className={`text-2xl font-bold ${Number(data.avgAtt) >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                                    {data.avgAtt}%
                                </span>
                            </div>
                        </div>

                        {/* Grid Layout: Left (Line) / Right (Pie) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            
                            {/* Left: Timeline Chart */}
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
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="score" 
                                                    stroke="#0068c9" 
                                                    strokeWidth={3} 
                                                    dot={{ r: 3, fill: '#0068c9', strokeWidth: 0 }} 
                                                    activeDot={{ r: 6, strokeWidth: 0 }} 
                                                />
                                            </LineChart>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-400">
                                                ไม่พบข้อมูล Timeline
                                            </div>
                                        )}
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
                                                {/* ใช้ key จากชื่อ entry */}
                                                {data.pieChartData.map((entry) => (
                                                    <Cell 
                                                        key={entry.name} 
                                                        fill={BEHAVIOR_COLORS[entry.name] || BEHAVIOR_COLORS["default"]} 
                                                        stroke="none" 
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => `${(value * 100).toFixed(1)}%`} />
                                            <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{fontSize: '11px', paddingTop: '10px'}}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-4 text-center pointer-events-none">
                                        <div className="text-gray-400 text-[10px]">รวม</div>
                                        <div className="text-gray-700 font-bold text-lg">100%</div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-[500px] text-gray-400 bg-white rounded-[20px] border border-gray-200">
                        {loading ? (
                             <p>กำลังโหลดข้อมูล...</p>
                        ) : (
                            <>
                                <BarChartOutlined className="text-4xl mb-2 opacity-50" />
                                <p>ไม่พบข้อมูลการสอนล่าสุด</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  )
}

export default SummarizePage