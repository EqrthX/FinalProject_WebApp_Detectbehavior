import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import MyBreadcrumb from '../../components/MyBreadcrumb.jsx'
import { 
  BarChartOutlined, 
  LoadingOutlined, 
  PieChartOutlined 
} from '@ant-design/icons';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../../config/supabase.js"
import { Spin } from 'antd';

const SummarizePage = () => {
  const teacher_id = localStorage.getItem("teacher_id")

  const [sessionData, setSessionData] = useState([]);
  const [headerInfo, setHeaderInfo] = useState({ subject: "", date: "" });
  const [loading, setLoading] = useState(true);

  // --- 🟢 (เพิ่ม) ฟังก์ชันจัดกลุ่มข้อมูลกราฟเส้น (5 นาที) ---
  const processDataTo5MinIntervals = (logs) => {
    const buckets = {};
    logs.forEach(log => {
      const date = new Date(log.created_at);
      // ปัดเศษเวลาเป็นช่วงละ 5 นาที
      const coeff = 1000 * 60 * 5; 
      const roundedDate = new Date(Math.floor(date.getTime() / coeff) * coeff);
      const timeStr = roundedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      if (!buckets[timeStr]) {
        buckets[timeStr] = { time: timeStr, totalAtt: 0, totalNon: 0, count: 0 };
      }
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

  // --- 🟢 (แก้ไข) Main Fetch Logic ---
  useEffect(() => {
    const fetchLatestSession = async () => {
      setLoading(true);
      try {
        // 1. 🔍 หา "Session ล่าสุด" ที่เพิ่งกด Stop
        const { data: latestRow, error: summaryError } = await supabase
          .from('camera_daily_summary')
          .select('*')
          .eq('teacher_id', teacher_id)
          .order('created_at', { ascending: false }) // เรียงจากใหม่สุด
          .limit(1);

        if (summaryError || !latestRow || latestRow.length === 0) {
          console.log("ไม่พบข้อมูลการสอนล่าสุด");
          setSessionData([]);
          setLoading(false);
          return;
        }

        // เก็บข้อมูลสำคัญ: รหัสวิชา, วันที่, และเวลาที่กดหยุด
        const targetSubject = latestRow[0].subject_id;
        const targetDate = latestRow[0].summary_date; 
        const stopTime = new Date(latestRow[0].created_at).toISOString(); // เวลาที่กด Stop
        
        setHeaderInfo({
          subject: targetSubject,
          date: new Date(targetDate).toLocaleDateString("th-TH", {
            year: "numeric", month: "long", day: "numeric",
          })
        });

        // 2. 📦 ดึง Summary ของ "ทุกกล้อง" ในคาบนั้น
        const { data: allSummaries } = await supabase
          .from('camera_daily_summary')
          .select('*')
          .eq('teacher_id', teacher_id)
          .eq('subject_id', targetSubject) // ✅ กรองเฉพาะวิชาล่าสุด
          .eq('summary_date', targetDate); // ✅ กรองเฉพาะวันที่ล่าสุด

        // 3. 📈 ดึง Logs (Timeline) เฉพาะของวิชานั้น
        // กำหนดขอบเขตเวลา: ตั้งแต่เริ่มวัน จนถึงเวลาที่กด Stop
        const startOfDay = new Date(targetDate).toISOString();

        const { data: logs } = await supabase
          .from('camera_logs')
          .select('*')
          .eq('teacher_id', teacher_id)
          .eq('subject_id', targetSubject) // ✅ สำคัญ: กรอง Logs ให้เหลือแค่วิชานี้เท่านั้น
          .gte('created_at', startOfDay)   
          .lte('created_at', stopTime)     // ✅ ตัดจบที่เวลา stop (กัน Log คาบถัดไปหลุดมา)
          .order('created_at', { ascending: true });

        // 4. 🧩 ประมวลผลข้อมูลแยกตามกล้อง
        const processed = allSummaries.map((sumItem) => {
          const camId = sumItem.camera_id;
          
          // A. กราฟเส้น (Timeline)
          const camLogs = logs ? logs.filter(l => l.camera_id === camId) : [];
          const lineChartData = processDataTo5MinIntervals(camLogs);

          // B. กราฟวงกลม (Pie Chart)
          const json = sumItem.class_json_summary || {};
          const totalActions = Object.values(json).reduce((a, b) => Number(a) + Number(b), 0) || 1;
          
          const pieChartData = [
            { name: "Focused", value: (json.Focused || 0) / totalActions },
            { name: "Looking Board", value: (json.Looking_at_the_board || 0) / totalActions },
            { name: "Taking Notes", value: (json.Taking_notes || 0) / totalActions },
            { name: "Looking Away", value: (json.LookingAway || 0) / totalActions },
            { name: "Using Phone", value: (json.UsingPhone || 0) / totalActions },
            { name: "Talking", value: (json.Talking || 0) / totalActions },
          ].filter(d => d.value > 0);

          return {
            cameraId: camId,
            avgAtt: (Number(sumItem.avg_attention) * 100).toFixed(0),
            avgNon: (Number(sumItem.avg_non_attention) * 100).toFixed(0),
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
  
  const COLORS = ['#0068c9','#fe2b2b', '#8622FF', '#739206ff', '#FE0056', '#00B7EB', '#FF8000', '#00FFCE', '#FFFF00'];
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
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      <Navbar />
      
      <div style={{ padding: 24, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <MyBreadcrumb />
        
        {/* Main Content Area */}
        <div className="flex-1 pt-6 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-auto">

            {/* --- Left Column: Line Charts --- */}
            <div className="col-span-2 bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-[#f0f0f0] flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
                <div className='flex items-center gap-2'>
                  <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                    <BarChartOutlined className="text-2xl text-blue-500" />
                    {/* แสดงชื่อวิชาล่าสุดที่ดึงมาได้ */}
                    สรุปผลการสอนล่าสุด: <span className="text-[#38A738]">{headerInfo.subject || "-"}</span>
                  </h2>
                </div>
                <div className="text-gray-500 text-sm">วันที่: {headerInfo.date}</div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 scrollbar-hide">
                <div className="w-full">
                  {sessionData.length > 0 ? (
                    sessionData.map((data) => (
                      <div key={data.cameraId} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 last:mb-0">
                        <div className='flex justify-between items-center mb-4'>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">CAM {data.cameraId}</span>
                              <h3 className="text-lg font-semibold text-gray-700">Timeline ({headerInfo.subject})</h3>
                            </div>
                          </div>
                          <div className="text-sm flex gap-3">
                            <span className="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 font-bold">
                              เฉลี่ยตั้งใจ: {data.avgAtt}%
                            </span>
                            <span className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 font-bold">
                              เฉลี่ยไม่ตั้งใจ: {data.avgNon}%
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
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              ไม่พบข้อมูล Timeline สำหรับวิชานี้
                            </div>
                          )}
                        </ResponsiveContainer>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                      <BarChartOutlined className="text-4xl mb-2 opacity-50" />
                      <p>ไม่พบข้อมูลการสอนล่าสุด</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* --- Right Column: Pie Charts --- */}
            <div className="col-span-1 h-full flex flex-col space-y-4 overflow-hidden">
              <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-[#f0f0f0] flex-shrink-0">
                  <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                     <PieChartOutlined className="text-2xl text-purple-500" />
                     พฤติกรรมรวม
                  </h2>
                </div>

                <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1 scrollbar-hide">
                  {sessionData.length > 0 ? (
                    sessionData.map((data) => (
                      <div key={data.cameraId} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative">
                        <div className="absolute top-3 left-3 z-10">
                             <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                              CAM {data.cameraId}
                            </span>
                        </div>
                        <div className="h-[250px] w-full">
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
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
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
                      <p>ไม่พบข้อมูลสรุป</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default SummarizePage