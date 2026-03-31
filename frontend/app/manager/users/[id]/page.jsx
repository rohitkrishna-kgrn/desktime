'use client';

// Manager user detail — same content as admin user detail, back button goes to /manager
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
  getScreenshotImageUrl,
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

const BREAK_CATEGORY_COLORS = {
  lunch: 'bg-amber-100 text-amber-700',
  personal_call: 'bg-blue-100 text-blue-700',
  physical_meeting: 'bg-emerald-100 text-emerald-700',
  short_break: 'bg-indigo-100 text-indigo-700',
  other: 'bg-slate-100 text-slate-600',
};

function fmtHours(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDur(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function ManagerUserDetailPage() {
  const router = useRouter();
  const { id }  = useParams();

  const [user, setUser]             = useState(null);
  const [period, setPeriod]         = useState('daily');
  const [prodData, setProdData]     = useState(null);
  const [appData, setAppData]       = useState([]);
  const [breaks, setBreaks]         = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [ssLoading, setSsLoading]   = useState(true);
  const [activeTab, setActiveTab]   = useState('productivity');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    const me = getStoredUser();
    if (!['admin', 'manager'].includes(me?.role)) { router.replace('/dashboard'); return; }
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
    const today = format(new Date(), 'yyyy-MM-dd');
    getProductivitySummaryForUser(id, { period, date: today }).then(setProdData).catch(() => {});
    getAppBreakdownForUser(id, { period, date: today }).then(setAppData).catch(() => {});
    getBreaksForUser(id, { period, date: today }).then(setBreaks).catch(() => {});
  }, [id, period]);

  const fetchScreenshots = useCallback(async (page = 1) => {
    setSsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const data = await getScreenshotsForUser(id, { date: today, page, limit: 12 });
      setScreenshots(data.screenshots || []);
    } catch {} finally {
      setSsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchScreenshots(1); }, [fetchScreenshots]);

  if (!user) {
    return (
      <div className="flex min-h-full flex-col bg-slate-50">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  const breakSummaryStats = breaks.reduce(
    (acc, b) => ({
      count: acc.count + 1,
      totalSecs: acc.totalSecs + (b.durationSeconds || 0),
    }),
    { count: 0, totalSecs: 0 }
  );

  const prodPieData = prodData
    ? [
        { name: 'Productive',   value: prodData.productive   || 0, color: '#10b981' },
        { name: 'Unproductive', value: prodData.unproductive || 0, color: '#ef4444' },
        { name: 'Neutral',      value: prodData.neutral      || 0, color: '#94a3b8' },
      ].filter((d) => d.value > 0)
    : [];

  const TABS = [
    { id: 'productivity', label: 'Productivity' },
    { id: 'breaks',       label: 'Breaks' },
    { id: 'screenshots',  label: 'Screenshots' },
    { id: 'apps',         label: 'App Usage' },
  ];

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {/* Back */}
        <button
          onClick={() => router.push('/manager')}
          className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Department
        </button>

        {/* User header */}
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
              {user.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900">{user.name}</h1>
                {user.departmentName && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                    {user.departmentName}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">{user.email}</p>
              {user.jobTitle && <p className="text-xs text-slate-400">{user.jobTitle}</p>}
            </div>
            <StatusBadge status={user.currentStatus} />
          </div>
          {/* Check-in / Check-out times */}
          {(user.lastCheckIn || user.lastCheckOut) && (
            <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4">
              {user.lastCheckIn && (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Check In</p>
                    <p className="text-sm font-semibold text-emerald-700">
                      {format(new Date(user.lastCheckIn), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              )}
              {user.lastCheckOut && (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                    <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Check Out</p>
                    <p className="text-sm font-semibold text-red-600">
                      {format(new Date(user.lastCheckOut), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              )}
              {user.lastCheckIn && user.lastCheckOut && new Date(user.lastCheckOut) > new Date(user.lastCheckIn) && (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                    <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Duration</p>
                    <p className="text-sm font-semibold text-blue-700">
                      {fmtHours(Math.round((new Date(user.lastCheckOut) - new Date(user.lastCheckIn)) / 1000))}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Period selector */}
        <div className="mb-5 flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 w-fit">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                period === p.value ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            { label: 'Productive',   value: fmtHours(prodData?.productive),   color: 'text-emerald-600' },
            { label: 'Unproductive', value: fmtHours(prodData?.unproductive), color: 'text-red-500' },
            { label: 'Neutral',      value: fmtHours(prodData?.neutral),       color: 'text-slate-500' },
            { label: 'Total Active', value: fmtHours(prodData?.total),         color: 'text-blue-600' },
            { label: 'Break Today',  value: fmtHours(breakSummaryStats.totalSecs), color: 'text-amber-600' },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
              <p className={`mt-1 text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 w-fit">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activeTab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'productivity' && (
          <div className="space-y-5">
            {prodPieData.length > 0 && (
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Productivity Split</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={prodPieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                        {prodPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <RechartTooltip formatter={(v) => fmtHours(v)} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            <ProductivityChart userId={id} period={period} />
          </div>
        )}

        {activeTab === 'breaks' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Breaks</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{breakSummaryStats.count}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Break Time</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{fmtHours(breakSummaryStats.totalSecs)}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Avg Duration</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">
                  {breakSummaryStats.count > 0 ? fmtHours(Math.round(breakSummaryStats.totalSecs / breakSummaryStats.count)) : '—'}
                </p>
              </div>
            </div>
            {breaks.length > 0 ? (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Start</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">End</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {breaks.map((b) => (
                      <tr key={b._id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3 text-slate-600">{format(new Date(b.startTime), 'MMM d, h:mm a')}</td>
                        <td className="px-5 py-3 text-slate-600">{b.endTime ? format(new Date(b.endTime), 'h:mm a') : <span className="text-amber-600 font-medium">Ongoing</span>}</td>
                        <td className="px-5 py-3 text-right font-medium text-slate-700">{fmtDur(b.durationSeconds)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BREAK_CATEGORY_COLORS[b.category] || 'bg-slate-100 text-slate-600'}`}>
                            {BREAK_CATEGORY_LABELS[b.category] || b.category}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-400">{b.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 rounded-2xl bg-white ring-1 ring-slate-200">
                <p className="text-sm">No break records for this period.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'screenshots' && (
          <div>
            {ssLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-video animate-pulse rounded-xl bg-slate-200" />
                ))}
              </div>
            ) : (
              <ScreenshotGallery screenshots={screenshots} getImageUrl={getScreenshotImageUrl} />
            )}
          </div>
        )}

        {activeTab === 'apps' && <AppUsageTable userId={id} period={period} />}
      </main>
    </div>
  );
}
