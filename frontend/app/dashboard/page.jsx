'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { isAuthenticated, getStoredUser } from '../../lib/auth';
import {
  getAttendanceStatus,
  getProductivitySummary,
  getAppBreakdown,
  getScreenshots,
  manualAttendance,
} from '../../lib/api';
import Navbar from '../../components/Navbar';
import StatusBadge from '../../components/StatusBadge';
import ProductivityChart from '../../components/ProductivityChart';
import AppUsageTable from '../../components/AppUsageTable';
import ScreenshotGallery from '../../components/ScreenshotGallery';

const PERIODS = [
  { label: 'Today', value: 'daily' },
  { label: 'This Week', value: 'weekly' },
  { label: 'This Month', value: 'monthly' },
];

function fmtHours(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [attendance, setAttendance] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [period, setPeriod] = useState('daily');
  const [summary, setSummary] = useState(null);
  const [apps, setApps] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [ssLoading, setSsLoading] = useState(true);
  const [ssPage, setSsPage] = useState(1);
  const [ssTotal, setSsTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('productivity');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    const user = getStoredUser();
    if (user?.role === 'admin') { router.replace('/admin'); return; }
  }, [router]);

  // Attendance polling every 5 s — keeps the check-in button state responsive
  useEffect(() => {
    fetchAttendance();
    const id = setInterval(fetchAttendance, 5_000);
    return () => clearInterval(id);
  }, []);

  async function fetchAttendance() {
    try {
      const data = await getAttendanceStatus();
      setAttendance(data);
    } catch {}
  }

  async function handleManualAttendance(action) {
    setAttendanceError('');
    setAttendanceLoading(true);
    try {
      await manualAttendance(action);
      await fetchAttendance();
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Action failed.';
      setAttendanceError(msg);
    } finally {
      setAttendanceLoading(false);
    }
  }

  // Productivity data when period changes
  useEffect(() => {
    fetchProductivity();
  }, [period]);

  async function fetchProductivity() {
    setSummary(null);
    const date = format(new Date(), 'yyyy-MM-dd');
    try {
      const [sum, appData] = await Promise.all([
        getProductivitySummary({ period, date }),
        getAppBreakdown({ period, date }),
      ]);
      setSummary(sum);
      setApps(appData);
    } catch {}
  }

  // Screenshots
  const fetchScreenshots = useCallback(async (page = 1) => {
    setSsLoading(true);
    try {
      const date = format(new Date(), 'yyyy-MM-dd');
      const from = period === 'daily'
        ? `${date}T00:00:00`
        : period === 'weekly'
        ? format(startOfWeek(new Date()), "yyyy-MM-dd'T'00:00:00")
        : format(startOfMonth(new Date()), "yyyy-MM-dd'T'00:00:00");
      const res = await getScreenshots({ from, limit: 24, page });
      if (page === 1) setScreenshots(res.screenshots);
      else setScreenshots((p) => [...p, ...res.screenshots]);
      setSsTotal(res.total);
      setSsPage(page);
    } catch {} finally {
      setSsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (activeTab === 'screenshots') fetchScreenshots(1);
  }, [activeTab, fetchScreenshots]);

  const productivePercent = summary?.summary?.total > 0
    ? Math.round((summary.summary.productive / summary.summary.total) * 100)
    : 0;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar status={attendance?.status} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">

        {/* Status banner */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Dashboard</h1>
            <p className="text-sm text-slate-500">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={attendance?.status} />
            {attendance?.lastCheckIn && (
              <span className="text-xs text-slate-400">
                Since {format(new Date(attendance.lastCheckIn), 'HH:mm')}
              </span>
            )}

            {/* ⚠️ Testing buttons — replace with Odoo webhook in production */}
            {attendance !== null && (
              attendance?.desktopClientActive ? (
                // Desktop is active — show action button
                attendance?.status !== 'checked_in' ? (
                  <button
                    onClick={() => handleManualAttendance('check_in')}
                    disabled={attendanceLoading}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                    {attendanceLoading ? 'Wait…' : 'Check In'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleManualAttendance('check_out')}
                    disabled={attendanceLoading}
                    className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-50"
                  >
                    <span className="inline-block h-2 w-2 rounded-full bg-white/80" />
                    {attendanceLoading ? 'Wait…' : 'Check Out'}
                  </button>
                )
              ) : (
                // Desktop is offline — locked state, clearly shown
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed select-none">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Client Offline
                </div>
              )
            )}
          </div>
        </div>

        {/* Attendance action error */}
        {attendanceError && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{attendanceError}</span>
            </div>
            <button onClick={() => setAttendanceError('')} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Desktop client offline banner */}
        {attendance && !attendance.desktopClientActive && (
          <div className="mb-4 flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <span className="font-semibold">Desktop client is not running.</span>{' '}
              Check-in, screenshots and activity tracking are disabled. Launch the DeskTime desktop app to enable them.
            </div>
          </div>
        )}

        {/* Period selector */}
        <div className="mb-6 flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 w-fit">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                period === p.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Productive"
            value={summary ? fmtHours(summary.summary.productive) : '—'}
            color="text-emerald-600"
          />
          <StatCard
            label="Unproductive"
            value={summary ? fmtHours(Math.max(0, summary.summary.total - summary.summary.productive)) : '—'}
            color="text-red-500"
          />
          <StatCard
            label="Total Active"
            value={summary ? fmtHours(summary.summary.total) : '—'}
            color="text-blue-600"
          />
          <StatCard
            label="Efficiency"
            value={summary ? `${productivePercent}%` : '—'}
            color={productivePercent >= 70 ? 'text-emerald-600' : productivePercent >= 40 ? 'text-amber-600' : 'text-red-500'}
          />
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-slate-200">
          {['productivity', 'screenshots'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Productivity tab */}
        {activeTab === 'productivity' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">Activity Over Time</h2>
              <ProductivityChart data={summary?.dailyBreakdown || []} />
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">Application Usage</h2>
              <AppUsageTable apps={apps} />
            </div>
          </div>
        )}

        {/* Screenshots tab */}
        {activeTab === 'screenshots' && (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                Screenshots{ssTotal > 0 && <span className="ml-1 text-slate-400">({ssTotal})</span>}
              </h2>
            </div>
            <ScreenshotGallery screenshots={screenshots} loading={ssLoading} />
            {screenshots.length < ssTotal && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => fetchScreenshots(ssPage + 1)}
                  className="rounded-lg bg-slate-100 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition"
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
