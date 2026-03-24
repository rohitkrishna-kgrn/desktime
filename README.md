# DeskTime — User Manual

**DeskTime** is an employee monitoring platform that tracks attendance, productivity, and screenshots. It consists of three parts: a **web frontend**, a **backend API**, and a **desktop client** that runs in the background on employees' Windows computers.

---

## Table of Contents

1. [Getting Started — Download & Install the Desktop Client](#1-getting-started--download--install-the-desktop-client)
2. [Creating Your Account (Register)](#2-creating-your-account-register)
3. [Signing In](#3-signing-in)
4. [How the Desktop Client Works](#4-how-the-desktop-client-works)
5. [Employee Dashboard (Web)](#5-employee-dashboard-web)
6. [Admin Portal](#6-admin-portal)

---

## 1. Getting Started — Download & Install the Desktop Client

The desktop client **must be running** before you can check in. It is what proves your computer is active.

1. Open the DeskTime login page in your browser.
2. Click the **Download for Windows** button below the login card.
3. Run the downloaded `DeskTime Setup 1.0.0.exe` installer and follow the prompts.
4. DeskTime will launch automatically after installation and appear in your system tray (bottom-right of the taskbar).

> **Tip:** DeskTime minimises to the system tray when you close its window — it keeps running in the background.

---

## 2. Creating Your Account (Register)

You only need to register once. Your work email must already be in the company's Odoo system before you can register.

1. Go to the DeskTime login page in your browser **or** open the desktop app.
2. Click the **Register** tab.
3. Fill in:
   - **Full Name** — your display name
   - **Work Email** — must match the email in Odoo
   - **Password** — at least 6 characters
   - **Confirm Password**
4. Click **Create account**.
5. If your email is not found in Odoo, contact your administrator.

---

## 3. Signing In

### Web (browser)

1. Go to the DeskTime URL provided by your admin.
2. Enter your **email** and **password**.
3. Click **Sign in**.
   - Employees are taken to their personal dashboard.
   - Admins are taken to the admin portal.

### Desktop app

1. Open DeskTime from the system tray or Start menu.
2. Enter your **email** and **password** and click **Sign In**.
3. The app connects to the server and starts sending heartbeats.

---

## 4. How the Desktop Client Works

Once you are signed in to the desktop app, it runs silently in the background and does the following:

| Feature | Detail |
|---|---|
| **Heartbeat** | Sends a ping to the server every 60 seconds to prove the client is online. |
| **App tracking** | While you are checked in, samples the active window every 5 seconds and classifies it as Productive, Unproductive, or Neutral. |
| **Screenshots** | Captures a screenshot every 10 minutes while you are checked in and uploads it securely. |
| **Productivity flush** | Aggregates app-usage data and uploads it every 60 seconds. |
| **Attendance sync** | Polls the server every 10 seconds to detect check-in / check-out status changes. |

### System tray menu

Right-click the DeskTime icon in the tray to see:

- Your name and current status (Checked In / Checked Out)
- **Open DeskTime** — brings the window back
- **Quit** — stops tracking and logs the client out cleanly

### Important

- **The desktop client must be running and you must be signed in to it before you can check in.** If the client is offline, the check-in button on the web dashboard will be locked.
- Closing the desktop window does **not** quit the app — it hides to the tray. Use **Quit** in the tray menu to fully exit.

---

## 5. Employee Dashboard (Web)

After signing in on the web you will see your personal dashboard.

### Status & check-in

| Element | Description |
|---|---|
| Status badge | Shows your current attendance status (Checked In / Checked Out). |
| **Check In** button | Visible only when the desktop client is online. Starts your work session. |
| **Check Out** button | Ends your work session. |
| "Client Offline" indicator | Shown when the desktop app is not running — check-in is disabled. |

### Period selector

Switch between **Today**, **This Week**, and **This Month** to filter all metrics.

### Stat cards

| Card | What it shows |
|---|---|
| Productive | Total time in productive apps (VS Code, Excel, Word, Teams, etc.) |
| Unproductive | Total active time minus productive time |
| Total Active | Sum of all tracked activity |
| Efficiency | Productive ÷ Total Active, shown as a percentage |

### Tabs

- **Productivity** — bar/line chart of activity over time plus a breakdown table of every app used with time spent.
- **Screenshots** — gallery of screenshots taken during the session. Supports pagination ("Load more").

---

## 6. Admin Portal

Admins land on the admin portal after signing in. Only accounts with the `admin` role can access these pages.

### Employee Overview (`/admin`)

- Shows all active employees as cards with their name, status, last check-in time, and whether their desktop client is online.
- Filter by status (All / Checked In / Checked Out) or search by name / email.
- Click any employee card to open their detail page.

### Employee Detail (`/admin/users/[id]`)

Same layout as the employee dashboard, but viewed for any employee:

- Profile header with name, email, job title, department, and desktop client status.
- Period selector, stat cards, Activity Over Time chart, App Usage table.
- Screenshots tab.

### Manage Users (`/admin/manage`)

Accessible via the **Manage Users** button on the Employee Overview page.

| Action | How |
|---|---|
| **Edit name** | Click **Edit** next to a user, change the name, click Save. |
| **Reset password** | Click **Edit**, enter a new password (min 6 chars), click Save. Leave the password field blank to keep the current one. |
| **Delete user** | Click **Delete** next to a user, confirm in the dialog. This deactivates the account — the user can no longer sign in. |

> **Note:** You cannot delete your own admin account.

---

*Developed by KGRN*
