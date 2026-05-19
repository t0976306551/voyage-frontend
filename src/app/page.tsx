import { auth } from '../../auth';
import { TopNav } from '@/components/landing/TopNav';
import { Hero } from '@/components/landing/Hero';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';
import { AuthModalMount } from '@/components/landing/AuthModalMount';

export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="bg-white text-slate-900" style={{ minHeight: '100dvh' }}>
      <TopNav isLoggedIn={isLoggedIn} />

      <main>
        <Hero isLoggedIn={isLoggedIn} />
        <FeaturesGrid />
        <HowItWorks />
        <FinalCTA isLoggedIn={isLoggedIn} />
      </main>

      <Footer />

      {/* Singleton modal — only mount it when there's no session, to keep
          DOM/event listeners minimal for logged-in visitors. */}
      {!isLoggedIn && <AuthModalMount />}
    </div>
  );
}
