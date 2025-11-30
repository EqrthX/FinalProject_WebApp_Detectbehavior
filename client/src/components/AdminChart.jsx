import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "../config/supabase";

const AdminChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Fetch Data Logic (เหมือนเดิม) ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. ดึง Log ล่าสุด 1000 แถว
        const { data: logs, error } = await supabase
          .from("camera_logs")
          .select("subject_id, Attention, Non_Attention, created_at")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (error) throw error;

        // 2. จัดกลุ่มและคำนวณ
        const groupedSubjects = {};
        logs.forEach((log) => {
          const subject = log.subject_id;
          if (!groupedSubjects[subject]) {
            groupedSubjects[subject] = {
              subject_id: subject,
              sumAtt: 0,
              sumNon: 0,
              count: 0,
              lastActive: log.created_at,
            };
          }
          groupedSubjects[subject].sumAtt += Number(log.Attention || 0);
          groupedSubjects[subject].sumNon += Number(log.Non_Attention || 0);
          groupedSubjects[subject].count += 1;
        });

        // 3. แปลงเป็น %
        let processedData = Object.values(groupedSubjects).map((item) => {
          const avgAtt = item.sumAtt / item.count;
          const avgNon = item.sumNon / item.count;
          const totalScore = avgAtt + avgNon;

          const percentAtt = totalScore === 0 ? 0 : Math.round((avgAtt / totalScore) * 100);
          const percentNon = totalScore === 0 ? 0 : Math.round((avgNon / totalScore) * 100);

          return {
            subject: item.subject_id,
            attentive: percentAtt,
            inattentive: percentNon,
            lastActive: item.lastActive,
          };
        });

        // 4. เรียงตามเวลาล่าสุด และตัดเอาแค่ 6 อันดับ
        processedData.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
        const top6Latest = processedData.slice(0, 6);

        setData(top6Latest);

      } catch (err) {
        console.error("Error fetching chart data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Loading UI ---
  if (loading) {
    return (
      <div className="w-full h-[560px] bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex items-center justify-center">
        <p className="text-gray-400">กำลังประมวลผลข้อมูล...</p>
      </div>
    );
  }

  // --- No Data UI ---
  if (data.length === 0) {
    return (
      <div className="w-full h-[560px] bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex items-center justify-center">
        <p className="text-gray-400">ไม่พบข้อมูลการเรียนล่าสุด</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[560px] bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 lg:p-8">
      <h2 className="text-md font-semibold mb-5 text-gray-800">
        เปอร์เซ็นต์ตั้งใจเรียน (6 วิชาล่าสุด)
      </h2>
      
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          data={data}
          // ปรับระยะห่างระหว่างแท่งคู่ของแต่ละวิชา
          barGap={4} 
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          
          <XAxis 
            dataKey="subject" 
            tick={{ fill: '#6B7280', fontSize: 12 }}
            dy={10}
          />
          
          <YAxis 
            domain={[0, 100]} 
            tickFormatter={(v) => `${v}%`} 
            tick={{ fill: '#6B7280', fontSize: 12 }}
          />
          
          <Tooltip 
            formatter={(value) => `${value}%`}
            cursor={{ fill: '#F3F4F6' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
          />
          
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          
          {/* 🟢 แท่งที่ 1: ตั้งใจ (เอา stackId ออก เพื่อให้วางข้างกัน) */}
          <Bar 
            dataKey="attentive" 
            name="ตั้งใจ" 
            fill="#8884d8" // สีม่วง (ตามแบบเดิม) หรือใช้ #38A738 (เขียว)
            radius={[4, 4, 0, 0]} 
          />

          {/* 🔴 แท่งที่ 2: ไม่ตั้งใจ (เอา stackId ออก) */}
          <Bar 
            dataKey="inattentive" 
            name="ไม่ตั้งใจ" 
            fill="#82ca9d" // สีเขียวอ่อน (ตามแบบเดิม) หรือใช้ #FF4D4F (แดง)
            radius={[4, 4, 0, 0]} 
          />

        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AdminChart;