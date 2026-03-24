# DeskTime — Technical Documentation & API Reference

**Base URL:** `https://backend-desktime.averelabs.com/api`

All endpoints that require authentication expect a JWT bearer token:

```
Authorization: Bearer <token>
```

Tokens are obtained from the `/auth/login` or `/auth/register` endpoints and expire after **24 hours**.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Attendance](#2-attendance)
3. [Productivity](#3-productivity)
4. [Screenshots](#4-screenshots)
5. [Users (Admin)](#5-users-admin)
6. [Desktop Heartbeat & Deactivation](#6-desktop-heartbeat--deactivation)
7. [Odoo Webhook](#7-odoo-webhook)
8. [Error Format](#8-error-format)
9. [Desktop Client Active — Rule](#9-desktop-client-active--rule)

---

## 1. Authentication

### POST `/auth/register`

Creates a new employee account. The email must exist in Odoo.

**Request**
```json
{
  "email": "john@company.com",
  "password": "secret123",
  "name": "John Doe"
}
```

**Response `201`**
```json
{
  "token": "<jwt>",
  "user": {
    "id": "...",
    "email": "john@company.com",
    "name": "John Doe",
    "role": "employee",
    "department": "Engineering",
    "jobTitle": "Developer",
    "currentStatus": "checked_out"
  }
}
```

**Errors**

| Status | `error` |
|---|---|
| 400 | `"Email and password are required"` |
| 400 | `"Password must be at least 6 characters"` |
| 403 | `"This email is not registered in the company system (Odoo)."` |
| 409 | `"An account with this email already exists"` |
| 503 | `"Could not verify email with Odoo."` |

---

### POST `/auth/login`

**Request**
```json
{
  "email": "john@company.com",
  "password": "secret123"
}
```

**Response `200`**
```json
{
  "token": "<jwt>",
  "user": { "id": "...", "email": "...", "name": "...", "role": "employee", ... }
}
```

**Errors**

| Status | `error` |
|---|---|
| 400 | `"Email and password are required"` |
| 401 | `"Invalid email or password"` |

---

### GET `/auth/me`

Returns the profile of the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response `200`**
```json
{
  "id": "...",
  "email": "john@company.com",
  "name": "John Doe",
  "role": "employee",
  "department": "Engineering",
  "jobTitle": "Developer",
  "currentStatus": "checked_in",
  "lastCheckIn": "2025-03-24T09:00:00.000Z",
  "lastCheckOut": null,
  "desktopClientActive": true
}
```

---

## 2. Attendance

### GET `/attendance/status`

Returns the current attendance status for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response `200`**
```json
{
  "status": "checked_in",
  "lastCheckIn": "2025-03-24T09:00:00.000Z",
  "lastCheckOut": "2025-03-23T18:30:00.000Z",
  "location": "manual",
  "desktopClientActive": true,
  "lastHeartbeat": "2025-03-24T09:45:00.000Z"
}
```

`status` is one of: `checked_in` | `checked_out` | `unknown`

`desktopClientActive` is `true` only if a heartbeat was received within the last **2 minutes**.

---

### POST `/attendance/manual`

Check in or check out via API. **Requires the desktop client to be active for check-in.**

**Headers:** `Authorization: Bearer <token>`

**Request**
```json
{
  "action": "check_in"
}
```

`action` is `"check_in"` or `"check_out"`.

**Response `200`**
```json
{
  "success": true,
  "status": "checked_in",
  "timestamp": "2025-03-24T09:00:00.000Z"
}
```

**Errors**

| Status | `error` | Reason |
|---|---|---|
| 400 | `"action must be check_in or check_out"` | Invalid action value |
| 403 | `"Client is not active"` | `check_in` attempted while desktop client is offline |
| 401 | `"Unauthorized"` | Missing or invalid token |

> **Important:** Check-out (`"check_out"`) is always allowed regardless of client status. Only `check_in` requires an active client.

---

### GET `/attendance/logs`

Returns attendance logs for the authenticated user.

**Query params**

| Param | Type | Description |
|---|---|---|
| `from` | ISO date | Start of range |
| `to` | ISO date | End of range |
| `limit` | number | Max records (default 50, max 200) |

**Response `200`** — array of log objects
```json
[
  {
    "_id": "...",
    "userId": "...",
    "status": "check_in",
    "timestamp": "2025-03-24T09:00:00.000Z",
    "location": "manual",
    "source": "manual"
  }
]
```

---

### GET `/attendance/logs/:userId` *(Admin)*

Same as above but for any user. Requires admin JWT.

---

## 3. Productivity

### GET `/productivity/summary`

Returns productive/unproductive/total seconds for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query params**

| Param | Type | Description |
|---|---|---|
| `period` | `daily` \| `weekly` \| `monthly` | Time range |
| `date` | `YYYY-MM-DD` | Reference date (usually today) |

**Response `200`**
```json
{
  "summary": {
    "productive": 14400,
    "unproductive": 3600,
    "neutral": 1800,
    "idle": 600,
    "total": 20400
  },
  "dailyBreakdown": [
    { "date": "2025-03-24", "productive": 14400, "total": 20400 }
  ]
}
```

> `unproductive` in the response is only explicitly categorised unproductive time.
> The **UI formula** for displayed "Unproductive" is: `max(0, total - productive)`.

---

### GET `/productivity/summary/:userId` *(Admin)*

Same as above but for any user. Requires admin JWT.

---

### GET `/productivity/apps`

Returns per-application usage breakdown.

**Query params:** same as `/productivity/summary`

**Response `200`** — array
```json
[
  { "appName": "Code.exe", "category": "productive", "totalSeconds": 9000 },
  { "appName": "chrome.exe", "category": "neutral",    "totalSeconds": 3600 }
]
```

---

### GET `/productivity/apps/:userId` *(Admin)*

Same as above but for any user. Requires admin JWT.

---

### POST `/productivity/log`

Used by the desktop client to upload app-usage samples. Authenticated as the desktop user.

**Request**
```json
{
  "logs": [
    {
      "appName": "Code.exe",
      "windowTitle": "main.js - DeskTime",
      "startTime": "2025-03-24T09:00:00.000Z",
      "endTime":   "2025-03-24T09:00:05.000Z",
      "productive": true
    }
  ]
}
```

---

## 4. Screenshots

### GET `/screenshots`

Returns screenshots for the authenticated user.

**Query params**

| Param | Default | Description |
|---|---|---|
| `page` | 1 | Page number |
| `limit` | 24 | Items per page |
| `from` | — | ISO datetime lower bound |
| `to` | — | ISO datetime upper bound |

**Response `200`**
```json
{
  "screenshots": [
    {
      "_id": "...",
      "fileId": "...",
      "capturedAt": "2025-03-24T09:10:00.000Z",
      "imageUrl": "https://backend-desktime.averelabs.com/api/screenshots/image/<fileId>?token=<jwt>"
    }
  ],
  "total": 12,
  "page": 1,
  "pages": 1
}
```

### GET `/screenshots/image/:fileId`

Streams the raw image. Accepts auth token via query param for use in `<img>` tags:

```
GET /screenshots/image/<fileId>?token=<jwt>
```

---

### GET `/screenshots/:userId` *(Admin)*

Same as `/screenshots` but for any user. Requires admin JWT.

---

## 5. Users (Admin)

All endpoints in this section require an admin JWT.

### GET `/users`

Lists all active users.

**Query params**

| Param | Description |
|---|---|
| `status` | Filter by `checked_in`, `checked_out`, or `unknown` |
| `search` | Search by name or email |

**Response** — array of user objects (includes `desktopClientActive` field).

---

### GET `/users/:id`

Returns a single user's profile with `desktopClientActive`.

---

### PATCH `/users/:id`

Updates a user's name and/or password.

**Request**
```json
{
  "name": "Jane Smith",
  "password": "newpassword123"
}
```

Both fields are optional. Send only the ones you want to change.

**Response `200`**
```json
{ "success": true, "id": "...", "name": "Jane Smith" }
```

**Errors**

| Status | `error` |
|---|---|
| 400 | `"Password must be at least 6 characters"` |
| 404 | `"User not found"` |

---

### DELETE `/users/:id`

Soft-deletes (deactivates) a user. They can no longer log in.

**Response `200`**
```json
{ "success": true }
```

**Errors**

| Status | `error` |
|---|---|
| 400 | `"Cannot delete your own account"` |
| 404 | `"User not found"` |

---

### PATCH `/users/:id/role`

Changes a user's role.

**Request**
```json
{ "role": "admin" }
```

`role` must be `"employee"` or `"admin"`.

---

## 6. Desktop Heartbeat & Deactivation

These endpoints are called by the desktop client automatically. You generally do not need to call them manually.

### POST `/attendance/heartbeat`

Marks the desktop client as active. Called every 60 seconds by the desktop app.

**Headers:** `Authorization: Bearer <token>`

**Response `200`**
```json
{ "ok": true }
```

---

### POST `/attendance/deactivate`

Immediately marks the desktop client as inactive. Called on logout or when the desktop app quits.

**Response `200`**
```json
{ "ok": true }
```

---

## 7. Odoo Webhook

Receives attendance events pushed by an Odoo 18 custom module.

**No authentication required.** The endpoint is secured by keeping the backend URL private — configure it only in your Odoo server settings.

### POST `/attendance/webhook`

**Headers**

```
Content-Type: application/json
```

**Request**
```json
{
  "email":             "john@company.com",
  "status":            "check_in",
  "timestamp":         "2025-03-24T09:00:00.000Z",
  "location":          "Office",
  "odooAttendanceId":  12345
}
```

| Field | Required | Description |
|---|---|---|
| `email` | Yes | Employee's work email |
| `status` | Yes | `"check_in"` or `"check_out"` |
| `timestamp` | No | ISO 8601 datetime — defaults to server time if omitted |
| `location` | No | Free-text location string |
| `odooAttendanceId` | No | Odoo attendance record ID for reference |

**Response `200`**
```json
{ "success": true, "userId": "...", "status": "checked_in" }
```

**Errors**

| Status | `error` |
|---|---|
| 400 | `"Invalid payload"` — missing `email` or invalid `status` |
| 403 | `"Client is not active"` — `check_in` rejected because desktop app is offline |
| 404 | `"User not found"` — email not registered in DeskTime |

---

## 8. Error Format

All error responses follow this shape:

```json
{ "error": "Human-readable message" }
```

HTTP status codes used:

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthenticated (missing/invalid token) |
| 403 | Forbidden (wrong role, or client not active) |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 500 | Internal server error |
| 503 | Upstream dependency unavailable (Odoo) |

---

## 9. Desktop Client Active — Rule

The server considers the desktop client **active** only when **both** conditions are met:

1. `desktopClientActive` is `true` in the database.
2. `lastDesktopHeartbeat` timestamp is **less than 2 minutes ago**.

If the client crashes or is force-quit, condition 2 will fail within 2 minutes and check-in will be blocked automatically — no manual intervention needed.

**Check-in is blocked → `403 Client is not active`**

**Check-out is always allowed** regardless of client status (employees can still clock out if their laptop dies).

---

## Stack Reference

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, Tailwind CSS, deployed on Vercel/Nginx |
| Backend | Node.js 20, Express 4, MongoDB 7, Mongoose |
| Desktop | Electron 31, electron-builder, electron-store v8 |
| Auth | JWT (24 h), bcryptjs |
| Storage | MongoDB GridFS (screenshots) |
| HR integration | Odoo 18 (email verification + webhook) |
| Deployment | Docker Compose, MongoDB named volume `mongo-data` |

---

*Developed by KGRN*
