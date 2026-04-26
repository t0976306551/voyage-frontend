import { auth } from '../../../auth';
import { Trip } from '@/lib/api/trips.api';
import Link from 'next/link';
import { MapPin, Plus } from 'lucide-react';

export default async function TripsPage() {
  await auth(); // validate session exists (middleware already guarantees this)
  const trips: Trip[] = [];

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">我的行程</h1>
      </div>

      {/* Trip List */}
      <div className="px-4 py-4 space-y-3">
        {trips.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">還沒有行程</p>
            <p className="text-gray-400 text-sm mt-1">點擊右下角 + 新增第一個行程</p>
          </div>
        ) : (
          trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`}>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow">
                <h2 className="font-semibold text-gray-900">{trip.title}</h2>
                {trip.startDate && (
                  <p className="text-sm text-gray-500 mt-1">
                    {trip.startDate} — {trip.endDate}
                  </p>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* FAB */}
      <button className="fixed bottom-20 right-4 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors">
        <Plus className="w-6 h-6" />
      </button>
    </main>
  );
}
