import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../config/supabase";
import { processSummaryData, processDataTo3MinIntervals, formatDuration } from "./dataProcessors";

export const useResultsData = () => {
  const teacher_id = localStorage.getItem("teacher_id");
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [rawLogs, setRawLogs] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [groupedData, setGroupedData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [uniqueSubjects, setUniqueSubjects] = useState([]);
  const [uniqueDates, setUniqueDates] = useState([]);
  const [uniqueSections, setUniqueSections] = useState([]);
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      if (!teacher_id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
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
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teacher_id]);

  useEffect(() => {
    if (rawLogs.length === 0 && summaries.length === 0) {
      setGroupedData([]);
      setCurrentPage(1);
      return;
    }

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
        totalDuration,
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
    setCurrentPage(1);
  }, [
    rawLogs,
    summaries,
    schedules,
    selectedSubject,
    selectedDate,
    selectedSection,
  ]);

  const paginatedData = groupedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return {
    loading,
    groupedData,
    paginatedData,
    currentPage,
    setCurrentPage,
    pageSize,
    totalCount: groupedData.length,
    uniqueDates,
    uniqueSubjects,
    uniqueSections,
    selectedDate,
    setSelectedDate,
    selectedSubject,
    setSelectedSubject,
    selectedSection,
    setSelectedSection,
  };
};
