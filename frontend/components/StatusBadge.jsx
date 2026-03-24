export default function StatusBadge({ status, showLabel = true, size = 'md' }) {
  const isIn = status === 'checked_in';
  const isOut = status === 'checked_out';

  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  const dot = isIn
    ? `${dotSize} rounded-full bg-emerald-500 animate-pulse`
    : isOut
    ? `${dotSize} rounded-full bg-red-500`
    : `${dotSize} rounded-full bg-slate-400`;

  const label = isIn ? 'Checked In' : isOut ? 'Checked Out' : 'Unknown';
  const color = isIn ? 'text-emerald-700' : isOut ? 'text-red-700' : 'text-slate-500';
  const bg = isIn ? 'bg-emerald-50' : isOut ? 'bg-red-50' : 'bg-slate-100';
  const ring = isIn ? 'ring-emerald-200' : isOut ? 'ring-red-200' : 'ring-slate-200';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1 ${bg} ${ring} ${color} ${textSize}`}
    >
      <span className={dot} />
      {showLabel && label}
    </span>
  );
}
