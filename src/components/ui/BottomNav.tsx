'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, MapPin, DollarSign, CheckSquare, User } from 'lucide-react';

const tabs = [
  { href: '/trips', icon: Map, label: '行程' },
  { href: '/explore', icon: MapPin, label: '景點' },
  { href: '/expenses', icon: DollarSign, label: '費用' },
  { href: '/tasks', icon: CheckSquare, label: '待辦' },
  { href: '/profile', icon: User, label: '我的' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-2 gap-1 cursor-pointer transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
