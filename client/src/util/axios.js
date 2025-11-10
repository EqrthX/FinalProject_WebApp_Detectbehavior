import axios from "axios";

const instance = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE}` || "http:localhost:8000/api",
  timeout: 10000,
});

export default instance;
