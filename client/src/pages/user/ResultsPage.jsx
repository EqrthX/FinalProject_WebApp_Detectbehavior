import React from 'react'
import Navbar from '../../components/Navbar'
import { Link } from 'react-router-dom';
import { BarChartOutlined } from '@ant-design/icons';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";

const ResultsPage = () => {
  const dataLine = [
    {
      name: '09:00',
      ความตั้งใจ: 75,
      amt: 2400,
    },
    {
      name: '09:10',
      ความตั้งใจ: 68,
      amt: 2210,
    },
    {
      name: '09:20',
      ความตั้งใจ: 85,
      amt: 2290,
    },
    {
      name: '09:30',
      ความตั้งใจ: 68,
      amt: 2000,
    },
    {
      name: '09:40',
      ความตั้งใจ: 68,
      amt: 2181,
    },
    {
      name: '',
      ความตั้งใจ: 75,
      amt: 2500,
    },
    {
      name: '09:50',
      ความตั้งใจ: 65,
      amt: 2500,
    },

  ];

  // กราฟวงกลม
  const data = [
    { name: 'Focused', value: 870 },
    { name: 'Inactive', value: 130 },

  ];

  const RADIAN = Math.PI / 180;
  const COLORS = ['#0068c9', '#fe2b2b'];

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
      <div className="grid grid-cols-3 gap-4 p-6 min-h-screen">

        {/* กล่องซ้าย */}
        <div className="col-span-2 bg-white rounded-2xl shadow p-6 border border-gray-100 h-140">
          <div className="p-6">
            <div className="mb-6 ">
              <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                <BarChartOutlined className="text-2xl text-blue-500" />
                ผลรวมรายวัน
              </h2>
            </div>
            <div className="flex justify-center gap-50">
              <div className="bg-white  p-6 flex flex-col items-center w-auto">
                <span className="text-black ">ตั้งใจเรียน</span>
                <span className="text-4xl font-bold text-[#1D971D]">70%</span>
              </div>
              <div className="bg-white  p-6 flex flex-col items-center w-auto">
                <span className="text-black">ไม่ตั้งใจเรียน</span>
                <span className="text-4xl font-bold text-[#FF3300]">30%</span>
              </div>
            </div>

            {/* กราฟเส้น */}
            <div className="w-full rounded-lg p-6 ">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dataLine}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="name"
                    padding={{ left: 30, right: 30 }}
                    tick={{ fill: '#666' }}
                  />
                  <YAxis tick={{ fill: '#666' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '20px' }}
                  />

                  <Line
                    type="monotone"
                    dataKey="ความตั้งใจ"
                    stroke="#82ca9d"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>


        {/* กล่องฝั่งขวา */}
        <div className="flex flex-col space-y-4">
          <div className="bg-white rounded-2xl shadow flex flex-col h-140 border border-gray-300">
            <h2 className="flex justify-start ml-15 p-9 text-lg font-bold">ผลรวม</h2>
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
        </div>
      </div>
    </>
  )
}

export default ResultsPage