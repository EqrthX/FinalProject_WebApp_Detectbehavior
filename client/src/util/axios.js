import axios from "axios";

const instance = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE}` || "http://localhost:8000/api",
  timeout: 10000,
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config
})
export default instance;
