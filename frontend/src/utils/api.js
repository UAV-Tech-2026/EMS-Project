import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";


export const authApi = axios.create({
  baseURL: `${API_URL}/auth`,
  headers: { "Content-Type": "application/json" },
});


export const api = axios.create({
  baseURL: `${API_URL}`,
  headers: { "Content-Type": "application/json" },
});


[api, authApi].forEach(instance => {
  instance.interceptors.request.use(config => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
});