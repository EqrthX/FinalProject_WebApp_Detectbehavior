import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import MyBreadcrumb from '../../components/MyBreadcrumb';
import { Link } from 'react-router-dom';
import axios from "../../util/axios";
import toast from 'react-hot-toast'
const Record = () => {

    const [isRecording, setIsRecording] = useState(false);
    const [timer, setTimer] = useState(0);
    const [detections, setDetections] = useState([]);
    const [cameras, setCameras] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [activeCamera, setActiveCamera] = useState(null);

    const handleStart = async () => {
        try {
            setIsRecording(true);
            setTimer(0);
            setDetections([]);

        } catch (error) {
            console.error("ฟังก์ชั่นเริ่มต้นบันทึก error: ", error)
        }
    };

    const handleStop = () => setIsRecording(false);

    useEffect(() => {

        const fetchListCamera = async () => {
            try {
                const resListCamera = await axios.get("camera/list-camera");
                setCameras(resListCamera.data.cameras || []);
                console.log(resListCamera.data.cameras);

            } catch (error) {
                console.error(error.message)
                setError("ไม่มีกล้อง")
            }
        }
        fetchListCamera();

    }, [])

    // จับเวลาเมื่อบันทึก ฝั่งซ้าย
    useEffect(() => {
        let intervalId;
        if (isRecording) {
            intervalId = setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isRecording]);

    // ข้อมูลเวลาในรูปแบบ HH:MM:SS
    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
            secs
        ).padStart(2, '0')}`;
    };

    const handleOpenCamera = async (id) => {
        try {
            setActiveCamera(id)
            const res = await axios.get(`camera/open-camera/${id}`);
            toast.success(`เปิดกล้อง ${id} แล้ว!`);
        } catch (error) {
            console.error(error);
            toast.error("เปิดกล้องไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    }

    const handleCloseCamera = async (id) => {
        try {
            setActiveCamera(null)
            const res = await axios.get(`camera/close-camera/${id}`);
            toast.success(`ปิดกล้อง ${id} แล้ว!`);
        } catch (err) {
            console.error(err);
            toast.error("ปิดกล้องไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    const handleStartDetect = async (id) => {
        try {
            setActiveCamera(id)
            const res = await axios.get(`camera/start-detect/${id}`);
            console.log(res.data);
            toast.success(`กำลังสตีมกล้องที่ ${id} แล้ว!`);
        } catch (error) {
            console.error(error);
            toast.error("ไม่สามารถสตีมกล้องได้");
        } finally {
            setLoading(false);
        }
    }
    
    // // จำลองการตรวจจับทุก ๆ 10 วินาทีขณะบันทึก
    // useEffect(() => {
    //     if (isRecording && timer > 0 && timer % 10 === 0) {
    //         const newDetection = {
    //             id: Date.now(),
    //             time: formatTime(timer),
    //             image: `https://via.placeholder.com/80?text=T${timer}s`,
    //         };
    //         setDetections((prev) => [...prev, newDetection]);
    //     }
    // }, [timer, isRecording]);

    return (
        <>
            <Navbar />
            <div style={{ padding: 24 }}>
                <MyBreadcrumb />
                <div className="grid grid-cols-3 gap-4 p-6">
                    {/* กล่องซ้าย */}
                    <div className="col-span-2 bg-white rounded-2xl shadow p-6 border border-gray-100 h-150">
                        <div className="flex items-center space-x-3 p-6">
                            {/* วงกลมสถานะ */}
                            <div
                                className={`w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-offset-2 ${isRecording ? 'ring-red-300' : 'ring-green-300'
                                    }`}
                            >
                                <div
                                    className={`w-3.5 h-3.5 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                                        }`}
                                />
                            </div>

                            <h2 className="text-lg font-semibold">ตรวจจับพฤติกรรม</h2>
                        </div>

                        <div className="px-6 pb-4">
                            <div className="flex items-center justify-center text-sm text-gray-700">
                                <div className="flex items-center space-x-20">
                                    <span className="font-medium">{formatTime(timer)}</span>
                                    <span>SI235-1</span>
                                    <span>กลุ่ม 1</span>
                                    <span>ห้อง 7501</span>
                                    <span>เวลา 12:20 - 16:10</span>
                                </div>
                            </div>
                        </div>

                        {cameras.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {cameras.map((cam) => (
                                    <div
                                        key={cam.id}
                                        className="border rounded-2xl p-6 shadow-lg bg-white flex flex-col justify-between w-[540px]"
                                    >
                                        <h3 className="font-semibold text-lg mb-4 text-center">{cam.name}</h3>

                                        {/* ส่วนแสดงภาพ */}
                                        <div className="flex justify-center">
                                            <div className="flex flex-col items-center">
                                                <div style={{ textAlign: "center" }}>
                                                    {activeCamera === cam.id ? (
                                                        <img
                                                            src={`http://localhost:8000/api/camera/video/${cam.id}`}
                                                            alt="camera stream"
                                                            className='w-full h-[240px] flex'
                                                        />
                                                    ) : (

                                                        <p className="text-black text-xl font-medium opacity-80">
                                                            ยังไม่เปิดกล้อง
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* ปุ่มควบคุม */}
                                        <div className="flex justify-center gap-4 mt-6">

                                            <button
                                                onClick={() => handleOpenCamera(cam.id)}
                                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                                disabled={loading}
                                            >
                                                เปิดกล้อง
                                            </button>
                                            <button
                                                onClick={() => handleCloseCamera(cam.id)}
                                                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                                                disabled={loading}
                                            >
                                                ปิดกล้อง
                                            </button>

                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center text-lg">
                                ไม่มีกล้องที่เชื่อมต่อ
                            </p>
                        )}

                    </div>

                    {/* โชว์สถานะ ฝั่งขวา */}
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
                                                <p className="text-sm font-medium text-gray-700">เวลา {item.time}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* ปุ่ม */}
                        <div className="flex justify-center gap-4 pt-4">
                            <button
                                onClick={() => handleStartDetect(activeCamera)}
                                disabled={isRecording}
                                className={`w-50 py-3 rounded-lg font-semibold transition-colors ${isRecording
                                    ? 'bg-gray-400 text-white cursor-not-allowed'
                                    : 'bg-blue-900 text-white hover:bg-[#38A738]'
                                    }`}
                            >
                                เริ่มต้นบันทึก
                            </button>
                            <Link to={"/user/summarize"} className="w-50">
                                <button
                                    onClick={handleStop}
                                    disabled={!isRecording}
                                    className={`w-50 py-3 rounded-lg font-semibold transition-colors ${!isRecording
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-[#FDEEED] text-[#74393C] hover:bg-red-600 hover:text-white'
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
