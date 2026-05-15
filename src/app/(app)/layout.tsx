import { AppRail } from '@/components/shell/AppRail';
import { BottomNav } from '@/components/ui/BottomNav';
import { InstallPrompt } from '@/components/ui/InstallPrompt';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppRail />
      <div
        className="md:pl-16"
        style={{ minHeight: '100dvh' }}
      >
        {children}
      </div>
      <BottomNav />
      <InstallPrompt />
    </>
  );
}
