"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, LogOut, User, ChevronDown, X, Sun, Moon } from "lucide-react";
import { clearSession, getSessionUser } from "@/lib/api";
import { initials } from "@/lib/utils";
import Image from "next/image";

const NOTIFS = [
  { id:1, text:"New message from Ravi Kumar",     time:"2m ago",  unread:true  },
  { id:2, text:"Campaign 'Welcome' completed",     time:"15m ago", unread:true  },
  { id:3, text:"Template 'order_update' approved", time:"1h ago",  unread:false },
];

/* ─────────────────────────────────────────
   LAYER TOKENS  (light / dark)
   ───────────────────────────────────────── */
const LIGHT = {
  /* OUTER glass layer — the header bar itself */
  outerBg:      "rgba(255,255,255,0.32)",
  outerBorder:  "1px solid rgba(255,255,255,0.70)",
  outerShadow:  `0 1px 0 rgba(255,255,255,0.85) inset,
                 0 -1px 0 rgba(0,0,0,0.04) inset,
                 0 4px 20px rgba(0,0,0,0.07),
                 0 1px 3px rgba(0,0,0,0.05)`,
  outerBlur:    "blur(52px) saturate(220%) brightness(1.00) contrast(1.08)",

  /* INNER glass layer — search, icon pills, profile pill */
  innerBg:      "rgba(220,252,231,0.40)",
  innerBorder:  "1px solid rgba(34,197,94,0.25)",
  innerShadow:  `0 1px 0 rgba(255,255,255,0.70) inset,
                 0 2px 8px rgba(0,0,0,0.04)`,
  innerBlur:    "blur(24px) saturate(190%)",

  /* inner active / hover */
  innerHoverBg:  "rgba(220,252,231,0.60)",
  innerActiveBg: "rgba(220,252,231,0.80)",
  innerActiveBrd:"rgba(34,197,94,0.45)",

  /* text */
  t1: "var(--t1)",
  t2: "var(--t2)",
  t3: "var(--t3)",
  divider: "rgba(0,0,0,0.08)",

  /* top specular line gradient (simulates curved glass catching light) */
  topGlint: `linear-gradient(90deg,
    transparent 0%,
    rgba(255,255,255,0.70) 20%,
    rgba(255,255,255,0.95) 50%,
    rgba(255,255,255,0.70) 80%,
    transparent 100%)`,
};

const DARK = {
  outerBg:      "rgba(15,30,20,0.72)",
  outerBorder:  "1px solid rgba(255,255,255,0.10)",
  outerShadow:  `0 1px 0 rgba(255,255,255,0.08) inset,
                 0 -1px 0 rgba(0,0,0,0.25) inset,
                 0 4px 24px rgba(0,0,0,0.30),
                 0 1px 4px rgba(0,0,0,0.20)`,
  outerBlur:    "blur(48px) saturate(180%) brightness(0.92)",

  innerBg:      "rgba(255,255,255,0.08)",
  innerBorder:  "1px solid rgba(255,255,255,0.13)",
  innerShadow:  `0 1px 0 rgba(255,255,255,0.10) inset,
                 0 2px 8px rgba(0,0,0,0.20)`,
  innerBlur:    "blur(16px) saturate(160%)",

  innerHoverBg:  "rgba(255,255,255,0.14)",
  innerActiveBg: "rgba(34,197,94,0.20)",
  innerActiveBrd:"rgba(34,197,94,0.40)",

  t1: "rgba(240,255,248,0.95)",
  t2: "rgba(200,240,220,0.80)",
  t3: "rgba(160,200,180,0.60)",
  divider: "rgba(255,255,255,0.10)",

  topGlint: `linear-gradient(90deg,
    transparent 0%,
    rgba(255,255,255,0.06) 20%,
    rgba(255,255,255,0.14) 50%,
    rgba(255,255,255,0.06) 80%,
    transparent 100%)`,
};

export default function Header() {
  const router = useRouter();
  const user   = getSessionUser();

  const [search,     setSearch]     = useState("");
  const [showNotifs, setShowNotifs] = useState(false);
  const [showPro,    setShowPro]    = useState(false);
  const [unread,     setUnread]     = useState(NOTIFS.filter(n => n.unread).length);
  const [dark,       setDark]       = useState(false);

  const nRef = useRef<HTMLDivElement>(null);
  const pRef = useRef<HTMLDivElement>(null);

  const T = dark ? DARK : LIGHT;

  /* close dropdowns on outside click */
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (nRef.current && !nRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (pRef.current && !pRef.current.contains(e.target as Node)) setShowPro(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  /* apply dark class to <html> for downstream pages */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const logout = () => { clearSession(); router.replace("/login"); };

  /* ── inner pill helper (search / icon buttons / profile) ── */
  const innerStyle = (active = false): React.CSSProperties => ({
    background:           active ? T.innerActiveBg : T.innerBg,
    border:               active ? `1px solid ${T.innerActiveBrd}` : T.innerBorder,
    boxShadow:            T.innerShadow,
    backdropFilter:       T.innerBlur,
    WebkitBackdropFilter: T.innerBlur,
  });

  return (
    <header
      className="shrink-0 z-40 relative select-none"
      style={{
        height:               "52px",
        background:           T.outerBg,
        border:               T.outerBorder,
        borderTop:            "none",
        borderLeft:           "none",
        borderRight:          "none",
        boxShadow:            T.outerShadow,
        backdropFilter:       T.outerBlur,
        WebkitBackdropFilter: T.outerBlur,
      }}
    >
      {/* ── Top specular highlight line (curved-glass light catch) ── */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{ height:"1px", background: T.topGlint, opacity: dark ? 0.8 : 1 }}
      />

      {/* ── Outer bottom shadow line ── */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height:"1px", background: dark ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.06)" }}
      />

      {/* ── Glass grain — subtle turbulence so the bar reads as frosted glass, not flat blur ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "var(--grain)",
          backgroundSize: "140px 140px",
          opacity: dark ? 0.5 : 1,
        }}
      />

      {/* ── Inner layout row ── */}
      <div className="flex items-center gap-3 h-full px-4">

        {/* LOGO — on the outer layer (no inner pill) */}
        <div className="flex items-center shrink-0 mr-1">
          <Image
            src="/logo.png"
            alt="WhatsApp Wiz logo"
            width={160}
            height={52}
            priority
            unoptimized
            className="object-contain w-auto"
            style={{ height:"38px", filter: dark ? "brightness(1.15) contrast(0.95)" : "none", maxWidth:"160px" }}
          />
        </div>

        {/* SEARCH — inner glass pill (layer 2) */}
        <div className="flex-1 max-w-[320px] mx-auto relative search-wrap">
          <Search size={13} className="search-icon" />
          <input
            className="search-input !h-[32px] !pl-8 !pr-7 !text-[12.5px]"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity" onClick={() => setSearch("")}>
              <X size={11} style={{ color: "var(--gp)" }} />
            </button>
          )}
        </div>

        {/* RIGHT SIDE — all inner glass pills (layer 2) */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">

          {/* Dark / Light toggle — inner glass pill */}
          <button
            onClick={() => setDark(!dark)}
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center transition-all duration-200"
            style={innerStyle()}
            title={dark ? "Switch to light" : "Switch to dark"}
            onMouseEnter={e => (e.currentTarget.style.background = T.innerHoverBg)}
            onMouseLeave={e => (e.currentTarget.style.background = T.innerBg)}
          >
            {dark
              ? <Sun  size={13} style={{ color:"#fcd34d" }} />
              : <Moon size={13} style={{ color: T.t2 }} />
            }
          </button>

          {/* Notification bell — inner glass pill */}
          <div className="relative" ref={nRef}>
            <button
              onClick={() => { setShowNotifs(!showNotifs); setShowPro(false); }}
              className="relative w-[30px] h-[30px] rounded-full flex items-center justify-center transition-all duration-200"
              style={innerStyle(showNotifs)}
              onMouseEnter={e => { if (!showNotifs) e.currentTarget.style.background = T.innerHoverBg; }}
              onMouseLeave={e => { if (!showNotifs) e.currentTarget.style.background = T.innerBg; }}
            >
              <Bell size={14} style={{ color: showNotifs ? "var(--gp)" : T.t2 }} />
              {unread > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-[14px] h-[14px] rounded-full text-[7.5px] font-black text-white flex items-center justify-center"
                  style={{ background:"linear-gradient(155deg,#22c55e,#16a34a)", boxShadow:"0 1px 5px rgba(34,197,94,0.55), inset 0 1px 0 rgba(255,255,255,0.25)" }}
                >
                  {unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="dropdown absolute top-[calc(100%+8px)] right-0 w-[284px] z-50 animate-scale-in">
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom:`1px solid ${T.divider}` }}>
                  <span className="font-bold text-[12.5px]" style={{ color: T.t1 }}>Notifications</span>
                  {unread > 0 && (
                    <button className="text-[11px] font-semibold hover:opacity-70 transition-opacity" style={{ color:"var(--gp)" }} onClick={() => setUnread(0)}>
                      Mark all read
                    </button>
                  )}
                </div>
                {NOTIFS.map(n => (
                  <div key={n.id} className="dropdown-item cursor-pointer" style={{ borderTop:`1px solid ${T.divider}` }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-px"
                      style={{ background: n.unread ? "#22c55e" : "rgba(0,0,0,0.15)", boxShadow: n.unread ? "0 0 5px rgba(34,197,94,0.55)" : "none" }} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize:"11.5px", lineHeight:"1.4", fontWeight: n.unread ? 600 : 400, color: n.unread ? T.t1 : T.t3 }}>{n.text}</p>
                      <p style={{ fontSize:"10px", marginTop:"2px", color: T.t3 }}>{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Thin glass divider */}
          <div className="h-5 w-px mx-0.5 shrink-0" style={{ background: T.divider }} />

          {/* Profile pill — inner glass pill */}
          <div className="relative" ref={pRef}>
            <button
              onClick={() => { setShowPro(!showPro); setShowNotifs(false); }}
              className="flex items-center gap-1.5 h-[30px] pl-1.5 pr-2.5 rounded-full transition-all duration-200"
              style={innerStyle(showPro)}
              onMouseEnter={e => { if (!showPro) e.currentTarget.style.background = T.innerHoverBg; }}
              onMouseLeave={e => { if (!showPro) e.currentTarget.style.background = T.innerBg; }}
            >
              <div className="avatar w-[20px] h-[20px] text-[9px] rounded-md shrink-0">
                {initials(user?.email?.split("@")[0] || "U")}
              </div>
              <span className="hidden md:block font-semibold max-w-[76px] truncate text-[12px]" style={{ color: T.t1 }}>
                {user?.email?.split("@")[0]}
              </span>
              <ChevronDown size={10} style={{ color: T.t3, transform: showPro ? "rotate(180deg)" : "rotate(0deg)", transition:"transform 0.18s" }} />
            </button>

            {showPro && (
              <div className="dropdown absolute top-[calc(100%+8px)] right-0 w-[200px] z-50 animate-scale-in">
                <div className="px-4 py-3.5" style={{ borderBottom:`1px solid ${T.divider}` }}>
                  <div className="flex items-center gap-2.5">
                    <div className="avatar w-7 h-7 text-[10px] shrink-0">{initials(user?.email?.split("@")[0] || "U")}</div>
                    <div className="min-w-0">
                      <p className="font-bold truncate text-[12.5px]" style={{ color:"var(--t1)" }}>{user?.email?.split("@")[0]}</p>
                      <p className="capitalize truncate text-[10px]" style={{ color:"var(--t3)" }}>{user?.role?.replace(/_/g," ")}</p>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <button className="dropdown-item" onClick={() => { router.push("/settings"); setShowPro(false); }}>
                    <User size={12} /> Profile & Settings
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item danger" onClick={logout}>
                    <LogOut size={12} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
