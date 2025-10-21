import React, { useState, useEffect, useRef } from "react";
import Navbar from "../../components/Navbar";
import MyBreadcrumb from "../../components/MyBreadcrumb";
import { Link } from "react-router-dom";
import axios from "../../util/axios";
import toast from "react-hot-toast";

const Record = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [timer, setTimer] = useState(0);
    const [detections, setDetections] = useState([]);
    const [cameras, setCameras] = useState([]);
    const [loading, setLoading] = useState(false);

    const [frames, setFrames] = useState({});
    const wsRefs = useRef({});

    const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

    const safeCloseWS = (id) => {
        try {
            if (wsRefs.current[id]) {
                wsRefs.current[id].close();
                delete wsRefs.current[id];
            }
        } catch (_) { }
    };

    const connectWebSocket = (cameraId) => {
        if (wsRefs.current[cameraId]) return;
        const wsUrl = `${import.meta.env.VITE_API_BASE.replace("http", "ws")}/camera/ws/camera/${cameraId}`;
        const ws = new WebSocket(wsUrl);
        wsRefs.current[cameraId] = ws;

        ws.onopen = () => console.log(`✅ WS connected: camera ${cameraId}`);
        ws.onclose = () => {
            console.log(`🔌 WS closed: camera ${cameraId}`);
            delete wsRefs.current[cameraId];
        };
        ws.onerror = (e) => {
            console.error(`WS error cam ${cameraId}`, e);
            toast.error(`สตรีมกล้อง ${cameraId} มีปัญหา`);
        };
        ws.onmessage = (event) => {
            if (typeof event.data === "string" && event.data.startsWith("error:")) return;
            setFrames((prev) => ({ ...prev, [cameraId]: event.data }));
        };
    };

    useEffect(() => {
        const initCameras = async () => {
            try {
                const res = await axios.get("camera/list-camera");
                const list = res.data.cameras || [];
                setCameras(list);

                if (list.length === 0) {
                    toast.error("ไม่พบกล้องในระบบ");
                    return;
                }

                await axios.get("camera/open-all");
                toast.success(`เปิดกล้องทั้งหมด (${list.length}) แล้ว!`);
                list.forEach((cam) => connectWebSocket(cam.id));
            } catch (err) {
                console.error(err);
                toast.error("เกิดข้อผิดพลาดขณะโหลดกล้อง");
            }
        };

        initCameras();
        return () => {
            Object.values(wsRefs.current).forEach((ws) => ws.close());
            axios.get("camera/close-all").catch(() => { });
        };
    }, []);

    const handleCloseCamera = async (id) => {
        try {
            await axios.get(`camera/close-camera/${id}`);
            safeCloseWS(id);
            setFrames((prev) => {
                const n = { ...prev };
                delete n[id];
                return n;
            });
            toast.success(`ปิดกล้อง ${id} แล้ว`);
        } catch {
            toast.error("ปิดกล้องไม่สำเร็จ");
        }
    };

    const handleReconnect = async (id) => {
        try {
            await axios.get(`camera/open-all`);
            connectWebSocket(id);
            toast.success(`เชื่อมต่อใหม่ กล้อง ${id} แล้ว`);
        } catch {
            toast.error(`เชื่อมต่อใหม่กล้อง ${id} ไม่สำเร็จ`);
        }
    };

    const handleCloseAll = async () => {
        try {
            Object.keys(wsRefs.current).forEach((id) => safeCloseWS(id));
            await axios.get("camera/close-all");
            setFrames({});
            toast.success("ปิดกล้องทั้งหมดแล้ว");
        } catch {
            toast.error("ปิดกล้องทั้งหมดไม่สำเร็จ");
        }
    };

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

    return (
        <>
            <Navbar />
            <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
                <MyBreadcrumb />

                {/* 🧱 Layout หลัก */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    {/* กล่องซ้าย (2 ใน 3 ส่วน) */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 sm:p-6 md:p-8 border border-gray-200">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                            <div className="flex items-center space-x-3">
                                <div
                                    className={`w-5 h-5 rounded-full ring-2 ring-offset-2 ${isRecording ? "ring-red-300" : "ring-green-300"
                                        } flex items-center justify-center`}
                                >
                                    <div
                                        className={`w-4 h-4 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-green-500"
                                            }`}
                                    />
                                </div>
                                <h2 className="text-lg md:text-xl font-semibold">
                                    ตรวจจับพฤติกรรม
                                </h2>
                            </div>

                            <button
                                onClick={handleCloseAll}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm md:text-base"
                                disabled={loading}
                            >
                                ปิดทั้งหมด
                            </button>
                        </div>

                        {/* Info bar */}
                        <div className="flex flex-wrap items-center justify-center text-sm md:text-base text-gray-700 gap-3 md:gap-10 mb-6">
                            <span className="font-medium">{formatTime(timer)}</span>
                            <span>SI235-1</span>
                            <span>กลุ่ม 1</span>
                            <span>ห้อง 7501</span>
                            <span>เวลา 12:20 - 16:10</span>
                        </div>

                        {/* กล้อง */}
                        {cameras.length > 0 ? (
                            <div
                                className="grid
                            grid-cols-1
                            sm:grid-cols-2
                            md:grid-cols-2
                            xl:grid-cols-3
                            2xl:grid-cols-4
                            gap-8
                            justify-items-center"
                            >
                                {cameras.map((cam) => (
                                    <div
                                        key={cam.id}
                                        className="border rounded-3xl shadow-lg bg-white flex flex-col items-center
                               p-5 sm:p-6 md:p-8 xl:p-10
                               hover:shadow-2xl transition-all duration-300 w-full sm:w-[90%] md:w-[85%]"
                                    >
                                        <h3 className="font-semibold text-lg md:text-xl xl:text-2xl mb-4 text-center">
                                            {cam.name}
                                        </h3>

                                        <div
                                            className="w-full max-w-[480px] xl:max-w-[600px]
                                 aspect-[4/3]
                                 border-2 border-gray-200 rounded-2xl 
                                 flex items-center justify-center bg-black"
                                        >
                                            {frames[cam.id] ? (
                                                <img
                                                    src={`data:image/jpeg;base64,${frames[cam.id]}`}
                                                    alt={`Camera ${cam.id}`}
                                                    className="w-full h-full object-contain rounded-xl"
                                                />
                                            ) : (
                                                <p className="text-white opacity-70 text-sm md:text-base">
                                                    กำลังเชื่อมต่อ...
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-4 mt-6 w-full justify-center">
                                            <button
                                                onClick={() => handleReconnect(cam.id)}
                                                className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-base font-medium w-full sm:w-auto"
                                            >
                                                เชื่อมต่อใหม่
                                            </button>
                                            <button
                                                onClick={() => handleCloseCamera(cam.id)}
                                                className="px-6 py-3 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-base font-medium w-full sm:w-auto"
                                            >
                                                ปิดตัวนี้
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 mt-6">
                                {loading ? "กำลังค้นหากล้อง..." : "ไม่มีกล้องที่เชื่อมต่อ"}
                            </p>
                        )}
                    </div>

                    {/* กล่องขวา (Log การตรวจจับ) */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-white rounded-2xl shadow border border-gray-300 flex flex-col h-[500px] md:h-[600px] xl:h-[700px]">
                            <h1 className="flex justify-center p-6 text-lg md:text-xl font-bold">
                                ไม่ตั้งใจ
                            </h1>
                            <div className="space-y-4 overflow-y-auto flex-1 px-4 pb-4">
                                {detections.length === 0 ? (
                                    <div className="text-center text-gray-400 mt-8">
                                        <p>ยังไม่มีการตรวจจับ</p>
                                    </div>
                                ) : (
                                    detections.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <div className="w-20 h-20 bg-gray-300 rounded-lg overflow-hidden">
                                                <img
                                                    src={item.image}
                                                    alt={`Detection at ${item.time}`}
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
                        </div>

                        {/* ปุ่มบันทึก */}
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <button
                                onClick={() => setIsRecording(true)}
                                disabled={isRecording}
                                className={`w-full sm:w-40 py-3 rounded-lg font-semibold transition-colors ${isRecording
                                        ? "bg-gray-400 text-white cursor-not-allowed"
                                        : "bg-blue-900 text-white hover:bg-[#38A738]"
                                    }`}
                            >
                                เริ่มต้นบันทึก
                            </button>
                            <Link to="/user/summarize" className="w-full sm:w-40">
                                <button
                                    onClick={() => setIsRecording(false)}
                                    disabled={!isRecording}
                                    className={`w-full py-3 rounded-lg font-semibold transition-colors ${!isRecording
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
