'use client';

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const CATEGORY_STYLE = {
  productive: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Productive' },
  unproductive: { bg: 'bg-red-100', text: 'text-red-700', label: 'Unproductive' },
  neutral: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Neutral' },
  idle: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Idle' },
};

export default function AppUsageTable({ apps = [] }) {
  if (!apps.length) {
    return <p className="py-6 text-center text-sm text-slate-400">No app data for this period.</p>;
  }

  const total = apps.reduce((s, a) => s + a.totalSeconds, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-4">Application</th>
            <th className="py-2 pr-4">Category</th>
            <th className="py-2 pr-4 text-right">Time</th>
            <th className="py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app, i) => {
            const style = CATEGORY_STYLE[app.category] || CATEGORY_STYLE.neutral;
            const pct = total > 0 ? Math.round((app.totalSeconds / total) * 100) : 0;
            return (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition">
                <td className="py-2.5 pr-4 font-medium text-slate-800">{app.appName}</td>
                <td className="py-2.5 pr-4">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right text-slate-600">{fmtDuration(app.totalSeconds)}</td>
                <td className="py-2.5 text-right">
                  <div className="ml-auto flex items-center justify-end gap-2">
                    <div className="h-1.5 w-20 rounded-full bg-slate-100">
                      <div
                        className={`h-1.5 rounded-full ${style.bg.replace('100', '400')}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-xs text-slate-500">{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
