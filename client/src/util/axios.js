import axios from "axios";

const instance = axios.create({
    baseURL: `${import.meta.env.VITE_API_BASE}`,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    },
    // withCredentials: true // เปิดใช้งาน cookie
})

export default instance