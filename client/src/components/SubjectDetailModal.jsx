import React, { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { X, Users, Calendar, Clock, BookOpen } from "lucide-react";
import { supabase } from "../config/supabase";
import dayjs from "dayjs"; // แนะนำให้ลง npm install dayjs เพิ่มเพื่อจัดการวันที่ง่ายขึ้น

// Helper: คำนวณสัปดาห์ที่เรียน (Week 1, Week 2...) จากวันที่
const getWeekLabel = (dateStr, startDate) => {
    const current = dayjs(dateStr);
    const start = dayjs(startDate);
    const diffWeeks = current.diff(start, 'week');
    return `สัปดาห์ที่ ${diffWeeks + 1}`;
};

export const SubjectDetailModal = ({ isOpen, onClose, subject }) => {
  // --- States ---
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);

  // --- 1. Fetch Groups (ดึงข้อมูลกลุ่มเรียน) ---
  useEffect(() => {
    if (isOpen && subject?.code) {
      setLoadingGroups(true);
      const fetchGroups = async () => {
        try {
            // ดึงข้อมูลกลุ่มเรียน + teacher_id เพื่อเอาไป query log ต่อ
            const { data, error } = await supabase
            .from("class_schedule")
            .select(`
                id: class_schedule_id, 
                group, day, start_time, end_time, 
                room, teacher_name, teacher_id, subject_id
            `)
            .eq("subject_id", subject.code) 
            .order("group", { ascending: true });

            if (error) throw error;

            setGroups(data || []);
            
            // เลือกกลุ่มแรกเป็น Default
            if (data && data.length > 0) {
                setSelectedGroup(data[0]);
            } else {
                setSelectedGroup(null);
            }
        } catch (err) {
            console.error("Error fetching groups:", err);
        } finally {
            setLoadingGroups(false);
        }
      };
      fetchGroups();
    } else {
        setGroups([]);
        setSelectedGroup(null);
        setChartData([]);
    }
  }, [isOpen, subject]);

  // --- 2. Fetch Chart Data (ดึงข้อมูลจริงจาก camera_logs) ---
  useEffect(() => {
    if (selectedGroup && isOpen) {
      setLoadingChart(true);
      const fetchLogs = async () => {
        try {
            // 1. ดึงข้อมูล Log ที่ตรงกับ วิชา และ อาจารย์ ของกลุ่มที่เลือก
            const { data, error } = await supabase
                .from("camera_logs")
                .select("created_at, Attention, Non_Attention")
                .eq("subject_id", subject.code) // ตรงกับวิชา
                .eq("teacher_id", selectedGroup.teacher_id) // ตรงกับอาจารย์ผู้สอนกลุ่มนี้
                .order("created_at", { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                setChartData([]);
                return;
            }

            // 2. ประมวลผลข้อมูล (Group by Week)
            // หา startDate (วันที่ log แรกเกิดขึ้น) เพื่อใช้นับสัปดาห์ที่ 1
            const startDate = data[0].created_at; 
            const groupedData = {};

            data.forEach((log) => {
                const weekLabel = getWeekLabel(log.created_at, startDate);

                if (!groupedData[weekLabel]) {
                    groupedData[weekLabel] = { 
                        sumAtt: 0, 
                        sumNon: 0, 
                        count: 0 
                    };
                }

                // แปลงค่า Attention/Non_Attention เป็นตัวเลข (เผื่อ DB เป็น string)
                groupedData[weekLabel].sumAtt += Number(log.Attention || 0);
                groupedData[weekLabel].sumNon += Number(log.Non_Attention || 0);
                groupedData[weekLabel].count += 1;
            });

            // 3. แปลงเป็น Format ของ Recharts (หาค่าเฉลี่ยต่อสัปดาห์)
            const formattedData = Object.keys(groupedData).map((key) => {
                const item = groupedData[key];
                return {
                    name: key,
                    // ปัดเศษทศนิยม
                    attentive: Math.round(item.sumAtt / item.count),
                    notAttentive: Math.round(item.sumNon / item.count),
                };
            });

            setChartData(formattedData);

        } catch (err) {
            console.error("Error fetching camera logs:", err);
            setChartData([]);
        } finally {
            setLoadingChart(false);
        }
      };

      fetchLogs();
    }
  }, [selectedGroup, isOpen, subject]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#f8f8f8] w-full max-w-5xl h-[85vh] rounded-[20px] shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-[#3D42D3] flex items-center gap-2">
                    <BookOpen className="w-6 h-6" />
                    {subject?.code} : {subject?.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1 ml-8">
                    หมวดหมู่: {subject?.category || "-"}
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
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="font-bold text-lg text-gray-800">สถิติความสนใจรายสัปดาห์</h3>
                            <p className="text-sm text-gray-500">
                                {selectedGroup 
                                    ? `กลุ่มเรียนที่ ${selectedGroup.group} (อ.${selectedGroup.teacher_name})`
                                    : "กรุณาเลือกกลุ่มเรียนด้านซ้าย"
                                }
                            </p>
                        </div>
                        <div className="flex gap-4 text-xs font-medium">
                            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#38A738]"></span> ตั้งใจ (เฉลี่ย)</div>
                            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#FF4D4F]"></span> ไม่ตั้งใจ (เฉลี่ย)</div>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-0 relative">
                        {loadingChart ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3D42D3]"></div>
                                    <p className="text-sm text-gray-500">กำลังประมวลผลข้อมูล...</p>
                                </div>
                            </div>
                        ) : null}

                        {selectedGroup ? (
                            chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartData}
                                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                        barSize={40}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                        <Tooltip 
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                                        />
                                        <Bar dataKey="attentive" name="ตั้งใจเรียน" stackId="a" fill="#38A738" radius={[0, 0, 4, 4]} />
                                        <Bar dataKey="notAttentive" name="ไม่ตั้งใจ" stackId="a" fill="#FF4D4F" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    <p>ยังไม่มีข้อมูลสถิติการเรียนสำหรับกลุ่มนี้</p>
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