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

    // ✅ เก็บเฟรมของแต่ละกล้อง: { [id]: base64 }
    const [frames, setFrames] = useState({});

    // ✅ เก็บ WebSocket ต่อกล้อง: { [id]: ws }
    const wsRefs = useRef({});

    const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
    const WS_BASE = API_BASE.replace("http", "ws");

    // ---------- Utility ----------
    const safeCloseWS = (id) => {
        try {
            if (wsRefs.current[id]) {
                wsRefs.current[id].close();
                delete wsRefs.current[id];
            }
        } catch (_) { }
    };

    const connectWebSocket = (cameraId) => {
        // มีแล้วไม่ต้องเปิดซ้ำ
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
            if (typeof event.data === "string" && event.data.startsWith("error:")) {
                console.error(`Camera ${cameraId}: ${event.data}`);
                return;
            }
            // เก็บ base64 ต่อ id
            setFrames((prev) => ({ ...prev, [cameraId]: event.data }));
        };
    };

    // ---------- เปิดทุกกล้องตั้งแต่โหลดหน้า ----------
    useEffect(() => {
        const initCameras = async () => {
            try {
                const res = await axios.get("camera/list-camera");
                const list = res.data.cameras || [];
                setCameras(list);

                if (list.length === 0) {
                    toast.loading("กำลังสแกนกล้อง...");
                    setTimeout(initCameras, 3000); // เรียกใหม่อีกครั้งหลัง 3 วิ
                    return;
                }

                const ck = await axios.get("camera/open-all", { timeout: 60000 });
                toast.success(`เปิดกล้องทั้งหมด (${list.length}) แล้ว!`);

                list.forEach((cam) => connectWebSocket(cam.id));
            } catch (err) {
                console.error(err);
                toast.error("เกิดข้อผิดพลาดขณะโหลดกล้อง");
            }
        };

        initCameras();
    }, []);



    // ---------- ปุ่มควบคุม ----------
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
            console.error(err);
            toast.error("ปิดกล้องไม่สำเร็จ");
        }
    };

    const handleReconnect = async (id) => {
        try {
            // เผื่อกล้องถูกปิดไปก่อนหน้า ให้เปิดใหม่เฉพาะตัวนี้ได้
            // (ถ้าเปิดอยู่แล้ว endpoint นี้ไม่จำเป็น — แต่ไม่มีผลเสีย)
            await axios.get(`camera/open-all`);
            connectWebSocket(id);
            toast.success(`เชื่อมต่อใหม่ กล้อง ${id} แล้ว`);
        } catch (err) {
            console.error(err);
            toast.error(`เชื่อมต่อใหม่กล้อง ${id} ไม่สำเร็จ`);
        }
    };

    const handleCloseAll = async () => {
        try {
            Object.keys(wsRefs.current).forEach((id) => safeCloseWS(id));
            await axios.get("camera/close-all");
            setFrames({});
            toast.success("ปิดกล้องทั้งหมดแล้ว");
        } catch (err) {
            console.error(err);
            toast.error("ปิดกล้องทั้งหมดไม่สำเร็จ");
        }
    };

    // ---------- จับเวลาเมื่อบันทึก ----------
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
            <div style={{ padding: 24 }}>
                <MyBreadcrumb />

                <div className="grid grid-cols-3 gap-4 p-6">
                    {/* กล่องซ้าย */}
                    <div className="col-span-2 bg-white rounded-2xl shadow p-6 border border-gray-100 h-150">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <div
                                    className={`w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-offset-2 ${isRecording ? "ring-red-300" : "ring-green-300"
                                        }`}
                                >
                                    <div
                                        className={`w-3.5 h-3.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-green-500"
                                            }`}
                                    />
                                </div>
                                <h2 className="text-lg font-semibold">ตรวจจับพฤติกรรม</h2>
                            </div>

                            {/* ปุ่มรวม */}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCloseAll}
                                    className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                    disabled={loading}
                                >
                                    ปิดทั้งหมด
                                </button>
                            </div>
                        </div>

                        <div className="px-6 pb-4">
                            <div className="flex items-center justify-center text-sm text-gray-700">
                                <div className="flex items-center gap-6 sm:gap-12">
                                    <span className="font-medium">{formatTime(timer)}</span>
                                    <span>SI235-1</span>
                                    <span>กลุ่ม 1</span>
                                    <span>ห้อง 7501</span>
                                    <span>เวลา 12:20 - 16:10</span>
                                </div>
                            </div>
                        </div>

                        {/* กลุ่มกล้อง */}
                        {cameras.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {cameras.map((cam) => (
                                    <div
                                        key={cam.id}
                                        className="border rounded-2xl p-6 shadow-lg bg-white flex flex-col items-center"
                                    >
                                        <h3 className="font-semibold text-lg mb-2">{cam.name}</h3>

                                        <div className="w-[320px] h-[240px] border rounded-lg flex items-center justify-center bg-black">
                                            {frames[cam.id] ? (
                                                <img
                                                    src={`data:image/jpeg;base64,${frames[cam.id]}`}
                                                    alt={`Camera ${cam.id}`}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <p className="text-white opacity-60">กำลังเชื่อมต่อ...</p>
                                            )}
                                        </div>

                                        <div className="flex gap-3 mt-4">
                                            <button
                                                onClick={() => handleReconnect(cam.id)}
                                                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                            >
                                                เชื่อมต่อใหม่
                                            </button>
                                            <button
                                                onClick={() => handleCloseCamera(cam.id)}
                                                className="px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                                            >
                                                ปิดตัวนี้
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500">
                                {loading ? "กำลังค้นหากล้อง..." : "ไม่มีกล้องที่เชื่อมต่อ"}
                            </p>
                        )}
                    </div>

                    {/* ฝั่งขวา (log/รายการตรวจจับ) */}
                    <div className="flex flex-col space-y-4">
                        <div className="bg-white rounded-2xl shadow flex flex-col h-150 border border-gray-300">
                            <h1 className="flex justify-center p-9 text-lg font-bold">ไม่ตั้งใจ</h1>
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
                                            <div className="w-20 h-20 bg-gray-300 rounded-lg flex-shrink-0 overflow-hidden">
                                                <img
                                                    src={item.image}
                                                    alt={`Detection at ${item.time}`}
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
                        </div>

                        <div className="flex justify-center gap-4 pt-4">
                            <button
                                onClick={() => setIsRecording(true)}
                                disabled={isRecording}
                                className={`w-50 py-3 rounded-lg font-semibold transition-colors ${isRecording
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : "bg-blue-900 text-white hover:bg-[#38A738]"
                                    }`}
                            >
                                เริ่มต้นบันทึก
                            </button>
                            <Link to={"/user/summarize"} className="w-50">
                                <button
                                    onClick={() => setIsRecording(false)}
                                    disabled={!isRecording}
                                    className={`w-50 py-3 rounded-lg font-semibold transition-colors ${!isRecording
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
