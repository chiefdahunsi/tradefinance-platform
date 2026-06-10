import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("tf_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }

  // Remove the default Content-Type for FormData — axios sets it automatically
  // with the correct multipart boundary. Leaving it as application/json breaks uploads.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("tf_token");
      window.location.href = "/sign-in";
    }
    return Promise.reject(err);
  }
);
