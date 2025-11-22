import React, { useState, useEffect, useRef } from "react";
// 1. นำเข้า useParams
import { useParams, Link, useNavigate } from "react-router-dom"; 
import Navbar from "../../components/Navbar";
import MyBreadcrumb from "../../components/MyBreadcrumb";
import axios from "../../util/axios";
import toast from "react-hot-toast";

const Record = () => {
    const { subjectId } = useParams();
    const navigate = useNavigate();

    // ** States **
    const [isRecording, setIsRecording] = useState(false);
    const [timer, setTimer] = useState(0);
    const [detections, setDetections] = useState([]);
    const [cameras, setCameras] = useState([]);
    const [loading, setLoading] = useState(false); // สถานะโหลดกล้อง
    const [frames, setFrames] = useState({});
    
    // ** Refs **
    const wsRefs = useRef({});
    const summaryRefs = useRef({});
    const didInit = useRef(false);
    const retryInterval = useRef(null);
    const scanningToastId = useRef(null);

    // ** ข้อมูล Mock เพื่อแสดงใน Info bar **
    const mockSubjectDetails = {
        'SI235-1': { group: '1', room: '7501', time: '12:20 - 16:10' },
        'SI230-1': { group: '1', room: '5401', time: '08:30 - 11:00' },
    };

    const details = mockSubjectDetails[subjectId] || { group: 'N/A', room: 'N/A', time: 'N/A' };
    
    // ---------- Utility ----------
    
    /** หาชื่อกล้องจาก ID ที่ได้รับจาก WebSocket */
    const getCameraName = (id) => {
        const cam = cameras.find(c => c.id.toString() === id.toString());
        return cam ? cam.name : `กล้อง ID: ${id}`;
    };

    /** ปิด WebSocket อย่างปลอดภัย */
    const safeCloseWS = (id) => {
        try {
            if (wsRefs.current[id]) {
                wsRefs.current[id].close();
                delete wsRefs.current[id];
            }
        } catch (_) { /* ignore */ }
    };
    
    /** ปิด Summary WebSocket อย่างปลอดภัย */
    const safeCloseSummaryWS = (id) => {
        try {
            if (summaryRefs.current[id]) {
                summaryRefs.current[id].close();
                delete summaryRefs.current[id];
            }
        } catch (_) { /* ignore */ }
    };

    /** เชื่อมต่อ WebSocket สำหรับรับ Summary (Log การตรวจจับ) */
    const connectSummarySocket = (cameraId) => {
        if (summaryRefs.current[cameraId]) return;

        const base = import.meta.env.VITE_API_BASE;
        const wsProtocol = base.startsWith("https") ? "wss" : "ws";
        const wsBase = base.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}://${wsBase}/camera/ws/camera/summary/${cameraId}`;
        const ws = new WebSocket(wsUrl);

        summaryRefs.current[cameraId] = ws;
        const camName = getCameraName(cameraId);

        ws.onopen = () => console.log(`📊 Summary WS connected: ${camName}`);
        ws.onclose = () => {
            console.log(`Summary WS closed: ${camName}`);
            delete summaryRefs.current[cameraId];
        };
        ws.onerror = (err) => console.error("Summary WS error:", err);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // data = { CameraId, ID, Time, avg, maybe class_behavior }
                setDetections((prev) => [
                    {
                        // ใช้ CameraId จาก Backend ซึ่งควรตรงกับ cameraId ใน frames
                        cameraId: data.CameraId, 
                        id: data.ID,
                        time: data.Time || new Date().toLocaleTimeString(),
                        image: frames[cameraId]
                            ? `data:image/jpeg;base64,${frames[cameraId]}`
                            : null,
                    },
                    ...prev,
                ]);
            } catch (err) {
                console.error("⚠️ summary parse error:", err);
            }
        };
    };

    /** เชื่อมต่อ WebSocket สำหรับรับ Frame (ภาพวิดีโอ) */
    const connectWebSocket = (cameraId) => {
        if (wsRefs.current[cameraId]) return;

        const base = import.meta.env.VITE_API_BASE;
        const wsProtocol = base.startsWith("https") ? "wss" : "ws";
        const wsBase = base.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}://${wsBase}/camera/ws/camera/${cameraId}`;
        const ws = new WebSocket(wsUrl);
        const camName = getCameraName(cameraId);

        wsRefs.current[cameraId] = ws;

        ws.onopen = () => console.log(`✅ WS connected: ${camName}`);
        ws.onclose = () => {
            console.log(`WS closed: ${camName}`);
            delete wsRefs.current[cameraId];
        };
        ws.onerror = (e) => {
            console.error(`WS error cam ${camName}`, e);
            toast.error(`สตรีมกล้อง ${camName} มีปัญหา`);
        };
        ws.onmessage = (event) => {

            if (typeof event.data === "string" && event.data.startsWith("error:")) {
                console.error(`Camera ${camName}: ${event.data}`);
                return;
            }
            setFrames((prev) => ({ ...prev, [cameraId]: event.data }));
        };
    };

    // ---------- เปิดกล้องทั้งหมด (เมื่อเข้าหน้าครั้งแรก) ----------
    useEffect(() => {
        const initCameras = async () => {
            try {
                // 1. ดึงรายการกล้อง
                const res = await axios.get("camera/list-camera", {
                    headers: { "Cache-Control": "no-cache" },
                });
                const list = res.data.cameras || [];
                setCameras(list);

                // 2. จัดการ Retry หากไม่พบกล้อง
                if (list.length === 0) {
                    if (!scanningToastId.current) {
                        scanningToastId.current = toast.loading("กำลังสแกนกล้อง...");
                    }
                    if (!retryInterval.current) {
                        retryInterval.current = setInterval(initCameras, 3000);
                    }
                    return;
                }

                // 3. ถ้าพบกล้องแล้ว ยกเลิก Retry และ Toast
                if (retryInterval.current) {
                    clearInterval(retryInterval.current);
                    retryInterval.current = null;
                }
                toast.dismiss(scanningToastId.current);
                scanningToastId.current = null

                // 4. เปิดกล้องทั้งหมด (ทำแค่รอบแรกเท่านั้น)
                if (!didInit.current) {
                    didInit.current = true; // ✅ กันซ้ำเฉพาะเปิดกล้องรอบแรก
                    await axios.get(`camera/open-all?subjectId=${subjectId}`, { timeout: 60000 });
                    list.forEach((cam) => connectWebSocket(cam.id));
                    toast.success("เปิดกล้องทั้งหมดแล้ว!");
                }

            } catch (err) {
                console.error("❌ โหลดกล้องล้มเหลว:", err);
                toast.error("เกิดข้อผิดพลาดขณะโหลดกล้อง");
            }
        };

        // ✅ เริ่มต้นเรียกครั้งแรก
        initCameras();

        // ✅ cleanup (ยกเลิกการ retry เมื่อ unmount)
        return () => {
            if (retryInterval.current) clearInterval(retryInterval.current);
            toast.dismiss(scanningToastId.current);
        };
    }, []);


    // ---------- ออกจากหน้านี้ให้ปิดกล้องทั้งหมด (Unmount cleanup) ----------
    useEffect(() => {
        return () => {
            console.log("Cleanup: ปิด WS ทั้งหมด");

            // ปิด Video Streams (WS)
            Object.keys(wsRefs.current).forEach((cameraId) => safeCloseWS(cameraId));

            // ปิด Summary Streams (WS)
            Object.keys(summaryRefs.current).forEach((cameraId) => safeCloseSummaryWS(cameraId));

            // ปิดกล้องที่ Backend 
            try {
                // ไม่จำเป็นต้อง await ใน cleanup แต่เรียกให้ทำงานแบบ fire-and-forget
                axios.get("camera/close-all"); 
                console.log("Cleanup: เรียก API ปิดกล้องทั้งหมด");
            } catch (error) {
                console.error("ปิดกล้องทั้งหมดก่อนออกจาก Record นี้ไม่สำเร็จ", error)
            }
        }
    }, [])

    // ---------- ปุ่ม Actions ----------

    // เชื่อมต่อกล้องใหม่
    const handleReconnect = async (cameraId) => {
        try {
            // เรียก open-all เพื่อให้แน่ใจว่า API เปิดอยู่
            await axios.get(`camera/open-all`); 
            connectWebSocket(cameraId);
            toast.success(`เชื่อมต่อใหม่ กล้อง ${getCameraName(cameraId)} แล้ว`);
        } catch {
            toast.error(`เชื่อมต่อใหม่กล้อง ${getCameraName(cameraId)} ไม่สำเร็จ`);
        }
    };

    // ปิดกล้องเฉพาะตัว
    const handleCloseCamera = async (cameraId) => {
        // ไม่ต้อง setIsRecording(false) ที่นี่ เพราะการปิดตัวเดียวไม่ใช่การจบการบันทึก
        try {
            await axios.get(`camera/close-camera/${cameraId}`);
            safeCloseWS(cameraId);
            safeCloseSummaryWS(cameraId); // ปิด summary ของกล้องนี้ด้วย
            setFrames((prev) => {
                const n = { ...prev };
                delete n[cameraId];
                return n;
            });
            toast.success(`ปิดกล้อง ${getCameraName(cameraId)} แล้ว`);
        } catch (err) {
            toast.error("ปิดกล้องไม่สำเร็จ");
            console.error("ปิดกล้องไม่สำเร็จ :", err);
        }
    };

    // ปิดกล้องทั้งหมด (ปุ่มปิดทั้งหมด)
    const handleCloseAll = async () => {
        setIsRecording(false); // หยุดสถานะการบันทึก
        setTimer(0); // รีเซ็ต Timer 
        try {
            // ปิด WS และ Summary WS ทั้งหมด
            Object.keys(wsRefs.current).forEach((id) => safeCloseWS(id));
            Object.keys(summaryRefs.current).forEach((id) => safeCloseSummaryWS(id));

            await axios.get("camera/close-all");
            setFrames({});
            toast.success("ปิดกล้องทั้งหมดแล้ว");
        } catch {
            toast.error("ปิดกล้องทั้งหมดไม่สำเร็จ");
        }
    };

    // เริ่มต้นตรวจจับ
    const handleStartDetect = async () => { 
        if (isRecording) return;

        setIsRecording(true);
        try {
            const resStartDetect = await axios.get(`camera/start-all`)
            console.log(resStartDetect);
            const started_ids = resStartDetect.data.started || []
            
            // เชื่อมต่อ Summary Socket สำหรับกล้องที่เริ่มตรวจจับแล้ว
            started_ids.forEach(id => connectSummarySocket(id));

            toast.success(`เริ่มตรวจจับทุกกล้อง`);

        } catch (error) {
            setIsRecording(false); // ถ้า Start ไม่สำเร็จ ให้ตั้งค่ากลับ
            console.error("การตรวจจับเกิดข้อผิดพลาด", error)
            toast.error("เริ่มต้นตรวจจับไม่สำเร็จ");
        }
    }

    // หยุดการตรวจจับ (จบการบันทึก)
    const handleStopDetect = async (e) => {
        e.preventDefault();
        
        if (!isRecording) return;
        
        setIsRecording(false);
        setTimer(0); 

        try {
            // 1. หยุด detection บน backend
            await axios.get(`camera/stop-all`);
            
            const summaryRes = await axios.get(`camera/summary-to-supabase`)
            // 2. แสดงข้อมูลหลังจากบันทึลง supabasee
            console.log("Summary Done:", summaryRes.data);
            
            // 3. หน่วงเวลา รอให้หลังบ้าน cleans up (0.5 - 1s)
            await new Promise(resolve => setTimeout(resolve, 800));

            // 4. ปิด Summary WebSockets ทั้งหมด
            Object.keys(summaryRefs.current).forEach((id) => safeCloseSummaryWS(id));
            
            toast.success(`หยุดการตรวจจับทุกกล้อง`);

            navigate("/user/summarize/")
        } catch (error) {
            console.error("การหยุดตรวจจับเกิดข้อผิดพลาด", error);
            toast.error("หยุดการตรวจจับไม่สำเร็จ");
        }
    };

    // ---------- จับเวลา ----------
    useEffect(() => {
        let intervalId;
        if (isRecording) {
            intervalId = setInterval(() => setTimer((t) => t + 1), 1000);
        }
        return () => intervalId && clearInterval(intervalId);
    }, [isRecording]);

    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
            2,
            "0"
        )}:${String(secs).padStart(2, "0")}`;
    };

    // ---------- UI ----------
    return (
        <>
            <Navbar />
            <div className="p-4 sm:p-6 md:p-8 lg:p-10">
                <MyBreadcrumb />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ✅ กล่องซ้าย */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 sm:p-6 border border-gray-200">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
                            <div className="flex items-center space-x-3">
                                <div
                                    className={`w-5 h-5 rounded-full ring-2 ring-offset-2 ${isRecording ? "ring-red-300" : "ring-green-300"
                                        } flex items-center justify-center`}
                                >
                                    <div
                                        className={`w-3.5 h-3.5 rounded-full ${isRecording
                                                ? "bg-red-500 animate-pulse"
                                                : "bg-green-500"
                                            }`}
                                    />
                                </div>
                                <h2 className="text-lg font-semibold">
                                    ตรวจจับพฤติกรรม
                                    {/* 📌 แสดงรหัสวิชาที่รับมา */}
                                    <span className="ml-3 text-blue-700 font-bold text-xl">
                                        {subjectId}
                                    </span>
                                </h2>
                            </div>

                            <button
                                onClick={handleCloseAll}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 text-sm sm:text-base"
                                disabled={loading}
                            >
                                ปิดทั้งหมด
                            </button>
                        </div>

                        {/* Info bar */}
                        <div className="flex flex-wrap justify-center gap-4 text-gray-700 text-sm sm:text-base mb-6">
                            <span className="font-medium">🕒 {formatTime(timer)}</span>
                            {/* 📌 แสดงรหัสวิชาและรายละเอียดที่รับมา */}
                            <span className="font-bold">รหัสวิชา: {subjectId}</span>
                            <span>กลุ่ม: {details.group}</span>
                            <span>ห้อง: {details.room}</span>
                            <span>เวลา: {details.time}</span>
                        </div>

                        {/* ✅ กลุ่มกล้อง */}
                        {cameras.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                {cameras.map((cam) => (
                                    <div
                                        key={cam.id}
                                        className="border rounded-2xl p-4 shadow-sm bg-white flex flex-col items-center transition hover:shadow-md"
                                    >
                                        <h3 className="font-semibold text-lg mb-2">{cam.name}</h3>
                                        <div className="w-full aspect-video bg-black rounded-lg flex items-center justify-center">
                                            {frames[cam.id] ? (
                                                <img
                                                    src={`data:image/jpeg;base64,${frames[cam.id]}`}
                                                    alt={`Camera ${cam.id}`}
                                                    className="w-full h-full object-contain rounded-lg"
                                                />
                                            ) : (
                                                <p className="text-white text-sm opacity-70">
                                                    กำลังเชื่อมต่อ...
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => handleReconnect(cam.id)}
                                                className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                            >
                                                เชื่อมต่อใหม่
                                            </button>
                                            <button
                                                onClick={() => handleCloseCamera(cam.id)}
                                                className="px-3 py-2 text-sm rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                                            >
                                                ปิดตัวนี้
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-8">
                                {loading ? "กำลังค้นหากล้อง..." : "ไม่มีกล้องที่เชื่อมต่อ"}
                            </p>
                        )}
                    </div>

                    {/* ✅ ฝั่งขวา (log ตรวจจับ) */}
                    <div className="bg-white rounded-2xl shadow flex flex-col border border-gray-200 h-[500px]">
                        <h1 className="text-center py-4 text-lg font-bold border-b md:text-3xl">
                            พฤติกรรม
                        </h1>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {detections.length === 0 ? (
                                <div className="text-center text-gray-400 mt-6">
                                    <p>ยังไม่มีการตรวจจับ</p>
                                </div>
                            ) : (
                                detections.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex justify-between items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-center overflow-y-auto"
                                    >
                                        <h1 className="text-lg font-medium text-gray-700">
                                            {getCameraName(item.cameraId)} 
                                        </h1>

                                        <div className="w-24 h-24 bg-gray-300 rounded-lg overflow-hidden">
                                            <img
                                                src={item.image}
                                                alt={item.time}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        <p className="text-sm font-medium text-gray-700">
                                            เวลา {item.time}
                                        </p>
                                    </div>

                                ))
                            )}
                        </div>

                        {/* ปุ่ม */}
                        <div className="flex flex-wrap justify-center gap-3 py-4 border-t">
                            <button
                                onClick={handleStartDetect} 
                                disabled={isRecording}
                                className={`px-5 py-3 rounded-lg font-semibold text-sm sm:text-base ${isRecording
                                        ? "bg-gray-400 text-white cursor-not-allowed"
                                        : "bg-blue-900 text-white hover:bg-[#38A738]"
                                    }`}
                            >
                                เริ่มต้นบันทึก
                            </button>
                            <Link 
                                // to={`/user/summarize/${subjectId}`} 
                                onClick={handleStopDetect} // 📌 เรียก API หยุดการตรวจจับก่อนนำทาง
                            >
                                <button
                                    disabled={!isRecording}
                                    className={`px-5 py-3 rounded-lg font-semibold text-sm sm:text-base ${!isRecording
                                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                            : "bg-[#FDEEED] text-[#74393C] hover:bg-red-600 hover:text-white"
                                        }`}
                                >
                                    จบการบันทึก
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Record;