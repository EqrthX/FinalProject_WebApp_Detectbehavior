import { useState } from "react";
import BG from "../assets/backgroud.png";
import { Link, useNavigate } from "react-router-dom";
import axios from "../util/axios.js";
import toast from "react-hot-toast";

const LoginPage = () => {
  const [values, setValues] = useState({
    teacherId: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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
      const res = await axios.post("/auth/LoginPage", values, {
        withCredentials: true,
      });

      console.log("Response from server:", res.data); // ✅ Debug response

      const getRole = res.data.user.user_role;

      if (getRole === "admin") {
        navigate("/admin/AdminHomepage");
      } else if (getRole === "teacher") {
        navigate("/user/Homepage");
      } else {
        setErrorMessage("ไม่พบสิทธิ์ของผู้ใช้บัญชีนี้");
      }

      toast.success("เข้าสู่ระบบ");
    } catch (error) {
      if (error.response && error.response.status === 400) {
        toast.error(error.response.data.message);
      } else {
        console.error("Sign Up Page error: ", error);
        setErrorMessage(
          error.response?.data?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="w-full h-screen bg-cover bg-center flex items-center justify-end"
      style={{ backgroundImage: `url(${BG})`,
      backgroundSize: 'cover',
      backgroundPosition: 'top' }}
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

          <div>
            <label
              htmlFor="password"
              className="block mb-1 font-semibold text-gray-700"
            >
              รหัสผ่าน
            </label>
            <input
              id="password"
              name="password"
              type="password"
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {errorMessage && (
            <p className="text-red-500 text-center font-medium">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-700 text-white py-3 rounded-md font-semibold hover:bg-blue-800 transition-colors"
          >
            {isLoading ? "กำลังเข้าสู่ระบบ..." : "ยืนยัน"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;