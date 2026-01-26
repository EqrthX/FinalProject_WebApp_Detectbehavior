// นำเข้า React และ Hook ที่ใช้จาก React
import React, { useEffect, useRef, useState } from "react";
// นำเข้า Navbar ด้านบนของหน้า จากโฟลเดอร์ components
import Navbar from "../../components/Navbar";
// นำเข้า Breadcrumb (แสดงเส้นทางหน้า เช่น หน้าแรก > ตารางสอน > บันทึก)
import MyBreadcrumb from "../../components/MyBreadcrumb";
// นำเข้า axios เวอร์ชันที่เราตั้งค่า baseURL ไว้แล้ว
import axios from "../../util/axios";
// นำเข้า toast สำหรับแจ้งเตือน Popup มุมจอ (เช่น ข้อความสำเร็จ/ผิดพลาด)
import toast from "react-hot-toast";
// นำเข้า hook ใช้เปลี่ยนหน้า (navigate) และดึงค่าจาก URL (useParams)
import { useNavigate, useParams } from "react-router-dom";

// ประกาศ Component หลักของหน้านี้ ชื่อ RecordPage
const RecordPage = () => {
  // ใช้ hook useNavigate เพื่อให้เราสามารถสั่งเปลี่ยนหน้าได้ด้วยโค้ด
  const navigate = useNavigate();

  // ดึงค่าจาก URL parameter เช่น /user/record/:subjectId
  const { subjectId } = useParams();

  // ดึงค่า teacher_id จาก localStorage (หลังจาก Login แล้วเคยเก็บไว้)
  const teacherId = localStorage.getItem("teacher_id");

  // state สำหรับเก็บ "รายการกล้อง" ที่ค้นเจอในเครื่อง (array)
  const [cameras, setCameras] = useState([]);
  // state เอาไว้บอกว่า "ตอนนี้กำลังตรวจจับอยู่หรือไม่" (true/false)
  const [isRecording, setIsRecording] = useState(false);
  // state สำหรับนับเวลาเป็นวินาที ว่าตรวจจับไปแล้วกี่วินาที
  const [timer, setTimer] = useState(0);
  // state บอกว่า "กำลังโหลดรายการกล้องอยู่ไหม" (true/false)
  const [loading, setLoading] = useState(false);
  // state สำหรับเก็บข้อมูลสรุปที่ได้จาก WebSocket summary (array)
  const [summaryData, setSummaryData] = useState([]);

  // useRef เก็บรายการ WebSocket ของแต่ละกล้อง (เช่น {0: wsObject, 1: wsObject, ...})
  const wsRefs = useRef({});
  // useRef เก็บ WebSocket ที่เอาไว้รับข้อมูลสรุป (summary) ของแต่ละกล้อง
  const summaryRefs = useRef({});
  // useRef เก็บ Image object สำหรับแต่ละกล้อง (ใช้วาดภาพลง canvas)
  const imgRef = useRef({});
  // useRef เก็บค่าอ้างถึง <canvas> ของแต่ละกล้อง
  const canvasRef = useRef({});
  // useRef เก็บ id ของ toast (เวลาแสดง "กำลังสแกนกล้อง...") เพื่อจะปิดถูกตัว
  const scanningToastId = useRef(null);
  // useRef เก็บ id ของ setInterval ที่ใช้สแกนกล้องซ้ำทุก 3 วิ
  const retryInterval = useRef(null);

  // ---------------------- ฟังก์ชัน Utils (ฟังก์ชันช่วยงานทั่วไป) ----------------------

  // ฟังก์ชันสร้างชื่อกล้องจาก id เช่น 0 -> "กล้องตัวที่ 1"
  const getCameraName = (id) => `กล้องตัวที่ ${Number(id) + 1}`;

  // ฟังก์ชันแปลงจำนวนวินาที เป็นรูปแบบเวลา HH:MM:SS
  const formatTime = (seconds) => {
    // คำนวณชั่วโมงจากวินาทีทั้งหมด
    const hrs = Math.floor(seconds / 3600);
    // คำนวณนาทีจากส่วนที่เกินชั่วโมง
    const mins = Math.floor((seconds % 3600) / 60);
    // ส่วนวินาทีที่เหลือ
    const secs = seconds % 60;
    // แปลงเป็น string แบบเติม 0 ด้านหน้าให้ครบ 2 หลัก เช่น 01:05:09
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  };

  // ฟังก์ชันปิด WebSocket ของกล้องแบบปลอดภัย (กัน error ถ้าไม่มีหรือปิดไปแล้ว)
  const safeCloseWS = (id) => {
    try {
      // เช็คว่ามี WebSocket ของกล้องนี้ไหม
      if (wsRefs.current[id]) {
        // ถ้ามีให้ปิดการเชื่อมต่อ
        wsRefs.current[id].close();
        // จากนั้นลบออกจาก object เพื่อไม่ให้ค้างอยู่
        delete wsRefs.current[id];
      }
    } catch (e) {
      // ถ้าเกิด error ให้ log ดูใน console (ไม่ทำให้โปรแกรมล้ม)
      console.error("safeCloseWS error:", e);
    }
  };

  // ฟังก์ชันปิด WebSocket summary ของกล้องแบบปลอดภัย
  const safeCloseSummaryWS = (id) => {
    try {
      // ถ้ามี WebSocket summary ของกล้องนี้
      if (summaryRefs.current[id]) {
        // ปิดการเชื่อมต่อ
        summaryRefs.current[id].close();
        // ลบออกจาก object
        delete summaryRefs.current[id];
      }
    } catch (e) {
      // log error เผื่อ debug
      console.error("safeCloseSummaryWS error:", e);
    }
  };

  // ---------------------- WebSocket: สตรีมภาพ (annotated/raw) ----------------------

  // ฟังก์ชันเชื่อม WebSocket สำหรับ "สตรีมภาพกล้อง" (เวอร์ชันเดิม)
  const connectWebSocket = (cameraId) => {
    // อ่านฐาน URL จาก .env
    const base = import.meta.env.VITE_API_BASE;
    // เลือกใช้ ws หรือ wss ขึ้นกับว่า base เป็น http หรือ https
    const wsProtocol = base.startsWith("https") ? "wss" : "ws";
    // ตัด http:// หรือ https:// ออก
    const wsBase = base.replace(/^https?:\/\//, "");
    // ประกอบ URL สำหรับ WebSocket ของกล้อง + query string teacher_id, subject_id
    const wsUrl =
      `${wsProtocol}://${wsBase}/camera/ws/camera/${cameraId}` +
      `?teacher_id=${teacherId}&subject_id=${subjectId}`;

    // log ดูว่ากำลังจะเชื่อมต่อไปที่ไหน
    console.log("[connectWebSocket] connecting", wsUrl);

    // สร้าง WebSocket ใหม่
    const ws = new WebSocket(wsUrl);

    // เมื่อเชื่อมต่อสำเร็จ
    ws.onopen = () => {
      console.log("✅ WS เปิดสำหรับกล้อง", Number(cameraId) + 1);
    };

    // ถ้า WebSocket error
    ws.onerror = (err) => {
      console.error("[connectWebSocket] error", err);
    };

    // เมื่อ WebSocket ถูกปิด
    ws.onclose = () => {
      console.log("🔌 WS ปิดสำหรับกล้อง", Number(cameraId) + 1);
    };

    // เมื่อได้รับข้อมูลภาพจากกล้อง
    ws.onmessage = (event) => {
      // ถ้าเป็นข้อความตัวหนังสือและขึ้นต้นด้วย "error:"
      if (typeof event.data === "string" && event.data.startsWith("error:")) {
        // แสดง error ว่ากล้องนี้มีปัญหาอะไร
        console.error(`Camera ${getCameraName(cameraId)} error:`, event.data);
        return; // แล้วหยุดทำงานต่อ
      }

      // ถ้ายังไม่มี Image object สำหรับกล้องนี้ ให้สร้างใหม่
      if (!imgRef.current[cameraId]) {
        imgRef.current[cameraId] = new Image();
      }

      // แปลงข้อมูลที่ได้เป็นรูป base64 พร้อม header
      const imageSrc = "data:image/jpeg;base64," + event.data;
      // ดึง Image object ของกล้องนี้
      const img = imgRef.current[cameraId];

      // เมื่อรูปโหลดเสร็จ
      img.onload = () => {
        // ดึง canvas ของกล้องนี้
        const canvas = canvasRef.current[cameraId];
        // ถ้าไม่มี canvas ก็ไม่ต้องทำอะไร
        if (!canvas) return;

        // ดึง context 2D ของ canvas
        const ctx = canvas.getContext("2d");
        // ลบภาพเก่าทิ้งเคลียร์พื้นที่
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // วาดรูปใหม่ลงเต็ม canvas (ใช้ขนาด canvas ในหน้าจอ)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };

      // ตั้งค่า src ของรูป (เริ่มโหลดรูป)
      img.src = imageSrc;
    };

    // เก็บ WebSocket นี้ไว้ใน ref
    wsRefs.current[cameraId] = ws;
  };

  // ---------------------- WebSocket: รับ Summary (ข้อมูลสรุป) ----------------------

  // ฟังก์ชันเชื่อม WebSocket สำหรับรับข้อมูลสรุป (summary) ของกล้องแต่ละตัว
  const connectSummarySocket = (cameraId) => {
    // อ่าน base URL จาก .env
    const base = import.meta.env.VITE_API_BASE;
    // เลือก ws หรือ wss
    const wsProtocol = base.startsWith("https") ? "wss" : "ws";
    // ตัด http://, https:// ออก
    const wsBase = base.replace(/^https?:\/\//, "");
    // ประกอบ URL สำหรับ summary WebSocket
    const wsUrl =
      `${wsProtocol}://${wsBase}/camera/ws/camera/summary/${cameraId}` +
      `?teacher_id=${teacherId}&subject_id=${subjectId}`;

    // log ว่ากำลังเชื่อมจะต่อ summary socket
    console.log("[connectSummarySocket] connecting", wsUrl);

    // สร้าง WebSocket summary ใหม่
    const ws = new WebSocket(wsUrl);

    // เมื่อเชื่อมต่อ summary สำเร็จ
    ws.onopen = () => {
      console.log("✅ Summary WS open for camera", Number(cameraId) + 1);
    };

    // ถ้าเกิด error ใน summary WebSocket
    ws.onerror = (err) => {
      console.error("[Summary WS] error", err);
    };

    // เมื่อ summary WebSocket ถูกปิด
    ws.onclose = () => {
      console.log("🔌 Summary WS closed for camera", Number(cameraId) + 1);
    };

    // เมื่อได้รับข้อมูล summary จากหลังบ้าน
    ws.onmessage = (event) => {
      try {
        // ข้อมูลที่ส่งมาจะอยู่ในรูปแบบ JSON string ต้องแปลงเป็น object ก่อน
        const data = JSON.parse(event.data);

        // อัปเดต state summaryData โดยเพิ่มข้อมูลใหม่เข้าไปต่อท้าย array เดิม
        setSummaryData((prev) => [
          ...prev,
          { cameraId, data }, // เก็บทั้ง cameraId และ data ที่ได้
        ]);

        // log ดูข้อมูล summary เพื่อ debug หรือเช็คค่า
        console.log("📊 Summary from camera", Number(cameraId) + 1, data);
      } catch (e) {
        // ถ้า parse JSON ไม่ได้ให้แสดง error เพื่อ debug
        console.error("Summary parse error:", e, event.data);
      }
    };

    // เก็บ reference ของ summary WebSocket ไว้
    summaryRefs.current[cameraId] = ws;
  };

  // ---------------------- โหลดรายการกล้องจากหลังบ้าน ----------------------

  // useEffect นี้ จะรันครั้งแรกตอนเปิดหน้า เพื่อโหลด list กล้อง
  useEffect(() => {
    // ฟังก์ชัน async สำหรับโหลดกล้อง
    const initCameras = async () => {
      try {
        // เปิด loading = true เพื่อแสดงข้อความ "กำลังโหลด..."
        setLoading(true);

        // ยิง request ไปยัง API "camera/list-camera"
        // ส่ง header "Cache-Control": "no-cache" เพื่อไม่ให้ browser ใช้ cache เก่า
        const res = await axios.get("camera/list-camera", {
          headers: { "Cache-Control": "no-cache" },
        });

        // ดึงรายการกล้องจาก res.data.cameras ถ้าไม่มีให้ใช้ [] แทน
        const list = res.data.cameras || [];
        // เก็บผลลงใน state cameras
        setCameras(list);
        // ปิด loading
        setLoading(false);

        // ถ้า "ยังไม่มีกล้อง" ที่ถูกพบเลย
        if (list.length === 0) {
          // ถ้ายังไม่ได้แสดง toast "กำลังสแกนกล้อง..."
          if (!scanningToastId.current) {
            // สร้าง toast แบบ loading และเก็บ id ไว้ใน ref
            scanningToastId.current = toast.loading("กำลังสแกนกล้อง...");
          }
          // ถ้ายังไม่ได้ตั้ง Interval ให้สแกนซ้ำ
          if (!retryInterval.current) {
            // ตั้งให้เรียก initCameras ใหม่ทุก ๆ 3 วินาที
            retryInterval.current = setInterval(initCameras, 3000);
          }
          // แล้วก็ออกจากฟังก์ชัน (ยังไม่ต้องทำอย่างอื่น)
          return;
        }

        // ถ้าพบกล้องแล้ว (list.length > 0)

        // ถ้ามี interval สแกนซ้ำอยู่ ให้หยุดมัน
        if (retryInterval.current) {
          clearInterval(retryInterval.current);
          retryInterval.current = null;
        }
        // ถ้ามี toast loading แสดงอยู่ ให้ปิดมัน
        if (scanningToastId.current) {
          toast.dismiss(scanningToastId.current);
          scanningToastId.current = null;
        }
      } catch (err) {
        // ถ้าโหลดกล้องเกิด error ให้ปิด loading
        setLoading(false);
        // log error เพื่อ debug
        console.error("❌ โหลดกล้องล้มเหลว:", err);
        // แจ้งเตือนผู้ใช้ว่ามีปัญหา
        toast.error("เกิดข้อผิดพลาดขณะโหลดกล้อง");
      }
    };

    // เรียกฟังก์ชัน initCameras เมื่อหน้าโหลดครั้งแรก
    initCameras();

    // ฟังก์ชัน cleanup ของ useEffect นี้
    return () => {
      // ถ้ามี interval สแกนกล้อง ให้ยกเลิก
      if (retryInterval.current) clearInterval(retryInterval.current);
      // ถ้ามี toast loading แสดงอยู่ ให้ปิด
      if (scanningToastId.current) toast.dismiss(scanningToastId.current);
    };
  }, []); // [] หมายความว่าให้รันครั้งเดียวตอน component ถูกสร้าง

  // useEffect นี้จะทำงานทุกครั้งที่ค่า cameras เปลี่ยนแปลง
  useEffect(() => {
    // ถ้ายังไม่มี cameras หรือ array ว่าง ไม่ต้องทำอะไร
    if (!cameras || cameras.length === 0) return;

    // วนทุกกล้องที่ค้นพบ
    cameras.forEach((cam) => {
      // เชื่อม WebSocket สำหรับสตรีมภาพกล้อง
      connectWebSocket(cam.id);
    });

    // แจ้งเตือนว่า "เปิดกล้องทั้งหมดแล้ว!"
    toast.success("เปิดกล้องทั้งหมดแล้ว!");
  }, [cameras]); // ทำงานเมื่อ cameras เปลี่ยน

  // cleanup ตอนออกจากหน้านี้ (เช่น เปลี่ยนไปหน้าอื่น)
  useEffect(() => {
    // return ฟังก์ชันที่จะถูกเรียกเมื่อ component ถูก unmount (ออกจากหน้า)
    return () => {
      console.log("Cleanup: ปิด WS ทั้งหมด");

      // ปิด WebSocket สตรีมภาพทุกตัว
      Object.keys(wsRefs.current).forEach((cameraId) => safeCloseWS(cameraId));
      // ปิด WebSocket summary ทุกตัว
      Object.keys(summaryRefs.current).forEach((cameraId) =>
        safeCloseSummaryWS(cameraId)
      );

      try {
        // เรียก API ให้หลังบ้านปิดกล้องทั้งหมด
        axios.get("camera/close-all");
        console.log("Cleanup: เรียก API ปิดกล้องทั้งหมด");
      } catch (error) {
        // ถ้ามี error เวลาปิดกล้อง log ไว้
        console.error("ปิดกล้องทั้งหมดก่อนออกจาก Record ไม่สำเร็จ", error);
      }
    };
  }, []); // [] หมายถึงทำ cleanup ตอน component ถูกถอดออกเท่านั้น

  // ---------------------- ฟังก์ชันสำหรับปุ่มต่าง ๆ ----------------------

  // ปุ่ม "เชื่อมต่อใหม่" สำหรับกล้องบางตัว
  const handleReconnect = async (cameraId) => {
    try {
      // เรียกหลังบ้านให้เปิดกล้องทั้งหมด (เผื่อกล้องไหนปิด/หลุด)
      await axios.get("camera/open-all");
      // เชื่อมต่อ WebSocket ใหม่สำหรับกล้องนี้
      connectWebSocket(cameraId);
      // แจ้งผู้ใช้ว่าทำสำเร็จ
      toast.success(`เชื่อมต่อใหม่ กล้อง ${getCameraName(cameraId)} แล้ว`);
    } catch {
      // ถ้ามีปัญหาให้แจ้งเตือนว่าล้มเหลว
      toast.error(`เชื่อมต่อใหม่กล้อง ${getCameraName(cameraId)} ไม่สำเร็จ`);
    }
  };

  // ปุ่ม "ปิดตัวนี้" สำหรับปิดกล้องทีละตัว
  const handleCloseCamera = async (cameraId) => {
    try {
      // เรียก API ปิดกล้องตัวที่ระบุ
      await axios.get(`camera/close-camera/${cameraId}`);
      // ปิด WebSocket สตรีมภาพของกล้องนี้
      safeCloseWS(cameraId);
      // ปิด WebSocket summary ของกล้องนี้
      safeCloseSummaryWS(cameraId);
      // แจ้งเตือนว่าปิดกล้องแล้ว
      toast.success(`ปิดกล้อง ${getCameraName(cameraId)} แล้ว`);
    } catch (err) {
      // แจ้งเตือนว่าปิดกล้องไม่สำเร็จ
      toast.error("ปิดกล้องไม่สำเร็จ");
      // log error เพื่อ debug
      console.error("ปิดกล้องไม่สำเร็จ :", err);
    }
  };

  // ปุ่ม "ปิดกล้องทั้งหมด"
  const handleCloseAll = async () => {
    // ตั้งสถานะว่าไม่ได้กำลังบันทึก/ตรวจจับแล้ว
    setIsRecording(false);
    // รีเซ็ตตัวจับเวลาให้กลับไปเริ่มต้นที่ 0
    setTimer(0);
    try {
      // ปิด WebSocket สตรีมภาพทุกกล้อง
      Object.keys(wsRefs.current).forEach((id) => safeCloseWS(id));
      // ปิด WebSocket summary ทุกกล้อง
      Object.keys(summaryRefs.current).forEach((id) => safeCloseSummaryWS(id));

      // แจ้งหลังบ้านให้ปิดกล้องทั้งหมด
      await axios.get("camera/close-all");
      // แจ้งเตือนผู้ใช้
      toast.success("ปิดกล้องทั้งหมดแล้ว");
    } catch {
      // ถ้าปิดไม่สำเร็จ แจ้งเตือน
      toast.error("ปิดกล้องทั้งหมดไม่สำเร็จ");
    }
  };

  // ปุ่ม "เริ่มต้นตรวจจับทุกกล้อง"
  const handleStartDetect = async () => {
    // ถ้าตอนนี้กำลังตรวจจับอยู่แล้ว ไม่ต้องสั่งซ้ำ
    if (isRecording) return;

    // ตั้งค่าว่าตอนนี้เริ่มตรวจจับแล้ว
    setIsRecording(true);

    try {
      // เปิด WebSocket summary สำหรับทุกกล้อง
      cameras.forEach((cam) => {
        connectSummarySocket(cam.id);
      });

      // เรียก API ให้เริ่มตรวจจับทุกกล้อง
      const resStartDetect = await axios.get(`camera/start-all`);
      // รับรายการ id กล้องที่เริ่มตรวจจับสำเร็จจากหลังบ้าน
      const started_ids = resStartDetect.data.started || [];

      // แจ้งเตือนว่าการเริ่มตรวจจับสำเร็จ
      toast.success(`เริ่มตรวจจับทุกกล้อง`);
    } catch (error) {
      // ถ้ามี error ให้ยกเลิกสถานะกำลังบันทึก
      setIsRecording(false);
      // log error
      console.error("การตรวจจับเกิดข้อผิดพลาด", error);
      // แจ้งเตือนผู้ใช้
      toast.error("เริ่มต้นตรวจจับไม่สำเร็จ");
    }
  };

  // ปุ่ม "จบการตรวจจับ"
  const handleStopDetect = async (e) => {
    // กัน event ปกติ (เผื่ออยู่ใน form) ไม่ให้ reload หน้า
    e.preventDefault();

    // ถ้าไม่ได้อยู่ในสถานะกำลังตรวจจับ ก็ไม่ต้องทำอะไร
    if (!isRecording) return;

    // ตั้งว่าตอนนี้หยุดตรวจจับแล้ว
    setIsRecording(false);
    // รีเซ็ต timer กลับไป 0
    setTimer(0);

    try {
      // เรียก API ให้หยุดตรวจจับทุกกล้อง
      await axios.get(`camera/stop-all`);
      // เรียก API ให้สรุปข้อมูล และส่งเข้า Supabase
      const summaryRes = await axios.get(`camera/summary-to-supabase`);
      // log ข้อมูลที่หลังบ้านตอบกลับมา
      console.log("Summary Done:", summaryRes.data);

      // หน่วงเวลานิดหน่อย (0.8 วินาที) เผื่อให้หลังบ้านทำงานเสร็จ
      await new Promise((resolve) => setTimeout(resolve, 800));

      // ปิด WebSocket summary ทุกตัว
      Object.keys(summaryRefs.current).forEach((id) => safeCloseSummaryWS(id));

      // แจ้งเตือนว่าหยุดตรวจจับเรียบร้อย
      toast.success(`หยุดการตรวจจับทุกกล้อง`);
      // ส่งผู้ใช้ไปยังหน้า "สรุปผล" ของ user
      navigate("/user/summarize/");
    } catch (error) {
      // ถ้ามีปัญหาระหว่างหยุดตรวจจับ ให้ log ไว้
      console.error("การหยุดตรวจจับเกิดข้อผิดพลาด", error);
      // แจ้งเตือนผู้ใช้ว่าหยุดไม่สำเร็จ
      toast.error("หยุดการตรวจจับไม่สำเร็จ");
    }
  };

  // ---------------------- ระบบ Timer นับเวลาบันทึก ----------------------

  // useEffect สำหรับนับเวลาเมื่อ isRecording เป็น true
  useEffect(() => {
    // ประกาศตัวแปรเก็บ id ของ setInterval
    let intervalId;
    // ถ้าตอนนี้กำลังบันทึก/ตรวจจับอยู่
    if (isRecording) {
      // ตั้ง Interval ให้ทำงานทุก 1000ms (1 วินาที)
      intervalId = setInterval(
        // ฟังก์ชันที่ถูกเรียกทุก 1 วิ: เพิ่ม timer ทีละ 1
        () => setTimer((t) => t + 1),
        1000
      );
    }
    // ฟังก์ชัน cleanup: ถ้า effect ถูกเปลี่ยนหรือ component ถูกถอด
    return () => intervalId && clearInterval(intervalId);
  }, [isRecording]); // จะ run ใหม่ทุกครั้งที่ isRecording เปลี่ยน

  // ---------------------- ส่วน UI (สิ่งที่จะแสดงบนหน้าเว็บ) ----------------------

  // JSX ที่ return ออกไป คือโครงหน้าทั้งหมด
  return (
    <>
      {/* Navbar ด้านบนของหน้า */}
      <Navbar />

      {/* พื้นที่เนื้อหาหลักของหน้า มี padding รอบ ๆ */}
      <div className="p-4 sm:p-6 md:p-8 lg:p-10">
        {/* แสดงเส้นทาง Breadcrumb (เช่น หน้าแรก > ตารางสอน > บันทึก) */}
        <MyBreadcrumb />

        {/* layout แบ่ง 2 คอลัมน์: ซ้ายใหญ่ (กล้อง), ขวาเล็ก (summary) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* กล่องฝั่งซ้าย: ใช้พื้นที่ 2 ใน 3 (lg:col-span-2) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 sm:p-6 border border-gray-200">
            {/* ส่วนหัว (Header) แสดงสถานะการตรวจจับ และเวลา */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
              {/* แสดงจุดไฟ บอกว่าสถานะกำลังตรวจจับ/พร้อมเริ่ม */}
              <div className="flex items-center space-x-3">
                {/* วงกลมด้านนอก มี ring แสดงสีต่างกันตามสถานะ */}
                <div
                  className={`w-5 h-5 rounded-full ring-2 ring-offset-2 ${
                    isRecording ? "ring-red-300" : "ring-green-300"
                  } flex items-center justify-center`}
                >
                  {/* วงกลมด้านใน ถ้ากำลังตรวจจับจะกระพริบสีแดง */}
                  <div
                    className={`w-3.5 h-3.5 rounded-full ${
                      isRecording ? "bg-red-500 animate-pulse" : "bg-green-500"
                    }`}
                  />
                </div>
                {/* ข้อความอธิบายสถานะ */}
                <div>
                  {/* ตัวหนังสือเล็กสีเทา บอกหัวข้อ */}
                  <div className="text-sm text-gray-500">สถานะการตรวจจับ</div>
                  {/* ตัวหนังสือหนา แสดงข้อความตามสถานะ */}
                  <div className="font-semibold text-gray-800">
                    {isRecording ? "กำลังตรวจจับ" : "พร้อมเริ่มต้น"}
                  </div>
                </div>
              </div>

              {/* ส่วนแสดงเวลาในการบันทึก */}
              <div className="text-right">
                {/* หัวข้อเล็กสีเทา */}
                <div className="text-sm text-gray-500">ระยะเวลาบันทึก</div>
                {/* ตัวเลขเวลาแบบฟอนต์ Mono ดูเหมือนนาฬิกา */}
                <div className="text-2xl font-mono font-bold">
                  {formatTime(timer)}
                </div>
              </div>
            </div>

            {/* แถวของปุ่มควบคุมต่าง ๆ */}
            <div className="flex flex-wrap gap-3 mb-4">
              {/* ปุ่มเริ่มตรวจจับทุกกล้อง */}
              <button
                className={`px-4 py-2 rounded-lg text-white font-semibold ${
                  isRecording
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-500"
                }`}
                // ถ้ากำลังบันทึกอยู่ ให้ disable ปุ่ม
                disabled={isRecording}
                // เมื่อกดเรียกฟังก์ชัน handleStartDetect
                onClick={handleStartDetect}
              >
                เริ่มต้นตรวจจับทุกกล้อง
              </button>

              {/* ปุ่มหยุดการตรวจจับ */}
              <button
                className={`px-4 py-2 rounded-lg text-white font-semibold ${
                  !isRecording ? "bg-gray-400 cursor-not-allowed" : "bg-red-500"
                }`}
                // ถ้าไม่ได้บันทึกอยู่ ก็ disable ปุ่ม
                disabled={!isRecording}
                // เมื่อกดเรียก handleStopDetect
                onClick={handleStopDetect}
              >
                จบการตรวจจับ
              </button>

              {/* ปุ่มปิดกล้องทั้งหมด */}
              <button
                className="px-4 py-2 rounded-lg font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100"
                onClick={handleCloseAll}
              >
                ปิดกล้องทั้งหมด
              </button>
            </div>

            {/* ถ้ากำลังโหลดรายการกล้อง ให้โชว์ข้อความนี้ */}
            {loading && (
              <div className="text-center text-gray-500 my-6">
                กำลังโหลดรายการกล้อง...
              </div>
            )}

            {/* ถ้าไม่โหลดแล้ว และไม่พบกล้องเลย ให้โชว์ข้อความนี้ */}
            {!loading && cameras.length === 0 && (
              <div className="text-center text-gray-500 my-6">
                ไม่พบกล้องในระบบ กำลังสแกน...
              </div>
            )}

            {/* Grid แสดงการ์ดของแต่ละกล้อง */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* วน loop แสดงกล้องทุกตัวใน cameras */}
              {cameras.map((cam) => (
                // กล่องของกล้องแต่ละตัว
                <div
                  key={cam.id} // key สำหรับ React
                  className="border border-gray-300 rounded-2xl p-3 flex flex-col items-center bg-white shadow-sm"
                >
                  {/* ชื่อกล้อง ถ้ามี name ในข้อมูลก็ใช้เลย ไม่งั้น generate จาก id */}
                  <h3 className="font-semibold text-lg mb-2 text-center">
                    {getCameraName(cam.id)}
                  </h3>

                  {/* พื้นที่โชว์ภาพจากกล้อง (ใช้ canvas ในกรอบ 16:9) */}
                  <div className="w-full aspect-video bg-black rounded-xl overflow-hidden mb-3 flex items-center justify-center">
                    {/* canvas ของกล้องนี้ ใช้ ref เพื่อให้โค้ดด้านบนวาดรูปใส่ */}
                    <canvas
                      ref={(el) => (canvasRef.current[cam.id] = el)}
                      width={640} // กำหนดความกว้างเดิมของ canvas
                      height={460} // กำหนดความสูงเดิมของ canvas
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* กล่องฝั่งขวา: แสดงข้อมูลสรุประหว่างสอน (Summary) */}
          <div className="bg-white rounded-2xl shadow p-4 sm:p-6 border border-gray-200">
            {/* หัวข้อของกล่อง summary */}
            <h2 className="text-lg font-semibold mb-3">ข้อมูลสรุประหว่างสอน</h2>

            {/* โซนเลื่อนดู summary ได้สูงสุด 500px ถ้าเกินจะมี scrollbar */}
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {/* วนแสดงข้อมูล summary ที่ถูก push จาก WebSocket */}
              {summaryData.map((item, index) => (
                // กล่องแต่ละรายการ summary
                <div
                  key={index}
                  className="bg-white shadow rounded-xl p-4 border border-gray-200 flex gap-4"
                >
                  {/* ปุ่มซ้าย: Info */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">
                      กล้อง {Number(item.cameraId) + 1}
                    </h3>

                    <p className="text-sm text-gray-500">
                      เวลา: {item.data.Time}
                    </p>

                    {/* ค่า Attention */}
                    {/*<div className="mt-2">
                      <p className="text-sm font-medium text-green-600">
                        ✔ ตั้งใจเรียน: {(item.data.Attention * 100).toFixed(1)}%
                      </p>
                      <p className="text-sm font-medium text-red-600">
                        ✘ ไม่ตั้งใจ:{" "}
                        {(item.data.Non_Attention * 100).toFixed(1)}%
                      </p>
                    </div>*/}
                  </div>

                  {/* รูป summary */}
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

// export Component นี้ออกไปใช้ในไฟล์อื่น
export default RecordPage;
