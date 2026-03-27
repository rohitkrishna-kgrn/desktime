# DeskTime — User Manual

**DeskTime** is an employee monitoring platform that tracks attendance, productivity, and screenshots. It consists of three parts: a **web frontend**, a **backend API**, and a **desktop client** that runs in the background on employees' Windows computers.

---

## Table of Contents

1. [Getting Started — Download & Install the Desktop Client](#1-getting-started--download--install-the-desktop-client)
2. [Creating Your Account (Register)](#2-creating-your-account-register)
3. [Signing In](#3-signing-in)
4. [How the Desktop Client Works](#4-how-the-desktop-client-works)
5. [Employee Dashboard (Web)](#5-employee-dashboard-web)
6. [Taking a Break](#6-taking-a-break)
7. [Admin Portal](#7-admin-portal)

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
| **App tracking** | While you are checked in and not on a break, samples the active window every 5 seconds and classifies it as Productive, Unproductive, or Neutral. |
| **Screenshots** | Captures a screenshot every 1 minute while you are checked in and not on a break. |
| **Productivity flush** | Aggregates app-usage data and uploads it every 30 seconds. |
| **Attendance sync** | Polls the server every 10 seconds to detect check-in / check-out / break status changes. |
| **Break pause** | When a break starts, screenshots and app tracking pause automatically. They resume the moment you end the break. |

### System tray menu

Right-click the DeskTime icon in the tray to see:

- Your name and current status (Checked In / On Break / Checked Out)
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
| Status badge | Shows your current attendance status (Checked In / On Break / Checked Out). |
| **Check In** button | Visible only when the desktop client is online. Starts your work session. |
| **Take Break** button | Appears while you are checked in. Opens the break reason selector. |
| **Resume** button | Appears while you are on a break. Ends the break and resumes tracking. |
| **Check Out** button | Ends your work session. Any active break is automatically ended first. |
| "Client Offline" indicator | Shown when the desktop app is not running — check-in is disabled. |

### Period selector

Switch between **Today**, **This Week**, and **This Month** to filter all metrics.

### Stat cards

| Card | What it shows |
|---|---|
| Productive | Total time in productive apps (VS Code, Excel, Word, Teams, etc.) |
| Unproductive | Total active time minus productive time |
| Total Active | Sum of all tracked app activity (excludes break time) |
| Break Today | Total break time taken today (daily view only) |
| Efficiency | Productive ÷ Total Active, shown as a percentage (weekly / monthly view) |

### Tabs

- **Productivity** — bar chart of activity over time plus a breakdown table of every app used with time spent.
- **Screenshots** — gallery of screenshots taken during the session. Supports pagination ("Load more").

---

## 6. Taking a Break

Breaks let you step away from your desk without your idle time counting as unproductive. Tracking pauses the moment a break starts and resumes the moment you end it.

### Starting a break — Web

1. Make sure you are **checked in**.
2. Click the **Take Break** button (amber, next to Check Out).
3. A modal opens — select a reason:

| Category | When to use |
|---|---|
| **Short Break** | Quick pause, coffee, stretch |
| **Lunch** | Meal break |
| **Personal Call** | Phone or video call for personal matters |
| **Physical Meeting** | In-person meeting away from your desk |
| **Other** | Anything that doesn't fit the above |

4. Optionally type a custom reason in the **Custom reason** field (e.g. *"Doctor's appointment"*).
5. Click **Start Break** — the status badge changes to **On Break** and an amber banner appears.

### Starting a break — Desktop app

1. While checked in, click the **☕ Take a Break** button in the desktop window.
2. Select a category and optionally type a custom reason.
3. Click **Start Break**.
4. The desktop window shows **On Break** and the tray icon tooltip updates to "🟡 On Break".

### Ending a break

- **Web:** Click the **Resume** button in the top bar.
- **Desktop:** Click the **▶ Resume Work** button in the desktop window.

Tracking (screenshots + app usage) resumes immediately after you click Resume.

> **Note:** If you check out while on a break, the break is automatically ended and its duration is recorded.

### What happens during a break

| Activity | During break |
|---|---|
| Heartbeat (client keep-alive) | Continues — your client stays registered as online |
| App tracking | **Paused** — no app usage logged |
| Screenshots | **Paused** — no screenshots taken |
| Attendance status | Shows **On Break** in dashboard and admin portal |

### Viewing your break history

On your dashboard, the **Break Today** stat card shows your total break time for the current day.

---

## 7. Admin Portal

Admins land on the admin portal after signing in. Only accounts with the `admin` role can access these pages.

### Overview Dashboard (`/admin`)

The main admin page provides a live overview of the entire team.

**Big Four stat cards:**

| Card | What it shows |
|---|---|
| Total Employees | Number of active accounts |
| Checked In | How many are currently checked in (and % of team) |
| On Break | How many are currently on a break + total break hours today |
| Avg Productivity | Average efficiency % across employees who were active today |

**Charts:**

| Chart | What it shows |
|---|---|
| Team Productivity Today | Donut chart — Productive / Unproductive / Neutral / Break hours (team total) |
| Break Reasons Today | Pie chart — count of breaks by category across all employees |
| Top Active Employees | Stacked bar chart — each employee's productive / unproductive / neutral / break hours |

**Employee table** — columns: Employee, Status (with live On Break indicator and reason), Productive, Unproductive, Break, Efficiency (progress bar), Desktop, Actions.

**Break Summary table** — at the bottom of the page, shows each break category with total count, total time, and average duration for today.

**Filters:** Search by name / email, or filter by All / Checked In / On Break / Checked Out.

### Employee Detail (`/admin/users/[id]`)

Full analytics for a single employee. Open by clicking **View** in the overview table.

- Profile header with name, email, job title, department, break status, and desktop client status.
- Period selector (Today / This Week / This Month).
- Five stat cards: Productive, Unproductive, Neutral, Total Active, Efficiency.
- **Productivity tab** — pie chart (Productive / Unproductive / Neutral split) + activity-over-time bar chart + app usage table.
- **Breaks tab** — full break log for today with columns:

| Column | Description |
|---|---|
| # | Break number (1, 2, 3…) |
| Start | Time the break started |
| End | Time the break ended (or "Active" pulse if still ongoing) |
| Duration | Length of the break |
| Category | Badge showing the reason category |
| Reason | Free-text reason entered by the employee |

- **Screenshots tab** — gallery of screenshots for the selected period.

### Manage Users (`/admin/manage`)

Accessible via the **Manage Users** button on the Overview page.

| Action | How |
|---|---|
| **Edit name** | Click **Edit** next to a user, change the name, click Save. |
| **Change role** | Click **Edit**, select Admin or Employee from the Role dropdown, click Save. |
| **Reset password** | Click **Edit**, enter a new password (min 6 chars), click Save. Leave the password field blank to keep the current one. |
| **Delete user** | Click **Delete** next to a user, confirm in the dialog. This deactivates the account — the user can no longer sign in. |

> **Note:** You cannot delete your own admin account.

---

*Developed by KGRN*
