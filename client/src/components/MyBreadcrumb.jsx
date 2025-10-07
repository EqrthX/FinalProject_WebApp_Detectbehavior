import React from 'react';
import { Breadcrumb } from 'antd';
import { NavLink, useLocation } from 'react-router-dom';

const steps = [
  { key: 'TeachingSchedule', to: '/user/TeachingSchedule', label: 'ตารางสอน' },
  { key: 'Record',            to: '/user/Record',           label: 'เริ่มบันทึก' },
  { key: 'summarize',         to: '/user/summarize',        label: 'สรุปผล' },
];

const MyBreadcrumb = () => {
  const { pathname } = useLocation();

  // หา “ขั้น” ปัจจุบันจาก pathname แล้วแสดงตั้งแต่ขั้นแรกจนถึงขั้นนั้น
  const currentIndex =
    steps.findIndex(s => pathname.toLowerCase().includes(s.key.toLowerCase()));

  const itemsToShow = (currentIndex === -1 ? [steps[0]] : steps.slice(0, currentIndex + 1));

  return (
    <Breadcrumb separator=" / ">
      {itemsToShow.map(s => (
        <Breadcrumb.Item key={s.key}>
          <NavLink
            to={s.to}
            className={({ isActive }) =>
              isActive
                ? 'bg-[#38A738] text-white px-4 py-1 rounded-lg'
                : 'text-gray-700 px-4 py-1 hover:text-[#38A738]'
            }
          >
            {s.label}
          </NavLink>
        </Breadcrumb.Item>
      ))}
    </Breadcrumb>
  );
};

export default MyBreadcrumb;
