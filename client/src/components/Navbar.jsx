import React from 'react'
import { NavLink } from 'react-router-dom'

export const Navbar = () => {
    return (
        <div className='w-full h-20 flex bg-gray-300 justify-center items-center-safe'>
            <nav className='flex justify-between w-full'>
                {/* Left section, you can add content here */}
                <div className='w-full'></div>

                <div className="bg-white w-full rounded-2xl p-2 flex justify-around gap-8">
                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            isActive ? 'bg-[#38A738] text-white p-2 rounded-2xl flex items-center justify-center' : 'text-gray-700 flex items-center justify-center'
                        }
                    >
                        หน้าแรก
                    </NavLink>
                    <NavLink
                        to="/schedule"
                        className={({ isActive }) =>
                            isActive ? 'bg-[#38A738] text-white p-2 rounded-2xl flex items-center justify-center' : 'text-gray-700 flex items-center justify-center'
                        }
                    >
                        ตารางสอน
                    </NavLink>
                    <NavLink
                        to="/results"
                        className={({ isActive }) =>
                            isActive ? 'bg-[#38A738] text-white p-2 rounded-2xl flex items-center justify-center' : 'text-gray-700 flex items-center justify-center'
                        }
                    >
                        สรุปผล
                    </NavLink>
                </div>

                {/* Right section, you can add content here */}
                <div className='w-full'></div>
            </nav>
        </div>
    )
}
