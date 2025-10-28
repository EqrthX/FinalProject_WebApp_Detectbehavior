import React from "react";
import AdminNavbar from "../../components/AdminNavbar";
import Adminsubject from "../../components/Adminsubject";
import AdminChart from "../../components/AdminChart";

const AdminHomePage = () => {
  return (
    <div className="min-h-screen bg-[#f6f6f4] flex flex-col md:flex-row gap-4 p-4">
      {/* Sidebar */}
      <aside className="w-full md:w-64">
        <AdminNavbar />
      </aside>

      {/* Main */}
      <main
        className="flex-1 transition-all
                 lg:pl-[0rem]  md:pl-0  sm:pl-0"
      >
        {" "}
        {/* ขยับขวาให้พ้น sidebar เฉพาะจอใหญ่ */}
        <div className="max-w-screen-2xl mx-auto px-6 md:px-4">
          {/* Top bar */}
          <div
            className="w-full bg-white rounded-[20px] border border-[#e9e9e9] shadow-sm
                    h-20 md:h-16 px-6 md:px-4
                    mt-2 md:mt-3 lg:mt-5 flex items-center"
          >
            {" "}
            {/* ขยับลง: mt-2/3/4 ตามจอ */}
            <h1 className="text-[22px] md:text-[18px] font-semibold text-black ">
              Dashboard
            </h1>
          </div>

          {/* เนื้อหา */}
          <div
            className="
  grid gap-10 
  grid-cols-1 md:grid-cols-2   /* 👈 จอเล็ก 1 คอลัมน์, จอ md+ เป็น 2 */
  items-start
  max-w-screen-2xl mx-auto lg:mt-4
"
          >
            <div>
              <AdminChart />
            </div>

            <div>
              <Adminsubject />
            </div>

            {/* กล่องคณะทั้งหมด */}
            <div
            className=" flex justify-between gap-11 w-full items-center ml-"
          >
            {[
              { title: "คณะทั้งหมด", value: 6 },
              { title: "วิชาทั้งหมด", value: 124 },
              { title: "อาจารย์ทั้งหมด", value: 42 },
            ].map((item, i) => (
              <div
                key={i}
                className="
                  flex-1 min-w-[350px] max-w-[600px]
                  bg-white rounded-[20px] border border-[#e9e9e9]
                  p-6 shadow-sm flex flex-col items-center justify-center
                  transition-all
                "
              >
                <h2 className="text-lg font-medium text-gray-700 mb-2 text-center">
                  {item.title}
                </h2>
                <p className="text-2xl font-bold text-[#38a738]">
                  {item.value}
                </p>
              </div>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminHomePage;
