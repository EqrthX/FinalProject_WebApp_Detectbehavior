import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const data = [
  { subject: "SI235-1", attentive: 70, inattentive: 30 },
  { subject: "SI230-1", attentive: 60, inattentive: 40 },
  { subject: "SI423-59", attentive: 80, inattentive: 20 },
  { subject: "SP348-1", attentive: 55, inattentive: 45 },
  { subject: "SP348-1", attentive: 90, inattentive: 10 },
  { subject: "GE108-1", attentive: 72, inattentive: 28 },
  { subject: "GE407-1", attentive: 66, inattentive: 34 },
];

const AdminChart = () => {
  return (
    <div 
      // 🟢 แก้ไขตรงนี้: 
      // 1. ลบ max-w-... ออก หรือเปลี่ยนเป็น w-full เพื่อให้กว้างเต็มช่อง Grid
      // 2. เพิ่ม h-[...] เป็น 500px (หรือ 550px) เพื่อให้กราฟสูงขึ้น
      className="w-full h-[560px] bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 lg:p-8"
    >
      <h2 className="text-md font-semibold mb-5">
        เปอร์เซ็นต์ตั้งใจเรียน (รายวิชา)
      </h2>
      
      {/* ResponsiveContainer จะขยายตามขนาดกล่องแม่ที่เราแก้ด้านบน */}
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data}>
          <XAxis dataKey="subject" />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v) => `${v}%`} />
          <Legend />
          <Bar dataKey="attentive" name="ตั้งใจ" fill="#8884d8" />
          <Bar dataKey="inattentive" name="ไม่ตั้งใจ" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AdminChart;