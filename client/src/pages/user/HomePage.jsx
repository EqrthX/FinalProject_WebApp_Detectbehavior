import React, { useState, useEffect } from 'react'
import Navbar from '../../components/Navbar'
import BookMark from "../../assets/BookMark.png";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Schedule from '../../components/schedule'; 
import { supabase } from "../../config/supabase";

const HomePage = () => {
  const teacher_id = localStorage.getItem("teacher_id");

  // --- State สำหรับข้อมูล ---
  const [todayStats, setTodayStats] = useState({
    avgFocused: 0,
    avgNonFocused: 0,
  });

  const [bestWorstTime, setBestWorstTime] = useState({
    bestTime: "-",      
    bestSubject: "",
    bestScore: 0,
    worstTime: "-",
    worstSubject: "",     
    worstScore: 0
  });

  const [pieData, setPieData] = useState([]);

  // สีสำหรับกราฟ
  const COLORS = ['#0068c9','#fe2b2b', '#8622FF', '#739206ff', '#FE0056', '#00B7EB', '#FF8000', '#00FFCE', '#FFFF00'];
  const RADIAN = Math.PI / 180;

  // --- useEffect: ดึงข้อมูลเมื่อโหลดหน้า ---
  useEffect(() => {
    const fetchTodayData = async () => {
      if (!teacher_id) return;

      // หาวันที่ปัจจุบัน (YYYY-MM-DD)
      const todayStr = new Date().toLocaleDateString('en-CA'); 

      try {
        const { data, error } = await supabase
          .from('camera_daily_summary')
          .select('*')
          .eq('teacher_id', teacher_id)
          .eq('summary_date', todayStr);

        if (error) throw error;

        if (data && data.length > 0) {
          processData(data);
        } else {
          // Reset ค่าถ้าไม่เจอข้อมูลวันนี้
          setTodayStats({ avgFocused: 0, avgNonFocused: 0 });
          setBestWorstTime({ bestTime: "-",bestSubject: "", bestScore: 0, worstTime: "-",worstSubject: "", worstScore: 0 });
          setPieData([]);
        }

      } catch (err) {
        console.error("Error fetching homepage data:", err);
      }
    };

    fetchTodayData();
  }, [teacher_id]);

  // --- ฟังก์ชันคำนวณข้อมูล (Logic) ---
  const processData = (records) => {
    let sumAvgAtt = 0;
    let sumAvgNon = 0;
    
    // ตัวแปรสำหรับหา Best/Worst Time
    let maxScore = -1;
    let minScore = 101;
    let bestT = "-";
    let worstT = "-";
    let bestSubject = "";
    let worstSubject = "";

    // ตัวแปรสำหรับรวม JSON (Pie Chart)
    const jsonTotals = {};

    records.forEach(record => {
      // 1. จัดการคะแนน (แปลง 0-1 เป็น 0-100 ถ้าจำเป็น)
      let attScore = Number(record.avg_attention);
      let nonScore = Number(record.avg_non_attention);

      if (attScore <= 1 && attScore > 0) attScore *= 100;
      if (nonScore <= 1 && nonScore > 0) nonScore *= 100;

      sumAvgAtt += attScore;
      sumAvgNon += nonScore;

      // 2. จัดรูปแบบเวลา (HH:mm) จาก created_at
      const timeStr = record.created_at 
        ? new Date(record.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        : "-";

      // 3. หา Best Time (คะแนนสูงสุด)
      if (attScore > maxScore) {
        maxScore = attScore;
        bestT = timeStr;
        bestSubject = record.subject_id;
      }

      // 4. หา Worst Time (คะแนนต่ำสุด)
      if (attScore < minScore) {
        minScore = attScore;
        worstT = timeStr;
        worstSubject = record.subject_id;
      }

      // 5. รวม JSON สำหรับ Pie Chart
      const behaviors = record.class_json_summary || {};
      Object.keys(behaviors).forEach(key => {
        const val = Number(behaviors[key] || 0);
        jsonTotals[key] = (jsonTotals[key] || 0) + val;
      });
    });

    const count = records.length;

    // --- อัปเดต State ---
    
    // A. ค่าเฉลี่ยรวม
    setTodayStats({
      avgFocused: (sumAvgAtt / count).toFixed(0),
      avgNonFocused: (sumAvgNon / count).toFixed(0),
    });

    // B. Best/Worst (ใส่ข้อมูลจริงลงไปใน Format เดิม)
    setBestWorstTime({
      bestTime: bestT,
      bestSubject:  bestSubject,
      bestScore: maxScore.toFixed(0),
      worstTime: worstT,
      worstSubject: worstSubject,
      worstScore: minScore.toFixed(0)
    });

    // C. Pie Chart
    // แปลง jsonTotals เป็น Array และ Recharts จะคำนวณ % จาก value ให้เอง
    const chartData = Object.keys(jsonTotals).map(key => ({
      name: key,
      value: jsonTotals[key]
    })).filter(item => item.value > 0);
    
    setPieData(chartData);
  };

  const cardStyle = "bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 flex flex-col items-center justify-center";

  // ฟังก์ชัน Custom Label สำหรับ Pie Chart (แสดง %)
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);

    if (percent < 0.05) return null; // ซ่อนถ้าเล็กกว่า 5%

    return (
      <text x={x} y={y} fill="white" fontSize={12} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      
      <Navbar />

      <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
        <div className="space-y-6 max-w-screen-2xl mx-auto">
          
          {/* --- Section 1: การ์ดคะแนน --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cardStyle}>
              <span className="text-4xl font-bold text-[#1D971D]">{todayStats.avgFocused}%</span>
              <span className="text-gray-700 mt-2 font-medium">ตั้งใจเรียน</span>
            </div>
            <div className={cardStyle}>
              <span className="text-4xl font-bold text-[#FF3300]">{todayStats.avgNonFocused}%</span>
              <span className="text-gray-700 mt-2 font-medium">ไม่ตั้งใจเรียน</span>
            </div>
          </div>

          {/* --- Section 2: ตารางสอน และ กราฟ --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            <div className="lg:col-span-2 h-full">
              <Schedule/> 
            </div>
                    
            <div className="flex flex-col space-y-4">
              
              {/* กราฟวงกลม */}
              <div className={`${cardStyle} !justify-start`} style={{ minHeight: '350px' }}>
                <h2 className="text-lg font-semibold text-[#767676] mb-2 self-start w-full text-center border-b pb-2 border-gray-100">
                  ผลรวมรายวัน
                </h2>
                <div className="w-full flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {pieData.length > 0 ? (
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={renderCustomizedLabel} // แสดง % ในกราฟ
                          outerRadius={80}
                          innerRadius={50}
                          dataKey="value"
                          paddingAngle={2}
                        >    
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => `${val} ครั้ง`} />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400">
                        ยังไม่มีข้อมูลวันนี้
                      </div>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* กล่องสรุปผล (ใช้รูปแบบเดิม 100% ตามคำขอ) */}
              <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 flex flex-col">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3 mb-3">
                  <img src={BookMark} alt="Bookmark" className="w-6 h-6" />
                  <h2 className="text-lg font-semibold text-black mb-0">สรุปผล</h2>
                </div>
                <div className="space-y-3">
                  {/* แถวเขียว: ดีที่สุด */}
                  <div className="bg-green-50 border border-green-200 text-[#085E0E] px-4 py-3 rounded-xl flex justify-between items-center text-sm font-medium">
                    <span>ช่วงเวลาที่ดีที่สุด {bestWorstTime.bestTime} ({bestWorstTime.bestSubject})</span>
                    <span className="font-bold">{bestWorstTime.bestScore}%</span>
                  </div>
                  
                  {/* แถวแดง: แย่ที่สุด */}
                  <div className="bg-red-50 border border-red-200 text-[#74393C] px-4 py-3 rounded-xl flex justify-between items-center text-sm font-medium">
                     <span>ช่วงเวลาที่แย่ที่สุด {bestWorstTime.worstTime} ({bestWorstTime.worstSubject})</span>
                     <span className="font-bold">{bestWorstTime.worstScore}%</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default HomePage