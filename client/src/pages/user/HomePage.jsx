import React, { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import BookMark from "../../assets/BookMark.png";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PieChartOutlined } from "@ant-design/icons";
import Schedule from "../../components/schedule";
import { supabase } from "../../config/supabase";

// --- 1. กำหนดสี (5 หมวดหลัก) ---
const BEHAVIOR_COLORS = {
  มองกระดาน: "#3b82f6",   // รวม Focused
  จดเลคเชอร์: "#a855f7",
  มองทางอื่น: "#f59e0b",
  เล่นมือถือ: "#ef4444",
  อื่นๆ: "#9ca3af",       // รวม Talking
  default: "#cccccc",
  empty: "#e5e7eb",
};

// --- 2. ลำดับรายการด้านขวา (Fixed 5 Categories) ---
const FIXED_CATEGORIES = [
  "มองกระดาน",
  "จดเลคเชอร์",
  "มองทางอื่น",
  "เล่นมือถือ",
  "อื่นๆ"
];

// ฟังก์ชันแปลงเวลา (เผื่อใช้ใน Tooltip)
const formatDuration = (seconds) => {
  const roundedSeconds = Math.round(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  if (minutes > 0) return `${minutes} นาที ${remainingSeconds} วินาที`;
  return `${remainingSeconds} วินาที`;
};

const HomePage = () => {
  const teacher_id = localStorage.getItem("teacher_id");

  const [displayDate, setDisplayDate] = useState("-");
  const [todayStats, setTodayStats] = useState({
    avgFocused: 0,
    avgNonFocused: 0,
    totalClasses: 0,
  });

  const [bestWorstTime, setBestWorstTime] = useState({
    bestTime: "-",
    bestSubject: "",
    bestScore: 0,
    worstTime: "-",
    worstSubject: "",
    worstScore: 0,
  });

  const [pieDataMap, setPieDataMap] = useState({});
  const [totalDuration, setTotalDuration] = useState(0); // เก็บเวลารวมทั้งหมด

  useEffect(() => {
    const fetchDailyData = async () => {
      if (!teacher_id) return;
      try {
        const todayStr = new Date().toLocaleDateString("en-CA");
        
        // 1. พยายามดึงข้อมูลของ "วันนี้" ทั้งหมด
        let { data, error } = await supabase
          .from("camera_daily_summary")
          .select("*")
          .eq("teacher_id", teacher_id)
          .eq("summary_date", todayStr);

        // 2. Fallback: ถ้าวันนี้ไม่มีข้อมูล ให้ไปดึง "วันล่าสุดที่มีข้อมูล"
        if (!error && (!data || data.length === 0)) {
          const result = await supabase
            .from("camera_daily_summary")
            .select("summary_date")
            .eq("teacher_id", teacher_id)
            .order("summary_date", { ascending: false })
            .limit(1);

          if (result.data && result.data.length > 0) {
            const latestDate = result.data[0].summary_date;
            const latestData = await supabase
              .from("camera_daily_summary")
              .select("*")
              .eq("teacher_id", teacher_id)
              .eq("summary_date", latestDate);
              
            data = latestData.data;
          }
        }

        if (data && data.length > 0) {
          setDisplayDate(data[0].summary_date);
          processData(data);
        } else {
          setDisplayDate("-");
          processData([]);
        }
      } catch (err) {
        console.error("Error:", err);
      }
    };
    fetchDailyData();
  }, [teacher_id]);

  const processData = (records) => {
    let sumAvgAtt = 0; 
    let sumAvgNon = 0;
    
    let maxScore = -1; let minScore = 101;
    let bestT = "-"; let bestSubject = "-";
    let worstT = "-"; let worstSubject = "-";

    // ตัวแปรสะสมยอดรวม (หน่วยเป็นวินาที)
    const dailyTotals = {
      มองกระดาน: 0,
      จดเลคเชอร์: 0,
      มองทางอื่น: 0,
      เล่นมือถือ: 0,
      อื่นๆ: 0,
    };

    if (records.length > 0) {
      records.forEach((record) => {
        // 1. คำนวณคะแนนเฉลี่ย (Attentive Score)
        let attScore = Number(record.avg_attention);
        let nonScore = Number(record.avg_non_attention);
        if (attScore <= 1 && attScore > 0) attScore *= 100;
        if (nonScore <= 1 && nonScore > 0) nonScore *= 100;
        
        sumAvgAtt += attScore; 
        sumAvgNon += nonScore;

        // 2. หา Best/Worst
        const timeStr = record.created_at
          ? new Date(record.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
          : "-";
        const subjectName = record.subject_id || "Unknown";

        if (attScore > maxScore) { maxScore = attScore; bestT = timeStr; bestSubject = subjectName; }
        if (attScore < minScore) { minScore = attScore; worstT = timeStr; worstSubject = subjectName; }

        // --- 🟢 แก้ไขจุดสำคัญ: ใช้ class_duration_summary แทน json_summary ---
        // เพื่อให้หน่วยเป็น "เวลา" เหมือนหน้า Results
        let behaviors = record.class_duration_summary; 
        
        // Fallback: ถ้าไม่มี duration ให้ไปใช้ json แบบเดิม (กันเหนียว)
        if (!behaviors) {
             behaviors = record.class_json_summary;
        }

        if (typeof behaviors === "string") { try { behaviors = JSON.parse(behaviors); } catch (e) {} }
        behaviors = behaviors || {};

        // --- รวมยอด (Mapping 5 หมวด) ---
        dailyTotals["มองกระดาน"] += (Number(behaviors.Looking_at_the_board || 0) + Number(behaviors.Focused || 0));
        dailyTotals["จดเลคเชอร์"] += Number(behaviors.Taking_notes || 0);
        dailyTotals["เล่นมือถือ"] += Number(behaviors.UsingPhone || 0);
        dailyTotals["มองทางอื่น"] += Number(behaviors.LookingAway || 0);
        dailyTotals["อื่นๆ"] += (Number(behaviors.Talking || 0) + Number(behaviors.Other || 0));
      });

      const count = records.length;
      
      setTodayStats({
        avgFocused: (sumAvgAtt / count).toFixed(0),
        avgNonFocused: (sumAvgNon / count).toFixed(0),
        totalClasses: count,
      });

      setBestWorstTime({
        bestTime: bestT, 
        bestSubject: bestSubject, 
        bestScore: maxScore >= 0 ? maxScore.toFixed(0) : 0,
        worstTime: worstT, 
        worstSubject: worstSubject, 
        worstScore: minScore <= 100 ? minScore.toFixed(0) : 0,
      });

    } else {
      setTodayStats({ avgFocused: 0, avgNonFocused: 0, totalClasses: 0 });
      setBestWorstTime({ bestTime: "-", bestSubject: "", bestScore: 0, worstTime: "-", worstSubject: "", worstScore: 0 });
    }

    // คำนวณเวลารวมทั้งหมดเพื่อใช้หา %
    const sumAllDuration = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
    setTotalDuration(sumAllDuration);
    setPieDataMap(dailyTotals);
  };

  // แปลง Map เป็น Array
  const chartData = Object.keys(pieDataMap).map(key => ({
    name: key,
    value: pieDataMap[key]
  })).filter(item => item.value > 0);

  const isDataEmpty = totalDuration === 0;
  const finalPieData = isDataEmpty ? [{ name: "No Data", value: 1 }] : chartData;

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null; 
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const RADIAN = Math.PI / 180;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);

    return (
      <text
        x={x} y={y} fill="white" fontSize={10}
        textAnchor="middle" dominantBaseline="central"
      >
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  const cardStyle = "bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 flex flex-col items-center justify-center";

  return (
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      <Navbar />
      <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
        <div className="space-y-6 max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-full">
              <Schedule />
            </div>

            <div className="flex flex-col space-y-4">
              <div className={`${cardStyle} !p-0 !items-start relative overflow-hidden`} style={{ minHeight: "300px" }}>
                <div className="w-full p-4 pb-0 flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-gray-600 mb-0 flex items-center gap-2">
                    <PieChartOutlined /> สัดส่วนพฤติกรรม (รวมทั้งวัน)
                  </h4>
                  <span className="text-xs text-gray-400">
                    ข้อมูล: {displayDate} ({todayStats.totalClasses} คลาส)
                  </span>
                </div>

                <div className="flex items-center w-full h-[250px] px-2">
                  <div className="w-[55%] h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={finalPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={80}
                          paddingAngle={isDataEmpty ? 0 : 3}
                          dataKey="value"
                          labelLine={false}
                          label={isDataEmpty ? null : renderCustomizedLabel} 
                        >
                          {finalPieData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={isDataEmpty ? BEHAVIOR_COLORS["empty"] : BEHAVIOR_COLORS[entry.name] || BEHAVIOR_COLORS["default"]}
                              stroke="none"
                            />
                          ))}
                        </Pie>
                        {!isDataEmpty && (
                          <Tooltip 
                            formatter={(value) => {
                                // คำนวณ % เทียบกับเวลา
                                const percent = totalDuration > 0 ? ((value / totalDuration) * 100).toFixed(1) : 0;
                                return [`${percent}%`, "สัดส่วน"];
                            }}
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                          />
                        )}
                      </PieChart>
                    </ResponsiveContainer>
                    {isDataEmpty && (
                      <div className="absolute top-1/2 left-[27%] transform -translate-x-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                        ไม่มีข้อมูล
                      </div>
                    )}
                  </div>

                  <div className="w-[45%] flex flex-col justify-center h-full pr-4">
                    {FIXED_CATEGORIES.map((category, index) => {
                      const value = pieDataMap[category] || 0;
                      // คำนวณ % จากเวลารวม
                      const percent = totalDuration > 0 ? ((value / totalDuration) * 100).toFixed(0) : 0;
                      
                      return (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded text-xs flex items-center justify-center shrink-0" style={{ backgroundColor: BEHAVIOR_COLORS[category] }} />
                            <span className="text-xs text-gray-600 truncate">{category}</span>
                          </div>
                          <span className="text-xs font-medium text-gray-500">{percent}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* กล่องสรุปผล */}
              {/*<div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 flex flex-col">
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
              </div>*/}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;