'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import { isAuthenticated, getStoredUser } from '../../lib/auth';
import {
  getAttendanceStatus,
  getProductivitySummary,
  getAppBreakdown,
  getScreenshots,
  getBreaks,
  startBreak,
  endBreak,
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

const BREAK_CATEGORIES = [
  { value: 'lunch',             label: 'Lunch' },
  { value: 'personal_call',     label: 'Personal Call' },
  { value: 'physical_meeting',  label: 'Physical Meeting' },
  { value: 'short_break',       label: 'Short Break' },
  { value: 'other',             label: 'Other' },
];

function fmtHours(seconds) {
  if (!seconds) return '0m';
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

function BreakModal({ onConfirm, onCancel }) {
  const [category, setCategory] = useState('short_break');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const reason = customReason.trim() || BREAK_CATEGORIES.find((c) => c.value === category)?.label || category;
    await onConfirm(reason, category);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h2 className="mb-1 text-base font-semibold text-slate-900">Take a Break</h2>
        <p className="mb-4 text-sm text-slate-500">Select a reason — tracking will pause.</p>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {BREAK_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                category === cat.value
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Custom reason (optional)
          </label>
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="e.g. Doctor's appointment"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
          >
            {loading ? 'Starting…' : 'Start Break'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [attendance, setAttendance] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [period, setPeriod] = useState('daily');
  const [summary, setSummary] = useState(null);
  const [apps, setApps] = useState([]);
  const [todayBreakSecs, setTodayBreakSecs] = useState(0);
  const [screenshots, setScreenshots] = useState([]);
  const [ssLoading, setSsLoading] = useState(true);
  const [ssPage, setSsPage] = useState(1);
  const [ssTotal, setSsTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('productivity');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    const user = getStoredUser();
    if (user?.role === 'admin') { router.replace('/admin'); return; }
    if (user?.role === 'manager') { router.replace('/manager'); return; }
  }, [router]);

  // Attendance polling every 5 s
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

  async function fetchTodayBreaks() {
    try {
      const date = format(new Date(), 'yyyy-MM-dd');
      const breaks = await getBreaks({ date });
      const total = breaks.reduce((s, b) => s + (b.durationSeconds || 0), 0);
      setTodayBreakSecs(total);
    } catch {}
  }

  async function handleStartBreak(reason, category) {
    setAttendanceError('');
    try {
      await startBreak(reason, category);
      setShowBreakModal(false);
      await fetchAttendance();
    } catch (err) {
      setAttendanceError(err?.response?.data?.error || 'Failed to start break.');
    }
  }

  async function handleEndBreak() {
    setAttendanceError('');
    setAttendanceLoading(true);
    try {
      await endBreak();
      await fetchAttendance();
      await fetchTodayBreaks();
    } catch (err) {
      setAttendanceError(err?.response?.data?.error || 'Failed to end break.');
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

  // Fetch today's break total when period is daily
  useEffect(() => {
    if (period === 'daily') fetchTodayBreaks();
  }, [period]);

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

  // Live break duration (ticks every 30s)
  const [liveSecs, setLiveSecs] = useState(0);
  useEffect(() => {
    if (attendance?.onBreak && attendance?.currentBreakStart) {
      const tick = () => {
        setLiveSecs(Math.round((Date.now() - new Date(attendance.currentBreakStart).getTime()) / 1000));
      };
      tick();
      const id = setInterval(tick, 30_000);
      return () => clearInterval(id);
    } else {
      setLiveSecs(0);
    }
  }, [attendance?.onBreak, attendance?.currentBreakStart]);

  const displayBreakSecs = attendance?.onBreak ? todayBreakSecs + liveSecs : todayBreakSecs;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar status={attendance?.status} />

      {showBreakModal && (
        <BreakModal
          onConfirm={handleStartBreak}
          onCancel={() => setShowBreakModal(false)}
        />
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">

        {/* Status banner */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Dashboard</h1>
            <p className="text-sm text-slate-500">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={attendance?.onBreak ? 'on_break' : attendance?.status} />
            {attendance?.onBreak && attendance?.currentBreakReason && (
              <span className="text-xs text-amber-600 font-medium">
                {attendance.currentBreakReason}
              </span>
            )}
            {attendance?.lastCheckIn && !attendance?.onBreak && (
              <span className="text-xs text-slate-400">
                Since {format(new Date(attendance.lastCheckIn), 'HH:mm')}
              </span>
            )}

            {attendance !== null && attendance?.desktopClientActive && attendance?.status === 'checked_in' && (
              attendance?.onBreak ? (
                <button
                  onClick={handleEndBreak}
                  disabled={attendanceLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {attendanceLoading ? 'Wait…' : 'Resume'}
                </button>
              ) : (
                <button
                  onClick={() => setShowBreakModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Take Break
                </button>
              )
            )}
          </div>
        </div>

        {/* On-break banner */}
        {attendance?.onBreak && (
          <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="font-semibold">You are on a break.</span>{' '}
              Screenshots and activity tracking are paused. Break duration: <span className="font-semibold">{fmtHours(liveSecs)}</span>
            </div>
          </div>
        )}

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

        {/* Desktop offline banner */}
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
            label={period === 'daily' ? 'Break Today' : 'Efficiency'}
            value={
              period === 'daily'
                ? fmtHours(displayBreakSecs)
                : summary
                ? `${productivePercent}%`
                : '—'
            }
            color={
              period === 'daily'
                ? 'text-amber-600'
                : productivePercent >= 70
                ? 'text-emerald-600'
                : productivePercent >= 40
                ? 'text-amber-600'
                : 'text-red-500'
            }
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
