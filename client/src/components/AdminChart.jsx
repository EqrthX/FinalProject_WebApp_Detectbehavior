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

const AdminChart = ({ selectedCategory }) => { // รับ props เผื่อมีการ filter ในอนาคต
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. ดึงข้อมูลสรุปรายวันล่าสุด (camera_daily_summary)
        // ดึงมาสัก 50-100 รายการล่าสุดก็พอ เพราะเป็นข้อมูลสรุปแล้ว
        const { data: summaries, error } = await supabase
          .from("camera_daily_summary")
          .select("subject_id, avg_attention, avg_non_attention, summary_date, created_at")
          .order("summary_date", { ascending: false }) // เรียงตามวันที่สอนล่าสุด
          .limit(100);

        if (error) throw error;

        // 2. จัดกลุ่มข้อมูลตาม subject_id
        const groupedSubjects = {};
        
        summaries.forEach((item) => {
          const subject = item.subject_id;
          
          if (!groupedSubjects[subject]) {
            groupedSubjects[subject] = {
              subject_id: subject,
              totalAtt: 0, // ผลรวมค่าเฉลี่ยความสนใจ
              totalNon: 0, // ผลรวมค่าเฉลี่ยความไม่สนใจ
              count: 0,    // จำนวนครั้งที่สอน (จำนวน row)
              lastActive: item.summary_date || item.created_at, // ใช้วันที่สอนล่าสุด
            };
          }
          
          // บวกค่าเฉลี่ยสะสมไว้
          groupedSubjects[subject].totalAtt += Number(item.avg_attention || 0);
          groupedSubjects[subject].totalNon += Number(item.avg_non_attention || 0);
          groupedSubjects[subject].count += 1;
          
          // อัปเดตวันที่ให้เป็นล่าสุดเสมอ (ข้อมูล sort มาแล้ว แต่อัปเดตกันพลาด)
          const currentDate = new Date(item.summary_date || item.created_at);
          const savedDate = new Date(groupedSubjects[subject].lastActive);
          if (currentDate > savedDate) {
              groupedSubjects[subject].lastActive = item.summary_date || item.created_at;
          }
        });

        // 3. คำนวณเป็นเปอร์เซ็นต์เฉลี่ยรวม
        let processedData = Object.values(groupedSubjects).map((item) => {
          // หาค่าเฉลี่ยต่อคาบของวิชานั้นๆ
          const meanAtt = item.totalAtt / item.count;
          const meanNon = item.totalNon / item.count;
          const totalScore = meanAtt + meanNon;

          // แปลงเป็น % เทียบกันเอง (เพื่อให้กราฟรวมกันได้ 100%)
          const percentAtt = totalScore === 0 ? 0 : Math.round((meanAtt / totalScore) * 100);
          const percentNon = totalScore === 0 ? 0 : Math.round((meanNon / totalScore) * 100);

          return {
            subject: item.subject_id,
            attentive: percentAtt,
            inattentive: percentNon,
            lastActive: item.lastActive,
          };
        });

        // 4. เรียงลำดับตามความเคลื่อนไหวล่าสุด และตัดมาแค่ 5 วิชา
        processedData.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
        const top6Latest = processedData.slice(0, 5);

        setData(top6Latest);

      } catch (err) {
        console.error("Error fetching chart summary:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCategory]); // เพิ่ม dependencies หากมีการใช้ filter

  // --- Loading UI ---
  if (loading) {
    return (
      <div className="w-full h-[560px] bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3D42D3]"></div>
            <p className="text-gray-400">กำลังโหลดข้อมูลสรุป...</p>
        </div>
      </div>
    );
  }

  // --- No Data UI ---
  if (data.length === 0) {
    return (
      <div className="w-full h-[560px] bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex items-center justify-center">
        <p className="text-gray-400">ไม่พบข้อมูลสรุปรายวัน</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[560px] bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 lg:p-8">
      <h2 className="text-md font-semibold mb-5 text-gray-800">
        ผลรวม 6 วิชาล่าสุด
      </h2>
      
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          data={data}
          barGap={6} // ระยะห่างระหว่างแท่ง
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          
          <XAxis 
            dataKey="subject" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 12 }}
            dy={10}
          />
          
          <YAxis 
            axisLine={false}
            tickLine={false}
            domain={[0, 100]} 
            tickFormatter={(v) => `${v}%`} 
            tick={{ fill: '#6B7280', fontSize: 12 }}
          />
          
          <Tooltip 
            formatter={(value) => `${value}%`}
            cursor={{ fill: '#F3F4F6' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
          />
          
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle"
          />
          
          {/* กราฟแท่งแยกสี ตั้งใจ/ไม่ตั้งใจ */}
          <Bar 
            dataKey="attentive" 
            name="ตั้งใจเรียน" 
            fill="#38A738"  // สีเขียว
            radius={[4, 4, 0, 0]} 
            barSize={30}
          />

          <Bar 
            dataKey="inattentive" 
            name="ไม่ตั้งใจ" 
            fill="#FF4D4F"  // สีแดง
            radius={[4, 4, 0, 0]} 
            barSize={30}
          />

        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AdminChart;