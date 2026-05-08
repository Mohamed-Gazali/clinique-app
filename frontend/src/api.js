import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

// Injecte automatiquement le token JWT dans chaque requête
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Déconnexion automatique si token expiré
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default API;