import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar'
import { Link } from 'react-router-dom';
import { BarChartOutlined } from '@ant-design/icons';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../../config/supabase";

const ResultsPage = () => {
  const teacher_id = localStorage.getItem("teacher_id")

  // 1. แยก State: result, กราฟต่างๆ
  const [result, setResult] = useState([])
  const [lineChartData, setLineChartData] = useState([]);
  const [pieChartData, setPieChartData] = useState([]);
  const [summary, setSummary] = useState({ att: 0, nonAtt: 0, other: 0 });

  // 2. แยก State วันที่: อันนึงไว้ Query (queryDate), อันนึงไว้โชว์ (displayDate)
  const [queryDate, setQueryDate] = useState(null);
  const [displayDate, setDisplayDate] = useState("");

  // useEffect 1: ทำงานครั้งแรกเพื่อตั้งค่า "วันนี้"
  useEffect(() => {
    const now = new Date();

    // ตั้งค่าวันที่สำหรับโชว์ (ภาษาไทย)
    const thaiDate = now.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    setDisplayDate(thaiDate);

    // ตั้งค่าวันที่สำหรับ Query (เริ่มที่ 00:00:00 ของวันนี้)
    now.setHours(0, 0, 0, 0);
    setQueryDate(now.toISOString());
    
  }, []);

  // useEffect 2: ดึงข้อมูลเมื่อ queryDate หรือ teacher_id เปลี่ยน
  useEffect(() => {
    const fetechResult = async () => {
      // ต้องรอให้ queryDate มีค่าก่อนค่อยดึง
      if (!queryDate || !teacher_id) return;

      try {
        const { data: response, error: errResponse } = await supabase
          .from("camera_logs")
          .select("*")
          .limit(120)
          .eq("teacher_id", teacher_id)
          .order("created_at", { ascending: true })

        if (errResponse) {
          console.error("ไม่เจอข้อมูลที่เก็บพฤติกรรม", errResponse)
        }

        setResult(response || [])
      } catch (error) {
        console.error("เกิดข้อผิดพลาดไม่สามารถแสดงผลได้", error)
      }
    }
    fetechResult();
  }, [teacher_id, queryDate]); // เพิ่ม queryDate ใน dependency

  // useEffect 3: คำนวณกราฟเมื่อได้ result มาแล้ว
  useEffect(() => {
    if (result) { // เอา check length > 0 ออก เพื่อให้กราฟเคลียร์ค่าเป็น 0 ถ้าไม่มีข้อมูล
      const totals = {
        Focused: 0,
        Looking_at_the_board: 0,
        Taking_notes: 0,
        LookingAway: 0,
        Talking: 0,
        UsingPhone: 0,
        Other: 0
      }

      result.forEach(log => {
        const ratios = log.class_json || {};
        totals.Focused += ratios.Focused || 0;
        totals.Looking_at_the_board += ratios.Looking_at_the_board || 0;
        totals.Taking_notes += ratios.Taking_notes || 0;
        totals.LookingAway += ratios.LookingAway || 0;
        totals.Talking += ratios.Talking || 0;
        totals.UsingPhone += ratios.UsingPhone || 0;
        totals.Other += ratios.Other || 0;
      })

      // กราฟเส้น
      const transformedLineDataAtt = result.map(log => {
        const date = new Date(log.created_at);
        const formattedTime = date.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })

        return {
          name: formattedTime,
          ความตั้งใจ: (log.Attention * 100).toFixed(2),
          ความไม่ตั้งใจ: (log.Non_Attention * 100).toFixed(2),
          อื่นๆ: (log.Other * 100).toFixed(2)
        }
      })
      setLineChartData(transformedLineDataAtt)

      // สรุปผลรวม
      const totalLogs = result.length;
      // ป้องกันการหารด้วย 0
      const avgAttention = totalLogs > 0 ? (result.reduce((acc, log) => acc + (log.Attention || 0), 0) / totalLogs) : 0;
      const avgNonAttenion = totalLogs > 0 ? (result.reduce((acc, log) => acc + (log.Non_Attention || 0), 0) / totalLogs) : 0;
      const avgOhther = totalLogs > 0 ? (result.reduce((acc, log) => acc + (log.Other || 0), 0) / totalLogs) : 0;

      setSummary({
        att: avgAttention,
        nonAtt: avgNonAttenion,
        other: avgOhther
      })

      // กราฟวงกลม
      // เช็ค totalLogs > 0 ป้องกัน NaN ใน PieChart
      if (totalLogs > 0) {
        const dataForPie = [
          { name: "Focused", value: totals.Focused / totalLogs },
          { name: "Looking_at_the_board", value: totals.Looking_at_the_board / totalLogs },
          { name: "Taking_notes", value: totals.Taking_notes / totalLogs },
          { name: "LookingAway", value: totals.LookingAway / totalLogs },
          { name: "UsingPhone", value: totals.UsingPhone / totalLogs },
          { name: "Other", value: totals.Other / totalLogs },
        ].filter(item => item.value > 0); // กรองค่าที่เป็น 0 ออกเพื่อให้กราฟสวยงาม
        setPieChartData(dataForPie);
      } else {
        setPieChartData([]);
      }
    }
  }, [result])

  const RADIAN = Math.PI / 180;
  const COLORS = ['#0068c9','#fe2b2b', '#8622FF', '#739206ff', '#FE0056', '#00B7EB', '#FF8000', '#00FFCE', '#FFFF00'];

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
                {/* แสดงวันที่จาก State displayDate */}
                ผลรวมรายวัน {displayDate}
              </h2>
            </div>
            <div className="flex justify-center gap-50">
              <div className="bg-white  p-6 flex flex-col items-center w-auto">
                <span className="text-black ">ตั้งใจเรียน</span>
                <span className="text-4xl font-bold text-[#1D971D]">{(summary.att * 100).toFixed(0)}%</span>
              </div>
              <div className="bg-white  p-6 flex flex-col items-center w-auto">
                <span className="text-black">ไม่ตั้งใจเรียน</span>
                <span className="text-4xl font-bold text-[#FF3300]">{(summary.nonAtt * 100).toFixed(0)}%</span>
              </div>
              <div className="bg-white  p-6 flex flex-col items-center w-auto">
                <span className="text-black">อื่นๆ</span>
                <span className="text-4xl font-bold text-[#000000]">{(summary.other * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* กราฟเส้น */}
            <div className="w-full rounded-lg p-6 ">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineChartData}>
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
                  <Line
                    type="monotone"
                    dataKey="ความไม่ตั้งใจ"
                    stroke="#FF3300"
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
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${(value * 100).toFixed(1)}%`} />
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