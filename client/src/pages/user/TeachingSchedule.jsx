import React from 'react'
import Navbar from '../../components/Navbar'
import Classroom from '../../components/Classroom'

const TeachingSchedule = () => {
    return (
            <>
            <Navbar />
            <div className="grid grid-cols-3 gap-4  p-6">
                <div className="col-span-2 bg-white rounded-2xl shadow p-6 ">
                    <Classroom />
            <h2 className='text-[#767676] text-xs'>*หมายเหตุ : ข้อมูลตารางสอนจะมีการเปลี่ยนแปลงทุกๆ 3 เดือน และไม่สามารถเพิ่ม ลบ แก้ไข ข้อมูลได้ระหว่างภาคเทอม</h2>
                </div>

            </div>
            </>
            )
}

            export default TeachingSchedule