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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. ดึงข้อมูลดิบทั้งหมด (เพิ่ม group ใน select)
        const { data: allRecords, error } = await supabase
          .from("camera_daily_summary")
          .select("subject_id, group, camera_id, avg_attention")
          .limit(10000); 

        if (error) throw error;

        // 🟢 เพิ่มการกรอง: เฉพาะ Record ที่มี 'group' เท่านั้น
        const filteredRecords = allRecords.filter(record => record.group !== null && record.group !== undefined);

        // --- STEP 1: สร้างสมุดพกนักเรียน (รวบรวมคะแนนรายคน) ---
        // Key ของนักเรียน 1 คน = "วิชา-กลุ่ม-เลขกล้อง"
        const studentsReport = {};

        filteredRecords.forEach((record) => {
          // สร้าง Key เพื่อระบุตัวตน (Unique ID)
          const studentKey = `${record.subject_id}-${record.group}-${record.camera_id}`;

          if (!studentsReport[studentKey]) {
            studentsReport[studentKey] = {
              subject_id: record.subject_id,
              totalScore: 0,
              sessionCount: 0
            };
          }

          // บวกคะแนนเพิ่มเข้าไป
          studentsReport[studentKey].totalScore += Number(record.avg_attention || 0);
          studentsReport[studentKey].sessionCount += 1;
        });

        // --- STEP 2: ตัดเกรดพฤติกรรม (ผ่าน / ไม่ผ่าน) ---
        const subjectCounts = {};

        Object.values(studentsReport).forEach((student) => {
          const subject = student.subject_id;

          if (!subjectCounts[subject]) {
            subjectCounts[subject] = {
              subject: subject,
              attentive: 0,
              inattentive: 0
            };
          }

          // คำนวณค่าเฉลี่ยของคนนี้
          const finalAverage = (student.totalScore / student.sessionCount) * 100;

          // ตัดสินใจ: ถ้าเฉลี่ยเกิน 50% ให้ถือว่าเป็นคนตั้งใจ
          if (finalAverage >= 50) {
            subjectCounts[subject].attentive += 1;
          } else {
            subjectCounts[subject].inattentive += 1;
          }
        });

        // --- STEP 3: แปลงข้อมูลเป็น Array เพื่อใส่กราฟ ---
        const chartData = Object.values(subjectCounts);

        // เรียงลำดับตามจำนวนคนเรียนจากมากไปน้อย
        chartData.sort((a, b) => (b.attentive + b.inattentive) - (a.attentive + a.inattentive));

        setData(chartData);

      } catch (err) {
        console.error("Error fetching admin chart:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return (
    <div className="w-full h-[560px] flex items-center justify-center bg-white rounded-2xl border border-gray-200">
      <p className="text-gray-400">กำลังประมวลผลข้อมูลทั้งเทอม...</p>
    </div>
  );

  if (data.length === 0) return (
    <div className="w-full h-[500px] flex items-center justify-center bg-white rounded-2xl border border-gray-200">
      <p className="text-lg text-gray-400">ไม่พบข้อมูลรายวิชาที่มีการกำหนดกลุ่มเรียน</p>
      <p className="text-sm text-gray-400 mt-2">โปรดตรวจสอบว่าข้อมูลที่บันทึกมีค่า 'Group' แล้ว</p>
    </div>
  );

  return (
    <div className="w-full h-[560px] bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
            <h2 className="text-lg font-semibold text-gray-800">
            สรุปพฤติกรรมนักเรียนรายวิชา (ภาพรวมทั้งเทอม)
            </h2>
            <p className="text-xs text-gray-400 mt-1">
            เกณฑ์ตัดสิน: คะแนนเฉลี่ยสะสมทุกคาบ {'>'}= 50% ถือว่าตั้งใจเรียน
            </p>
        </div>
        <div className="mt-2 md:mt-0 flex gap-2">
             <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="w-3 h-3 rounded-full bg-[#38A738]"></div> ตั้งใจ
             </div>
             <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="w-3 h-3 rounded-full bg-[#FF4D4F]"></div> ไม่ตั้งใจ
             </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height="85%">
        <BarChart 
          data={data} 
          margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
          barGap={8}
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
            allowDecimals={false} 
            tick={{ fill: '#6B7280', fontSize: 12 }} 
            label={{ value: 'จำนวนคน', angle: -90, position: 'insideLeft', fill: '#9CA3AF', offset: 10 }} 
          />
          <Tooltip 
            cursor={{ fill: '#F9FAFB' }}
            formatter={(value) => [`ทั้งหมด ${value} คน`]}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
          />
          
          <Bar 
            dataKey="attentive" 
            name="ตั้งใจเรียน" 
            fill="#38A738" 
            radius={[4, 4, 0, 0]} 
            barSize={40} 
          />
          <Bar 
            dataKey="inattentive" 
            name="ไม่ตั้งใจเรียน" 
            fill="#FF4D4F" 
            radius={[4, 4, 0, 0]} 
            barSize={40} 
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AdminChart;