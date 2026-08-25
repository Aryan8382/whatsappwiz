"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken } from "@/lib/api";
import Header              from "@/components/header";
import BottomNav           from "@/components/bottom-nav";
import NavigationProgress  from "@/components/navigation-progress";
import WaveLoader          from "@/components/wave-loader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  // mounted — guards against SSR/CSR hydration mismatch (localStorage unavailable on server)
  const [mounted, setMounted] = useState(false);

  // pageReady — tracks whether the current route's content has had time to render.
  // We flip it to false on every navigation so the loader re-appears between routes,
  // then back to true after a short frame-yield so React can paint the new page first.
  const [pageReady, setPageReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!getToken()) router.replace("/login");
  }, [router]);

  // Show loader on every route change
  useEffect(() => {
    setPageReady(false);
    // Two rAF frames → paint cycle completes → content is in the DOM
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Small extra buffer so the wave plays at least once per visit —
        // trimmed from 300ms to 150ms so navigation feels snappier while
        // the loader is still visible long enough not to just flash.
        const t = setTimeout(() => setPageReady(true), 150);
        return () => clearTimeout(t);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  if (!mounted) return null;
  if (!getToken()) return null;

  return (
    <>
      {/* Wave loader — sits above everything, fades out when pageReady */}
      <WaveLoader ready={pageReady} />

      {/* Progress bar — Suspense required for useSearchParams inside */}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>

      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{
          backgroundImage:    "url('/bg.png')",
          backgroundSize:     "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          backgroundRepeat:   "no-repeat",
        }}
      >
        <Header />

        {/*
          main is a scrollable area with breathing room on all sides.
          Normal pages scroll naturally inside it with proper padding.
          The Inbox page breaks out of the padding via -mx/-mt to fill
          the full area, then manages its own internal scroll.
        */}
        <main className="flex-1 min-h-0 overflow-hidden relative">
          {/* Scroll + padding wrapper — all normal pages live here */}
          <div className="absolute inset-0 overflow-y-auto px-4 sm:px-5 pt-4 sm:pt-5 pb-28">
            {/* The inbox page uses absolute inset-0 to escape this padding */}
            <div className="relative min-h-full">
              {children}
            </div>
          </div>
        </main>

        {/* BottomNav — fixed, centered, 14px from the bottom edge */}
        <div className="fixed bottom-[14px] left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[1180px]">
            <BottomNav />
          </div>
        </div>
      </div>
    </>
  );
}