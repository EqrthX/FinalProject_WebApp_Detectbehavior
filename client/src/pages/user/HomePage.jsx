import React from 'react'
import Navbar from '../../components/Navbar'
import BookMark from "../../assets/BookMark.png";


import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Classroom from '../../components/Classroom';

const HomePage = () => {

  const data = [
    { name: 'Focused', value: 870 },
    { name: 'Inactive', value: 130 },

  ];

  const RADIAN = Math.PI / 180;
  const COLORS = ['#0068c9','#fe2b2b'];

  // เพิ่มฟังก์ชัน handleCourseClick
  const handleCourseClick = (courseId) => {
    console.log('Course clicked:', courseId);
    // เพิ่ม logic ที่ต้องการเมื่อคลิกที่วิชา
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <>
      <Navbar />

      {/* เนื้อหา Dashboard */}
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        {/* การ์ดเปอร์เซ็นต์ */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center">
            <span className="text-4xl font-bold text-[#1D971D]">70%</span>
            <span className="text-black ">ตั้งใจเรียน</span>
          </div>
          <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center">
            <span className="text-4xl font-bold text-[#FF3300]">30%</span>
            <span className="text-black">ไม่ตั้งใจเรียน</span>
          </div>
          <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center">
            <span className="text-4xl font-bold text-[#0900FF]">30%</span>
            <span className="text-black ">ค่าเฉลี่ยของวันนี้</span>
          </div>
        </div>

        {/* ตารางสอน ดึงมาจาก complemant Classroom */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-2xl shadow p-6 ">
            <Classroom/> 
          </div>
                   
          {/* ฝั่งขวา: กราฟ + สรุปผล */}
          <div className="flex flex-col space-y-4">
            {/* กราฟ - เพิ่มความสูงที่ชัดเจน */}
            <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center" style={{ minHeight: '350px' }}>
              <h2 className="text-lg font-semibold text-[#767676] mb-2">ผลรวมรายวัน</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >    
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* สรุปผล */}
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center space-x-2">
                <img src={BookMark} alt="Bookmark" className="w-6 h-6" />
                <h2 className="text-lg font-semibold text-black mb-0">สรุปผล</h2>
              </div>
              <div className="space-y-2 mt-5">
                <div className="bg-green-100 text-[#085E0E] px-4 py-2 rounded-lg">
                  ช่วงเวลาที่ดีที่สุด : 09:30 (ความสนใจ 78%)
                </div>
                <div className="bg-red-100 text-[#74393C] px-4 py-2 rounded-lg">
                  ช่วงเวลาที่แย่ที่สุด : 09:40 (ความสนใจ 65%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default HomePage