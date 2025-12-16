import React from "react";
import { Link, useLocation } from "react-router-dom";

// ... ไอคอน ChevronRightIcon (เหมือนเดิม) ...
const ChevronRightIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-5 h-5 text-gray-400"
    >
        <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
        />
    </svg>
);

const Breadcrumbs = () => {
    const location = useLocation();
    const crumbs = [];

    const pathnames = location.pathname
        .split("/")
        .filter((x) => x && x !== "admin");

    pathnames.forEach((name, index) => {
        const isLast = index === pathnames.length - 1;
        let breadcrumbName = "";
        let routeTo = "";

        if (name === "AdminTeachers") {
            breadcrumbName = "รายชื่ออาจารย์";
            routeTo = "/admin/AdminTeachers";
        } else if (name === "AdminClassRoom") {
            crumbs.push(
                <li key="teachers-list" className="flex items-center">
                    {index > 0 && <ChevronRightIcon />}{" "}
                    <Link
                        to="/admin/AdminTeachers"
                        className="ml-1 text-gray-500 hover:text-[#38A738]"
                    >
                        รายชื่ออาจารย์
                    </Link>
                </li>
            );

            const teacherName = location.state?.teacher?.fullname;
            breadcrumbName = teacherName || "รายละเอียดตารางสอน";
            routeTo = location.pathname;
        } else if (name === "AdminTeachingschedule") {
            breadcrumbName = "ตารางสอนรวม";
            routeTo = "/admin/AdminTeachingschedule";
        } else {
            breadcrumbName = name;
            routeTo = `/admin/${name}`;
        }

        if (breadcrumbName) { 
            crumbs.push(
                <li key={name} className="flex items-center">
                    {(index > 0 || crumbs.length > 0) && <ChevronRightIcon />}
                    {isLast ? (
                        <span className="ml-1 font-medium text-gray-800">
                            {breadcrumbName}
                        </span>
                    ) : (
                        <Link
                            to={routeTo}
                            className="ml-1 text-gray-500 hover:text-[#38A738]"
                        >
                            {breadcrumbName}
                        </Link>
                    )}
                </li>
            );
        }
    });

    return (
        <nav className="mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-1 text-sm">{crumbs}</ol>
        </nav>
    );
};

export default Breadcrumbs;