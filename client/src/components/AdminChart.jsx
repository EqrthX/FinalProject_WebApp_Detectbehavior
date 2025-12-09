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

const AdminChart = ({ selectedCategory }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // ดึงข้อมูลมาเยอะๆ หน่อย เพราะเราจะยุบรวมเหลือแค่จำนวนนักเรียนจริง
        const { data: summaries, error } = await supabase
          .from("camera_daily_summary")
          .select("subject_id, camera_id, avg_attention, summary_date, created_at")
          .order("summary_date", { ascending: false })
          .limit(2000); 

        if (error) throw error;

        // --- STEP 1: จัดกลุ่ม (รายหัวนักเรียน) ---
        const uniqueStudents = {}; // เปลี่ยนชื่อตัวแปรให้สื่อความหมาย

        summaries.forEach((item) => {
          // เราไม่สนวันที่แล้ว (ตัด dateStr ทิ้ง) เพื่อรวมคะแนนของคนนี้ตลอดทั้งเทอม
          const sectionVal = item.section || 'N/A'; 
          
          // 🟢 KEY ใหม่: แยกแค่ วิชา + กลุ่ม + เลขกล้อง (1 Key = 1 นักเรียน)
          const uniqueKey = `${item.subject_id}|${sectionVal}|${item.camera_id}`;

          if (!uniqueStudents[uniqueKey]) {
            uniqueStudents[uniqueKey] = {
              subject_id: item.subject_id,
              lastActive: item.summary_date || item.created_at, // เก็บวันที่ล่าสุดที่น้องคนนี้เข้าเรียน
              sumAttention: 0,
              count: 0 
            };
          }

          // รวมคะแนนสะสมทุกคาบเรียนของคนนี้
          uniqueStudents[uniqueKey].sumAttention += Number(item.avg_attention || 0);
          uniqueStudents[uniqueKey].count += 1; // นับจำนวนคาบที่เข้าเรียน

          // อัปเดตวันที่ล่าสุด (เผื่อเรียงลำดับ)
          const currentDate = new Date(item.summary_date || item.created_at);
          const savedDate = new Date(uniqueStudents[uniqueKey].lastActive);
          if (currentDate > savedDate) {
             uniqueStudents[uniqueKey].lastActive = item.summary_date || item.created_at;
          }
        });

        // --- STEP 2: ตัดสินพฤติกรรม "โดยรวม" ของนักเรียนคนนั้น ---
        const subjectStats = {};

        Object.values(uniqueStudents).forEach((student) => {
          const subject = student.subject_id;

          if (!subjectStats[subject]) {
            subjectStats[subject] = {
              subject_id: subject,
              attentiveCount: 0,
              inattentiveCount: 0,
              lastActive: student.lastActive,
            };
          }

          // คะแนนเฉลี่ยตลอดเทอมของนักเรียนคนนี้
          const avgPercent = (student.sumAttention / student.count) * 100;

          // ถ้าโดยรวมตลอดเทอม เกิน 50% ถือว่าเป็นเด็กตั้งใจเรียน
          if (avgPercent >= 50) {
            subjectStats[subject].attentiveCount += 1;
          } else {
            subjectStats[subject].inattentiveCount += 1;
          }
          
          // หาว่าวิชานี้มีการเรียนการสอนล่าสุดเมื่อไหร่
          const currentSubDate = new Date(student.lastActive);
          const savedSubDate = new Date(subjectStats[subject].lastActive);
          if (currentSubDate > savedSubDate) {
            subjectStats[subject].lastActive = student.lastActive;
          }
        });

        // --- STEP 3: ลงกราฟ ---
        let processedData = Object.values(subjectStats).map((item) => {
          return {
            subject: item.subject_id,
            attentivePeople: item.attentiveCount,
            inattentivePeople: item.inattentiveCount,
            lastActive: item.lastActive,
          };
        });

        processedData.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
        const topSubjects = processedData.slice(0, 6);

        setData(topSubjects);

      } catch (err) {
        console.error("Error fetching chart summary:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCategory]);

  if (loading) return <div className="w-full h-[560px] flex items-center justify-center bg-white rounded-2xl border border-gray-200"><p className="text-gray-400">กำลังประมวลผล...</p></div>;
  if (data.length === 0) return <div className="w-full h-[560px] flex items-center justify-center bg-white rounded-2xl border border-gray-200"><p className="text-gray-400">ไม่พบข้อมูล</p></div>;

  return (
    <div className="w-full h-[560px] bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 lg:p-8">
      <h2 className="text-md font-semibold mb-5 text-gray-800">
        สรุปพฤติกรรมนักเรียนรายบุคคล (เฉลี่ยรวมทุกคาบ)
      </h2>
      
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data} barGap={8} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#6B7280', fontSize: 12 }} label={{ value: 'จำนวนนักเรียน (คน)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
          <Tooltip formatter={(value) => `${value} คน`} cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
          <Legend verticalAlign="top" height={36} iconType="circle" />
          
          <Bar dataKey="attentivePeople" name="ตั้งใจเรียน (ภาพรวม)" fill="#38A738" radius={[4, 4, 0, 0]} barSize={40} />
          <Bar dataKey="inattentivePeople" name="ไม่ตั้งใจเรียน (ภาพรวม)" fill="#FF4D4F" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AdminChart;