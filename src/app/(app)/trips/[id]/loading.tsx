export default function TripDetailLoading() {
  return (
    <div className="bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100" style={{ minHeight: '100dvh' }}>
      {/* Hero skeleton */}
      <div className="h-40 sm:h-52 md:h-60 vs-shimmer" />

      {/* Header skeleton */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3 min-h-[44px]">
          <div className="w-9 h-9 rounded-full vs-shimmer" />
          <div className="flex-1 space-y-2">
            <div className="h-4 vs-shimmer rounded-full w-2/5" />
            <div className="h-3 vs-shimmer rounded-full w-1/3" />
          </div>
          <div className="w-9 h-9 rounded-full vs-shimmer" />
        </div>
      </div>

      {/* Jump bar skeleton */}
      <div className="bg-white/90 border-b border-slate-100 px-4 py-2">
        <div className="max-w-3xl mx-auto flex gap-3">
          {[60, 80, 50, 50].map((w, i) => (
            <div key={i} className="h-7 vs-shimmer rounded-full" style={{ width: w }} />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto space-y-6">
        {/* Section header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 vs-shimmer rounded-full w-20" />
            <div className="h-4 vs-shimmer rounded-full w-24" />
          </div>
          {/* Day cards */}
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="h-4 vs-shimmer rounded-full w-32" />
                <div className="h-3 vs-shimmer rounded-full w-8" />
              </div>
              <div className="px-4 py-3 space-y-2.5">
                <div className="h-3.5 vs-shimmer rounded w-full" />
                <div className="h-3.5 vs-shimmer rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>

        {/* Second section */}
        <div className="space-y-3">
          <div className="h-5 vs-shimmer rounded-full w-24" />
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <div className="h-3.5 vs-shimmer rounded w-full" />
            <div className="h-3.5 vs-shimmer rounded w-5/6" />
            <div className="h-3.5 vs-shimmer rounded w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
