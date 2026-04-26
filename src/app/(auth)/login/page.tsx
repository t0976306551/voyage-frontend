import { signIn } from '../../../../auth';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">VoyageStack</h1>
        <p className="text-gray-500 mb-8 text-sm">多人協作旅遊規劃</p>

        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/trips' });
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 rounded-xl px-6 py-3 font-semibold hover:bg-gray-50 transition-colors"
          >
            使用 Google 登入
          </button>
        </form>
      </div>
    </div>
  );
}
