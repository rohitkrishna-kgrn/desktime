'use client';

import Cookies from 'js-cookie';

const TOKEN_KEY = 'dt_token';
const USER_KEY = 'dt_user';
const COOKIE_OPTS = { expires: 1, sameSite: 'strict' }; // 1 day

export function saveSession(token, user) {
  Cookies.set(TOKEN_KEY, token, COOKIE_OPTS);
  Cookies.set(USER_KEY, JSON.stringify(user), COOKIE_OPTS);
}

export function clearSession() {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(USER_KEY);
}

export function getToken() {
  return Cookies.get(TOKEN_KEY) || null;
}

export function getStoredUser() {
  try {
    const raw = Cookies.get(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!getToken();
}
