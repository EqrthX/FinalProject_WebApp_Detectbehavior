import React, { useState, useEffect } from 'react'
import Navbar from '../../components/Navbar'
import BookMark from "../../assets/BookMark.png";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer ,Label } from "recharts";
import { PieChartOutlined } from '@ant-design/icons'; // เพิ่ม icon ให้เหมือนต้นฉบับ
import Schedule from '../../components/schedule'; 
import { supabase } from "../../config/supabase";

// --- 1. เพิ่มค่าสีและการแปลงชื่อให้เหมือนต้นฉบับ ---
const BEHAVIOR_COLORS = {
  "ตั้งใจเรียน": "#22c55e",       
  "มองกระดาน": "#3b82f6",        
  "จดเลคเชอร์": "#a855f7",       
  "มองทางอื่น": "#f59e0b",       
  "คุยกัน": "#f97316",           
  "เล่นมือถือ": "#ef4444",                   
  "default": "#cccccc"
};

// Map ชื่อจาก Database (Eng) -> ชื่อที่จะแสดง (Thai)
const KEY_MAPPING = {
  "Focused": "ตั้งใจเรียน",
  "Looking_at_the_board": "มองกระดาน",
  "Taking_notes": "จดเลคเชอร์",
  "LookingAway": "มองทางอื่น",
  "Talking": "คุยกัน",
  "UsingPhone": "เล่นมือถือ"
};

const HomePage = () => {
  const teacher_id = localStorage.getItem("teacher_id");

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

  useEffect(() => {
    const fetchTodayData = async () => {
      if (!teacher_id) return;
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

  const processData = (records) => {
    let sumAvgAtt = 0;
    let sumAvgNon = 0;
    let maxScore = -1;
    let minScore = 101;
    let bestT = "-";
    let worstT = "-";
    let bestSubject = "";
    let worstSubject = "";

    const jsonTotals = {};

    records.forEach(record => {
      let attScore = Number(record.avg_attention);
      let nonScore = Number(record.avg_non_attention);

      if (attScore <= 1 && attScore > 0) attScore *= 100;
      if (nonScore <= 1 && nonScore > 0) nonScore *= 100;

      sumAvgAtt += attScore;
      sumAvgNon += nonScore;

      const timeStr = record.created_at 
        ? new Date(record.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        : "-";

      if (attScore > maxScore) {
        maxScore = attScore;
        bestT = timeStr;
        bestSubject = record.subject_id;
      }

      if (attScore < minScore) {
        minScore = attScore;
        worstT = timeStr;
        worstSubject = record.subject_id;
      }

      const behaviors = record.class_json_summary || {};
      Object.keys(behaviors).forEach(key => {
        const val = Number(behaviors[key] || 0);
        jsonTotals[key] = (jsonTotals[key] || 0) + val;
      });
    });

    const count = records.length;

    setTodayStats({
      avgFocused: (sumAvgAtt / count).toFixed(0),
      avgNonFocused: (sumAvgNon / count).toFixed(0),
    });

    setBestWorstTime({
      bestTime: bestT,
      bestSubject:  bestSubject,
      bestScore: maxScore.toFixed(0),
      worstTime: worstT,
      worstSubject: worstSubject,
      worstScore: minScore.toFixed(0)
    });

    const chartData = Object.keys(jsonTotals).map(key => ({
      name: key,
      value: jsonTotals[key]
    })).filter(item => item.value > 0);
    
    setPieData(chartData);
  };

  const cardStyle = "bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 flex flex-col items-center justify-center";

  // --- 2. Label แบบเดียวกับ Reference ---
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if(percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const RADIAN = Math.PI / 180;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
    return (
      <text x={x} y={y} fill="white" fontSize={10} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  // เตรียมข้อมูลสำหรับกราฟ (แปลงชื่อ และหาผลรวมเพื่อคำนวณ %)
  const displayPieData = pieData.map(item => ({
    name: KEY_MAPPING[item.name] || item.name,
    value: item.value
  }));

  // หา Total รวมเพื่อใช้คำนวณ % ใน Tooltip (ถ้าต้องการ)
  const totalValue = displayPieData.reduce((acc, cur) => acc + cur.value, 0);

  return (
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      
      <Navbar />

      <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
        <div className="space-y-6 max-w-screen-2xl mx-auto">
          
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            <div className="lg:col-span-2 h-full">
              <Schedule/> 
            </div>
                    
            <div className="flex flex-col space-y-4">
              
              {/* --- 3. ส่วน Pie Chart ที่แก้ใหม่ (เหมือน ResultsPage) --- */}
              <div className={`${cardStyle} !p-0 !items-start relative overflow-hidden`} style={{ minHeight: '300px' }}>
                <div className="w-full p-4 pb-0">
                   <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                      <PieChartOutlined /> สัดส่วนพฤติกรรม (รายวัน)
                   </h4>
                </div>
                
                <div className="w-full h-[250px] relative"> 
                  <ResponsiveContainer width="100%" height="100%">
                    {displayPieData.length > 0 ? (
                      <PieChart>
                      <Pie
                        data={displayPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={renderCustomizedLabel}
                      >
                        {displayPieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={BEHAVIOR_COLORS[entry.name] || BEHAVIOR_COLORS["default"]} 
                            stroke="none" 
                          />
                        ))}
                      </Pie>
                    
                      {/* Tooltip และ Legend เหมือนเดิม */}
                      <Tooltip 
                          formatter={(value) => [`${((value / totalValue) * 100).toFixed(1)}%`, 'สัดส่วน']} 
                          wrapperStyle={{ zIndex: 1000 }}
                          contentStyle={{ 
                              borderRadius: "12px",
                              border: "none",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          }}
                      />
                      <Legend 
                          layout="vertical" 
                          verticalAlign="middle" 
                          align="right" 
                          iconSize={8} 
                          wrapperStyle={{ fontSize: '11px', right: 0 }}
                      />
                    </PieChart>
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400">
                        ยังไม่มีข้อมูลวันนี้
                      </div>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* กล่องสรุปผล (คงเดิม) */}
              <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 flex flex-col">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3 mb-3">
                  <img src={BookMark} alt="Bookmark" className="w-6 h-6" />
                  <h2 className="text-lg font-semibold text-black mb-0">สรุปผล</h2>
                </div>
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 text-[#085E0E] px-4 py-3 rounded-xl flex justify-between items-center text-sm font-medium">
                    <span>ช่วงเวลาที่ดีที่สุด {bestWorstTime.bestTime} ({bestWorstTime.bestSubject})</span>
                    <span className="font-bold">{bestWorstTime.bestScore}%</span>
                  </div>
                  
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