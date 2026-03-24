const axios = require('axios');
const storage = require('./storage');

const API_BASE_URL = 'https://backend-desktime.averelabs.com/api';

function getClient() {
  const token = storage.getToken();
  return axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function login(email, password) {
  const client = getClient();
  const res = await client.post('/auth/login', { email, password });
  return res.data; // { token, user }
}

async function register(email, password, name) {
  const client = getClient();
  const res = await client.post('/auth/register', { email, password, name });
  return res.data; // { token, user }
}

async function sendHeartbeat() {
  const client = getClient();
  await client.post('/attendance/heartbeat');
}

async function deactivateClient() {
  const client = getClient();
  await client.post('/attendance/deactivate');
}

async function uploadScreenshot(buffer, timestamp) {
  const client = getClient();
  const FormData = require('form-data');
  const form = new FormData();
  form.append('screenshot', buffer, {
    filename: `screenshot_${Date.now()}.jpg`,
    contentType: 'image/jpeg',
  });
  form.append('timestamp', timestamp.toISOString());
  const res = await client.post('/screenshots/upload', form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  return res.data;
}

async function sendProductivityLogs(logs) {
  if (!logs.length) return;
  const client = getClient();
  await client.post('/productivity/log', { logs });
}

async function getAttendanceStatus() {
  const client = getClient();
  const res = await client.get('/attendance/status');
  return res.data;
}

module.exports = {
  login,
  register,
  sendHeartbeat,
  deactivateClient,
  uploadScreenshot,
  sendProductivityLogs,
  getAttendanceStatus,
};
