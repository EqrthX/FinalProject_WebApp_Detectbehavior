import React, { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar'
import { BarChartOutlined, PieChartOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../../config/supabase";

const ResultsPage = () => {
  const teacher_id = localStorage.getItem("teacher_id")

  // --- State ---
  const [result, setResult] = useState([]) 
  const [groupCameras, setGroupCameras] = useState([]); 
  const [uniqueSubjects, setUniqueSubjects] = useState([]); 
  
  // Filter & Search
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // 1. ดึงข้อมูลทั้งหมด
  useEffect(() => {
    const fetchData = async () => {
      if (!teacher_id) return;

      try {
        const { data: response, error } = await supabase
          .from("camera_logs")
          .select("*")
          .eq("teacher_id", teacher_id)
          .order("created_at", { ascending: false })
          .limit(1000); 

        if (error) {
          console.error("Error loading data:", error);
          return;
        }

        if (response) {
          const sortedResponse = response.reverse();
          setResult(sortedResponse);
          const subjects = [...new Set(sortedResponse.map(item => item.subject_id))].filter(Boolean);
          setUniqueSubjects(subjects);
        }
      } catch (err) {
        console.error("System error:", err);
      }
    }
    fetchData();
  }, [teacher_id]);

  // 2. Logic การกรอง
  useEffect(() => {
    if (!result) return;

    let filtered = selectedSubject === "all" 
      ? result 
      : result.filter(row => row.subject_id === selectedSubject);

    if (searchTerm.trim() !== "") {
        filtered = filtered.filter(row => 
            (row.subject_id || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    const grouped = filtered.reduce((acc, row) => {
      if (!acc[row.camera_id]) acc[row.camera_id] = [];
      acc[row.camera_id].push(row);
      return acc;
    }, {});
    
    setGroupCameras(grouped);
  }, [result, selectedSubject, searchTerm]);

  // --- Helper Functions ---
  const getAvgAttentionPerCamera = (logs) => {
    if (!logs || logs.length === 0) return { att: 0, non: 0 }
    let totalAtt = 0, totalNon = 0
    logs.forEach(l => { 
        totalAtt += Number(l.Attention) || 0; 
        totalNon += Number(l.Non_Attention) || 0; 
    })
    return { att: totalAtt / logs.length, non: totalNon / logs.length }
  }

  const groupCamerasWithPie = Object.fromEntries(
    Object.entries(groupCameras).map(([camId, logs]) => {
      const totals = { Focused: 0, Looking_at_the_board: 0, Taking_notes: 0, LookingAway: 0, Talking: 0, UsingPhone: 0 };
      logs.forEach(log => {
        const ratios = log.class_json || {}; 
        totals.Focused += ratios.Focused || 0;
        totals.Looking_at_the_board += ratios.Looking_at_the_board || 0;
        totals.Taking_notes += ratios.Taking_notes || 0;
        totals.LookingAway += ratios.LookingAway || 0;
        totals.Talking += ratios.Talking || 0;
        totals.UsingPhone += ratios.UsingPhone || 0;
      });
      const totalCount = logs.length || 1;
      const pieChartData = [
        { name: "Focused", value: totals.Focused / totalCount },
        { name: "Look Board", value: totals.Looking_at_the_board / totalCount },
        { name: "Take Notes", value: totals.Taking_notes / totalCount },
        { name: "Look Away", value: totals.LookingAway / totalCount },
        { name: "Phone", value: totals.UsingPhone / totalCount },
      ].filter(item => item.value > 0); 
      return [camId, { logs, pieChartData }];
    })
  );

  const RADIAN = Math.PI / 180;
  const COLORS = ['#0068c9', '#00B7EB', '#8622FF', '#FF8000', '#FE0056', '#FFFF00'];
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
    return (
      <text x={x} y={y} fill="white" fontSize={10} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    // 🛠️ 1. Container หลัก: เต็มจอ (h-screen) และห้ามเลื่อน (overflow-hidden)
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      
      {/* Navbar อยู่ด้านบน */}
      <Navbar />
      
      {/* 🛠️ 2. พื้นที่เนื้อหา: ยืดเต็มพื้นที่ที่เหลือ (flex-1) */}
      <div className="flex-1 p-6 overflow-hidden">
        
        {/* Grid Container: เต็มความสูง (h-full) */}
        <div className="grid grid-cols-3 gap-4 h-full">

          {/* --- ฝั่งซ้าย --- */}
          {/* h-full เพื่อให้กล่องยาวเต็มจอ */}
          <div className="col-span-2 bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full overflow-hidden">
            
            {/* Header (Fixed) - ไม่เลื่อน */}
            <div className="p-6 border-b border-[#f0f0f0] flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
              <div className='flex items-center gap-2'>
                  <BarChartOutlined className="text-2xl text-blue-500" />
                  <h2 className="text-xl font-semibold text-gray-700">ผลรวมการสอน (ล่าสุด)</h2>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                  {/* Search */}
                  <div className="relative w-40">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <SearchOutlined className="text-gray-400" />
                      </div>
                      <input 
                          type="text" 
                          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-full focus:ring-blue-500 block w-full pl-10 p-2 outline-none" 
                          placeholder="ค้นหาวิชา..." 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>

                  {/* Dropdown */}
                  <div className="relative group">
                      <select 
                          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-full focus:ring-blue-500 block pl-10 p-2 pr-8 outline-none cursor-pointer hover:bg-gray-100 transition-colors min-w-[150px]"
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                      >
                          <option value="all">-- ทุกวิชา --</option>
                          {uniqueSubjects.map((subject, index) => (
                              <option key={index} value={subject}>วิชา {subject}</option>
                          ))}
                      </select>
                  </div>
              </div>
            </div>

            {/* 🛠️ 3. ส่วนเนื้อหาข้างใน: ให้เลื่อนได้ (overflow-y-auto) */}
            <div className="p-6 overflow-y-auto flex-1 scrollbar-hide">
              <div className="w-full">
                {Object.entries(groupCameras).length > 0 ? (
                  Object.entries(groupCameras).map(([camId, logs]) => {
                    const avg = getAvgAttentionPerCamera(logs);
                    const lastLogDate = new Date(logs[logs.length-1].created_at).toLocaleDateString('th-TH');

                    return (
                      <div key={camId} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 last:mb-0">
                        <div className='flex justify-between items-center mb-4'>
                          <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">CAM {camId}</span>
                                  <h3 className="text-lg font-semibold text-gray-700">วิชา {logs[0].subject_id}</h3>
                              </div>
                              <span className="text-xs text-gray-400 ml-1">วันที่: {lastLogDate}</span>
                          </div>
                          <div className="text-sm flex gap-3">
                            <span className="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 font-bold">
                              ตั้งใจ: {(avg.att * 100).toFixed(1)}%
                            </span>
                            <span className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 font-bold">
                              ไม่ตั้งใจ: {(avg.non * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={logs.map(l => ({
                            time: new Date(l.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                            ตั้งใจ: (Number(l.Attention) * 100).toFixed(2),
                            ไม่ตั้งใจ: (Number(l.Non_Attention) * 100).toFixed(2),
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ borderRadius: '8px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                            <Line type="monotone" dataKey="ตั้งใจ" stroke="#38A738" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="ไม่ตั้งใจ" stroke="#FF3300" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                      <BarChartOutlined className="text-4xl mb-2 opacity-50" />
                      <p>ยังไม่มีประวัติการสอน</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* --- ฝั่งขวา --- */}
          <div className="col-span-1 h-full flex flex-col space-y-4 overflow-hidden">
            <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] flex flex-col h-full overflow-hidden">
              
              {/* Header (Fixed) */}
              <div className="p-6 border-b border-[#f0f0f0] flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                   <PieChartOutlined className="text-2xl text-purple-500" />
                   พฤติกรรมรวม {selectedSubject !== "all" && <span className="text-sm font-normal text-gray-500">({selectedSubject})</span>}
                </h2>
              </div>

              {/* 🛠️ 3. ส่วนเนื้อหาข้างใน: ให้เลื่อนได้ */}
              <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1 scrollbar-hide">
                {Object.entries(groupCamerasWithPie).length > 0 ? (
                  Object.entries(groupCamerasWithPie).map(([camId, logs]) => (
                    <div key={camId} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative">
                      <div className="absolute top-3 left-3 z-10">
                           <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                            CAM {Number(camId)}
                          </span>
                      </div>

                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={logs.pieChartData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              innerRadius={50}
                              paddingAngle={2}
                              dataKey="value"
                              labelLine={false}
                              label={renderCustomizedLabel}
                            >
                              {logs.pieChartData.map((entry, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${(value * 100).toFixed(1)}%`} />
                            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <p>ไม่พบข้อมูล</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default ResultsPage