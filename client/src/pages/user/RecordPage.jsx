import React, { useEffect, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import MyBreadcrumb from "../../components/MyBreadcrumb";
import axios from "../../util/axios";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { CLASS_LABEL_MAP } from "../../util/constants";

const RecordPage = () => {
  const navigate = useNavigate();
  const { subjectId, group } = useParams();
  const teacherId = localStorage.getItem("teacher_id");

  const [startTime, setStartTime] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState([]);

  const wsRefs = useRef({});
  const summaryRefs = useRef({});
  const imgRef = useRef({});
  const canvasRef = useRef({});
  const scanningToastId = useRef(null);
  const retryInterval = useRef(null);

  // ---------------------- ฟังก์ชัน Utils (ฟังก์ชันช่วยงานทั่วไป) ----------------------
  const convertClass = (cls) => {
    return CLASS_LABEL_MAP[cls] || cls;
  }
  
  // ฟังก์ชันสร้างชื่อกล้องจาก id เช่น 0 -> "กล้องตัวที่ 1"
  const getCameraName = (id) => `กล้องตัวที่ ${Number(id) + 1}`;

  // ฟังก์ชันแปลงจำนวนวินาที เป็นรูปแบบเวลา HH:MM:SS
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  };

  // ฟังก์ชันปิด WebSocket ของกล้องแบบปลอดภัย (กัน error ถ้าไม่มีหรือปิดไปแล้ว)
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

  // ฟังก์ชันปิด WebSocket summary ของกล้องแบบปลอดภัย
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

  // ---------------------- WebSocket: สตรีมภาพ (annotated/raw) ----------------------

  // ฟังก์ชันเชื่อม WebSocket สำหรับ "สตรีมภาพกล้อง"
  const connectWebSocket = (cameraId) => {
    const base = import.meta.env.VITE_API_BASE;
    const wsProtocol = base.startsWith("https") ? "wss" : "ws";
    const wsBase = base.replace(/^https?:\/\//, "");
    const wsUrl =
      `${wsProtocol}://${wsBase}/camera/ws/camera/${cameraId}` +
      `?teacher_id=${teacherId}&subject_id=${subjectId}&group=${group}`;

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
    };

    wsRefs.current[cameraId] = ws;
  };

  // ---------------------- WebSocket: รับ Summary (ข้อมูลสรุป) ----------------------

  // ฟังก์ชันเชื่อม WebSocket สำหรับรับข้อมูลสรุป (summary) ของกล้องแต่ละตัว
  const connectSummarySocket = (cameraId) => {
    const base = import.meta.env.VITE_API_BASE;
    const wsProtocol = base.startsWith("https") ? "wss" : "ws";
    const wsBase = base.replace(/^https?:\/\//, "");
    const wsUrl =
      `${wsProtocol}://${wsBase}/camera/ws/camera/summary/${cameraId}` +
      `?teacher_id=${teacherId}&subject_id=${subjectId}&group=${group}`;

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

        if(data.type === "realtime") {
          if(data.total_duration_sec !== undefined){
            setTimer(data.total_duration_sec);
          }
          return;
        }
        
        setSummaryData((prev) => {
          const isDuplicate = prev.some(
            (item) => item.cameraId === cameraId && item.data.Time === data.Time
          );
          if (isDuplicate) return prev;
          return [...prev, { cameraId, data }];
        });
        console.log("📊 Summary from camera", Number(cameraId) + 1, data);
      } catch (e) {
        console.error("Summary parse error:", e, event.data);
      }
    };

    summaryRefs.current[cameraId] = ws;
  };

  // ---------------------- โหลดรายการกล้องจากหลังบ้าน ----------------------

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

        if (retryInterval.current) {
          clearInterval(retryInterval.current);
          retryInterval.current = null;
        }
        if (scanningToastId.current) {
          toast.dismiss(scanningToastId.current);
          scanningToastId.current = null;
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

  useEffect(() => {
    if (!cameras || cameras.length === 0) return;

    cameras.forEach((cam) => {
      connectWebSocket(cam.id);
    });

    toast.success("เปิดกล้องทั้งหมดแล้ว!");
  }, [cameras]);

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

  // ---------------------- ฟังก์ชันสำหรับปุ่มต่าง ๆ ----------------------


  // ปุ่ม "เริ่มต้นตรวจจับทุกกล้อง"
  const handleStartDetect = async () => {
    if (isRecording) return;

    const isNewSession = timer === 0;
    if (isNewSession) {
      setTimer(0);
      setSummaryData([]);
      setStartTime(Date.now());
    } else {
      setStartTime(Date.now() - (timer * 1000));
    }

    setIsRecording(true);

    cameras.forEach((cam) => {
      safeCloseWS(cam.id);
      safeCloseSummaryWS(cam.id)
    })

    await new Promise(r => setTimeout(r, 500))

    try {
      cameras.forEach((cam) => {
        safeCloseWS(cam.id);
        connectWebSocket(cam.id);

        safeCloseSummaryWS(cam.id);
        connectSummarySocket(cam.id);
      });

      await axios.get(`camera/start-all`);
      toast.success(`เริ่มตรวจจับทุกกล้อง`);
    } catch (error) {
      setIsRecording(false);
      console.error("การตรวจจับเกิดข้อผิดพลาด", error);
      toast.error("เริ่มต้นตรวจจับไม่สำเร็จ");
    }
  };

  // ปุ่ม "ปิดกล้องทั้งหมด"
  const handleStopAll = async () => {
    setIsRecording(false);

    try {
      await axios.get("camera/stop-all");
      toast.success("ปิดกล้องทั้งหมดแล้ว");
    } catch {
      toast.error("ปิดกล้องทั้งหมดไม่สำเร็จ");
    }
  };

  // ปุ่ม "จบการตรวจจับ"
  const handleCloseAll = async (e) => {
    e.preventDefault();
    if (!isRecording && timer === 0) return; // เพิ่ม timer === 0 กันพลาด

    setIsRecording(false);
    setStartTime(null);
    setTimer(0);

    try {
      await axios.get(`camera/close-all`);
      const summaryRes = await axios.get(`camera/summary-to-supabase`);
      console.log("Summary Done:", summaryRes.data);

      await new Promise((resolve) => setTimeout(resolve, 800));

      Object.keys(summaryRefs.current).forEach((id) => safeCloseSummaryWS(id));

      toast.success(`หยุดการตรวจจับทุกกล้อง`);
      navigate(`/user/summarize/${subjectId}/${group}`);
    } catch (error) {
      console.error("การหยุดตรวจจับเกิดข้อผิดพลาด", error);
      toast.error("หยุดการตรวจจับไม่สำเร็จ");
    }
  };

  // ---------------------- ระบบ Timer นับเวลาบันทึก ----------------------

  // useEffect(() => {
  //   let intervalId;

  //   if (isRecording && startTime) {
  //     intervalId = setInterval(() => {
  //       // คำนวณเวลา: (ปัจจุบัน - เริ่มต้น) / 1000 เพื่อแปลงเป็นวินาที
  //       const now = Date.now();
  //       const secondsElapsed = Math.floor((now - startTime) / 1000);

  //       setTimer(secondsElapsed);
  //     }, 1000);
  //   }

  //   return () => {
  //     if (intervalId) clearInterval(intervalId);
  //   };
  // }, [isRecording, startTime]);

  return (
    <>
      <Navbar />

      <div className="p-4 sm:p-6 md:p-8 lg:p-10">
        <MyBreadcrumb />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 sm:p-6 border border-gray-200">
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
                  <div className="text-sm text-gray-500">
                    สถานะการตรวจจับ
                  </div>
                  <div className="font-semibold text-gray-800">
                    {isRecording ? "กำลังตรวจจับ" : "พร้อมเริ่มต้น"}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-500">
                  ระยะเวลาบันทึก
                </div>
                <div className="text-2xl font-mono font-bold">
                  {formatTime(timer)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
              <button
                className={`px-4 py-2 rounded-lg text-white font-semibold ${isRecording
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-500"
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
                onClick={handleCloseAll}
              >
                จบการตรวจจับ
              </button>

              <button
                className="px-4 py-2 rounded-lg font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100"
                onClick={handleStopAll}
              >
                ปิดกล้องทั้งหมด
              </button>
            </div>

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
                    {getCameraName(cam.id)}
                  </h3>

                  <div className="w-full aspect-video bg-black rounded-xl overflow-hidden mb-3 flex items-center justify-center">
                    <canvas
                      ref={(el) => (canvasRef.current[cam.id] = el)}
                      width={640}
                      height={460}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4 sm:p-6 border border-gray-200">
            <h2 className="text-lg font-semibold mb-3">
              ข้อมูลสรุประหว่างสอน
            </h2>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {summaryData.map((item, index) => (
                <div
                  key={index}
                  className="bg-white shadow rounded-xl p-4 border border-gray-200 flex gap-4"
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">
                      กล้อง {Number(item.cameraId) + 1}
                    </h3>

                    <p className="text-sm text-gray-500">
                      เวลา: {item.data.Time}
                    </p>

                    {/* <div className="mt-2">
                      <p className="text-lg font-medium text-amber-700">
                        พฤติกรรม: {convertClass(item.data.CurrentClass)}
                      </p>
                    </div> */}
                  </div>

                  {item.data.image && (
                    <div className="w-32 h-24 overflow-hidden rounded-lg border border-gray-300">
                      <img
                        src={`data:image/jpeg;base64,${item.data.image}`}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RecordPage;