export default function TripsLoading() {
  return (
    <div className="bg-slate-50" style={{ minHeight: '100dvh' }}>
      {/* Hero skeleton */}
      <div className="bg-white border-b border-slate-100 px-4 pt-5 pb-4 md:px-6">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="h-7 vs-shimmer rounded-full w-28" />
          <div className="h-4 vs-shimmer rounded-full w-40" />
        </div>
      </div>

      {/* Cards grid */}
      <div className="px-4 md:px-6 py-5 max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <div className="h-5 vs-shimmer rounded-full w-20" />
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="h-32 sm:h-44 vs-shimmer" />
                <div className="px-3 py-2.5 space-y-2">
                  <div className="h-3.5 vs-shimmer rounded w-3/4" />
                  <div className="h-3 vs-shimmer rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
