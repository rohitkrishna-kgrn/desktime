'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import StatusBadge from './StatusBadge';

export default function UserCard({ user }) {
  const router = useRouter();

  const lastSeen = user.currentStatus === 'checked_in'
    ? user.lastCheckIn
    : user.lastCheckOut;

  return (
    <button
      onClick={() => router.push(`/admin/users/${user._id}`)}
      className="group w-full rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-slate-200 flex-shrink-0"
          />
        ) : (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
            {user.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-semibold text-slate-800 group-hover:text-blue-700 transition">
              {user.name}
            </p>
            <StatusBadge status={user.currentStatus} showLabel={false} size="sm" />
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
          {user.department && (
            <p className="mt-1 text-xs text-slate-400">{user.department}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <StatusBadge status={user.currentStatus} size="sm" />
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {/* Desktop client indicator */}
          <span
            title={user.desktopClientActive ? 'Desktop app active' : 'Desktop app offline'}
            className={`h-1.5 w-1.5 rounded-full ${user.desktopClientActive ? 'bg-blue-500' : 'bg-slate-300'}`}
          />
          {lastSeen && (
            <span>{formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}</span>
          )}
        </div>
      </div>
    </button>
  );
}
