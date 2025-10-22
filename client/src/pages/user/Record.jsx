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

    // ---------- Utility ----------
    const safeCloseWS = (id) => {
        try {
            if (wsRefs.current[id]) {
                wsRefs.current[id].close();
                delete wsRefs.current[id];
            }
        } catch (_) { _ }
    };

    const connectWebSocket = (cameraId) => {
        if (wsRefs.current[cameraId]) return;

        const base = import.meta.env.VITE_API_BASE;
        const wsProtocol = base.startsWith("https") ? "wss" : "ws";
        const wsBase = base.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}://${wsBase}/camera/ws/camera/${cameraId}`;
        const ws = new WebSocket(wsUrl);

        wsRefs.current[cameraId] = ws;

        ws.onopen = () => console.log(`✅ WS connected: camera ${cameraId}`);
        ws.onclose = () => {
            console.log(`WS closed: camera ${cameraId}`);
            delete wsRefs.current[cameraId];
        };
        ws.onerror = (e) => {
            console.error(`WS error cam ${cameraId}`, e);
            toast.error(`สตรีมกล้อง ${cameraId} มีปัญหา`);
        };

        ws.onmessage = (event) => {

            if (typeof event.data === "string" && event.data.startsWith("error:")) {
                console.error(`Camera ${cameraId}: ${event.data}`);
                return;
            }
            setFrames((prev) => ({ ...prev, [cameraId]: event.data }));
        };
    };

    // ---------- เปิดกล้องทั้งหมด ----------
    useEffect(() => {
        let retryInterval;
        const initCameras = async () => {
            try {
                const res = await axios.get("camera/list-camera", {
                    headers: { "Cache-Control": "no-cache" },
                });
                const list = res.data.cameras || [];
                setCameras(list);

                if (list.length === 0) {
                    toast.loading("กำลังสแกนกล้อง...");
                    if (!retryInterval) retryInterval = setInterval(initCameras, 3000);
                    return;
                }

                clearInterval(retryInterval);
                await axios.get("camera/open-all", { timeout: 60000 });
                toast.success(`เปิดกล้องทั้งหมด (${list.length}) แล้ว!`);
                list.forEach((cam) => connectWebSocket(cam.id));
            } catch (err) {
                console.error(err);
                toast.error("เกิดข้อผิดพลาดขณะโหลดกล้อง");
            }
        };
        initCameras();
        return () => clearInterval(retryInterval);
    }, []);

    // ---------- ปุ่ม ----------
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
        } catch (err) {
            toast.error("ปิดกล้องไม่สำเร็จ");
            console.error("ปิดกล้องไม่สำเร็จ :", err);

        }
    };

    // เชื่อมต่อกล้องใหม่
    const handleReconnect = async (id) => {
        try {
            await axios.get(`camera/open-all`);
            connectWebSocket(id);
            toast.success(`เชื่อมต่อใหม่ กล้อง ${id} แล้ว`);
        } catch {
            toast.error(`เชื่อมต่อใหม่กล้อง ${id} ไม่สำเร็จ`);
        }
    };

    // ปิดกล้องทั้งหมด
    const handleCloseAll = async () => {
        try {
            Object.keys(wsRefs.current).forEach((id) => safeCloseWS(id));
            await axios.get("camera/close-all");
            setFrames({});
            toast.success("ปิดกล้องทั้งหมดแล้ว");
            setIsRecording(false)
        } catch {
            toast.error("ปิดกล้องทั้งหมดไม่สำเร็จ");
        }
    };

    const handleStartDetect = async (cameraId) => {
        setIsRecording(true)
        try {
            const resStartDetect = await axios.get(`camera/start-detect/${cameraId}`)
            console.log(resStartDetect);

        } catch (error) {
            console.error("การตรวจจับเกิดข้อผิดพลาด", error)
        }
    }

    // const handleStopDetect = async () => {
    //     setIsRecording(false)
    //     try {
    //         await axios.get(`camera/stop-all`)
    //         toast.success("หยุดตรวจจับทั้งหมด")
    //     } catch (error) {
    //         console.error("การหยุดตรวจจับเกิดข้อผิดพลาด", error)
    //     }
    // }
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
                                    className={`w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-offset-2 ${isRecording ? "ring-red-300" : "ring-green-300"
                                        }`}
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
                            <span className="font-medium">{formatTime(timer)}</span>
                            <span>SI235-1</span>
                            <span>กลุ่ม 1</span>
                            <span>ห้อง 7501</span>
                            <span>เวลา 12:20 - 16:10</span>
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
                    <div className="bg-white rounded-2xl shadow flex flex-col border border-gray-200 h-full">
                        <h1 className="text-center py-4 text-lg font-bold border-b">
                            ไม่ตั้งใจ
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
                                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                                    >
                                        <div className="w-20 h-20 bg-gray-300 rounded-lg overflow-hidden flex-shrink-0">
                                            <img
                                                src={item.image}
                                                alt={item.time}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-700">
                                                เวลา {item.time}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* ปุ่ม */}
                        <div className="flex flex-wrap justify-center gap-3 py-4 border-t">
                            <button
                                onClick={() => handleStartDetect(cameras.map(cam => cam.id))}
                                disabled={isRecording}
                                className={`px-5 py-3 rounded-lg font-semibold text-sm sm:text-base ${isRecording
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : "bg-blue-900 text-white hover:bg-[#38A738]"
                                    }`}
                            >
                                เริ่มต้นบันทึก
                            </button>
                            {/* <button
                                onClick={handleStopDetect}
                                disabled={!isRecording}
                                className={`px-5 py-3 rounded-lg font-semibold text-sm sm:text-base ${!isRecording
                                        ? "bg-gray-400 text-white cursor-not-allowed"
                                        : "bg-amber-900 text-white hover:bg-[#859710]"
                                    }`}
                            >
                                หยุดบันทึก
                            </button> */}
                            <Link to={"/user/summarize"}>
                                <button
                                    onClick={() => setIsRecording(false)}
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
