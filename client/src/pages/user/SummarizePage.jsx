import React, { useEffect, useState } from "react";
import Navbar from "../../components/Navbar.jsx";
import MyBreadcrumb from "../../components/MyBreadcrumb.jsx";
import {
  BarChartOutlined,
  PieChartOutlined,
  CalendarOutlined,
  SendOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  CartesianGrid,
  Legend, // ไม่ได้ใช้ Legend แล้ว แต่เก็บไว้เผื่อ
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

// --- 1. กำหนดชุดสีมาตรฐาน ---
const BEHAVIOR_COLORS = {
  ตั้งใจเรียน: "#22c55e",
  มองกระดาน: "#3b82f6",
  จดเลคเชอร์: "#a855f7",
  มองทางอื่น: "#f59e0b",
  คุยกัน: "#f97316",
  เล่นมือถือ: "#ef4444",
  default: "#cbd5e1",
};

// 🟢 ฟังก์ชันแปลงวินาทีเป็น "ชม./นาที/วินาที"
const formatDuration = (seconds) => {
  const roundedSeconds = Math.round(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (hours > 0) {
    return `${hours} ชม. ${minutes} นาที`;
  } else if (minutes > 0) {
    return `${minutes} นาที ${remainingSeconds} วินาที`;
  } else {
    return `${remainingSeconds} วินาที`;
  }
};

const SummarizePage = () => {
  const teacher_id = localStorage.getItem("teacher_id");
  const navigate = useNavigate();

  const [sessionData, setSessionData] = useState([]);
  const [headerInfo, setHeaderInfo] = useState({
    subject: "",
    date: "",
    group: "",
    scheduleTime: "",
  });
  const [loading, setLoading] = useState(true);

  // --- 2. ฟังก์ชันจัดกลุ่มข้อมูลกราฟเส้น (3 นาที) ---
  const processDataTo3MinIntervals = (logs) => {
    const buckets = {};
    logs.forEach((log) => {
      const date = new Date(log.created_at);
      const coeff = 1000 * 60 * 3; // 3 นาที
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

  // --- 3. Main Fetch Logic ---
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
          setSessionData([]);
          setLoading(false);
          return;
        }

        const targetSubject = latestRow[0].subject_id;
        const targetDate = latestRow[0].summary_date;
        const targetGroup = latestRow[0].group
          ? String(latestRow[0].group)
          : "N/A";
        const stopTime = new Date(latestRow[0].created_at).toISOString();

        const { data: schedules } = await supabase
          .from("class_schedule")
          .select("*")
          .eq("teacher_id", teacher_id);

        let displayTime = "ไม่พบตารางเรียน";

        if (schedules) {
          const matchedSchedules = schedules.filter((s) => {
            const isSubjectMatch =
              String(s.subject_id).trim() === String(targetSubject).trim();
            const sGroup = String(s.group || "").trim();
            const tGroup = String(targetGroup).trim();
            const isGroupMatch =
              sGroup === tGroup || parseInt(sGroup) === parseInt(tGroup);
            return isSubjectMatch && isGroupMatch;
          });

          if (matchedSchedules.length > 0) {
            displayTime = matchedSchedules
              .map((s) => {
                const day = s.day;
                const start = String(s.start_time).slice(0, 5);
                const end = String(s.end_time).slice(0, 5);
                return `${day} ${start} - ${end}`;
              })
              .join(", ");
          }
        }

        setHeaderInfo({
          subject: targetSubject,
          group: targetGroup,
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

        const groupedByCamera = {};

        if (logs) {
          logs.forEach((log) => {
            const camId = log.camera_id;

            if (!groupedByCamera[camId]) {
              groupedByCamera[camId] = {
                totalAtt: 0,
                countRow: 0,
                durationSum: {
                  Focused: 0,
                  Looking_at_the_board: 0,
                  Taking_notes: 0,
                  LookingAway: 0,
                  UsingPhone: 0,
                  Talking: 0,
                },
              };
            }

            groupedByCamera[camId].totalAtt += Number(log.Attention || 0);
            groupedByCamera[camId].countRow += 1;

            const duration = log.class_duration || {};
            groupedByCamera[camId].durationSum.Focused += Number(
              duration.Focused || 0
            );
            groupedByCamera[camId].durationSum.Looking_at_the_board += Number(
              duration.Looking_at_the_board || 0
            );
            groupedByCamera[camId].durationSum.Taking_notes += Number(
              duration.Taking_notes || 0
            );
            groupedByCamera[camId].durationSum.LookingAway += Number(
              duration.LookingAway || 0
            );
            groupedByCamera[camId].durationSum.UsingPhone += Number(
              duration.UsingPhone || 0
            );
            groupedByCamera[camId].durationSum.Talking += Number(
              duration.Talking || 0
            );
          });
        }

        const processed = Object.keys(groupedByCamera).map((camId) => {
          const group = groupedByCamera[camId];
          const avgDecimal =
            group.countRow > 0 ? group.totalAtt / group.countRow : 0;
          const finalAvgAtt = (avgDecimal * 100).toFixed(0);

          const camLogs = logs
            ? logs.filter((l) => String(l.camera_id) === String(camId))
            : [];

          const lineChartData = processDataTo3MinIntervals(camLogs);

          let recordedDurationStr = "0 วินาที";
          if (camLogs.length > 0) {
            const logTimes = camLogs.map((l) =>
              new Date(l.created_at).getTime()
            );
            const minTime = Math.min(...logTimes);
            const maxTime = Math.max(...logTimes);
            const durationSec = (maxTime - minTime) / 1000;
            recordedDurationStr = formatDuration(durationSec);
          }

          const pieChartData = [
            { name: "ตั้งใจเรียน", value: group.durationSum.Focused },
            {
              name: "มองกระดาน",
              value: group.durationSum.Looking_at_the_board,
            },
            { name: "จดเลคเชอร์", value: group.durationSum.Taking_notes },
            { name: "มองทางอื่น", value: group.durationSum.LookingAway },
            { name: "เล่นมือถือ", value: group.durationSum.UsingPhone },
            { name: "คุยกัน", value: group.durationSum.Talking },
          ].filter((d) => d.value > 0);

          return {
            cameraId: camId,
            avgAtt: finalAvgAtt,
            lineChartData,
            pieChartData,
            recordedDuration: recordedDurationStr,
          };
        });

        setSessionData(processed);
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

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={10}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const handleGoToResults = () => {
    navigate("/user/ResultsPage", {
      state: {
        filterSubject: headerInfo.subject,
        filterDate: new Date(headerInfo.date).toLocaleDateString("th-TH"),
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
          {/* Header Section */}
          <div className="bg-white rounded-[20px] p-4 shadow-sm border border-[#e9e9e9] flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <BarChartOutlined className="text-2xl text-blue-500" />
                <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2 flex-wrap">
                  สรุปผลการสอนล่าสุด:
                  <span className="text-[#38A738]">
                    {headerInfo.subject || "กำลังโหลด..."}
                  </span>
                  {headerInfo.group && headerInfo.group !== "N/A" && (
                    <span className="flex items-center gap-1 bg-purple-100 text-purple-700 text-sm font-medium px-3 py-1 rounded-full border border-purple-200 ml-1">
                      <TeamOutlined /> กลุ่ม {headerInfo.group}
                    </span>
                  )}
                </h2>
              </div>

              <div className="text-gray-500 text-sm font-medium flex items-center gap-4 md:ml-4">
                <span className="flex items-center gap-1">
                  <CalendarOutlined /> {headerInfo.date}
                </span>
                <div className="w-[1px] h-4 bg-gray-300"></div>
                <span className="flex items-center gap-1 text-gray-500 font-medium">
                  <ClockCircleOutlined /> {headerInfo.scheduleTime}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <span className="text-sm text-gray-400 hidden lg:inline">
                ข้อมูลนี้คือข้อมูลดิบรายกล้อง คุณสามารถดูภาพรวมได้ที่หน้าสรุปผล
              </span>

              <button
                onClick={handleGoToResults}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-medium hover:bg-blue-600 transition duration-200 shadow-md flex-shrink-0"
              >
                <SendOutlined className="text-sm" />
                ไปยังหน้ารวมสรุปผล
              </button>
            </div>
          </div>

          {/* Cards Container */}
          <div className="flex flex-col gap-6">
            {sessionData.length > 0 ? (
              sessionData.map((data, index) => {
                // 🟢 คำนวณผลรวมเวลา (สำหรับหา % ใน Tooltip)
                const totalPieValue = data.pieChartData.reduce(
                  (acc, curr) => acc + curr.value,
                  0
                );

                return (
                  <div
                    key={`${data.cameraId}-${index}`}
                    className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6"
                  >
                    <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-gray-800">
                            กล้อง {data.cameraId}
                          </h3>
                          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                            CAM {data.cameraId}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          Timeline การสอนวิชา {headerInfo.subject}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-gray-400 text-xs mb-1">
                          คะแนนเฉลี่ยรวม
                        </span>
                        <span
                          className={`text-2xl font-bold ${
                            Number(data.avgAtt) > 50
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {data.avgAtt}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Left: Line Chart */}
                      <div className="lg:col-span-2">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                            <BarChartOutlined /> Timeline ความตั้งใจ (เฉลี่ยทุก
                            3 นาที)
                          </h4>
                          <div className="flex items-center gap-1 text-xs text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200 shadow-sm">
                            <PlayCircleOutlined className="text-green-500" />
                            <span>บันทึก {data.recordedDuration}</span>
                          </div>
                        </div>

                        <div className="h-[250px] bg-gray-50 rounded-xl border border-gray-100 p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            {data.lineChartData.length > 0 ? (
                              <LineChart data={data.lineChartData}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#e0e0e0"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="time"
                                  tick={{ fontSize: 12, fill: "#888" }}
                                  axisLine={false}
                                  tickLine={false}
                                  dy={10}
                                />
                                <YAxis
                                  domain={[0, 100]}
                                  tick={{ fontSize: 12, fill: "#888" }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <Tooltip
                                  contentStyle={{
                                    borderRadius: "12px",
                                    border: "none",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                  }}
                                  formatter={(value) => [
                                    `${value}%`,
                                    "ความสนใจเฉลี่ย",
                                  ]}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="score"
                                  stroke="#0068c9"
                                  strokeWidth={3}
                                  dot={{
                                    r: 3,
                                    fill: "#0068c9",
                                    strokeWidth: 0,
                                  }}
                                  activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                              </LineChart>
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-400">
                                ไม่พบข้อมูล Timeline
                              </div>
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
                          {/* 1. ตัวกราฟวงกลม (ปรับลด width เหลือ 45% เพื่อแบ่งที่ให้ List) */}
                          <div className="w-[55%] h-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={data.pieChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={45}
                                  outerRadius={80}
                                  paddingAngle={3}
                                  dataKey="value"
                                  labelLine={false}
                                  label={renderCustomizedLabel}
                                >
                                  {data.pieChartData.map((entry, index) => (
                                    <Cell
                                      key={index}
                                      fill={
                                        BEHAVIOR_COLORS[entry.name] ||
                                        BEHAVIOR_COLORS["default"]
                                      }
                                      stroke="none"
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value) => {
                                    const percent =
                                      totalPieValue > 0
                                        ? (
                                            (value / totalPieValue) *
                                            100
                                          ).toFixed(0)
                                        : 0;
                                    return `${percent}%`;
                                  }}
                                  wrapperStyle={{ zIndex: 1000 }}
                                  contentStyle={{
                                    borderRadius: "12px",
                                    border: "none",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          {/* 2. รายการแสดงเวลา (ขวา) - 🟢 ปรับใหม่: บรรทัดเดียว, ไม่ต้องเลื่อน */}
                          <div className="w-[35%] flex flex-col justify-center h-full pr-2">
                            {data.pieChartData.map((entry, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0"
                              >
                                {/* ชื่อพฤติกรรม (ซ้าย) */}
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{
                                      backgroundColor:
                                        BEHAVIOR_COLORS[entry.name] || "#ccc",
                                    }}
                                  />
                                  <span
                                    className="text-xs text-gray-700 font-medium truncate"
                                    title={entry.name}
                                  >
                                    {entry.name}
                                  </span>
                                </div>
                                {/* เวลา (ขวา) */}
                                <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">
                                  {formatDuration(entry.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-[500px] text-gray-400 bg-white rounded-[20px] border border-gray-200">
                {loading ? (
                  <p>กำลังโหลดข้อมูล...</p>
                ) : (
                  <>
                    <BarChartOutlined className="text-4xl mb-2 opacity-50" />
                    <p>ไม่พบข้อมูลการสอนล่าสุด</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummarizePage;
