'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, getStoredUser } from '../lib/auth';
import StatusBadge from './StatusBadge';

export default function Navbar({ status }) {
  const router = useRouter();
  // Read cookie only on the client to avoid SSR/client hydration mismatch
  const [user, setUser] = useState(null);
  useEffect(() => { setUser(getStoredUser()); }, []);

  function handleLogout() {
    clearSession();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-base font-bold text-slate-800">DeskTime</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {status && <StatusBadge status={status} size="sm" />}
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-800">{user?.name}</p>
            <p className="text-xs text-slate-400">{user?.role === 'admin' ? 'Administrator' : user?.jobTitle || 'Employee'}</p>
          </div>
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-200" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
