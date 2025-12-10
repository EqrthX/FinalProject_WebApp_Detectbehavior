import React, { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
// ใช้ BarChart2 จาก lucide-react เพื่อไม่ให้ชื่อชนกับกราฟ
import { X, Users, Calendar, Clock, BookOpen, BarChart2 } from "lucide-react";
import { DatePicker } from "antd"; 
import { supabase } from "../config/supabase";
import dayjs from "dayjs"; 
import "dayjs/locale/th"; 

const { RangePicker } = DatePicker;

export const SubjectDetailModal = ({ isOpen, onClose, subject }) => {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  // --- 1. Fetch Groups (ดึงเฉพาะกลุ่มที่มีในตารางเรียน และต้องมีเลขกลุ่มชัดเจน) ---
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
            
            // ✅ กรอง: เอาเฉพาะที่มีเลขกลุ่ม (ไม่เอา null, ไม่เอาว่าง)
            const validGroups = data?.filter(g => g.group !== null && g.group !== "") || [];
            
            setGroups(validGroups);
            
            // เลือกกลุ่มแรกให้อัตโนมัติ
            if (validGroups.length > 0) setSelectedGroup(validGroups[0]);
            else setSelectedGroup(null);

        } catch (err) { console.error(err); } 
        finally { setLoadingGroups(false); }
      };
      fetchGroups();
    } else {
        setGroups([]); setSelectedGroup(null); setChartData([]); setDateRange(null);
    }
  }, [isOpen, subject]);

  // --- 2. Fetch & Calculate Chart Data (ดึงข้อมูลพฤติกรรม) ---
  useEffect(() => {
    if (selectedGroup && isOpen) {
      setLoadingChart(true);
      const fetchSummary = async () => {
        try {
            // 🟢 Query: ดึงข้อมูลจาก camera_daily_summary
            let query = supabase
                .from("camera_daily_summary") 
                .select("avg_attention, camera_id, group, teacher_id, summary_date") 
                .eq("subject_id", subject.code)
                .eq("group", selectedGroup.group)       // 1. ต้องตรงกับกลุ่มที่เลือก
                .eq("teacher_id", selectedGroup.teacher_id) // 2. ✅ สำคัญมาก: ต้องตรงกับอาจารย์ผู้สอนคนนี้เท่านั้น (ป้องกันข้อมูลของมานีหลุดมา)
                .not("group", "is", null);              // 3. ห้ามเป็นค่าว่างเด็ดขาด

            // กรองช่วงวันที่ (ถ้ามีการเลือก)
            if (dateRange && dateRange[0] && dateRange[1]) {
                query = query
                    .gte('summary_date', dateRange[0].format('YYYY-MM-DD'))
                    .lte('summary_date', dateRange[1].format('YYYY-MM-DD'));
            }

            const { data, error } = await query.order("summary_date", { ascending: true });
            
            if (error) throw error;

            if (!data || data.length === 0) { 
                setChartData([]); 
                return; 
            }

            // --- LOGIC: รวมคะแนนรายคน (1 camera_id = 1 คน) ---
            const studentsReport = {};

            data.forEach((item) => {
                const cameraKey = item.camera_id; 

                if (!studentsReport[cameraKey]) {
                    studentsReport[cameraKey] = { sumAttention: 0, count: 0 };
                }

                // รวมคะแนนสะสม
                studentsReport[cameraKey].sumAttention += Number(item.avg_attention || 0);
                studentsReport[cameraKey].count += 1;
            });

            // --- สรุปผลลัพธ์เป็น 1 จุดข้อมูล ---
            let attentiveCount = 0;
            let inattentiveCount = 0;

            Object.values(studentsReport).forEach((student) => {
                // หาค่าเฉลี่ย
                const avg = student.sumAttention / student.count;

                // เกณฑ์: >= 0.5 (50%) ถือว่าตั้งใจ
                if (avg >= 0.5) attentiveCount++; 
                else inattentiveCount++;
            });

            // ข้อมูลสำหรับกราฟ
            const summaryChartData = [{
                name: "ภาพรวม", 
                attentivePeople: attentiveCount,
                inattentivePeople: inattentiveCount,
                totalStudents: attentiveCount + inattentiveCount
            }];

            setChartData(summaryChartData);

        } catch (err) { 
            console.error("Error fetching summary:", err); 
            setChartData([]); 
        } finally { 
            setLoadingChart(false); 
        }
      };
      
      fetchSummary();
    }
  }, [selectedGroup, isOpen, subject, dateRange]); 

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
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                <Users className="w-8 h-8 mb-2 opacity-30" />
                                <p>ไม่พบข้อมูลกลุ่มเรียน</p>
                            </div>
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
                            <h3 className="font-bold text-lg text-gray-800">
                                สรุปภาพรวมพฤติกรรมสะสม
                            </h3>
                            <p className="text-sm text-gray-500">
                                {selectedGroup 
                                    ? `กลุ่มเรียนที่ ${selectedGroup.group}: ตัดสินจากคะแนนเฉลี่ยสะสมทุกคาบ (${chartData[0]?.totalStudents || 0} คน)`
                                    : "กรุณาเลือกกลุ่มเรียนด้านซ้ายเพื่อแสดงข้อมูล"
                                }
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <RangePicker 
                                onChange={(dates) => setDateRange(dates)}
                                placeholder={['เริ่มต้น', 'สิ้นสุด']}
                                className="border-gray-300 rounded-lg"
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
                                    {/* ✅ ปรับกราฟกลับเป็นแนวตั้ง และแยกแท่ง */}
                                    <BarChart
                                        data={chartData}
                                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                        // เอา layout="vertical" ออกเพื่อให้เป็นแนวตั้งปกติ
                                        barGap={20} // ระยะห่างระหว่างแท่งเขียวกับแดง
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        
                                        {/* แกน X คือชื่อ (ภาพรวม) */}
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#6B7280', fontSize: 14, fontWeight: 'bold' }} 
                                            dy={10} 
                                        />
                                        
                                        {/* แกน Y คือจำนวนคน */}
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#6B7280', fontSize: 12 }} 
                                            allowDecimals={false} 
                                            label={{ value: 'จำนวนคน', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                                        />
                                        
                                        <Tooltip 
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => [`${value} คน`]} 
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle"/>
                                        
                                        {/* เอา stackId ออกเพื่อให้แท่งแยกกัน */}
                                        <Bar 
                                            dataKey="attentivePeople" 
                                            name="ตั้งใจเรียน (>= 50%)" 
                                            fill="#38A738" 
                                            radius={[4, 4, 0, 0]} // มนหัวบน
                                            barSize={60} // ขนาดความกว้างแท่ง
                                        />
                                        <Bar 
                                            dataKey="inattentivePeople" 
                                            name="ไม่ตั้งใจ" 
                                            fill="#FF4D4F" 
                                            radius={[4, 4, 0, 0]} // มนหัวบน
                                            barSize={60} // ขนาดความกว้างแท่ง
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    <BarChart2 className="w-12 h-12 mb-3 opacity-20" />
                                    <p>ไม่พบข้อมูลการบันทึกของกลุ่มนี้</p>
                                </div>
                            )
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <Users className="w-10 h-10 mb-2 opacity-20" />
                                <p>เลือกกลุ่มเรียนเพื่อแสดงสรุปภาพรวม</p>
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