import React, { useEffect, useState } from "react";
import Navbar from "../../components/Navbar.jsx";
import MyBreadcrumb from "../../components/MyBreadcrumb.jsx";
import {
  BarChartOutlined,
  PieChartOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  BookOutlined,
  RightOutlined
} from "@ant-design/icons";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "../../config/supabase.js";
import { useNavigate } from "react-router-dom";

// --- 1. กำหนดสี ---
const BEHAVIOR_COLORS = {
  มองกระดาน: "#3b82f6",
  จดเลคเชอร์: "#a855f7",
  มองทางอื่น: "#f59e0b",
  เล่นมือถือ: "#ef4444",
  อื่นๆ: "#9ca3af",
  default: "#cbd5e1",
  empty: "#e5e7eb",
};

// --- 2. ลำดับรายการด้านขวา ---
const FIXED_CATEGORIES = [
  "มองกระดาน",
  "จดเลคเชอร์",
  "มองทางอื่น",
  "เล่นมือถือ",
  "อื่นๆ"
];

// ฟังก์ชันแปลงวินาที
const formatDuration = (seconds) => {
  const roundedSeconds = Math.round(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  if (minutes > 0) return `${minutes} นาที ${remainingSeconds} วินาที`;
  return `${remainingSeconds} วินาที`;
};

const SummarizePage = () => {
  const teacher_id = localStorage.getItem("teacher_id");
  const navigate = useNavigate();

  const [sessionsList, setSessionsList] = useState([]); 
  const [headerInfo, setHeaderInfo] = useState({
    subject: "",
    date: "",
    rawDate: "",
    group: "",
    scheduleTime: "",
  });
  const [loading, setLoading] = useState(true);

  const processDataByMinute = (logs) => {
    const buckets = {};
    logs.forEach((log) => {
      const date = new Date(log.created_at);
      const coeff = 1000 * 60 * 1; 
      const roundedDate = new Date(Math.floor(date.getTime() / coeff) * coeff);
      const timeStr = roundedDate.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (!buckets[timeStr]) {
        buckets[timeStr] = { time: timeStr, totalAtt: 0, count: 0 };
      }
      buckets[timeStr].totalAtt += Number(log.Attention || 0);
      buckets[timeStr].count += 1;
    });

    return Object.values(buckets).map((b) => ({
      time: b.time,
      score: ((b.totalAtt / b.count) * 100).toFixed(0),
    }));
  };

  useEffect(() => {
    const fetchLatestSession = async () => {
      setLoading(true);
      try {
        const { data: latestRow, error: summaryError } = await supabase
          .from("camera_daily_summary")
          .select("*")
          .eq("teacher_id", teacher_id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (summaryError || !latestRow || latestRow.length === 0) {
          setSessionsList([]);
          setLoading(false);
          return;
        }

        const targetSubject = latestRow[0].subject_id;
        const targetDate = latestRow[0].summary_date;
        const targetGroup = latestRow[0].group ? String(latestRow[0].group) : "N/A";
        const stopTime = new Date(latestRow[0].created_at).toISOString();

        const { data: schedules } = await supabase
          .from("class_schedule")
          .select("*")
          .eq("teacher_id", teacher_id);

        let displayTime = "ไม่พบตารางเรียน";
        if (schedules) {
          const matchedSchedules = schedules.filter((s) => {
            const isSubjectMatch = String(s.subject_id).trim() === String(targetSubject).trim();
            const sGroup = String(s.group || "").trim();
            const tGroup = String(targetGroup).trim();
            const isGroupMatch = sGroup === tGroup || parseInt(sGroup) === parseInt(tGroup);
            return isSubjectMatch && isGroupMatch;
          });

          if (matchedSchedules.length > 0) {
            displayTime = matchedSchedules
              .map((s) => `${s.day} ${String(s.start_time).slice(0, 5)} - ${String(s.end_time).slice(0, 5)}`)
              .join(", ");
          }
        }

        setHeaderInfo({
          subject: targetSubject,
          group: targetGroup,
          rawDate: targetDate, 
          date: new Date(targetDate).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          scheduleTime: displayTime,
        });

        const startOfDay = new Date(targetDate).toISOString();
        const { data: logs } = await supabase
          .from("camera_logs")
          .select("*")
          .eq("teacher_id", teacher_id)
          .eq("subject_id", targetSubject)
          .eq("group", targetGroup)
          .gte("created_at", startOfDay)
          .lte("created_at", stopTime)
          .order("created_at", { ascending: true });

        if (!logs || logs.length === 0) {
            setSessionsList([]);
            setLoading(false);
            return;
        }

        const sessionsMap = {};
        logs.forEach(log => {
            const sid = log.session_id || 'unknown_session';
            if (!sessionsMap[sid]) {
                sessionsMap[sid] = [];
            }
            sessionsMap[sid].push(log);
        });

        const sortedSessions = Object.values(sessionsMap).sort((a, b) => {
            const timeA = new Date(a[0].created_at).getTime();
            const timeB = new Date(b[0].created_at).getTime();
            return timeA - timeB;
        });

        const processedSessions = sortedSessions.map((sessionLogs, sessionIndex) => {
            const groupedByCamera = {};

            sessionLogs.forEach((log) => {
                const camId = log.camera_id;
                if (!groupedByCamera[camId]) {
                    groupedByCamera[camId] = {
                        totalAtt: 0,
                        countRow: 0,
                        durationSum: {
                            มองกระดาน: 0,
                            จดเลคเชอร์: 0,
                            มองทางอื่น: 0,
                            เล่นมือถือ: 0,
                            อื่นๆ: 0,
                        },
                        logs: []
                    };
                }

                groupedByCamera[camId].logs.push(log);
                groupedByCamera[camId].totalAtt += Number(log.Attention || 0);
                groupedByCamera[camId].countRow += 1;

                // --- 🟢 ส่วนที่แก้ไข Logic การรวม Data ---
                // ใช้การวนลูป Object.keys เพื่อดักจับทุกพฤติกรรม
                const duration = log.class_duration || {};
                Object.keys(duration).forEach((key) => {
                    const val = Number(duration[key] || 0);

                    if (key === "Looking_at_the_board" || key === "Focused") {
                        groupedByCamera[camId].durationSum["มองกระดาน"] += val;
                    } else if (key === "Taking_notes") {
                        groupedByCamera[camId].durationSum["จดเลคเชอร์"] += val;
                    } else if (key === "UsingPhone") {
                        groupedByCamera[camId].durationSum["เล่นมือถือ"] += val;
                    } else if (key === "LookingAway") {
                        groupedByCamera[camId].durationSum["มองทางอื่น"] += val;
                    } else {
                        // ถ้าไม่ใช่ 4 อันบน ให้โยนเข้า "อื่นๆ" ทั้งหมด
                        groupedByCamera[camId].durationSum["อื่นๆ"] += val;
                    }
                });
                // ----------------------------------------
            });

            const camerasData = Object.keys(groupedByCamera).map((camId) => {
                const group = groupedByCamera[camId];
                const avgDecimal = group.countRow > 0 ? group.totalAtt / group.countRow : 0;
                const finalAvgAtt = (avgDecimal * 100).toFixed(0);

                const lineChartData = processDataByMinute(group.logs);

                let startTimeStr = "--:--";
                let endTimeStr = "--:--";
                let recordedDurationStr = "0 วินาที";

                if (group.logs.length > 0) {
                    const logTimes = group.logs.map((l) => new Date(l.created_at).getTime());
                    const minTime = Math.min(...logTimes);
                    const maxTime = Math.max(...logTimes);
                    
                    const durationSec = (maxTime - minTime) / 1000;
                    recordedDurationStr = formatDuration(durationSec);

                    startTimeStr = new Date(minTime).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' });
                    endTimeStr = new Date(maxTime).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' });
                }

                const pieChartData = Object.keys(group.durationSum).map(key => ({
                    name: key,
                    value: group.durationSum[key]
                }));
                const totalDurationForPie = pieChartData.reduce((acc, curr) => acc + curr.value, 0);

                return {
                    cameraId: camId,
                    avgAtt: finalAvgAtt,
                    lineChartData,
                    pieChartData,
                    totalDurationForPie,
                    startTimeStr,
                    endTimeStr,
                    recordedDurationStr
                };
            });

            return {
                sessionOrder: sessionIndex + 1,
                sessionId: sessionLogs[0].session_id,
                cameras: camerasData
            };
        });

        setSessionsList(processedSessions);

      } catch (error) {
        console.error("Error fetching latest session:", error);
      } finally {
        setLoading(false);
      }
    };

    if (teacher_id) {
      fetchLatestSession();
    }
  }, [teacher_id]);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const RADIAN = Math.PI / 180;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
    return (
      <text x={x} y={y} fill="white" fontSize={11} textAnchor="middle" dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const handleGoToResults = () => {
    navigate("/user/ResultsPage", {
      state: {
        filterSubject: headerInfo.subject,
        filterDate: new Date(headerInfo.rawDate).toLocaleDateString("th-TH"), 
        filterSection: headerInfo.group,
      },
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      <Navbar />
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <MyBreadcrumb />
        <div className="flex-1 pt-6 overflow-y-auto scrollbar-hide pb-20">
          
          <div className="bg-white rounded-[20px] p-4 shadow-sm border border-[#e9e9e9] flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <BarChartOutlined className="text-2xl text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-700">
                สรุปผลการสอนล่าสุด
              </h2>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            {sessionsList.length > 0 ? (
              sessionsList.map((session) => (
                <div key={session.sessionId} className="flex flex-col gap-4">
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2 border-b border-gray-200 pb-2">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md shrink-0">
                                {session.sessionOrder}
                            </div>
                            <h3 className="text-lg font-bold text-gray-700 whitespace-nowrap">
                                การบันทึกครั้งที่ {session.sessionOrder}
                            </h3>
                        </div>
                        
                        <div className="hidden md:block h-6 w-[1px] bg-gray-300 mx-2"></div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                            <span className="flex items-center gap-1 font-medium text-gray-800">
                                <BookOutlined className="text-blue-500"/> วิชา {headerInfo.subject}
                            </span>
                            {headerInfo.group && headerInfo.group !== "N/A" && (
                                <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-100">
                                <TeamOutlined /> กลุ่ม {headerInfo.group}
                                </span>
                            )}
                            <span className="flex items-center gap-1 text-gray-500">
                                <CalendarOutlined className="text-orange-500"/> {headerInfo.date}
                            </span>
                            <span className="flex items-center gap-1 text-gray-500">
                                <ClockCircleOutlined className="text-green-500"/> {headerInfo.scheduleTime}
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={handleGoToResults} 
                        className="flex items-center gap-2 px-4 py-2 bg-white text-blue-500 border border-blue-100 rounded-full text-sm font-medium hover:bg-blue-50 transition duration-200 shadow-sm shrink-0 self-start md:self-auto"
                    >
                        <span>ไปยังหน้ารวมสรุปผล</span>
                        <RightOutlined className="text-xs"/>
                    </button>
                  </div>

                  {session.cameras.map((data, index) => {
                    const isDataEmpty = data.totalDurationForPie === 0;
                    const pieRenderData = isDataEmpty ? [{ name: "No Data", value: 1 }] : data.pieChartData.filter(d => d.value > 0);

                    return (
                      <div key={`${session.sessionId}-${data.cameraId}-${index}`} className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6">
                        <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <h3 className="text-xl font-bold text-gray-800">กล้อง {data.cameraId}</h3>
                              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">CAM {data.cameraId}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className={`text-2xl font-bold  ${Number(data.avgAtt) > 50 ? "text-green-600" : "text-red-500"}`}>{data.avgAtt}%</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          {/* Left: Line Chart */}
                          <div className="lg:col-span-2">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                                <BarChartOutlined /> Timeline
                              </h4>
                            </div>
                            <div className="h-[250px] bg-gray-50 rounded-xl border border-gray-100 p-2">
                              <ResponsiveContainer width="100%" height="100%">
                                {data.lineChartData.length > 0 ? (
                                  <LineChart data={data.lineChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                                    <XAxis dataKey="time" tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} formatter={(value) => [`${value}%`, "ความสนใจเฉลี่ย"]} />
                                    <Line type="monotone" dataKey="score" stroke="#0068c9" strokeWidth={3} dot={{ r: 3, fill: "#0068c9", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                  </LineChart>
                                ) : (
                                  <div className="flex items-center justify-center h-full text-gray-400">ไม่พบข้อมูล Timeline</div>
                                )}
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Right: Pie Chart + List */}
                          <div className="lg:col-span-1 border-l border-gray-100 pl-0 lg:pl-8">
                            <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                              <PieChartOutlined /> สัดส่วนเวลาพฤติกรรม
                            </h4>
                            <div className="flex items-center h-[90%] w-full">
                              <div className="w-[55%] h-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={pieRenderData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={45}
                                      outerRadius={80}
                                      paddingAngle={isDataEmpty ? 0 : 3}
                                      dataKey="value"
                                      labelLine={false}
                                      label={isDataEmpty ? null : renderCustomizedLabel}
                                    >
                                      {pieRenderData.map((entry, index) => (
                                        <Cell key={index} fill={isDataEmpty ? BEHAVIOR_COLORS["empty"] : BEHAVIOR_COLORS[entry.name] || BEHAVIOR_COLORS["default"]} stroke="none" />
                                      ))}
                                    </Pie>
                                    {!isDataEmpty && (
                                      <Tooltip formatter={(value) => {
                                          // ใช้ toFixed(0) เพื่อให้เป็นจำนวนเต็มเหมือนกันหมด
                                          const percent = data.totalDurationForPie > 0 ? ((value / data.totalDurationForPie) * 100).toFixed(0) : 0;
                                          return [`${percent}%`, "สัดส่วน"];
                                        }}
                                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
                                      />
                                    )}
                                  </PieChart>
                                </ResponsiveContainer>
                                {isDataEmpty && <div className="absolute top-1/2 left-[50%] transform -translate-x-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">ไม่มีข้อมูล</div>}
                              </div>

                              <div className="w-[45%] flex flex-col justify-center h-full pr-2">
                                {FIXED_CATEGORIES.map((catName, i) => {
                                  const item = data.pieChartData.find(d => d.name === catName) || { value: 0 };
                                  return (
                                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-2.5 h-2.5 rounded text-xs flex items-center justify-center shrink-0" style={{ backgroundColor: BEHAVIOR_COLORS[catName] }} />
                                        <span className="text-xs text-gray-600 truncate" title={catName}>{catName}</span>
                                      </div>
                                      {/* ส่วนนี้แสดงเป็นเวลา (Duration) ซึ่งเหมาะสมกับหน้ารายละเอียดครับ */}
                                      <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">{formatDuration(item.value)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-[500px] text-gray-400 bg-white rounded-[20px] border border-gray-200">
                {loading ? <p>กำลังโหลดข้อมูล...</p> : <><BarChartOutlined className="text-4xl mb-2 opacity-50" /><p>ไม่พบข้อมูลการสอนล่าสุด</p></>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummarizePage;