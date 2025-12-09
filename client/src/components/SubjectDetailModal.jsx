import React, { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { X, Users, Calendar, Clock, BookOpen } from "lucide-react";
import { DatePicker } from "antd"; 
import { supabase } from "../config/supabase";
import dayjs from "dayjs"; 
import "dayjs/locale/th"; 
import isBetween from "dayjs/plugin/isBetween"; 

dayjs.extend(isBetween);
const { RangePicker } = DatePicker;

export const SubjectDetailModal = ({ isOpen, onClose, subject }) => {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  const getDayNumber = (thaiDay) => {
    const days = { "อาทิตย์": 0, "จันทร์": 1, "อังคาร": 2, "พุธ": 3, "พฤหัสบดี": 4, "ศุกร์": 5, "เสาร์": 6 };
    return days[thaiDay] !== undefined ? days[thaiDay] : -1;
  };

  // --- 1. Fetch Groups ---
  useEffect(() => {
    if (isOpen && subject?.code) {
      setLoadingGroups(true);
      const fetchGroups = async () => {
        try {
            const { data, error } = await supabase
            .from("class_schedule")
            .select(`id: class_schedule_id, group, day, start_time, end_time, room, teacher_name, teacher_id, subject_id`)
            .eq("subject_id", subject.code) 
            .order("group", { ascending: true });

            if (error) throw error;
            setGroups(data || []);
            if (data && data.length > 0) setSelectedGroup(data[0]);
            else setSelectedGroup(null);
        } catch (err) { console.error(err); } 
        finally { setLoadingGroups(false); }
      };
      fetchGroups();
    } else {
        setGroups([]); setSelectedGroup(null); setChartData([]); setDateRange(null);
    }
  }, [isOpen, subject]);

  // --- 2. Fetch Chart Data (Logic ใหม่: แยกกลุ่มในวันเดียวกัน) ---
  useEffect(() => {
    if (selectedGroup && isOpen) {
      setLoadingChart(true);
      const fetchSummary = async () => {
        try {
            console.log("Selected Group:", selectedGroup);

            // 1. ดึงข้อมูลทั้งหมดของวิชานี้ (เอา teacher_id ออกก่อน เพื่อความชัวร์ว่าข้อมูลมา)
            let query = supabase
                .from("camera_daily_summary")
                .select("summary_date, created_at, avg_attention, camera_id") 
                .eq("subject_id", subject.code);

            if (dateRange && dateRange[0] && dateRange[1]) {
                query = query
                    .gte('summary_date', dateRange[0].format('YYYY-MM-DD'))
                    .lte('summary_date', dateRange[1].format('YYYY-MM-DD'));
            }

            const { data, error } = await query.order("summary_date", { ascending: true });
            if (error) throw error;

            console.log("Raw Data form DB:", data); // ดูว่ามีข้อมูลดิบมาไหม

            if (!data || data.length === 0) { setChartData([]); return; }

            // --- FILTERING LOGIC ---
            // เตรียมข้อมูลวันและเวลาของกลุ่มที่เลือก
            const targetDayNum = getDayNumber(selectedGroup.day); 
            const groupStartTime = selectedGroup.start_time.slice(0, 5); // "11:00"
            const groupEndTime = selectedGroup.end_time.slice(0, 5);     // "14:00"

            const filteredData = data.filter(item => {
                const recordDateTime = dayjs(item.created_at); // ใช้เวลาที่บันทึกจริง (created_at)

                // A. เช็ควัน: ต้องตรงกัน (เช่น วันจันทร์)
                // หมายเหตุ: ใช้ recordDateTime.day() เทียบกับ targetDayNum
                // ถ้า summary_date ตรงเป๊ะอยู่แล้ว แต่ created_at อาจจะเพี้ยน timezone ให้ลองเปลี่ยนไปใช้ dayjs(item.summary_date).day() แทนได้
                if (recordDateTime.day() !== targetDayNum) return false;

                // B. เช็คช่วงเวลา: เพื่อแยกกลุ่มที่เรียนวันเดียวกัน
                const dateStr = recordDateTime.format("YYYY-MM-DD");
                
                // สร้างขอบเขตเวลาเรียนของกลุ่มนี้
                // 🟢 Buffer: เผื่อเวลา +/- 3 ชั่วโมง (กว้างมาก เพื่อให้ข้อมูล 09:00 เข้ามาอยู่ในคาบ 11:00 ได้)
                const classStart = dayjs(`${dateStr} ${groupStartTime}`).subtract(3, 'hour');
                const classEnd = dayjs(`${dateStr} ${groupEndTime}`).add(3, 'hour');

                // ถ้าเวลาที่บันทึก (created_at) อยู่ในช่วงนี้ ให้ถือว่าเป็นของกลุ่มนี้
                const isMatch = recordDateTime.isBetween(classStart, classEnd, null, '[]');
                
                return isMatch;
            });

            console.log("Filtered Data:", filteredData); // ดูว่าเหลือข้อมูลหลังกรองเท่าไหร่

            // --- COUNTING LOGIC (นับคน) ---
            const dailyStats = {};
            filteredData.forEach((item) => {
                const dateKey = dayjs(item.summary_date).format("YYYY-MM-DD");
                const cameraKey = item.camera_id; 

                if (!dailyStats[dateKey]) dailyStats[dateKey] = { date: item.summary_date, students: {} };
                if (!dailyStats[dateKey].students[cameraKey]) dailyStats[dateKey].students[cameraKey] = { sumAttention: 0, count: 0 };

                dailyStats[dateKey].students[cameraKey].sumAttention += Number(item.avg_attention || 0);
                dailyStats[dateKey].students[cameraKey].count += 1;
            });

            const formattedData = Object.keys(dailyStats).map((dateKey) => {
                const dayData = dailyStats[dateKey];
                let attentiveCount = 0;
                let inattentiveCount = 0;

                Object.values(dayData.students).forEach((student) => {
                    const avg = student.sumAttention / student.count;
                    if (avg >= 50) attentiveCount++; else inattentiveCount++;
                });

                return {
                    name: dayjs(dayData.date).format("DD MMM"), 
                    fullDate: dayData.date,
                    attentivePeople: attentiveCount,
                    inattentivePeople: inattentiveCount
                };
            });

            formattedData.sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
            setChartData(formattedData);

        } catch (err) { console.error(err); setChartData([]); } 
        finally { setLoadingChart(false); }
      };
      fetchSummary();
    }
  }, [selectedGroup, isOpen, subject, dateRange]);

  // ... (JSX ส่วน Return เหมือนเดิม ไม่ต้องแก้)
  if (!isOpen) return null;
  return (
    // ... Copy JSX เดิมมาวางได้เลย
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#f8f8f8] w-full max-w-5xl h-[85vh] rounded-[20px] shadow-2xl flex flex-col overflow-hidden border border-gray-200">
         {/* ... Header ... */}
         <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-[#3D42D3] flex items-center gap-2">
                    <BookOpen className="w-6 h-6" />
                    {subject?.code} : {subject?.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1 ml-8">
                    หมวดหมู่ : {subject?.category || "-"}
                </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-red-500">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                
                {/* Left Column: Group List */}
                <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                            <Users className="w-5 h-5" /> เลือกกลุ่มเรียน ({groups.length})
                        </h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {loadingGroups ? (
                            <div className="flex justify-center mt-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3D42D3]"></div></div>
                        ) : groups.length === 0 ? (
                            <p className="text-center text-gray-400 mt-10">ไม่พบกลุ่มเรียน</p>
                        ) : (
                            groups.map((g) => (
                                <div 
                                    key={g.id}
                                    onClick={() => setSelectedGroup(g)}
                                    className={`cursor-pointer p-4 rounded-lg border transition-all duration-200 
                                        ${selectedGroup?.id === g.id 
                                            ? "bg-[#3D42D3] text-white border-[#3D42D3] shadow-md" 
                                            : "bg-white border-gray-200 hover:border-[#3D42D3] hover:shadow-sm text-gray-600"
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold">กลุ่ม {g.group}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${selectedGroup?.id === g.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                                            ห้อง {g.room}
                                        </span>
                                    </div>
                                    <div className="text-xs opacity-90 flex items-center gap-2 mt-2">
                                        <Calendar className="w-3 h-3" /> {g.day} | 
                                        <Clock className="w-3 h-3" /> {g.start_time?.slice(0,5)} - {g.end_time?.slice(0,5)}
                                    </div>
                                    <div className="text-xs mt-2 opacity-75 border-t border-white/20 pt-1 truncate">
                                        ผู้สอน: {g.teacher_name || "-"}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Column: Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            {/* 🟢 เปลี่ยนหัวข้อกราฟ */}
                            <h3 className="font-bold text-lg text-gray-800">จำนวนนักศึกษาที่ตั้งใจเรียน (คน)</h3>
                            <p className="text-sm text-gray-500">
                                {selectedGroup 
                                    ? `กลุ่มเรียนที่ ${selectedGroup.group} (เกณฑ์ > 50%)`
                                    : "กรุณาเลือกกลุ่มเรียนด้านซ้าย"
                                }
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <RangePicker 
                                onChange={(dates) => setDateRange(dates)}
                                placeholder={['วันที่เริ่มต้น', 'วันที่สิ้นสุด']}
                                className="border-gray-300 rounded-lg hover:border-[#3D42D3] focus:border-[#3D42D3]"
                                format="DD/MM/YYYY"
                                allowClear
                            />
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-0 relative">
                        {loadingChart ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3D42D3]"></div>
                            </div>
                        ) : selectedGroup ? (
                            chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartData}
                                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                        barGap={8} 
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#6B7280', fontSize: 12 }} 
                                            dy={10} 
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#6B7280', fontSize: 12 }} 
                                            allowDecimals={false} // 🟢 ห้ามมีทศนิยม (นับคน)
                                            label={{ value: 'จำนวนคน', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                                        />
                                        <Tooltip 
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => `${value} คน`} // 🟢 หน่วยเป็นคน
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle"/>
                                        
                                        <Bar 
                                            dataKey="attentivePeople" 
                                            name="ตั้งใจเรียน" 
                                            fill="#38A738" 
                                            radius={[4, 4, 0, 0]} 
                                            barSize={30} 
                                        />
                                        <Bar 
                                            dataKey="inattentivePeople" 
                                            name="ไม่ตั้งใจ" 
                                            fill="#FF4D4F" 
                                            radius={[4, 4, 0, 0]} 
                                            barSize={30} 
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    <p>ไม่พบข้อมูลในช่วงวันที่เลือก</p>
                                </div>
                            )
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <Users className="w-10 h-10 mb-2 opacity-20" />
                                <p>เลือกกลุ่มเรียนเพื่อแสดงกราฟ</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};