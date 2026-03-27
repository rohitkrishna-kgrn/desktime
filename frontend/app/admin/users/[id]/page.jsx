'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { isAuthenticated, getStoredUser } from '../../../../lib/auth';
import {
  getUser,
  getProductivitySummaryForUser,
  getAppBreakdownForUser,
  getScreenshotsForUser,
  getBreaksForUser,
} from '../../../../lib/api';
import Navbar from '../../../../components/Navbar';
import StatusBadge from '../../../../components/StatusBadge';
import ProductivityChart from '../../../../components/ProductivityChart';
import AppUsageTable from '../../../../components/AppUsageTable';
import ScreenshotGallery from '../../../../components/ScreenshotGallery';

const PERIODS = [
  { label: 'Today', value: 'daily' },
  { label: 'This Week', value: 'weekly' },
  { label: 'This Month', value: 'monthly' },
];

const BREAK_CATEGORY_LABELS = {
  lunch: 'Lunch',
  personal_call: 'Personal Call',
  physical_meeting: 'Physical Meeting',
  short_break: 'Short Break',
  other: 'Other',
};

const BREAK_CATEGORY_STYLES = {
  lunch:             'bg-amber-100 text-amber-700',
  personal_call:     'bg-blue-100 text-blue-700',
  physical_meeting:  'bg-indigo-100 text-indigo-700',
  short_break:       'bg-emerald-100 text-emerald-700',
  other:             'bg-slate-100 text-slate-600',
};

const PIE_COLORS = { productive: '#10b981', unproductive: '#ef4444', neutral: '#94a3b8', break: '#f59e0b' };

function fmtHours(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDuration(seconds) {
  if (!seconds || seconds < 60) return `${seconds || 0}s`;
  return fmtHours(seconds);
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-slate-200 text-xs">
      <p className="font-semibold text-slate-700">{name}</p>
      <p className="text-slate-500">{fmtHours(value)}</p>
    </div>
  );
}

export default function UserDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [period, setPeriod] = useState('daily');
  const [summary, setSummary] = useState(null);
  const [apps, setApps] = useState([]);
  const [breaks, setBreaks] = useState([]);
  const [breaksLoading, setBreaksLoading] = useState(false);
  const [screenshots, setScreenshots] = useState([]);
  const [ssLoading, setSsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('productivity');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    const me = getStoredUser();
    if (me?.role !== 'admin') { router.replace('/dashboard'); return; }
    fetchUser();
  }, [id]);

  async function fetchUser() {
    try {
      const data = await getUser(id);
      setUser(data);
    } catch {
      router.back();
    }
  }

  useEffect(() => {
    if (!id) return;
    fetchProductivity();
  }, [period, id]);

  async function fetchProductivity() {
    const date = format(new Date(), 'yyyy-MM-dd');
    try {
      const [sum, appData] = await Promise.all([
        getProductivitySummaryForUser(id, { period, date }),
        getAppBreakdownForUser(id, { period, date }),
      ]);
      setSummary(sum);
      setApps(appData);
    } catch {}
  }

  useEffect(() => {
    if (activeTab === 'breaks' && id) fetchBreaks();
  }, [activeTab, id, period]);

  async function fetchBreaks() {
    setBreaksLoading(true);
    try {
      const date = format(new Date(), 'yyyy-MM-dd');
      const data = await getBreaksForUser(id, { date });
      setBreaks(data);
    } catch {} finally {
      setBreaksLoading(false);
    }
  }

  const fetchScreenshots = useCallback(async () => {
    setSsLoading(true);
    try {
      const res = await getScreenshotsForUser(id, { limit: 24, page: 1 });
      setScreenshots(res.screenshots);
    } catch {} finally {
      setSsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'screenshots' && id) fetchScreenshots();
  }, [activeTab, fetchScreenshots]);

  const productivePercent = summary?.summary?.total > 0
    ? Math.round((summary.summary.productive / summary.summary.total) * 100)
    : 0;

  // Pie data for productivity
  const prodPieData = summary ? [
    { name: 'Productive',   value: summary.summary.productive   || 0, color: PIE_COLORS.productive },
    { name: 'Unproductive', value: summary.summary.unproductive || 0, color: PIE_COLORS.unproductive },
    { name: 'Neutral',      value: summary.summary.neutral      || 0, color: PIE_COLORS.neutral },
  ].filter((d) => d.value > 0) : [];

  // Break totals
  const totalBreakSecs  = breaks.reduce((s, b) => s + (b.durationSeconds || 0), 0);
  const completedBreaks = breaks.filter((b) => b.endTime);

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Overview
        </button>

        {/* User header */}
        {user && (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-200" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">{user.name}</h1>
                <StatusBadge status={user.onBreak ? 'on_break' : user.currentStatus} />
                {user.onBreak && user.currentBreakReason && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {user.currentBreakReason}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">{user.email}</p>
              <p className="text-xs text-slate-400">
                {[user.jobTitle, user.department].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs text-slate-400">
              {user.lastCheckIn && (
                <span>Check-in: {format(new Date(user.lastCheckIn), 'PPp')}</span>
              )}
              {user.lastCheckOut && (
                <span>Check-out: {format(new Date(user.lastCheckOut), 'PPp')}</span>
              )}
              <span className={`mt-1 inline-flex items-center gap-1 ${user.desktopClientActive ? 'text-blue-500' : 'text-slate-300'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${user.desktopClientActive ? 'bg-blue-500' : 'bg-slate-300'}`} />
                Desktop {user.desktopClientActive ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        )}

        {/* Period selector */}
        <div className="mb-5 flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 w-fit">
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
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard label="Productive"   value={summary ? fmtHours(summary.summary.productive)   : '—'} color="text-emerald-600" />
          <StatCard label="Unproductive" value={summary ? fmtHours(summary.summary.unproductive || 0) : '—'} color="text-red-500" />
          <StatCard label="Neutral"      value={summary ? fmtHours(summary.summary.neutral || 0)       : '—'} color="text-slate-500" />
          <StatCard label="Total Active" value={summary ? fmtHours(summary.summary.total)        : '—'} color="text-blue-600" />
          <StatCard
            label="Efficiency"
            value={summary ? `${productivePercent}%` : '—'}
            color={productivePercent >= 70 ? 'text-emerald-600' : productivePercent >= 40 ? 'text-amber-600' : 'text-red-500'}
          />
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-slate-200">
          {['productivity', 'breaks', 'screenshots'].map((tab) => (
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

        {/* ── Productivity tab ─────────────────────────────────────────── */}
        {activeTab === 'productivity' && (
          <div className="space-y-5">
            {/* Pie + bar side by side */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Productivity breakdown pie */}
              {prodPieData.length > 0 && (
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <h2 className="mb-1 text-sm font-semibold text-slate-700">Productivity Breakdown</h2>
                  <p className="mb-3 text-xs text-slate-400">Hours split for selected period</p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={prodPieData}
                          cx="50%" cy="50%"
                          innerRadius={52} outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {prodPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <RechartTooltip content={<PieTooltip />} />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11 }}
                          formatter={(value, entry) => (
                            <span style={{ color: '#64748b' }}>
                              {entry.payload.name} ({fmtHours(entry.payload.value)})
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Activity over time bar */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-4 text-sm font-semibold text-slate-700">Activity Over Time</h2>
                <ProductivityChart data={summary?.dailyBreakdown || []} />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">Application Usage</h2>
              <AppUsageTable apps={apps} />
            </div>
          </div>
        )}

        {/* ── Breaks tab ───────────────────────────────────────────────── */}
        {activeTab === 'breaks' && (
          <div className="space-y-5">
            {/* Break summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Breaks</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{breaks.length}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Break Time</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{fmtHours(totalBreakSecs)}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Avg Duration</p>
                <p className="mt-1 text-2xl font-bold text-slate-700">
                  {completedBreaks.length > 0
                    ? fmtDuration(Math.round(totalBreakSecs / completedBreaks.length))
                    : '—'}
                </p>
              </div>
            </div>

            {/* Break logs table */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-700">Break Log — Today</h2>
              </div>
              {breaksLoading ? (
                <div className="space-y-px p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : breaks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <svg className="mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No breaks recorded today.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Start</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">End</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {breaks.map((b, i) => (
                      <tr key={b._id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-700">
                          {format(new Date(b.startTime), 'HH:mm')}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {b.endTime ? format(new Date(b.endTime), 'HH:mm') : (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-700">
                          {b.endTime ? fmtDuration(b.durationSeconds) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${BREAK_CATEGORY_STYLES[b.category] || 'bg-slate-100 text-slate-600'}`}>
                            {BREAK_CATEGORY_LABELS[b.category] || b.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {b.reason || <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Screenshots tab ──────────────────────────────────────────── */}
        {activeTab === 'screenshots' && (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Screenshots</h2>
            <ScreenshotGallery screenshots={screenshots} loading={ssLoading} />
          </div>
        )}

      </main>
    </div>
  );
}
