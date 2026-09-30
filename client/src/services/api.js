import axios from "axios";
import { disconnectSocket } from "./socket";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("sos_token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("sos_token");
      localStorage.removeItem("sos_user");
      disconnectSocket();
      const isAuthPage = ["/login", "/register"].some((path) =>
        window.location.pathname.includes(path)
      );
      if (!isAuthPage) {
        window.location.href = "/login?expired=true";
      }
    }
    return Promise.reject(error);
  }
);

export const getContactResponse = (token) =>
  API.get(`/sos/respond/${encodeURIComponent(token)}`);

export const acknowledgeContactAlert = (token) =>
  API.post(`/sos/respond/${encodeURIComponent(token)}/acknowledge`);

export default API;
