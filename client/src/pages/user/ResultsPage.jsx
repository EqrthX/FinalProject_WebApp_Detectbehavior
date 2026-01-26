import React, { useEffect, useState, useRef } from "react";
import Navbar from "../../components/Navbar";
import {
  BarChartOutlined,
  PieChartOutlined,
  CalendarOutlined,
  DownOutlined,
  CheckOutlined,
  BookOutlined,
  TeamOutlined,
  UserOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { supabase } from "../../config/supabase";
import { useLocation } from "react-router-dom";

// --- 1. Custom Select Component (คงเดิม) ---
const CustomSelect = ({ options, value, onChange, prefixIcon, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const selectedOption = options.find(
    (opt) => (typeof opt === "object" ? opt.value : opt) === value
  );
  const displayValue = selectedOption
    ? typeof selectedOption === "object" ? selectedOption.label : selectedOption
    : value === "all" ? placeholder : value;
  return (
    <div className="relative group min-w-[160px]" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full p-2 pl-3 pr-3 bg-white border cursor-pointer transition-all duration-200 shadow-sm ${
          isOpen ? "border-blue-500 ring-2 ring-blue-100 rounded-t-2xl rounded-b-none z-50" : "border-gray-300 rounded-full hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {prefixIcon && <span className="text-gray-400">{prefixIcon}</span>}
          <span className={`text-sm truncate ${value === "all" ? "text-gray-500" : "text-gray-700 font-medium"}`}>
            {displayValue}
          </span>
        </div>
        <DownOutlined className={`text-[10px] text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </div>
      {isOpen && (
        <div className="absolute left-0 w-full bg-white border border-t-0 border-gray-200 rounded-b-2xl shadow-xl z-[999] overflow-hidden">
          <ul className="max-h-[200px] overflow-y-auto py-1 custom-scrollbar">
            <li
              onClick={() => { onChange("all"); setIsOpen(false); }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
            >
              <span>{placeholder}</span>
              {value === "all" && <CheckOutlined className="text-green-500" />}
            </li>
            {options.map((option, index) => {
              const optLabel = typeof option === "object" ? option.label : option;
              const optValue = typeof option === "object" ? option.value : option;
              return (
                <li
                  key={index}
                  onClick={() => { onChange(optValue); setIsOpen(false); }}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                >
                  <span className="truncate">{optLabel}</span>
                  {value === optValue && <CheckOutlined className="text-green-500" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

// --- 2. กำหนดสีและหมวดหมู่ (ให้เหมือน SummarizePage) ---
const BEHAVIOR_COLORS = {
  มองกระดาน: "#3b82f6",   // รวม Focused
  จดเลคเชอร์: "#a855f7",
  มองทางอื่น: "#f59e0b",
  เล่นมือถือ: "#ef4444",
  อื่นๆ: "#9ca3af",       // รวม Talking
  default: "#cbd5e1",
  empty: "#e5e7eb",
};

const FIXED_CATEGORIES = [
  "มองกระดาน",
  "จดเลคเชอร์",
  "มองทางอื่น",
  "เล่นมือถือ",
  "อื่นๆ"
];

// ฟังก์ชันแปลงเวลา
const formatDuration = (seconds) => {
  const roundedSeconds = Math.round(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  if (minutes > 0) return `${minutes} นาที ${remainingSeconds} วินาที`;
  return `${remainingSeconds} วินาที`;
};

const ResultsPage = () => {
  const teacher_id = localStorage.getItem("teacher_id");
  const location = useLocation();

  const [rawLogs, setRawLogs] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [groupedData, setGroupedData] = useState([]);

  const [uniqueSubjects, setUniqueSubjects] = useState([]);
  const [uniqueDates, setUniqueDates] = useState([]);
  const [uniqueSections, setUniqueSections] = useState([]);
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      if (!teacher_id) return;
      try {
        const logsReq = supabase
          .from("camera_logs")
          .select("*")
          .eq("teacher_id", teacher_id)
          .order("created_at", { ascending: false })
          .limit(5000);

        const summaryReq = supabase
          .from("camera_daily_summary")
          .select("*")
          .eq("teacher_id", teacher_id)
          .order("summary_date", { ascending: false });

        const scheduleReq = supabase
          .from("class_schedule")
          .select("*")
          .eq("teacher_id", teacher_id);

        const [logsRes, summaryRes, scheduleRes] = await Promise.all([
          logsReq,
          summaryReq,
          scheduleReq,
        ]);

        if (logsRes.data && summaryRes.data) {
          const mappedSummaries = summaryRes.data.map((item) => ({
            ...item,
            section: item.group ? item.group.toString() : "N/A",
          }));

          const mappedLogs = logsRes.data.reverse().map((log) => ({
            ...log,
            section: log.group ? log.group.toString() : "N/A",
          }));

          setRawLogs(mappedLogs);
          setSummaries(mappedSummaries);
          if (scheduleRes.data) setSchedules(scheduleRes.data);

          const subjects = [...new Set(mappedSummaries.map((item) => item.subject_id))].filter(Boolean);
          setUniqueSubjects(subjects);

          const dates = [...new Set(mappedSummaries.map((item) => new Date(item.summary_date).toLocaleDateString("th-TH")))];
          setUniqueDates(dates);

          const sections = [...new Set(mappedSummaries.map((item) => item.section))].filter((s) => s !== "N/A");
          setUniqueSections(sections.sort());

          if (location.state) {
            const { filterSubject, filterDate, filterSection } = location.state;
            let shouldNavigate = false;
            if (filterSubject && subjects.includes(filterSubject)) {
              setSelectedSubject(filterSubject);
              shouldNavigate = true;
            }
            if (filterDate && dates.includes(filterDate)) {
              setSelectedDate(filterDate);
              shouldNavigate = true;
            }
            if (filterSection && sections.includes(String(filterSection))) {
              setSelectedSection(String(filterSection));
              shouldNavigate = true;
            }
            if (shouldNavigate) {
              window.history.replaceState({}, document.title);
            }
          }
        }
      } catch (err) {
        console.error("System error:", err);
      }
    };
    fetchData();
  }, [teacher_id]);

  const processDataTo3MinIntervals = (logs) => {
    const buckets = {};
    logs.forEach((log) => {
      const date = new Date(log.created_at);
      const coeff = 1000 * 60 * 1;
      const roundedDate = new Date(Math.floor(date.getTime() / coeff) * coeff);
      const timeStr = roundedDate.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (!buckets[timeStr])
        buckets[timeStr] = { time: timeStr, totalAtt: 0, count: 0 };
      buckets[timeStr].totalAtt += Number(log.Attention || 0);
      buckets[timeStr].count += 1;
    });
    return Object.values(buckets).map((b) => ({
      time: b.time,
      score: ((b.totalAtt / b.count) * 100).toFixed(0),
    }));
  };

  // --- 3. แก้ไข Logic การรวมข้อมูลให้เป็น 5 หมวด (เหมือน SummarizePage) ---
  const processSummaryData = (summaryList) => {
    // ใช้ 5 หมวดหลัก
    const durationSum = {
      มองกระดาน: 0,
      จดเลคเชอร์: 0,
      มองทางอื่น: 0,
      เล่นมือถือ: 0,
      อื่นๆ: 0,
    };

    summaryList.forEach((item) => {
      const json = item.class_duration_summary || {};
      
      // Mapping Logic
      durationSum["มองกระดาน"] += (Number(json.Focused || 0) + Number(json.Looking_at_the_board || 0));
      durationSum["จดเลคเชอร์"] += Number(json.Taking_notes || 0);
      durationSum["มองทางอื่น"] += Number(json.LookingAway || 0);
      durationSum["เล่นมือถือ"] += Number(json.UsingPhone || 0);
      // รวม Talking + Other เข้าหมวด "อื่นๆ"
      durationSum["อื่นๆ"] += (Number(json.Talking || 0) + Number(json.Other || 0));
    });

    const pieChartData = Object.keys(durationSum).map(key => ({
        name: key,
        value: durationSum[key]
    }));

    // คำนวณคะแนนเฉลี่ย
    const studentsByCamera = {};
    summaryList.forEach((row) => {
      const camId = row.camera_id;
      if (!studentsByCamera[camId]) studentsByCamera[camId] = { totalAtt: 0, count: 0 };
      studentsByCamera[camId].totalAtt += Number(row.avg_attention);
      studentsByCamera[camId].count += 1;
    });
    let sumFinalPersonalScores = 0;
    const uniqueStudentCount = Object.keys(studentsByCamera).length;
    Object.values(studentsByCamera).forEach((student) => {
      const personalAvg = student.totalAtt / student.count;
      sumFinalPersonalScores += personalAvg;
    });
    const avgAtt = uniqueStudentCount > 0
        ? ((sumFinalPersonalScores / uniqueStudentCount) * 100).toFixed(0)
        : 0;

    return { pieChartData, avgAtt };
  };

  useEffect(() => {
    if (rawLogs.length === 0 && summaries.length === 0) return;

    let filteredSummaries = summaries;
    let filteredLogs = rawLogs;

    if (selectedSubject !== "all") {
      filteredSummaries = filteredSummaries.filter((s) => s.subject_id === selectedSubject);
      filteredLogs = filteredLogs.filter((l) => l.subject_id === selectedSubject);
    }
    if (selectedDate !== "all") {
      filteredSummaries = filteredSummaries.filter((s) => new Date(s.summary_date).toLocaleDateString("th-TH") === selectedDate);
      filteredLogs = filteredLogs.filter((l) => new Date(l.created_at).toLocaleDateString("th-TH") === selectedDate);
    }
    if (selectedSection !== "all") {
      filteredSummaries = filteredSummaries.filter((s) => s.section === selectedSection);
      filteredLogs = filteredLogs.filter((l) => l.section === selectedSection);
    }

    const grouped = {};
    filteredSummaries.forEach((sum) => {
      const key = `${sum.subject_id}|${sum.section}|${new Date(sum.summary_date).toDateString()}`;
      if (!grouped[key]) grouped[key] = { summaries: [], logs: [] };
      grouped[key].summaries.push(sum);
    });

    filteredLogs.forEach((log) => {
      const logDate = new Date(log.created_at).toDateString();
      const matchKey = Object.keys(grouped).find((k) => {
        const [sub, sec, d] = k.split("|");
        return (
          String(sub) === String(log.subject_id) &&
          d === logDate &&
          String(sec) === String(log.section)
        );
      });
      if (matchKey && grouped[matchKey]) grouped[matchKey].logs.push(log);
    });

    const finalArray = Object.entries(grouped).map(([key, data]) => {
      const [subjectId, section] = key.split("|");

      const studentsByCamera = {};
      data.summaries.forEach((row) => {
        const camId = row.camera_id;
        if (!studentsByCamera[camId]) studentsByCamera[camId] = { totalAtt: 0, count: 0 };
        studentsByCamera[camId].totalAtt += Number(row.avg_attention);
        studentsByCamera[camId].count += 1;
      });

      let attentiveCount = 0;
      let inattentiveCount = 0;
      const totalUniqueStudents = Object.keys(studentsByCamera).length;

      Object.values(studentsByCamera).forEach((student) => {
        const personalAvg = student.totalAtt / student.count;
        if (personalAvg * 100 > 50) attentiveCount++;
        else inattentiveCount++;
      });

      const barChartData = [
        { name: "ตั้งใจเรียน", count: attentiveCount, fill: "#38A738" },
        { name: "ไม่ตั้งใจ", count: inattentiveCount, fill: "#FF4D4F" },
      ];

      const { pieChartData, avgAtt } = processSummaryData(data.summaries);
      const lineChartData = processDataTo3MinIntervals(data.logs);

      // คำนวณผลรวมเวลาสำหรับกราฟ Pie
      const totalDuration = pieChartData.reduce((acc, item) => acc + item.value, 0);

      const matchedSchedules = schedules.filter((s) => {
        const isSubjectMatch = String(s.subject_id).trim() === String(subjectId).trim();
        const sGroup = String(s.group || "").trim();
        const tGroup = String(section).trim();
        const isGroupMatch = sGroup === tGroup || parseInt(sGroup) === parseInt(tGroup);
        return isSubjectMatch && isGroupMatch;
      });

      let displayTime = "-";
      if (matchedSchedules.length > 0) {
        displayTime = matchedSchedules.map((s) => {
            const day = s.day;
            const start = String(s.start_time).slice(0, 5);
            const end = String(s.end_time).slice(0, 5);
            return `${day} ${start} - ${end}`;
          }).join(", ");
      } else {
        displayTime = "ไม่พบตารางเรียน";
      }

      const rawDate = new Date(data.summaries[0].summary_date);
      let latestTimeForSort = rawDate.getTime();
      let realDurationSeconds = 0;

      if (data.logs && data.logs.length > 0) {
        const logTimes = data.logs.map((l) => new Date(l.created_at).getTime());
        latestTimeForSort = Math.max(...logTimes);
        const minTime = Math.min(...logTimes);
        const maxTime = Math.max(...logTimes);
        realDurationSeconds = (maxTime - minTime) / 1000;
      }

      return {
        key,
        subjectId,
        section,
        pieChartData,
        totalDuration, // เพิ่มตัวนี้สำหรับคำนวณ %
        avgAtt,
        lineChartData,
        barChartData,
        totalStudents: totalUniqueStudents,
        timestamp: latestTimeForSort,
        date: rawDate.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }),
        scheduleTime: displayTime,
        recordedDuration: formatDuration(realDurationSeconds),
      };
    });

    finalArray.sort((a, b) => b.timestamp - a.timestamp);
    setGroupedData(finalArray);
  }, [
    rawLogs,
    summaries,
    schedules,
    selectedSubject,
    selectedDate,
    selectedSection,
  ]);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const RADIAN = Math.PI / 180;
    const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
    const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
    return (
      <text x={x} y={y} fill="white" fontSize={10} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central">
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      <div className="relative z-[1000]">
        <Navbar />
      </div>

      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        {/* Header Filters */}
        <div className="bg-white rounded-[20px] p-4 shadow-sm border border-[#e9e9e9] flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 flex-shrink-0 z-50">
          <div className="flex items-center gap-2">
            <BarChartOutlined className="text-2xl text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-700">ผลลัพธ์การเรียนการสอน</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CustomSelect placeholder="-- ทุกวัน --" options={uniqueDates} value={selectedDate} onChange={setSelectedDate} prefixIcon={<CalendarOutlined />} />
            <CustomSelect placeholder="-- ทุกวิชา --" options={uniqueSubjects.map((sub) => ({ value: sub, label: `วิชา ${sub}` }))} value={selectedSubject} onChange={setSelectedSubject} prefixIcon={<BookOutlined />} />
            <CustomSelect placeholder="-- ทุกกลุ่ม --" options={uniqueSections.map((sec) => ({ value: sec, label: `กลุ่ม ${sec}` }))} value={selectedSection} onChange={setSelectedSection} prefixIcon={<TeamOutlined />} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
          {groupedData.length > 0 ? (
            <div className="flex flex-col gap-6">
              {groupedData.map((data, index) => {
                // สำหรับกราฟ: ถ้าไม่มีข้อมูล หรือยอดรวมเป็น 0 ให้แสดง dummy
                const isDataEmpty = data.totalDuration === 0;
                const pieRenderData = isDataEmpty ? [{ name: "No Data", value: 1 }] : data.pieChartData.filter(d => d.value > 0);

                return (
                  <div key={index} className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6">
                    {/* Card Header */}
                    <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-gray-800">วิชา {data.subjectId}</h3>
                          {data.section && data.section !== "N/A" && (
                            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full">
                              กลุ่ม {data.section}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                          <div className="flex items-center gap-1.5" title="วันที่บันทึกข้อมูล">
                            <CalendarOutlined className="text-blue-500" />
                            <span>{data.date}</span>
                          </div>
                          <div className="w-[1px] h-4 bg-gray-300"></div>
                          <div className="flex items-center gap-1.5" title="เวลาเรียนตามตาราง">
                            <ClockCircleOutlined className="text-orange-500" />
                            <span>{data.scheduleTime}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`text-2xl font-bold ${Number(data.avgAtt) > 50 ? "text-green-600" : "text-red-500"}`}>
                          {data.avgAtt}%
                        </span>
                      </div>
                    </div>

                    {/* Graphs Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                      {/* Line Chart */}
                      <div className="lg:col-span-2 xl:col-span-1 h-[250px] bg-gray-50 rounded-xl border border-gray-100 p-2">
                        <div className="flex justify-between items-center mb-2 px-2">
                          <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                            <BarChartOutlined /> Timeline
                          </h4>
                        </div>
                        <ResponsiveContainer width="100%" height="90%">
                          <LineChart data={data.lineChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} dy={10} minTickGap={30} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} formatter={(value) => [`${value}%`, "ความสนใจ"]} />
                            <Line type="monotone" dataKey="score" stroke="#0068c9" strokeWidth={3} dot={{ r: 3, fill: "#0068c9", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Bar Chart */}
                      <div className="h-[250px] bg-white rounded-xl border border-gray-100 p-2 relative">
                        <div className="flex justify-between items-center mb-2 px-2">
                          <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                            <UserOutlined /> จำนวนนักศึกษา
                          </h4>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">ทั้งหมด {data.totalStudents} คน</span>
                        </div>
                        <ResponsiveContainer width="100%" height="90%">
                          <BarChart data={data.barChartData} barGap={20}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} dy={5} />
                            <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: "transparent" }} formatter={(value) => [`${value} คน`]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }} />
                            <Bar dataKey="count" radius={[5, 5, 0, 0]} barSize={60}>
                              {data.barChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* --- 🟢 ส่วน Pie Chart ที่แก้ไข (ให้เหมือน SummarizePage) --- */}
                      <div className="lg:col-span-1 border-l border-gray-100 pl-0 lg:pl-8">
                        <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                          <PieChartOutlined /> สัดส่วนเวลาพฤติกรรม
                        </h4>

                        <div className="flex items-center h-[90%] w-full">
                          {/* 1. กราฟวงกลม (ซ้าย 55%) */}
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
                                  <Tooltip 
                                    formatter={(value) => {
                                      const percent = data.totalDuration > 0 ? ((value / data.totalDuration) * 100).toFixed(0) : 0;
                                      return [`${percent}%`, "สัดส่วน"];
                                    }}
                                    wrapperStyle={{ zIndex: 1000 }}
                                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }} 
                                  />
                                )}
                              </PieChart>
                            </ResponsiveContainer>
                            {isDataEmpty && <div className="absolute top-1/2 left-[50%] transform -translate-x-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">ไม่มีข้อมูล</div>}
                          </div>

                          {/* 2. รายการ List (ขวา 45%) */}
                          <div className="w-[45%] flex flex-col justify-center h-full pr-2">
                            {FIXED_CATEGORIES.map((catName, i) => {
                              // หาค่าของหมวดหมู่นี้
                              const item = data.pieChartData.find(d => d.name === catName) || { value: 0 };
                              return (
                                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded text-xs flex items-center justify-center shrink-0" style={{ backgroundColor: BEHAVIOR_COLORS[catName] }} />
                                    <span className="text-xs text-gray-600 truncate" title={catName}>{catName}</span>
                                  </div>
                                  {/* แสดงเวลา */}
                                  <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">{formatDuration(item.value)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {/* --- จบส่วนแก้ไข --- */}

                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[500px] text-gray-400 bg-white rounded-[20px] border border-gray-200">
              <BarChartOutlined className="text-6xl mb-4 opacity-20" />
              <p className="text-lg">ไม่พบข้อมูลการเรียนการสอน</p>
              <p className="text-sm">ลองปรับเปลี่ยนตัวกรองวันที่ หรือ วิชา</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;