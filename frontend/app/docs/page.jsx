'use client';

import Link from 'next/link';

const sections = [
  {
    id: 'install',
    number: '1',
    title: 'Getting Started — Download & Install the Desktop Client',
    content: (
      <>
        <p className="mb-4 text-slate-600">
          The desktop client <strong>must be running</strong> before you can check in. It is what proves your computer is active.
        </p>
        <ol className="space-y-2 list-decimal list-inside text-slate-600">
          <li>Open the DeskTime login page in your browser.</li>
          <li>Click the <strong>Download for Windows</strong> button below the login card.</li>
          <li>Run the downloaded <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">DeskTime Setup 1.0.0.exe</code> installer and follow the prompts.</li>
          <li>DeskTime will launch automatically after installation and appear in your system tray (bottom-right of the taskbar).</li>
        </ol>
        <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
          <strong>Tip:</strong> DeskTime minimises to the system tray when you close its window — it keeps running in the background.
        </div>
      </>
    ),
  },
  {
    id: 'register',
    number: '2',
    title: 'Creating Your Account (Register)',
    content: (
      <>
        <p className="mb-4 text-slate-600">
          You only need to register once. Your work email must already be in the company&apos;s Odoo system before you can register.
        </p>
        <ol className="space-y-2 list-decimal list-inside text-slate-600">
          <li>Go to the DeskTime login page in your browser <strong>or</strong> open the desktop app.</li>
          <li>Click the <strong>Register</strong> tab.</li>
          <li className="list-none ml-4">
            <span className="text-slate-600">Fill in:</span>
            <ul className="mt-2 space-y-1 list-disc list-inside ml-4 text-slate-600">
              <li><strong>Full Name</strong> — your display name</li>
              <li><strong>Work Email</strong> — must match the email in Odoo</li>
              <li><strong>Department</strong> — select your department from the dropdown</li>
              <li><strong>Password</strong> — at least 6 characters</li>
              <li><strong>Confirm Password</strong></li>
            </ul>
          </li>
          <li>Click <strong>Create account</strong>.</li>
          <li>If your email is not found in Odoo, contact your administrator.</li>
        </ol>
      </>
    ),
  },
  {
    id: 'signin',
    number: '3',
    title: 'Signing In',
    content: (
      <>
        <div className="mb-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Web (browser)</h3>
          <ol className="space-y-2 list-decimal list-inside text-slate-600">
            <li>Go to the DeskTime URL provided by your admin.</li>
            <li>Enter your <strong>email</strong> and <strong>password</strong>.</li>
            <li>Click <strong>Sign in</strong>.
              <ul className="mt-1 ml-6 list-disc text-slate-500 text-sm">
                <li>Employees are taken to their personal dashboard.</li>
                <li>Admins are taken to the admin portal.</li>
              </ul>
            </li>
          </ol>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Desktop app</h3>
          <ol className="space-y-2 list-decimal list-inside text-slate-600">
            <li>Open DeskTime from the system tray or Start menu.</li>
            <li>Enter your <strong>email</strong> and <strong>password</strong> and click <strong>Sign In</strong>.</li>
            <li>The app connects to the server and starts sending heartbeats.</li>
          </ol>
        </div>
      </>
    ),
  },
  {
    id: 'desktop',
    number: '4',
    title: 'How the Desktop Client Works',
    content: (
      <>
        <p className="mb-4 text-slate-600">
          Once you are signed in to the desktop app, it runs silently in the background and does the following:
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 mb-5">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-40">Feature</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[
                ['Heartbeat', 'Sends a ping to the server every 60 seconds to prove the client is online.'],
                ['App tracking', 'While checked in and not on a break, samples the active window every 5 seconds and classifies it as Productive, Unproductive, or Neutral.'],
                ['Screenshots', 'Captures a screenshot every 10 minutes while checked in and not on a break.'],
                ['Productivity flush', 'Aggregates app-usage data and uploads it every 30 seconds.'],
                ['Attendance sync', 'Polls the server every 10 seconds to detect check-in / check-out / break status changes.'],
                ['Break pause', 'When a break starts, screenshots and app tracking pause automatically. They resume the moment you end the break.'],
              ].map(([feat, detail]) => (
                <tr key={feat}>
                  <td className="px-4 py-3 font-medium text-slate-800">{feat}</td>
                  <td className="px-4 py-3 text-slate-600">{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">System tray menu</h3>
        <p className="mb-2 text-slate-600">Right-click the DeskTime icon in the tray to see:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-600 mb-4">
          <li>Your name and current status (Checked In / On Break / Checked Out)</li>
          <li><strong>Open DeskTime</strong> — brings the window back</li>
          <li><strong>Quit</strong> — stops tracking and logs the client out cleanly</li>
        </ul>
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <strong>Important:</strong> Closing the desktop window does <strong>not</strong> quit the app — it hides to the tray. Use <strong>Quit</strong> in the tray menu to fully exit.
        </div>
      </>
    ),
  },
  {
    id: 'dashboard',
    number: '5',
    title: 'Employee Dashboard (Web)',
    content: (
      <>
        <p className="mb-4 text-slate-600">After signing in on the web you will see your personal dashboard.</p>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Status bar</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 mb-5">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-40">Element</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[
                ['Status badge', 'Shows your current attendance status (Checked In / On Break / Checked Out).'],
                ['Take Break button', 'Appears while you are checked in. Opens the break reason selector.'],
                ['Resume button', 'Appears while you are on a break. Ends the break and resumes tracking.'],
                ['"Client Offline" indicator', 'Shown when the desktop app is not running — breaks are disabled.'],
              ].map(([el, desc]) => (
                <tr key={el}>
                  <td className="px-4 py-3 font-medium text-slate-800">{el}</td>
                  <td className="px-4 py-3 text-slate-600">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Period selector</h3>
        <p className="mb-4 text-slate-600">Switch between <strong>Today</strong>, <strong>This Week</strong>, and <strong>This Month</strong> to filter all metrics.</p>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Stat cards</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 mb-5">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-32">Card</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">What it shows</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[
                ['Productive', 'Total time in productive apps (VS Code, Excel, Word, Teams, etc.)'],
                ['Unproductive', 'Total active time minus productive time'],
                ['Total Active', 'Sum of all tracked app activity (excludes break time)'],
                ['Break Today', 'Total break time taken today (daily view only)'],
                ['Efficiency', 'Productive ÷ Total Active, shown as a percentage (weekly / monthly view)'],
              ].map(([card, what]) => (
                <tr key={card}>
                  <td className="px-4 py-3 font-medium text-slate-800">{card}</td>
                  <td className="px-4 py-3 text-slate-600">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Tabs</h3>
        <ul className="list-disc list-inside space-y-1 text-slate-600">
          <li><strong>Productivity</strong> — bar chart of activity over time plus a breakdown table of every app used with time spent.</li>
          <li><strong>Screenshots</strong> — gallery of screenshots taken during the session. Supports pagination.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'breaks',
    number: '6',
    title: 'Taking a Break',
    content: (
      <>
        <p className="mb-4 text-slate-600">
          Breaks let you step away from your desk without your idle time counting as unproductive. Tracking pauses the moment a break starts and resumes the moment you end it.
        </p>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Starting a break — Web</h3>
        <ol className="space-y-2 list-decimal list-inside text-slate-600 mb-4">
          <li>Make sure you are <strong>checked in</strong>.</li>
          <li>Click the <strong>Take Break</strong> button (amber).</li>
          <li>A modal opens — select a reason:</li>
        </ol>
        <div className="overflow-x-auto rounded-lg border border-slate-200 mb-4">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-40">Category</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">When to use</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[
                ['Short Break', 'Quick pause, coffee, stretch'],
                ['Lunch', 'Meal break'],
                ['Personal Call', 'Phone or video call for personal matters'],
                ['Physical Meeting', 'In-person meeting away from your desk'],
                ['Other', "Anything that doesn't fit the above"],
              ].map(([cat, when]) => (
                <tr key={cat}>
                  <td className="px-4 py-3 font-medium text-slate-800">{cat}</td>
                  <td className="px-4 py-3 text-slate-600">{when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ol className="space-y-2 list-decimal list-inside text-slate-600 mb-5" start={4}>
          <li>Optionally type a custom reason (e.g. <em>&quot;Doctor&apos;s appointment&quot;</em>).</li>
          <li>Click <strong>Start Break</strong> — status badge changes to <strong>On Break</strong>.</li>
        </ol>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Ending a break</h3>
        <ul className="list-disc list-inside space-y-1 text-slate-600 mb-4">
          <li><strong>Web:</strong> Click the <strong>Resume</strong> button in the top bar.</li>
          <li><strong>Desktop:</strong> Click the <strong>▶ Resume Work</strong> button in the desktop window.</li>
        </ul>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">What happens during a break</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-48">Activity</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">During break</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[
                ['Heartbeat', 'Continues — your client stays registered as online'],
                ['App tracking', 'Paused — no app usage logged'],
                ['Screenshots', 'Paused — no screenshots taken'],
                ['Attendance status', 'Shows On Break in dashboard and admin portal'],
              ].map(([act, during]) => (
                <tr key={act}>
                  <td className="px-4 py-3 font-medium text-slate-800">{act}</td>
                  <td className="px-4 py-3 text-slate-600">{during}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: 'admin',
    number: '7',
    title: 'Admin Portal',
    content: (
      <>
        <p className="mb-4 text-slate-600">Admins land on the admin portal after signing in. Only accounts with the <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">admin</code> role can access these pages.</p>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Overview Dashboard</h3>
        <p className="mb-2 text-slate-600">The main admin page provides a live overview of the entire team.</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 mb-5">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-40">Card</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">What it shows</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[
                ['Total Employees', 'Number of active accounts'],
                ['Checked In', 'How many are currently checked in (and % of team)'],
                ['On Break', 'How many are currently on a break + total break hours today'],
                ['Avg Productivity', 'Average efficiency % across employees who were active today'],
              ].map(([card, what]) => (
                <tr key={card}>
                  <td className="px-4 py-3 font-medium text-slate-800">{card}</td>
                  <td className="px-4 py-3 text-slate-600">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Employee Detail</h3>
        <p className="mb-4 text-slate-600">Full analytics for a single employee. Open by clicking <strong>View</strong> in the overview table. Includes productivity charts, app usage breakdown, screenshots gallery, and a full break log.</p>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Manage Users</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 mb-4">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-36">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">How</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[
                ['Edit name', 'Click Edit next to a user, change the name, click Save.'],
                ['Change role', 'Click Edit, select Admin, Manager, or Employee from the Role dropdown, click Save.'],
                ['Reset password', 'Click Edit, enter a new password (min 6 chars), click Save. Leave blank to keep current.'],
                ['Change department', 'Click Edit, select a department from the dropdown, click Save.'],
                ['Delete user', 'Click Delete next to a user, confirm in the dialog. Permanently removes all data.'],
              ].map(([action, how]) => (
                <tr key={action}>
                  <td className="px-4 py-3 font-medium text-slate-800">{action}</td>
                  <td className="px-4 py-3 text-slate-600">{how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 uppercase tracking-wide">Manage Departments</h3>
        <p className="mb-2 text-slate-600">Create departments and assign managers. Managers get their own dashboard scoped to their department.</p>
        <ul className="list-disc list-inside space-y-1 text-slate-600">
          <li>Creating a department with a manager auto-promotes that user to the <strong>Manager</strong> role.</li>
          <li>Removing a manager from all departments automatically demotes them back to Employee.</li>
          <li>Managers can view their department&apos;s employees, productivity, and screenshots, but cannot access other departments&apos; data.</li>
        </ul>
      </>
    ),
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-base font-bold text-slate-800">DeskTime</span>
          </div>
          <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
            Back to Login
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">User Manual</h1>
          <p className="mt-2 text-slate-500">DeskTime — Employee Monitoring Platform</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar TOC — hidden on mobile */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-20">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Contents</p>
              <nav className="space-y-1">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-white hover:text-slate-900"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                      {s.number}
                    </span>
                    <span className="leading-snug">{s.title.replace(/^\d+\.\s*/, '')}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1 space-y-8">
            {sections.map((s) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-20 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
              >
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {s.number}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">{s.title.replace(/^\d+\.\s*/, '')}</h2>
                </div>
                {s.content}
              </section>
            ))}

            <p className="text-center text-xs text-slate-400 pb-4">Developed by KGRN</p>
          </main>
        </div>
      </div>
    </div>
  );
}
