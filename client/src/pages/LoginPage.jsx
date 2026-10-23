import { useState } from "react";
import BG from "../assets/backgroud.png";
import { Link, useNavigate } from "react-router-dom";
import axios from "../util/axios.js";
import toast from "react-hot-toast";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const LoginPage = () => {
  const [values, setValues] = useState({
    teacherId: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    if (!values.teacherId || !values.password) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบ");
      setIsLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("teacher_id", values.teacherId);
      formData.append("password", values.password);

      const res = await axios.post("/auth/login-by-id", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data;

      if (!["admin", "teacher"].includes(data.role)) {
        throw new Error("ไม่พบสิทธิ์ของผู้ใช้บัญชีนี้");
      }

      if (!data.access_token) {
        throw new Error("ไม่ได้รับ token สำหรับเข้าสู่ระบบ");
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("teacher_id", data.teacher_id ?? "");
      localStorage.setItem("fullname", data.fullname ?? "");
      localStorage.setItem("major", data.major ?? "");

      toast.success("เข้าสู่ระบบสำเร็จ");

      navigate(
        data.role === "admin"
          ? "/admin/AdminHomepage"
          : "/user/Homepage"
      );

    } catch (error) {
      const detail = error.response?.data?.detail;

      const message =
        typeof detail === "string"
          ? detail
          : error.response
            ? "เข้าสู่ระบบไม่สำเร็จ"
            : error.isAxiosError
              ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่"
              : error.message || "เข้าสู่ระบบไม่สำเร็จ";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="w-full h-screen bg-cover bg-center flex items-center justify-end"
      style={{
        backgroundImage: `url(${BG})`,
        backgroundSize: "cover",
        backgroundPosition: "top",
      }}
    >
      {/* Card ด้านขวา */}
      <div className="w-full max-w-lg bg-white shadow-lg rounded-xl p-8 mr-20">
        <h1 className="text-3xl font-bold mb-6 text-center">เข้าสู่ระบบ</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="teacherId"
              className="block mb-1 font-semibold text-gray-700"
            >
              รหัสประจำตัว
            </label>
            <input
              id="teacherId"
              name="teacherId"
              type="text"
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* ▼▼▼ ส่วนของรหัสผ่านที่แก้ไข ▼▼▼ */}
          <div>
            <label
              htmlFor="password"
              className="block mb-1 font-semibold text-gray-700"
            >
              รหัสผ่าน
            </label>
            {/* 3. หุ้มด้วย div.relative */}
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"} // <-- 4. เปลี่ยน type ตาม State
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10" // <-- เพิ่ม pr-10 (padding-right)
              />
              {/* 5. เพิ่มปุ่ม Toggle */}
              <button
                type="button" // <-- สำคัญมาก: ป้องกันไม่ให้ปุ่มนี้ submit form
                onClick={() => setShowPassword(!showPassword)} // <-- สลับค่า State
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
              </button>
            </div>
          </div>
          {/* ▲▲▲ สิ้นสุดส่วนที่แก้ไข ▲▲▲ */}

          <Link to="/forgot-password" className="self-end rounded text-sm text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
            ลืมรหัสผ่าน?
          </Link>

          {errorMessage && (
            <p className="text-red-500 text-center font-medium">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-700 text-white w-full py-3 rounded-md font-semibold hover:bg-blue-800 transition-colors"
          >
            {isLoading ? "กำลังเข้าสู่ระบบ..." : "ยืนยัน"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
