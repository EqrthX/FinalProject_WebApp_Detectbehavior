import React, { useState, useEffect } from 'react'
import Navbar from '../../components/Navbar'
import BookMark from "../../assets/BookMark.png";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Schedule from '../../components/schedule'; 
import { supabase } from "../../config/supabase"; // อย่าลืม import supabase

const HomePage = () => {
  const teacher_id = localStorage.getItem("teacher_id");

  // --- State สำหรับข้อมูล ---
  const [todayStats, setTodayStats] = useState({
    avgFocused: 0,      // ตั้งใจเรียนเฉลี่ย
    avgNonFocused: 0,   // ไม่ตั้งใจเรียนเฉลี่ย
    dayAverage: 0,      // ค่าเฉลี่ยของวันนี้
  });

  const [bestWorstTime, setBestWorstTime] = useState({
    bestTime: "-",      // เวลาที่ดีที่สุด
    bestScore: 0,
    worstTime: "-",     // เวลาที่แย่ที่สุด
    worstScore: 0
  });

  const [pieData, setPieData] = useState([]); // ข้อมูลสำหรับกราฟวงกลม

  // สีสำหรับกราฟ
  const COLORS = ['#0068c9','#fe2b2b', '#8622FF', '#739206ff', '#FE0056', '#00B7EB', '#FF8000', '#00FFCE', '#FFFF00'];
  const RADIAN = Math.PI / 180;

  // --- useEffect: ดึงข้อมูลเมื่อโหลดหน้า ---
  useEffect(() => {
    const fetchTodayData = async () => {
      if (!teacher_id) return;

      // 1. กำหนดช่วงเวลา "วันนี้" (00:00 - 23:59)
      const now = new Date();
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      try {
        const { data, error } = await supabase
          .from('camera_logs')
          .select('*')
          .eq('teacher_id', teacher_id)
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay);

        if (error) throw error;

        if (data && data.length > 0) {
          processData(data);
        } else {
          // กรณีไม่มีข้อมูลวันนี้เลย ให้เซ็ตค่าเป็น 0
          setTodayStats({ avgFocused: 0, avgNonFocused: 0, dayAverage: 0 });
          setBestWorstTime({ bestTime: "-", bestScore: 0, worstTime: "-", worstScore: 0 });
          setPieData([]);
        }

      } catch (err) {
        console.error("Error fetching homepage data:", err);
      }
    };

    fetchTodayData();
  }, [teacher_id]);

  // --- ฟังก์ชันคำนวณข้อมูล (Logic) ---
  const processData = (logs) => {
    let totalAtt = 0;
    let totalNon = 0;
    
    // ตัวแปรสำหรับหา Best/Worst Time
    let maxAtt = -1;
    let minAtt = 101; // ตั้งไว้เกิน 100 เพื่อให้ค่าแรกทับแน่นอน
    let bestT = "-";
    let worstT = "-";

    // ตัวแปรสำหรับรวม JSON เพื่อทำ Pie Chart
    const jsonTotals = { Focused: 0, Looking_at_the_board: 0, Taking_notes: 0, LookingAway: 0, Talking: 0, UsingPhone: 0 };

    logs.forEach(log => {
      // 1. รวมค่าเพื่อหาค่าเฉลี่ย (แปลงจาก 0-1 เป็น 0-100)
      const att = Number(log.Attention) * 100;
      const non = Number(log.Non_Attention) * 100;
      
      totalAtt += att;
      totalNon += non;

      // 2. หาช่วงเวลาที่ดีที่สุด (Max Attention)
      if (att > maxAtt) {
        maxAtt = att;
        bestT = new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      }

      // 3. หาช่วงเวลาที่แย่ที่สุด (Min Attention)
      if (att < minAtt) {
        minAtt = att;
        worstT = new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      }

      // 4. รวมข้อมูลสำหรับ Pie Chart
      const ratios = log.class_json || {};
      Object.keys(jsonTotals).forEach(key => {
        jsonTotals[key] += (ratios[key] || 0);
      });
    });

    const count = logs.length;

    // --- อัปเดต State ---
    
    // A. การ์ด 3 ใบ
    setTodayStats({
      avgFocused: (totalAtt / count).toFixed(0),
      avgNonFocused: (totalNon / count).toFixed(0),
      dayAverage: (totalAtt / count).toFixed(0), // ค่าเฉลี่ยรวมวันนี้
    });

    // B. กล่องสรุปผล (Best/Worst)
    setBestWorstTime({
      bestTime: bestT,
      bestScore: maxAtt.toFixed(0),
      worstTime: worstT,
      worstScore: minAtt.toFixed(0)
    });

    // C. กราฟวงกลม
    const chartData = Object.keys(jsonTotals).map(key => ({
      name: key,
      value: jsonTotals[key] / count // หาค่าเฉลี่ยต่อ Log
    })).filter(item => item.value > 0);
    
    setPieData(chartData);
  };

  const cardStyle = "bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 flex flex-col items-center justify-center";

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);

    return (
      <text x={x} y={y} fill="white" fontSize={12} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      
      <Navbar />

      <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
        <div className="space-y-6 max-w-screen-2xl mx-auto">
          
          {/* --- Section 1: การ์ดเปอร์เซ็นต์ (ข้อมูลจริง) --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={cardStyle}>
              <span className="text-4xl font-bold text-[#1D971D]">{todayStats.avgFocused}%</span>
              <span className="text-gray-700 mt-2 font-medium">ตั้งใจเรียน</span>
            </div>
            <div className={cardStyle}>
              <span className="text-4xl font-bold text-[#FF3300]">{todayStats.avgNonFocused}%</span>
              <span className="text-gray-700 mt-2 font-medium">ไม่ตั้งใจเรียน</span>
            </div>
            <div className={cardStyle}>
              <span className="text-4xl font-bold text-[#0900FF]">{todayStats.dayAverage}%</span>
              <span className="text-gray-700 mt-2 font-medium">ค่าเฉลี่ยของวันนี้</span>
            </div>
          </div>

          {/* --- Section 2: ตารางสอน และ กราฟ --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            <div className="lg:col-span-2 h-full">
              <Schedule/> 
            </div>
                    
            <div className="flex flex-col space-y-4">
              
              {/* กราฟวงกลม (ข้อมูลจริง) */}
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
                          label={renderCustomizedLabel}
                          outerRadius={80}
                          innerRadius={50}
                          dataKey="value"
                          paddingAngle={2}
                        >    
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => val.toFixed(1)}/>
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

              {/* สรุปผล (ข้อมูลจริง: Best/Worst Time) */}
              <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6 flex flex-col">
                <div className="flex items-center space-x-2 border-b border-gray-100 pb-3 mb-3">
                  <img src={BookMark} alt="Bookmark" className="w-6 h-6" />
                  <h2 className="text-lg font-semibold text-black mb-0">สรุปผล</h2>
                </div>
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 text-[#085E0E] px-4 py-3 rounded-xl flex justify-between items-center text-sm font-medium">
                    <span>ช่วงเวลาที่ดีที่สุด ({bestWorstTime.bestTime})</span>
                    <span className="font-bold">{bestWorstTime.bestScore}%</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 text-[#74393C] px-4 py-3 rounded-xl flex justify-between items-center text-sm font-medium">
                     <span>ช่วงเวลาที่แย่ที่สุด ({bestWorstTime.worstTime})</span>
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