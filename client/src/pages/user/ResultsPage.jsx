import React from "react";
import Navbar from "../../components/Navbar";
import CustomSelect from "../../components/CustomSelect";
import SessionCard from "../../components/SessionCard";
import { useResultsData } from "../../util/useResultsData";
import { Pagination } from "antd";
import {
  BarChartOutlined,
  CalendarOutlined,
  BookOutlined,
  TeamOutlined,
} from "@ant-design/icons";

const ResultsPage = () => {
  const {
    loading,
    paginatedData,
    currentPage,
    setCurrentPage,
    pageSize,
    totalCount,
    uniqueDates,
    uniqueSubjects,
    uniqueSections,
    selectedDate,
    setSelectedDate,
    selectedSubject,
    setSelectedSubject,
    selectedSection,
    setSelectedSection,
  } = useResultsData();

  return (
    <div className="flex flex-col h-screen bg-[#F6F6F4] overflow-hidden">
      <div className="relative z-[1000]">
        <Navbar />
      </div>

      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        {/* Header Filters */}
        <div className="bg-white rounded-[20px] p-4 shadow-sm border border-[#e9e9e9] flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 flex-shrink-0 z-50">
          <div className="flex items-center gap-2">
            <BarChartOutlined className="text-2xl text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-700">ผลลัพธ์การเรียนการสอน</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CustomSelect
              placeholder="-- ทุกวัน --"
              options={uniqueDates}
              value={selectedDate}
              onChange={setSelectedDate}
              prefixIcon={<CalendarOutlined />}
            />
            <CustomSelect
              placeholder="-- ทุกวิชา --"
              options={uniqueSubjects.map((sub) => ({ value: sub, label: `วิชา ${sub}` }))}
              value={selectedSubject}
              onChange={setSelectedSubject}
              prefixIcon={<BookOutlined />}
            />
            <CustomSelect
              placeholder="-- ทุกกลุ่ม --"
              options={uniqueSections.map((sec) => ({ value: sec, label: `กลุ่ม ${sec}` }))}
              value={selectedSection}
              onChange={setSelectedSection}
              prefixIcon={<TeamOutlined />}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-gray-400 bg-white rounded-[20px] border border-gray-200">
              <p className="text-lg font-medium">กำลังโหลดข้อมูล...</p>
            </div>
          ) : paginatedData.length > 0 ? (
            <div className="flex flex-col gap-6">
              {paginatedData.map((data, index) => (
                <SessionCard key={data.key || index} data={data} />
              ))}
              
              {/* Pagination controls */}
              <div className="flex justify-center mt-2 mb-6 bg-white p-4 rounded-[20px] shadow-sm border border-[#e9e9e9]">
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={totalCount}
                  onChange={(page) => setCurrentPage(page)}
                  showSizeChanger={false}
                  align="center"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[500px] text-gray-400 bg-white rounded-[20px] border border-gray-200">
              <BarChartOutlined className="text-6xl mb-4 opacity-20" />
              <p className="text-lg">ไม่พบข้อมูลการเรียนการสอน</p>
              <p className="text-sm">ลองปรับเปลี่ยนตัวกรองวันที่ หรือ วิชา</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;