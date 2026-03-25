'use client';

import axios from 'axios';
import Cookies from 'js-cookie';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = Cookies.get('dt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove('dt_token');
      Cookies.remove('dt_user');
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then((r) => r.data);
export const register = (email, password, name) =>
  api.post('/auth/register', { email, password, name }).then((r) => r.data);
export const getMe = () => api.get('/auth/me').then((r) => r.data);

// Attendance
export const getAttendanceStatus = () =>
  api.get('/attendance/status').then((r) => r.data);
export const getAttendanceLogs = (params) =>
  api.get('/attendance/logs', { params }).then((r) => r.data);
export const getAttendanceLogsForUser = (userId, params) =>
  api.get(`/attendance/logs/${userId}`, { params }).then((r) => r.data);
// ⚠️ Testing only — manual attendance toggle
export const manualAttendance = (action) =>
  api.post('/attendance/manual', { action }).then((r) => r.data);

// Screenshots
export const getScreenshots = (params) =>
  api.get('/screenshots', { params }).then((r) => r.data);
export const getScreenshotsForUser = (userId, params) =>
  api.get(`/screenshots/${userId}`, { params }).then((r) => r.data);
export const getScreenshotImageUrl = (fileId) => {
  const token = Cookies.get('dt_token');
  return `${BASE_URL}/screenshots/image/${fileId}${token ? `?token=${token}` : ''}`;
};

// Productivity
export const getProductivitySummary = (params) =>
  api.get('/productivity/summary', { params }).then((r) => r.data);
export const getProductivitySummaryForUser = (userId, params) =>
  api.get(`/productivity/summary/${userId}`, { params }).then((r) => r.data);
export const getAppBreakdown = (params) =>
  api.get('/productivity/apps', { params }).then((r) => r.data);
export const getAppBreakdownForUser = (userId, params) =>
  api.get(`/productivity/apps/${userId}`, { params }).then((r) => r.data);

// Users (admin)
export const getUsers = (params) =>
  api.get('/users', { params }).then((r) => r.data);
export const getUser = (id) =>
  api.get(`/users/${id}`).then((r) => r.data);
export const updateUser = (id, data) =>
  api.patch(`/users/${id}`, data).then((r) => r.data);
export const updateUserRole = (id, role) =>
  api.patch(`/users/${id}/role`, { role }).then((r) => r.data);
export const deleteUser = (id) =>
  api.delete(`/users/${id}`).then((r) => r.data);

// App Rules (admin)
export const getRules = () =>
  api.get('/users/rules/all').then((r) => r.data);
export const createRule = (data) =>
  api.post('/users/rules', data).then((r) => r.data);
export const deleteRule = (id) =>
  api.delete(`/users/rules/${id}`).then((r) => r.data);

export default api;
