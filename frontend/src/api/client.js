import axios from "axios";

export const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("subscriptiq_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("subscriptiq_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    const envelope = err.response?.data?.error;
    const normalized = {
      code: envelope?.code || "NETWORK_ERROR",
      message: envelope?.message || err.message || "An unexpected error occurred",
      status: err.response?.status || 0,
      details: envelope?.details,
    };
    return Promise.reject(normalized);
  }
);

export default client;
