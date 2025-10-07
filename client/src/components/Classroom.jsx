import React from 'react';

const Classroom = () => {
  const handleCourseClick = (courseId) => {
    console.log('คลิกวิชา:', courseId);
    // สามารถเพิ่ม logic เพิ่มเติมได้ เช่น แสดง modal หรือเปิดหน้ารายละเอียดวิชา
  };

  return (
    // <div className="min-h-screen bg-gray-50 p-6">
    //   <div className="max-w-7xl mx-auto">
        <div className="">
          {/* ตารางเรียน */}
          <div className="col-span-2 bg-white rounded-2xl  p-6 ">
            <h2 className="flex items-center space-x-2 text-lg font-semibold text-black mb-4">
              <span>📅</span>
              <span>ตารางสอน</span>
            </h2>
            <h2 className="flex justify-center items-center gap-20">
              <span>ปีการศึกษา </span>
              <b><u>2568</u></b>
              <span>ภาคการศึกษา</span>
              <b><u>1</u></b>
            </h2>

            <table className="w-full text-center border-collapse border border-gray-300 mt-10">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-300 p-0.5">Day/Time</th>
                  <th className="border border-gray-300 p-0.5">8:00-9:00</th>
                  <th className="border border-gray-300 p-0.5">9:00-10:00</th>
                  <th className="border border-gray-300 p-0.5">10:00-11:00</th>
                  <th className="border border-gray-300 p-0.5">11:00-12:00</th>
                  <th className="border border-gray-300 p-0.5">12:00-13:00</th>
                  <th className="border border-gray-300 p-0.5">13:00-14:00</th>
                  <th className="border border-gray-300 p-0.5">14:00-15:00</th>
                  <th className="border border-gray-300 p-0.5">15:00-16:00</th>
                  <th className="border border-gray-300 p-0.5">16:00-17:00</th>
                </tr>
              </thead>
              <tbody>
                {/* จันทร์ */}
                <tr>
                  <td className="bg-gray-100 border border-gray-300 p-1">จันทร์</td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td
                    colSpan={4}
                    className="bg-yellow-400 text-xs cursor-pointer hover:bg-orange-500 transition-colors p-2 border border-gray-300"
                    onClick={() => handleCourseClick('SI243-59')}
                  >
                    <u>SI235-1</u> กลุ่ม 1 <br />ห้อง 7501 อาคาร 07 <br />[12:20 - 16:10]
                  </td>
                  <td className="border border-gray-300"></td>
                </tr>
                {/* อังคาร */}
                <tr>
                  <td className="bg-gray-100 border border-gray-300 p-1">อังคาร</td>
                  <td className="border border-gray-300"></td>
                  <td
                    colSpan={2}
                    className="bg-yellow-400 text-xs cursor-pointer hover:bg-orange-400 transition-colors p-2 border border-gray-300"
                    onClick={() => handleCourseClick('SP348-1')}
                  >
                    <u>SI230-1</u> กลุ่ม 1 <br />ห้อง 5401 อาคาร 05 <br />[8:30 - 11:00]
                  </td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td
                    colSpan={3}
                    className="bg-yellow-400 text-xs cursor-pointer hover:bg-orange-400 transition-colors p-2 border border-gray-300"
                    onClick={() => handleCourseClick('SP348-1')}
                  >
                    <u>SI423-1</u> กลุ่ม 1 <br />ห้อง 1205B อาคาร 01 <br />[13:10 - 16:00]
                  </td>
                </tr>

                {/* พุธ */}
                <tr>
                  <td className="bg-gray-100 border border-gray-300 p-1">พุธ</td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                </tr>
                {/* พฤหัสบดี */}
                <tr>
                  <td className="bg-gray-100 border border-gray-300 p-1">พฤหัสบดี</td>
                  <td className="border border-gray-300"></td>
                  <td
                    colSpan={3}
                    className="bg-yellow-400 text-xs cursor-pointer hover:bg-orange-400 transition-colors p-2 border border-gray-300"
                    onClick={() => handleCourseClick('SP338-1-G2')}
                  >
                    <u>SP338-1</u> กลุ่ม 2 <br />ห้อง 1205B อาคาร 01 <br />[8:30 - 12:20]
                  </td>
                  <td className="border border-gray-300"></td>
                  <td
                    colSpan={3}
                    className="bg-yellow-400 text-xs cursor-pointer hover:bg-orange-500 transition-colors p-2 border border-gray-300"
                    onClick={() => handleCourseClick('SP338-1-G1')}
                  >
                    <u>SP338-1</u> กลุ่ม 1 <br />ห้อง 1205B อาคาร 01 <br />[12:20 - 16:10]
                  </td>
                  <td className="border border-gray-300"></td>
                </tr>
                {/* ศุกร์ */}
                <tr>
                  <td className="bg-gray-100 border border-gray-300 p-1">ศุกร์</td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                  <td className="border border-gray-300"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
    //   </div>
    // </div>
  );
};

export default Classroom;