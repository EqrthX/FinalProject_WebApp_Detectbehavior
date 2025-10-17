import axios from "axios";

const instance = axios.create({
    baseURL: "http://localhost:8000/api",
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    },
    // withCredentials: true // เปิดใช้งาน cookie
})

export default instance