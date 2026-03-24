'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { isAuthenticated, getStoredUser } from '../../../../lib/auth';
import {
  getUser,
  getProductivitySummaryForUser,
  getAppBreakdownForUser,
  getScreenshotsForUser,
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

function fmtHours(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
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
                <StatusBadge status={user.currentStatus} />
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
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Productive" value={summary ? fmtHours(summary.summary.productive) : '—'} color="text-emerald-600" />
          <StatCard label="Unproductive" value={summary ? fmtHours(summary.summary.unproductive) : '—'} color="text-red-500" />
          <StatCard label="Total Active" value={summary ? fmtHours(summary.summary.total) : '—'} color="text-blue-600" />
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
