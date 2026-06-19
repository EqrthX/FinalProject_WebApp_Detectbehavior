export const formatDuration = (seconds) => {
  const roundedSeconds = Math.round(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  if (minutes > 0) return `${minutes} นาที ${remainingSeconds} วินาที`;
  return `${remainingSeconds} วินาที`;
};

export const processDataTo3MinIntervals = (logs) => {
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
    score: Number(((b.totalAtt / b.count) * 100).toFixed(0)),
  }));
};

export const processSummaryData = (summaryList) => {
  const durationSum = {
    "มองกระดาน": 0,
    "จดเลคเชอร์": 0,
    "มองทางอื่น": 0,
    "เล่นมือถือ": 0,
    "อื่นๆ": 0,
  };

  summaryList.forEach((item) => {
    const json = item.class_duration_summary || {};
    
    Object.keys(json).forEach((key) => {
      const val = Number(json[key] || 0);

      if (key === "Looking at the board" || key === "Looking_at_the_board" || key === "Focused") {
        durationSum["มองกระดาน"] += val;
      } else if (key === "Looking down to write" || key === "Taking_notes") {
        durationSum["จดเลคเชอร์"] += val;
      } else if (key === "Using Phone" || key === "UsingPhone") {
        durationSum["เล่นมือถือ"] += val;
      } else if (key === "Looking Away" || key === "LookingAway") {
        durationSum["มองทางอื่น"] += val;
      } else {
        durationSum["อื่นๆ"] += val;
      }
    });
  });

  const pieChartData = Object.keys(durationSum).map((key) => ({
    name: key,
    value: durationSum[key],
  }));

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
    ? Number(((sumFinalPersonalScores / uniqueStudentCount) * 100).toFixed(0))
    : 0;

  return { pieChartData, avgAtt };
};
