import React from "react";
import {
  BarChartOutlined,
  PieChartOutlined,
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
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
  BarChart,
  Bar,
} from "recharts";
import { BEHAVIOR_COLORS, FIXED_CATEGORIES } from "../util/constants";
import { formatDuration } from "../util/dataProcessors";

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

const SessionCard = ({ data }) => {
  const isDataEmpty = data.totalDuration === 0;
  const pieRenderData = isDataEmpty
    ? [{ name: "empty", value: 1 }]
    : data.pieChartData.filter((d) => d.value > 0);

  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[#e9e9e9] p-6">
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

        {/* Pie Chart */}
        <div className="lg:col-span-1 border-l border-gray-100 pl-0 lg:pl-8">
          <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
            <PieChartOutlined /> สัดส่วนเวลาพฤติกรรม
          </h4>

          <div className="flex items-center h-[90%] w-full">
            {/* 1. Pie Chart visualization */}
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
                      <Cell
                        key={index}
                        fill={isDataEmpty ? BEHAVIOR_COLORS["empty"] : BEHAVIOR_COLORS[entry.name] || BEHAVIOR_COLORS["default"]}
                        stroke="none"
                      />
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
              {isDataEmpty && (
                <div className="absolute top-1/2 left-[50%] transform -translate-x-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                  ไม่มีข้อมูล
                </div>
              )}
            </div>

            {/* 2. Behaviour lists with durations */}
            <div className="w-[45%] flex flex-col justify-center h-full pr-2">
              {FIXED_CATEGORIES.map((catName, i) => {
                const item = data.pieChartData.find((d) => d.name === catName) || { value: 0 };
                return (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded text-xs flex items-center justify-center shrink-0" style={{ backgroundColor: BEHAVIOR_COLORS[catName] }} />
                      <span className="text-xs text-gray-600 truncate" title={catName}>{catName}</span>
                    </div>
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
};

export default SessionCard;
