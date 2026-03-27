'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { isAuthenticated, getStoredUser } from '../../lib/auth';
import { getAdminOverview } from '../../lib/api';
import Navbar from '../../components/Navbar';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtHours(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Big Four stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className="rounded-xl bg-slate-50 p-2 text-slate-400">{icon}</div>
      </div>
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────────
function StatusPill({ user }) {
  if (user.onBreak) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        On Break
      </span>
    );
  }
  if (user.currentStatus === 'checked_in') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Checked In
      </span>
    );
  }
  if (user.currentStatus === 'checked_out') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Checked Out
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Unknown
    </span>
  );
}

// ── Pie chart tooltip ──────────────────────────────────────────────────────────
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: inner } = payload[0];
  return (
    <div className="rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-slate-200 text-xs">
      <p className="font-semibold text-slate-700">{name}</p>
      <p className="text-slate-500">{inner.isTime ? fmtHours(value) : `${value} break${value !== 1 ? 's' : ''}`}</p>
    </div>
  );
}

// ── Bar chart tooltip ──────────────────────────────────────────────────────────
function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-slate-200 text-xs">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill }} className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.fill }} />
          {p.name}: {fmtHours(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────────
const PROD_COLORS   = { productive: '#10b981', unproductive: '#ef4444', neutral: '#94a3b8', break: '#f59e0b' };
const BREAK_COLORS  = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Checked In', value: 'checked_in' },
  { label: 'On Break', value: 'on_break' },
  { label: 'Checked Out', value: 'checked_out' },
];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    const user = getStoredUser();
    if (user?.role !== 'admin') { router.replace('/dashboard'); return; }
  }, [router]);

  useEffect(() => {
    const id = setInterval(fetchOverview, 30_000);
    fetchOverview();
    return () => clearInterval(id);
  }, []);

  async function fetchOverview() {
    try {
      const data = await getAdminOverview();
      setOverview(data);
    } catch {} finally {
      setLoading(false);
    }
  }

  const users          = overview?.users          || [];
  const stats          = overview?.stats          || { total: 0, checkedIn: 0, onBreak: 0, avgProductivity: 0 };
  const teamProd       = overview?.teamProductivity || { productive: 0, unproductive: 0, neutral: 0, break: 0 };
  const breakCategories = overview?.breakCategories || [];

  // Productivity pie data
  const prodPieData = [
    { name: 'Productive',   value: teamProd.productive,   color: PROD_COLORS.productive,   isTime: true },
    { name: 'Unproductive', value: teamProd.unproductive, color: PROD_COLORS.unproductive, isTime: true },
    { name: 'Neutral',      value: teamProd.neutral,      color: PROD_COLORS.neutral,       isTime: true },
    { name: 'Break',        value: teamProd.break,        color: PROD_COLORS.break,         isTime: true },
  ].filter((d) => d.value > 0);

  // Break category pie data
  const breakPieData = breakCategories.map((b, i) => ({
    name:  b.label,
    value: b.count,
    color: BREAK_COLORS[i % BREAK_COLORS.length],
    isTime: false,
  }));

  // Team bar data — top 8 users by activity
  const topUsers = [...users]
    .filter((u) => u.todayTotal > 0)
    .sort((a, b) => b.todayTotal - a.todayTotal)
    .slice(0, 8)
    .map((u) => ({
      name:         u.name.split(' ')[0],
      productive:   u.todayProductive,
      unproductive: u.todayUnproductive,
      neutral:      u.todayNeutral,
      break:        u.todayBreak,
    }));

  // Filtered table
  const filtered = users.filter((u) => {
    if (statusFilter === 'on_break')    return u.onBreak;
    if (statusFilter === 'checked_in')  return u.currentStatus === 'checked_in' && !u.onBreak;
    if (statusFilter === 'checked_out') return u.currentStatus === 'checked_out';
    if (search.trim()) {
      const s = search.toLowerCase();
      return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    }
    return true;
  }).filter((u) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const hasChartData = prodPieData.length > 0 || breakPieData.length > 0 || topUsers.length > 0;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-sm text-slate-500">Live team overview — refreshes every 30s</p>
          </div>
          <Link
            href="/admin/manage"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Manage Users
          </Link>
        </div>

        {/* ── Big Four ─────────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total Employees"
            value={loading ? '—' : stats.total}
            color="text-slate-800"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <StatCard
            label="Checked In"
            value={loading ? '—' : stats.checkedIn}
            sub={!loading && stats.total > 0 ? `${Math.round((stats.checkedIn / stats.total) * 100)}% of team` : ''}
            color="text-emerald-600"
            icon={
              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="On Break"
            value={loading ? '—' : stats.onBreak}
            sub={!loading ? fmtHours(teamProd.break) + ' total today' : ''}
            color="text-amber-600"
            icon={
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Avg Productivity"
            value={loading ? '—' : `${stats.avgProductivity}%`}
            sub="active employees today"
            color={stats.avgProductivity >= 70 ? 'text-emerald-600' : stats.avgProductivity >= 40 ? 'text-amber-600' : 'text-red-500'}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
        </div>

        {/* ── Charts Row ────────────────────────────────────────────────── */}
        {!loading && hasChartData && (
          <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">

            {/* Team Productivity Pie */}
            {prodPieData.length > 0 && (
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-1 text-sm font-semibold text-slate-700">Team Productivity Today</h2>
                <p className="mb-3 text-xs text-slate-400">Total active hours split</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={prodPieData}
                        cx="50%" cy="50%"
                        innerRadius={48} outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {prodPieData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
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

            {/* Break Category Pie */}
            {breakPieData.length > 0 && (
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-1 text-sm font-semibold text-slate-700">Break Reasons Today</h2>
                <p className="mb-3 text-xs text-slate-400">Count of breaks by category</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakPieData}
                        cx="50%" cy="50%"
                        outerRadius={72}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {breakPieData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <RechartTooltip content={<PieTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value, entry) => (
                          <span style={{ color: '#64748b' }}>
                            {entry.payload.name} ({entry.payload.value})
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top Users Bar Chart */}
            {topUsers.length > 0 && (
              <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${prodPieData.length === 0 || breakPieData.length === 0 ? 'lg:col-span-2' : ''}`}>
                <h2 className="mb-1 text-sm font-semibold text-slate-700">Top Active Employees</h2>
                <p className="mb-3 text-xs text-slate-400">Today's hours by type</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topUsers} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tickFormatter={(v) => fmtHours(v)} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <RechartTooltip content={<BarTooltip />} />
                      <Bar dataKey="productive"   name="Productive"   stackId="a" fill="#10b981" radius={[0,0,0,0]} />
                      <Bar dataKey="unproductive" name="Unproductive" stackId="a" fill="#ef4444" />
                      <Bar dataKey="neutral"      name="Neutral"      stackId="a" fill="#94a3b8" />
                      <Bar dataKey="break"        name="Break"        stackId="a" fill="#f59e0b" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-xs flex-1">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search employees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 w-fit">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  statusFilter === f.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── User Table ────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {loading ? (
            <div className="space-y-px p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">No employees found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="hidden px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Productive</th>
                  <th className="hidden px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Unproductive</th>
                  <th className="hidden px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Break</th>
                  <th className="hidden px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Efficiency</th>
                  <th className="hidden px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 xl:table-cell">Desktop</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u._id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                          {u.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill user={u} />
                      {u.onBreak && u.currentBreakReason && (
                        <p className="mt-0.5 text-xs text-slate-400">{u.currentBreakReason}</p>
                      )}
                    </td>
                    <td className="hidden px-5 py-3.5 text-right font-medium text-emerald-600 sm:table-cell">
                      {fmtHours(u.todayProductive)}
                    </td>
                    <td className="hidden px-5 py-3.5 text-right text-red-500 md:table-cell">
                      {fmtHours(u.todayUnproductive)}
                    </td>
                    <td className="hidden px-5 py-3.5 text-right text-amber-600 md:table-cell">
                      {fmtHours(u.todayBreak)}
                    </td>
                    <td className="hidden px-5 py-3.5 text-right lg:table-cell">
                      {u.todayTotal > 0 ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100">
                            <div
                              className="h-1.5 rounded-full bg-emerald-400"
                              style={{ width: `${u.todayEfficiency}%` }}
                            />
                          </div>
                          <span className={`w-9 text-xs font-semibold ${
                            u.todayEfficiency >= 70 ? 'text-emerald-600' : u.todayEfficiency >= 40 ? 'text-amber-600' : 'text-red-500'
                          }`}>
                            {u.todayEfficiency}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="hidden px-5 py-3.5 text-center xl:table-cell">
                      {u.desktopClientActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          Offline
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/users/${u._id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Break Logs Table ──────────────────────────────────────────── */}
        {!loading && breakCategories.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-700">Break Summary — Today</h2>
              <p className="text-xs text-slate-400">Aggregated by category across all employees</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Count</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total Time</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Avg Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {breakCategories.sort((a, b) => b.totalSeconds - a.totalSeconds).map((cat, i) => {
                  const avg = cat.count > 0 ? Math.round(cat.totalSeconds / cat.count) : 0;
                  const colors = ['bg-indigo-100 text-indigo-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-pink-100 text-pink-700'];
                  return (
                    <tr key={cat.category} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[i % colors.length]}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-700">{cat.count}</td>
                      <td className="px-5 py-3.5 text-right text-slate-600">{fmtHours(cat.totalSeconds)}</td>
                      <td className="px-5 py-3.5 text-right text-slate-400">{fmtHours(avg)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
  );
}
