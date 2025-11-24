import React, { useEffect, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import MyBreadcrumb from "../../components/MyBreadcrumb";
import axios from "../../util/axios";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

const RecordPage = () => {
    const navigate = useNavigate();
    const { subjectId } = useParams();
    const teacherId = localStorage.getItem("teacher_id")
    const [cameras, setCameras] = useState([]);
    const [frames, setFrames] = useState({});
    const [isRecording, setIsRecording] = useState(false);
    const [timer, setTimer] = useState(0);
    const [loading, setLoading] = useState(false);

    const wsRefs = useRef({});
    const summaryRefs = useRef({});
    const imgRef = useRef({});
    const canvasRef = useRef({});
    const scanningToastId = useRef(null);
    const retryInterval = useRef(null);
    const didInit = useRef(false);

    // ---------------------- Utils ----------------------
    const getCameraName = (id) => `กล้องตัวที่ ${Number(id) + 1}`;

    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
            2,
            "0"
        )}:${String(secs).padStart(2, "0")}`;
    };

    const safeCloseWS = (id) => {
        try {
            if (wsRefs.current[id]) {
                wsRefs.current[id].close();
                delete wsRefs.current[id];
            }
        } catch (e) {
            console.error("safeCloseWS error:", e);
        }
    };

    const safeCloseSummaryWS = (id) => {
        try {
            if (summaryRefs.current[id]) {
                summaryRefs.current[id].close();
                delete summaryRefs.current[id];
            }
        } catch (e) {
            console.error("safeCloseSummaryWS error:", e);
        }
    };

    // ---------------------- WebSocket: RAW/annotated stream ----------------------

    const connectDetectSocket = (cameraId) => {
        if (wsRefs.current[cameraId]) return;

        const base = import.meta.env.VITE_API_BASE;
        const wsProtocol = base.startsWith("https") ? "wss" : "ws";
        const wsBase = base.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}://${wsBase}/camera/ws/camera/${cameraId}?teacher_id=${teacher_id}&subject_id=${subjectId}`;

        console.log("🔌 connecting detect WS:", wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRefs.current[cameraId] = ws;

        ws.onopen = () => console.log(`📡 Detect WS opened cam ${cameraId}`);
        ws.onclose = () => {
            console.log(`Detect WS closed cam ${cameraId}`);
            delete wsRefs.current[cameraId];
        };

        ws.onerror = (err) => console.error("Detect WS error", err);

        ws.onmessage = (event) => {
            const base64Image = event.data;
            const canvas = canvasRef.current[cameraId];
            if (!canvas) return;

            const ctx = canvas.getContext("2d");
            const img = new Image();
            img.src = "data:image/jpeg;base64," + base64Image;

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
            };
        };
    };

    const connectWebSocket = (cameraId) => {
        const base = import.meta.env.VITE_API_BASE;
        const wsProtocol = base.startsWith("https") ? "wss" : "ws"; // ซ้ำ 
        const wsBase = base.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}://${wsBase}/camera/ws/camera/${cameraId}`
            + `?teacher_id=${teacherId}&subject_id=${subjectId}`;

        console.log("[connectWebSocket] connecting", wsUrl);

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("✅ WS เปิดสำหรับกล้อง", Number(cameraId) + 1);
        };

        ws.onerror = (err) => {
            console.error("[connectWebSocket] error", err);
        };

        ws.onclose = () => {
            console.log("🔌 WS ปิดสำหรับกล้อง", Number(cameraId) + 1);
        };

        ws.onmessage = (event) => {
            if (typeof event.data === "string" && event.data.startsWith("error:")) {
                console.error(`Camera ${getCameraName(cameraId)} error:`, event.data);
                return;
            }

            if (!imgRef.current[cameraId]) {
                imgRef.current[cameraId] = new Image();
            }

            const imageSrc = "data:image/jpeg;base64," + event.data;
            const img = imgRef.current[cameraId];

            img.onload = () => {
                const canvas = canvasRef.current[cameraId];
                if (!canvas) return;

                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };

            img.src = imageSrc;

            setFrames((prev) => ({ ...prev, [cameraId]: event.data }));
        };

        wsRefs.current[cameraId] = ws;
    };

    // ---------------------- WebSocket: Summary ----------------------
    const connectSummarySocket = (cameraId) => {
        const base = import.meta.env.VITE_API_BASE;
        const wsProtocol = base.startsWith("https") ? "wss" : "ws";
        const wsBase = base.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}://${wsBase}/camera/ws/camera/summary/${cameraId}`;

        console.log("[connectSummarySocket] connecting", wsUrl);

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("✅ Summary WS open for camera", Number(cameraId) + 1);
        };
        ws.onerror = (err) => {
            console.error("[Summary WS] error", err);
        };
        ws.onclose = () => {
            console.log("🔌 Summary WS closed for camera", Number(cameraId) + 1);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("📊 Summary from camera", Number(cameraId) + 1, data);
                // ถ้าอยากแสดงผลแบบ real-time หน้าเว็บ สามารถ setState เพิ่มตรงนี้
            } catch (e) {
                console.error("Summary parse error:", e, event.data);
            }
        };

        summaryRefs.current[cameraId] = ws;
    };

    // ---------------------- โหลด list-camera ----------------------
    useEffect(() => {
        const initCameras = async () => {
            try {
                setLoading(true);
                const res = await axios.get("camera/list-camera", {
                    headers: { "Cache-Control": "no-cache" },
                });

                const list = res.data.cameras || [];
                setCameras(list);
                setLoading(false);

                if (list.length === 0) {
                    if (!scanningToastId.current) {
                        scanningToastId.current = toast.loading("กำลังสแกนกล้อง...");
                    }
                    if (!retryInterval.current) {
                        retryInterval.current = setInterval(initCameras, 3000);
                    }
                    return;
                }

                // ถ้ามีกล้องแล้ว
                if (retryInterval.current) {
                    clearInterval(retryInterval.current);
                    retryInterval.current = null;
                }
                if (scanningToastId.current) {
                    toast.dismiss(scanningToastId.current);
                    scanningToastId.current = null;
                }

                if (!didInit.current) {
                    didInit.current = true;
                }
            } catch (err) {
                setLoading(false);
                console.error("❌ โหลดกล้องล้มเหลว:", err);
                toast.error("เกิดข้อผิดพลาดขณะโหลดกล้อง");
            }
        };

        initCameras();

        return () => {
            if (retryInterval.current) clearInterval(retryInterval.current);
            if (scanningToastId.current) toast.dismiss(scanningToastId.current);
        };
    }, []);

    // เมื่อ cameras ถูกเซ็ตครั้งแรก → เปิด stream สำหรับทุกกล้อง
    // เมื่อ cameras ถูกเซ็ต → เปิด WS สำหรับทุกกล้องทันที
    useEffect(() => {
        if (!cameras || cameras.length === 0) return;

        cameras.forEach(cam => {
            connectWebSocket(cam.id);      // stream raw
            connectDetectSocket(cam.id);  // stream bounding box
        });

        toast.success("เปิดกล้องทั้งหมดแล้ว!");
    }, [cameras]);


    // cleanup ตอนออกจากหน้า
    useEffect(() => {
        return () => {
            console.log("Cleanup: ปิด WS ทั้งหมด");
            Object.keys(wsRefs.current).forEach((cameraId) => safeCloseWS(cameraId));
            Object.keys(summaryRefs.current).forEach((cameraId) =>
                safeCloseSummaryWS(cameraId)
            );

            try {
                axios.get("camera/close-all");
                console.log("Cleanup: เรียก API ปิดกล้องทั้งหมด");
            } catch (error) {
                console.error("ปิดกล้องทั้งหมดก่อนออกจาก Record ไม่สำเร็จ", error);
            }
        };
    }, []);

    // ---------------------- ปุ่มต่าง ๆ ----------------------
    const handleReconnect = async (cameraId) => {
        try {
            await axios.get("camera/open-all"); // ถ้ามี endpoint นี้ในหลังบ้าน
            connectWebSocket(cameraId);
            toast.success(`เชื่อมต่อใหม่ กล้อง ${getCameraName(cameraId)} แล้ว`);
        } catch {
            toast.error(`เชื่อมต่อใหม่กล้อง ${getCameraName(cameraId)} ไม่สำเร็จ`);
        }
    };

    const handleCloseCamera = async (cameraId) => {
        try {
            await axios.get(`camera/close-camera/${cameraId}`);
            safeCloseWS(cameraId);
            safeCloseSummaryWS(cameraId);
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

    const handleCloseAll = async () => {
        setIsRecording(false);
        setTimer(0);
        try {
            Object.keys(wsRefs.current).forEach((id) => safeCloseWS(id));
            Object.keys(summaryRefs.current).forEach((id) => safeCloseSummaryWS(id));

            await axios.get("camera/close-all");
            setFrames({});
            toast.success("ปิดกล้องทั้งหมดแล้ว");
        } catch {
            toast.error("ปิดกล้องทั้งหมดไม่สำเร็จ");
        }
    };

    // เริ่ม detect ทุกกล้อง
    const handleStartDetect = async () => {
        if (isRecording) return;

        setIsRecording(true);
        try {
            const resStartDetect = await axios.get(`camera/start-all`);
            const started_ids = resStartDetect.data.started || [];

            started_ids.forEach((id) => {
                connectSummarySocket(id);
                connectDetectSocket(id);
                // ไม่ใช้ detect socket แยกแล้ว เพราะ camera_ws ส่ง annotated อยู่แล้ว
            });

            toast.success(`เริ่มตรวจจับทุกกล้อง`);
        } catch (error) {
            setIsRecording(false);
            console.error("การตรวจจับเกิดข้อผิดพลาด", error);
            toast.error("เริ่มต้นตรวจจับไม่สำเร็จ");
        }
    };

    // หยุด detect
    const handleStopDetect = async (e) => {
        e.preventDefault();

        if (!isRecording) return;

        setIsRecording(false);
        setTimer(0);

        try {
            await axios.get(`camera/stop-all`);
            const summaryRes = await axios.get(`camera/summary-to-supabase`);
            console.log("Summary Done:", summaryRes.data);

            await new Promise((resolve) => setTimeout(resolve, 800));

            Object.keys(summaryRefs.current).forEach((id) =>
                safeCloseSummaryWS(id)
            );

            toast.success(`หยุดการตรวจจับทุกกล้อง`);
            navigate("/user/summarize/");
        } catch (error) {
            console.error("การหยุดตรวจจับเกิดข้อผิดพลาด", error);
            toast.error("หยุดการตรวจจับไม่สำเร็จ");
        }
    };

    // ---------------------- Timer ----------------------
    useEffect(() => {
        let intervalId;
        if (isRecording) {
            intervalId = setInterval(() => setTimer((t) => t + 1), 1000);
        }
        return () => intervalId && clearInterval(intervalId);
    }, [isRecording]);

    // ---------------------- UI ----------------------
    return (
        <>
            <Navbar />
            <div className="p-4 sm:p-6 md:p-8 lg:p-10">
                <MyBreadcrumb />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* กล่องซ้าย */}
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
                                <div>
                                    <div className="text-sm text-gray-500">สถานะการตรวจจับ</div>
                                    <div className="font-semibold text-gray-800">
                                        {isRecording ? "กำลังตรวจจับ" : "พร้อมเริ่มต้น"}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-sm text-gray-500">ระยะเวลาบันทึก</div>
                                <div className="text-2xl font-mono font-bold">
                                    {formatTime(timer)}
                                </div>
                            </div>
                        </div>

                        {/* ปุ่มควบคุม */}
                        <div className="flex flex-wrap gap-3 mb-4">
                            <button
                                className={`px-4 py-2 rounded-lg text-white font-semibold ${isRecording ? "bg-gray-400 cursor-not-allowed" : "bg-green-500"
                                    }`}
                                disabled={isRecording}
                                onClick={handleStartDetect}
                            >
                                เริ่มต้นตรวจจับทุกกล้อง
                            </button>

                            <button
                                className={`px-4 py-2 rounded-lg text-white font-semibold ${!isRecording ? "bg-gray-400 cursor-not-allowed" : "bg-red-500"
                                    }`}
                                disabled={!isRecording}
                                onClick={handleStopDetect}
                            >
                                จบการตรวจจับ
                            </button>

                            <button
                                className="px-4 py-2 rounded-lg font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100"
                                onClick={handleCloseAll}
                            >
                                ปิดกล้องทั้งหมด
                            </button>
                        </div>

                        {/* Grid แสดงกล้อง */}
                        {loading && (
                            <div className="text-center text-gray-500 my-6">
                                กำลังโหลดรายการกล้อง...
                            </div>
                        )}

                        {!loading && cameras.length === 0 && (
                            <div className="text-center text-gray-500 my-6">
                                ไม่พบกล้องในระบบ กำลังสแกน...
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {cameras.map((cam) => (
                                <div
                                    key={cam.id}
                                    className="border border-gray-300 rounded-2xl p-3 flex flex-col items-center bg-white shadow-sm"
                                >
                                    <h3 className="font-semibold text-lg mb-2 text-center">
                                        {cam.name || getCameraName(cam.id)}
                                    </h3>
                                    <div className="w-full aspect-video bg-black rounded-xl overflow-hidden mb-3 flex items-center justify-center">
                                        <canvas
                                            ref={(el) => (canvasRef.current[cam.id] = el)}
                                            width={640}
                                            height={360}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <div className="flex gap-2 w-full">
                                        <button
                                            className="flex-1 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 text-sm"
                                            onClick={() => handleReconnect(cam.id)}
                                        >
                                            เชื่อมต่อใหม่
                                        </button>
                                        <button
                                            className="flex-1 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 text-sm"
                                            onClick={() => handleCloseCamera(cam.id)}
                                        >
                                            ปิดตัวนี้
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* กล่องขวา (จะใช้แสดง summary, log, ฯลฯ ได้ภายหลัง) */}
                    <div className="bg-white rounded-2xl shadow p-4 sm:p-6 border border-gray-200">
                        <h2 className="text-lg font-semibold mb-3">ข้อมูลสรุประหว่างสอน</h2>
                        <p className="text-sm text-gray-500">
                            ตอนนี้ยังแสดงเฉพาะ log ใน console (Summary WS). ถ้าต้องการให้ดึงค่า
                            Attention / Non-Attention มาแสดงเป็นกราฟ realtime
                            สามารถเพิ่มการจัดเก็บ state ในฟังก์ชัน <code>connectSummarySocket</code>{" "}
                            ได้เลย
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default RecordPage;
