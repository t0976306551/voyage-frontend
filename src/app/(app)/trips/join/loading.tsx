import { Loader2 } from 'lucide-react';

export default function JoinLoading() {
  return (
    <main
      className="flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100"
      style={{ minHeight: '100dvh' }}
    >
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500">正在加入行程...</p>
      </div>
    </main>
  );
}
