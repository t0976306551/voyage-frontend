export default function DayDetailLoading() {
  return (
    <div className="bg-gradient-to-br from-slate-50 via-indigo-50/60 to-violet-50" style={{ minHeight: '100dvh' }}>
      {/* Header skeleton */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3 min-h-[44px]">
          <div className="w-9 h-9 rounded-full vs-shimmer" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 vs-shimmer rounded-full w-1/3" />
            <div className="h-3 vs-shimmer rounded-full w-1/4" />
          </div>
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-lg vs-shimmer" />
            <div className="w-8 h-8 rounded-lg vs-shimmer" />
          </div>
        </div>
      </div>

      {/* Items skeleton */}
      <div className="px-4 py-5 max-w-2xl mx-auto space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex items-center gap-3">
            <div className="w-12 h-4 vs-shimmer rounded flex-shrink-0" />
            <div className="flex-1 h-4 vs-shimmer rounded" style={{ width: `${55 + i * 10}%` }} />
            <div className="w-6 h-6 rounded-full vs-shimmer flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
