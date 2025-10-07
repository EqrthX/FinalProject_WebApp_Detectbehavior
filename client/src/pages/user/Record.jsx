import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import MyBreadcrumb from '../../components/MyBreadcrumb';
import { Link } from 'react-router-dom';

const Record = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [timer, setTimer] = useState(0);
    const [detections, setDetections] = useState([]);

    const handleStart = () => {
        setIsRecording(true);
        setTimer(0);
        setDetections([]);
    };

    const handleStop = () => setIsRecording(false);

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

                        <div className="border-2 border-gray-300 rounded-2xl h-110 bg-black text-white text-3xl flex items-center justify-center">
                            ใส่ API จากกล้อง
                        </div>
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
                                onClick={handleStart}
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
