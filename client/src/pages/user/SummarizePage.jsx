import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar.jsx'
import MyBreadcrumb from '../../components/MyBreadcrumb.jsx'
import { Link } from 'react-router-dom';
import { BarChartOutlined, LoadingOutlined } from '@ant-design/icons';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../../config/supabase.js"
import axios from '../../util/axios.js';
import { Flex, Spin } from 'antd';


const SummarizePage = () => {
  const teacher_id = localStorage.getItem("teacher_id")
  const [groupCameras, setGroupCameras] = useState([]);

  const [result, setResult] = useState([])
  const [lineChartData, setLineChartData] = useState([]);
  const [summary, setSummary] = useState({ att: 0, nonAtt: 0 });
  const [dateToDetect, setDateToDetect] = useState(null);
  const [pieChartData, setPieChartData] = useState([]);
  const [loading, setLoading] = useState(true);

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

        setLoading(true);

        const { data: response, error: errResponse } = await supabase
          .from("camera_logs")
          .select("*")
          .limit(180)
          .gte("created_at", queryDate)
          .eq("teacher_id", teacher_id)
          .order("created_at", { ascending: true })

        if (errResponse) {
          console.error("Supabase error:", errResponse)
          setGroupCameras({})
          setResult([])
          setLoading(false)
          return
        }
        

        if (!response || response.length === 0) {
            console.warn("ไม่มีข้อมูลใน camera_logs")
            setGroupCameras({})
            setResult([])
            setLoading(false)
            return
        }
        
        const groupedByCamera = response.reduce((acc, row) => {
          if (!acc[row.camera_id]) acc[row.camera_id] = [];
          acc[row.camera_id].push(row);
          return acc;
        }, {})

        setGroupCameras(groupedByCamera)
        setResult(response || [])
      } catch (error) {
        console.error("เกิดข้อผิดพลาดไม่สามารถแสดงผลได้", error)
      } finally {
        setLoading(false);
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
      }

      result.forEach(log => {
        const ratios = log.class_json || {};

        totals.Focused += ratios.Focused || 0;
        totals.Looking_at_the_board += ratios.Looking_at_the_board || 0;
        totals.Taking_notes += ratios.Taking_notes || 0;
        totals.LookingAway += ratios.LookingAway || 0;
        totals.Talking += ratios.Talking || 0;
        totals.UsingPhone += ratios.UsingPhone || 0;
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
        }
      })
      setLineChartData(transformedLineDataAtt)

      const totalLogs = result.length;

      const totalAttention = result.reduce((acc, log) => acc + (log.Attention || 0), 0);

      const totalNonAttention = result.reduce((acc, log) => acc + (log.Non_Attention || 0), 0);

      const avgAttention = totalLogs > 0 ? (totalAttention / totalLogs) : 0;
      const avgNonAttenion = totalLogs > 0 ? (totalNonAttention / totalLogs) : 0;

      setSummary({
        att: avgAttention,
        nonAtt: avgNonAttenion,
      })

      const dataForPie = [
        { name: "Focused", value: totals.Focused / totalLogs },
        { name: "Looking_at_the_board", value: totals.Looking_at_the_board / totalLogs },
        { name: "Taking_notes", value: totals.Taking_notes / totalLogs },
        { name: "LookingAway", value: totals.LookingAway / totalLogs },
        { name: "UsingPhone", value: totals.UsingPhone / totalLogs },
      ]
      setPieChartData(dataForPie);
    }
  }, [result])
  const getAvgAttentionPerCamera = (logs) => {
    if (!logs || logs.length === 0) return { att: 0, non: 0 }

    let totalAtt = 0
    let totalNon = 0

    logs.forEach(l => {
      totalAtt += l.Attention || 0
      totalNon += l.Non_Attention || 0
    })

    return {
      att: totalAtt / logs.length,
      non: totalNon / logs.length
    }
  }
  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Spin indicator={<LoadingOutlined style={{ fontSize: 90 }} spin />} />
      </div>
    )
  }
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
              </div>
              {/* <div className="flex justify-center gap-50">
                <div className="bg-white  p-6 flex flex-col items-center w-auto">
                  <span className="text-black ">ตั้งใจเรียน</span>
                  <span className="text-4xl font-bold text-[#1D971D]">{(summary.att * 100).toFixed(0)}%</span>
                </div>
                <div className="bg-white  p-6 flex flex-col items-center w-auto">
                  <span className="text-black">ไม่ตั้งใจเรียน</span>
                  <span className="text-4xl font-bold text-[#FF3300]">{(summary.nonAtt * 100).toFixed(0)}%</span>
                </div>
              </div> */}

              <div className="w-full rounded-lg p-6 ">
                {/* กราฟเส้น */}
                {Object.entries(groupCameras).map(([camId, logs]) => {
                  const avg = getAvgAttentionPerCamera(logs)
                  return (
                    <div key={camId} className="bg-white p-4 rounded-xl shadow mb-6 border">
                      <h3 className="text-lg font-semibold mb-3">กล้องตัวที่ {camId}</h3>

                      {/* แสดงข้อมูล Attention แบบล่าสุด */}
                      <p>ตั้งใจ: {(avg.att * 100).toFixed(1)}%</p>
                      <p>ไม่ตั้งเรียน: {(avg.non * 100).toFixed(1)}%</p>

                      {/* mini chart ของกล้องนี้ */}
                      <ResponsiveContainer width="100%" height={150}>
                        <LineChart data={logs.map(l => ({
                          time: new Date(l.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                          ตั้งใจ: (l.Attention * 100).toFixed(2),
                          ไม่ตั้งใจ: (l.Non_Attention * 100).toFixed(2),
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis dataKey="time" />
                          <YAxis domain={[0, 100]} />
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
                          <Line type="monotone" dataKey="ตั้งใจ" stroke="#82ca9d" strokeWidth={2} />
                          <Line type="monotone" dataKey="ไม่ตั้งใจ" stroke="#FF3300" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })}
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