'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, register, getDepartments } from '../../lib/api';
import { saveSession } from '../../lib/auth';

// ── Shared brand header ───────────────────────────────────────────────────────
function BrandHeader() {
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
        <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">DeskTime</h1>
      <p className="mt-1 text-sm text-slate-500">Employee Monitoring Platform</p>
    </div>
  );
}

// ── Input helper ──────────────────────────────────────────────────────────────
function Field({ label, id, type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}

// ── Login form ────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess }) {
  const [form, setForm]     = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form.email.trim(), form.password);
      onSuccess(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Email" id="login-email" type="email" autoComplete="email"
        value={form.email} onChange={set('email')} placeholder="you@company.com" />
      <Field label="Password" id="login-password" type="password" autoComplete="current-password"
        value={form.password} onChange={set('password')} placeholder="••••••••" />

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

// ── Register form ─────────────────────────────────────────────────────────────
function RegisterForm({ onSuccess }) {
  const [form, setForm]         = useState({ email: '', name: '', password: '', confirm: '', departmentId: '' });
  const [departments, setDepts] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    getDepartments().then(setDepts).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const data = await register(form.email.trim(), form.password, form.name.trim(), form.departmentId || undefined);
      onSuccess(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Full Name" id="reg-name" type="text" autoComplete="name"
        value={form.name} onChange={set('name')} placeholder="Your full name" />
      <Field label="Work Email" id="reg-email" type="email" autoComplete="email"
        value={form.email} onChange={set('email')} placeholder="you@company.com" />
      {departments.length > 0 && (
        <div>
          <label htmlFor="reg-dept" className="block text-sm font-medium text-slate-700 mb-1.5">
            Department
          </label>
          <select
            id="reg-dept"
            value={form.departmentId}
            onChange={set('departmentId')}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Select department…</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
      <Field label="Password" id="reg-password" type="password" autoComplete="new-password"
        value={form.password} onChange={set('password')} placeholder="Min. 6 characters" />
      <Field label="Confirm Password" id="reg-confirm" type="password" autoComplete="new-password"
        value={form.confirm} onChange={set('confirm')} placeholder="Repeat password" />

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-center text-xs text-slate-400">
        Your email must be registered in the company&apos;s Odoo system.
      </p>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router  = useRouter();
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  function handleSuccess(data) {
    saveSession(data.token, data.user);
    if (data.user.role === 'admin') router.replace('/admin');
    else if (data.user.role === 'manager') router.replace('/manager');
    else router.replace('/dashboard');
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <BrandHeader />

        {/* Tab switcher */}
        <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
          {['login', 'register'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition ${
                tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {tab === 'login'
            ? <LoginForm onSuccess={handleSuccess} />
            : <RegisterForm onSuccess={handleSuccess} />}
        </div>

        {/* Download for Windows */}
        <a
          href="https://kgrnauditdxb-my.sharepoint.com/:u:/g/personal/servicedesk_kgrnaudit_com/IQAEN0iZLtfdT64D48_IpbxOAQVN_94b6yoaDCDP0H3CQas?download=1"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.8" />
          </svg>
          Download for Windows Client
        </a>

        <div className="mt-5 flex items-center justify-center gap-3 text-xs text-slate-400">
          <span>Developed by KGRN</span>
          <span>·</span>
          <a href="/docs" className="text-blue-500 hover:underline">User Manual</a>
        </div>
      </div>
    </div>
  );
}
