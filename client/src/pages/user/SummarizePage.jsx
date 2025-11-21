import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import MyBreadcrumb from '../../components/MyBreadcrumb.jsx'
import { Link } from 'react-router-dom';
import { BarChartOutlined } from '@ant-design/icons';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../../config/supabase.js"
import axios from '../../util/axios.js';


const SummarizePage = () => {
  const teacher_id = localStorage.getItem("teacher_id")
  const [groupCameras, setGroupCameras] = useState([]);

  const [result, setResult] = useState([])
  const [lineChartData, setLineChartData] = useState([]);
  const [summary, setSummary] = useState({ att: 0, nonAtt: 0, other: 0 });
  const [dateToDetect, setDateToDetect] = useState(null);
  const [pieChartData, setPieChartData] = useState([]);

  const [queryDate, setQueryDate] = useState(null);
  const [displayDate, setDisplayDate] = useState("");

  useEffect(() => {
    const date = new Date()

    const formattedDate = date.toLocaleDateString('th-TH', {
      year: "numeric",
      month: "long",
      day: "numeric"
    })

    setDisplayDate(formattedDate)

    date.setHours(0, 0, 0, 0)
    setQueryDate(date.toISOString());

  }, [])

  useEffect(() => {
    const fetechResult = async () => {
      try {
        let query = supabase
          .from("camera_logs")
          .select("*")
          .limit(180)
          .gte("created_at", queryDate)
          .eq("teacher_id", teacher_id)
          .order("created_at", { ascending: true })

        const groupedByCamera = response.reduce((acc, row) => {
          if (!acc[row.camera_id]) acc[row.camera_id] = [];
          acc[row.camera_id].push(row);
          return acc;
        }, {})

        if (errResponse) {
          console.error("ไม่เจอข้อมูลที่เก็บพฤติกรรม", errResponse)
        }
        setGroupCameras(groupedByCamera)
        setResult(response || [])
      } catch (error) {
        console.error("เกิดข้อผิดพลาดไม่สามารถแสดงผลได้", error)
      }
    }
    fetechResult();
  }, [teacher_id, queryDate]);

  useEffect(() => {
    if (result && result.length > 0) {
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

      if (!dateToDetect) {
        const firstLogDate = new Date(result[0].created_at);
        setDateToDetect(firstLogDate.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }));
      }
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

      const totalLogs = result.length;

      const totalAttention = result.reduce((acc, log) => acc + (log.Attention || 0), 0);

      const totalNonAttention = result.reduce((acc, log) => acc + (log.Non_Attention || 0), 0);

      const totalOther = result.reduce((acc, log) => acc + (log.Other || 0), 0);

      const avgAttention = totalLogs > 0 ? (totalAttention / totalLogs) : 0;
      const avgNonAttenion = totalLogs > 0 ? (totalNonAttention / totalLogs) : 0;
      const avgOhther = totalLogs > 0 ? (totalOther / totalLogs) : 0;

      setSummary({
        att: avgAttention,
        nonAtt: avgNonAttenion,
        other: avgOhther
      })

      const dataForPie = [
        { name: "Focused", value: totals.Focused / totalLogs },
        { name: "Looking_at_the_board", value: totals.Looking_at_the_board / totalLogs },
        { name: "Taking_notes", value: totals.Taking_notes / totalLogs },
        { name: "LookingAway", value: totals.LookingAway / totalLogs },
        { name: "Talking", value: totals.Talking / totalLogs },
        { name: "UsingPhone", value: totals.UsingPhone / totalLogs },
        { name: "Other", value: totals.Other / totalLogs },
      ]
      setPieChartData(dataForPie);
    } else {
      setLineChartData([]);
      setSummary({ att: 0, nonAtt: 0, other: 0 });
      setPieChartData([]);
      setDateToDetect(null); 
    }
  }, [result])


  const RADIAN = Math.PI / 180;
  const COLORS = ['#0068c9', '#fe2b2b', '#780cdf', '#00B7EB', '#00FFCE', '#FF00FF', '#000'];
  
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
      <div style={{ padding: 24 }}>
        <MyBreadcrumb />
        <div className="grid grid-cols-3 gap-4 p-6">

          {/* กล่องซ้าย */}
          <div className="col-span-2 bg-white rounded-2xl shadow p-6 border border-gray-100 h-140">
            <div className="p-6">
              <div className="mb-6 ">
                <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                  <BarChartOutlined className="text-2xl text-blue-500" />
                  ผลรวมรายวัน {displayDate}
                </h2>
                <select
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#38A738]"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                >
                  <option value="" >
                    กรุณาเลือกช่วงเวลา
                  </option>

                  <option value="30m" >
                    30 นาที
                  </option>

                  <option value="60m" >
                    60 นาที
                  </option>

                  <option value="120m" >
                    120 นาที
                  </option>

                  <option value="180m" >
                    180 นาที
                  </option>
                </select>
              </div>
              {/* <div className="flex justify-center gap-50">
                <div className="bg-white  p-6 flex flex-col items-center w-auto">
                  <span className="text-black ">ตั้งใจเรียน</span>
                  <span className="text-4xl font-bold text-[#1D971D]">{(summary.att * 100).toFixed(1)}%</span>
                </div>
                <div className="bg-white  p-6 flex flex-col items-center w-auto">
                  <span className="text-black">ไม่ตั้งใจเรียน</span>
                  <span className="text-4xl font-bold text-[#FF3300]">{(summary.nonAtt * 100).toFixed(1)}%</span>
                </div>
                <div className="bg-white  p-6 flex flex-col items-center w-auto">
                  <span className="text-black">อื่นๆ</span>
                  <span className="text-4xl font-bold text-[#000000]">{(summary.other * 100).toFixed(1)}%</span>
                </div>
              </div> */}

              <div className="w-full rounded-lg p-6 ">
              {/* กราฟเส้น */}
              {Object.entries(groupCameras).map(([camId, logs]) => (
                <div key={camId} className="bg-white p-4 rounded-xl shadow mb-6 border">
                  <h3 className="text-lg font-semibold mb-3">กล้องตัวที่ {camId}</h3>

                  <p className="text-gray-600 mb-2">
                    จำนวน Log: {logs.length}
                  </p>

                  {/* แสดงข้อมูล Attention แบบล่าสุด */}
                  <p>ATT: {(logs[logs.length - 1]?.Attention * 100).toFixed(1)}%</p>
                  <p>NON: {(logs[logs.length - 1]?.Non_Attention * 100).toFixed(1)}%</p>
                  <p>OTHER: {(logs[logs.length - 1]?.Other * 100).toFixed(1)}%</p>

                  {/* mini chart ของกล้องนี้ */}
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={logs.map(l => ({
                      time: new Date(l.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                      att: (l.Attention * 100).toFixed(2),
                      non: (l.Non_Attention * 100).toFixed(2),
                    }))}>
                      <XAxis dataKey="time" />
                      <YAxis domain={[0, 100]} />
                      <Line type="monotone" dataKey="att" stroke="#82ca9d" />
                      <Line type="monotone" dataKey="non" stroke="#FF3300" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}
                {/* <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      dataKey="name"
                      padding={{ left: 30, right: 30 }}
                      tick={{ fill: '#666' }}
                      interval={9}
                    />
                    <YAxis tick={{ fill: '#666' }} domain={[0, 100]} />
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

                </ResponsiveContainer> */}
              </div>
            </div>
          </div>


          {/* กล่องฝั่งขวา */}
          <div className="flex flex-col space-y-4">
            <div className="bg-white rounded-2xl shadow flex flex-col h-140 border border-gray-300">
              <h2 className="flex justify-start ml-15 p-9 text-lg font-bold">ผลรวมของพฤติกรรมของนักศึกษา</h2>
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
            {/* ปุ่ม */}
            <div className="p- pt-4">
              <Link to="/user/ResultsPage">
                <button
                  type="submit"
                  className="bg-[#3D42D3] text-white w-full py-3 rounded-xl font-semibold hover:bg-blue-900 transition-colors"
                >
                  ดูสรุปผลทุกวิชา
                </button>
              </Link>

            </div>
          </div>

        </div>
      </div>
    </>
  )
}

export default SummarizePage