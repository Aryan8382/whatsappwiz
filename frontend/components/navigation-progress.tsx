"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavigationProgress() {
  const pathname      = usePathname();
  const searchParams  = useSearchParams();
  const [visible,     setVisible]    = useState(false);
  const [width,       setWidth]      = useState(0);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef        = useRef<number | null>(null);
  const prevPath      = useRef(pathname + searchParams.toString());

  useEffect(() => {
    const next = pathname + searchParams.toString();
    if (next === prevPath.current) return;
    prevPath.current = next;

    // start bar
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current)   cancelAnimationFrame(rafRef.current);
    setWidth(0);
    setVisible(true);

    // sprint to 80% quickly, then creep
    let w = 0;
    const tick = () => {
      w = w < 70  ? w + 4 :
          w < 85  ? w + 0.8 :
          w < 92  ? w + 0.2 : w;
      setWidth(w);
      if (w < 92) rafRef.current = requestAnimationFrame(tick);
    };
    // small delay so React can paint before animating
    timerRef.current = setTimeout(() => { rafRef.current = requestAnimationFrame(tick); }, 10);

    // complete after route settles
    const done = setTimeout(() => {
      setWidth(100);
      setTimeout(() => setVisible(false), 280);
    }, 320);

    return () => { clearTimeout(done); };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      style={{
        position:      "fixed",
        top:           0,
        left:          0,
        zIndex:        9999,
        height:        "2.5px",
        width:         `${width}%`,
        background:    "linear-gradient(90deg, #22c55e 0%, #4ade80 60%, #86efac 100%)",
        borderRadius:  "0 2px 2px 0",
        boxShadow:     "0 0 10px rgba(34,197,94,0.60), 0 0 4px rgba(34,197,94,0.40)",
        transition:    width === 100
          ? "width 0.22s cubic-bezier(0.16,1,0.3,1)"
          : "width 0.12s linear",
        pointerEvents: "none",
      }}
    />
  );
}
