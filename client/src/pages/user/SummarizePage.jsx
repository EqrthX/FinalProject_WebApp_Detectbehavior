import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import MyBreadcrumb from '../../components/MyBreadcrumb.jsx'
import { 
  BarChartOutlined, 
  PieChartOutlined,
  CalendarOutlined,
  SendOutlined,
  TeamOutlined,
  ClockCircleOutlined // 🟢 1. เพิ่มไอคอนนาฬิกา
} from '@ant-design/icons';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../../config/supabase.js"
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const [sessionData, setSessionData] = useState([]);
  // 🟢 เพิ่ม scheduleTime ใน State
  const [headerInfo, setHeaderInfo] = useState({ subject: "", date: "", group: "", scheduleTime: "" }); 
  const [loading, setLoading] = useState(true);

  // --- 2. ฟังก์ชันจัดกลุ่มข้อมูลกราฟเส้น (3 นาที - เส้นเดียว) ---
  const processDataTo3MinIntervals = (logs) => {
    const buckets = {};
    logs.forEach(log => {
      const date = new Date(log.created_at);
      const coeff = 1000 * 60 * 3; 
      const roundedDate = new Date(Math.floor(date.getTime() / coeff) * coeff);
      const timeStr = roundedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      if (!buckets[timeStr]) {
        buckets[timeStr] = { time: timeStr, totalAtt: 0, count: 0 };
      }
      buckets[timeStr].totalAtt += Number(log.Attention || 0);
      buckets[timeStr].count += 1;
    });

    return Object.values(buckets).map(b => ({
      time: b.time,
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
          .eq("group", group)
          .order('created_at', { ascending: false })
          .limit(1);

        if (summaryError || !latestRow || latestRow.length === 0) {
          setSessionData([]);
          setLoading(false);
          return;
        }

        const targetSubject = latestRow[0].subject_id;
        const targetDate = latestRow[0].summary_date;
        const targetGroup = latestRow[0].group; 
        const stopTime = new Date(latestRow[0].created_at).toISOString();
        
        // 🟢 B. ดึงตารางสอน (Class Schedule) มาหาเวลาเรียน
        const { data: schedules } = await supabase
            .from('class_schedule')
            .select('*')
            .eq('teacher_id', teacher_id);

        let displayTime = "ไม่พบตารางเรียน";

        if (schedules) {
            // กรองหาตารางที่ตรงกับ วิชา และ กลุ่ม (โดยไม่สนวันที่บันทึก)
            const matchedSchedules = schedules.filter(s => {
                const isSubjectMatch = String(s.subject_id).trim() === String(targetSubject).trim();
                const sGroup = String(s.group || "").trim();
                const tGroup = String(targetGroup).trim();
                const isGroupMatch = (sGroup === tGroup) || (parseInt(sGroup) === parseInt(tGroup));
                return isSubjectMatch && isGroupMatch;
            });

            if (matchedSchedules.length > 0) {
                // สร้าง String แสดงผล "วัน HH:mm - HH:mm"
                displayTime = matchedSchedules.map(s => {
                    const day = s.day; 
                    const start = String(s.start_time).slice(0, 5);
                    const end = String(s.end_time).slice(0, 5);
                    return `${day} ${start} - ${end}`;
                }).join(", ");
            }
        }

        // อัปเดต Header Info
        setHeaderInfo({
          subject: targetSubject,
          group: targetGroup,
          date: new Date(targetDate).toLocaleDateString("th-TH", {
            year: "numeric", month: "long", day: "numeric",
          }),
          scheduleTime: displayTime // 🟢 เก็บเวลาเรียน
        });

        // C. ดึง Summary ทุกกล้อง (กรองด้วย Subject, Date, Group)
        const { data: allSummaries } = await supabase
          .from('camera_daily_summary')
          .select('*')
          .eq('teacher_id', teacher_id)
          .eq('subject_id', targetSubject)
          .eq('summary_date', targetDate)
          .eq('group', targetGroup); 

        // D. ดึง Logs Timeline (กรองด้วย Group)
        const startOfDay = new Date(targetDate).toISOString();
        const { data: logs } = await supabase
          .from('camera_logs')
          .select('*')
          .eq('teacher_id', teacher_id)
          .eq('subject_id', targetSubject)
          .eq('group', targetGroup)
          .gte('created_at', startOfDay)   
          .lte('created_at', stopTime)
          .order('created_at', { ascending: true });

        // E. ประมวลผล (Group Aggregation)
        const groupedByCamera = {};

        allSummaries.forEach((item) => {
            const camId = item.camera_id;
            
            if (!groupedByCamera[camId]) {
                groupedByCamera[camId] = {
                    totalAtt: 0,    
                    countRow: 0,    
                    jsonSum: {      
                        Focused: 0, Looking_at_the_board: 0, Taking_notes: 0,
                        LookingAway: 0, UsingPhone: 0, Talking: 0
                    }
                };
            }

            groupedByCamera[camId].totalAtt += Number(item.avg_attention || 0);
            groupedByCamera[camId].countRow += 1;

            const json = item.class_json_summary || {};
            groupedByCamera[camId].jsonSum.Focused += Number(json.Focused || 0);
            groupedByCamera[camId].jsonSum.Looking_at_the_board += Number(json.Looking_at_the_board || 0);
            groupedByCamera[camId].jsonSum.Taking_notes += Number(json.Taking_notes || 0);
            groupedByCamera[camId].jsonSum.LookingAway += Number(json.LookingAway || 0);
            groupedByCamera[camId].jsonSum.UsingPhone += Number(json.UsingPhone || 0);
            groupedByCamera[camId].jsonSum.Talking += Number(json.Talking || 0);
        });

        const processed = Object.keys(groupedByCamera).map((camId) => {
          const group = groupedByCamera[camId];
          const avgDecimal = group.countRow > 0 ? (group.totalAtt / group.countRow) : 0;
          const finalAvgAtt = (avgDecimal * 100).toFixed(0);

          const camLogs = logs ? logs.filter(l => String(l.camera_id) === String(camId)) : [];
          const lineChartData = processDataTo3MinIntervals(camLogs);

          const totalActions = Object.values(group.jsonSum).reduce((a, b) => a + b, 0) || 1;
          
          const pieChartData = [
            { name: "ตั้งใจเรียน", value: group.jsonSum.Focused / totalActions },
            { name: "มองกระดาน", value: group.jsonSum.Looking_at_the_board / totalActions },
            { name: "จดเลคเชอร์", value: group.jsonSum.Taking_notes / totalActions },
            { name: "มองทางอื่น", value: group.jsonSum.LookingAway / totalActions },
            { name: "เล่นมือถือ", value: group.jsonSum.UsingPhone / totalActions },
            { name: "คุยกัน", value: group.jsonSum.Talking / totalActions },
          ].filter(d => d.value > 0);

          return {
            cameraId: camId,
            avgAtt: finalAvgAtt,
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

  const handleGoToResults = () => {
    navigate('/user/ResultsPage', { 
      state: { 
        filterSubject: headerInfo.subject, 
        filterDate: headerInfo.date,
        filterSection: headerInfo.group 
      } 
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      <Navbar />
      
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <MyBreadcrumb />
        
        {/* Main Content Area */}
        <div className="flex-1 pt-6 overflow-y-auto scrollbar-hide pb-20">
            
            {/* Header Section */}
            <div className="bg-white rounded-[20px] p-4 shadow-sm border border-[#e9e9e9] flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                  <div className="flex items-center gap-2">
                    <BarChartOutlined className="text-2xl text-blue-500" />
                    <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2 flex-wrap">
                      สรุปผลการสอนล่าสุด: 
                      <span className="text-[#38A738]">{headerInfo.subject || "กำลังโหลด..."}</span>
                      
                      {headerInfo.group && (
                         <span className="flex items-center gap-1 bg-purple-100 text-purple-700 text-sm font-medium px-3 py-1 rounded-full border border-purple-200 ml-1">
                            <TeamOutlined /> กลุ่ม {headerInfo.group}
                         </span>
                      )}
                    </h2>
                  </div>
                  
                  {/* 🟢 ส่วนแสดงวันที่และเวลาเรียน */}
                  <div className="text-gray-500 text-sm font-medium flex items-center gap-4 md:ml-4">
                      {/* วันที่บันทึก */}
                      <span className="flex items-center gap-1">
                        <CalendarOutlined /> {headerInfo.date}
                      </span>
                      
                      {/* เส้นคั่น */}
                      <div className="w-[1px] h-4 bg-gray-300"></div>

                      {/* เวลาเรียนตามตาราง */}
                      <span className="flex items-center gap-1 text-gray-500 font-medium">
                        <ClockCircleOutlined /> {headerInfo.scheduleTime}
                      </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                    <span className="text-sm text-gray-400">
                    ข้อมูลบนหน้านี้คือข้อมูลดิบของแต่ละกล้อง คุณสามารถดูภาพรวมทั้งหมดพร้อมตัวกรองได้ที่หน้าสรุปผล
                    </span>

                    <button
                        onClick={handleGoToResults}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-medium hover:bg-blue-600 transition duration-200 shadow-md flex-shrink-0"
                    >
                        <SendOutlined className="text-sm" />
                        ไปยังหน้ารวมสรุปผล
                    </button>
                </div>
            </div>

            {/* Cards Container */}
            <div className="flex flex-col gap-6">
                {sessionData.length > 0 ? (
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