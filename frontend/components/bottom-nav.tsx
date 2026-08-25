"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Inbox, Users, FileText, Megaphone,
  Bot, BarChart3, Wallet, Shield, Settings,
  SlidersHorizontal, BookOpen, Workflow, Image as ImageIcon,
  GitBranch, Ban, LayoutGrid, Briefcase, Boxes, ShoppingBag, SignalHigh,
} from "lucide-react";
import { getSessionUser } from "@/lib/api";
import { useEffect } from "react";

import { useRouter } from "next/navigation";

/* ─────────────────────────────────────────
   Nav data
   ───────────────────────────────────────── */
const NAV = [
  { href:"/",               label:"Dashboard",       icon:LayoutDashboard },
  { href:"/inbox",          label:"Inbox",            icon:Inbox },
  { href:"/custom-fields",  label:"Custom Fields",    icon:SlidersHorizontal },
  { href:"/contacts",       label:"Contacts",         icon:Users },
  { href:"/templates",      label:"Templates",        icon:FileText },
  { href:"/template-library", label:"Template Library", icon:BookOpen },
  { href:"/campaigns",      label:"Broadcast",        icon:Megaphone },
  { href:"/automation",     label:"Automation",       icon:Workflow },
  { href:"/media",          label:"Media",            icon:ImageIcon },
  { href:"/chatbot",        label:"Chatbot",          icon:Bot },
  { href:"/flow",           label:"Flow",             icon:GitBranch },
  { href:"/dnd",            label:"DND",              icon:Ban },
  { href:"/apps",           label:"Apps",             icon:LayoutGrid },
  { href:"/business",       label:"Business",         icon:Briefcase },
  { href:"/catalogue",      label:"Catalogue",        icon:Boxes },
  { href:"/reports",        label:"Reports",          icon:BarChart3 },
  { href:"/order-details",  label:"Order Details",    icon:ShoppingBag },
  { href:"/users",          label:"Users",            icon:Users },
  { href:"/sim-card",       label:"SIM Card",         icon:SignalHigh },
  { href:"/wallet",         label:"Wallet",           icon:Wallet },
  { href:"/admin",          label:"Admin",            icon:Shield, adminOnly:true },
  { href:"/settings",       label:"Settings",         icon:Settings },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getSessionUser();
  const visible  = NAV.filter(i => !(i as any).adminOnly || user?.role === "super_admin");

  // ── warm the router cache for every dock destination once the page is
  // idle, so clicking any icon feels instant instead of waiting on the
  // first hover — this only prefetches, it never changes navigation logic. */
  useEffect(() => {
    const prefetchAll = () => {
      visible.forEach(item => router.prefetch(item.href));
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void) => number)
      | undefined;
    if (ric) {
      const id = ric(prefetchAll);
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const t = setTimeout(prefetchAll, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="shrink-0 flex items-center justify-center px-3 py-2 dock-viewport"
      style={{ background: "transparent" }}
    >
      {/*
        ── Double-layer liquid glass dock, isolated per-icon hover ──
        OUTER layer  : translucent green-tinted glass, heavy blur, soft glow, luminous border.
        INNER layer  : slightly darker/clearer glass sitting inset within the outer shell,
                        giving the bar visible depth/separation without breaking it into pieces.
        Icons are laid out on a CSS grid with one equal-width column per item, so they always
        fill the full bar evenly with no leftover gap, at any icon count or screen width.
        Hover is plain CSS :hover scoped to each .dock-item — only the icon under the cursor
        lifts, scales, and gets its own glass pill + tooltip. No JS, no neighbor bleed.
      */}
      <nav
        className="dock-outer"
        role="navigation"
        aria-label="Primary"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
      >
        {/* top-edge glass glint (outer layer) */}
        <span className="dock-glint" aria-hidden="true" />

        {/* grain — turbulence texture so the bar reads as frosted glass, not flat blur */}
        <span className="dock-grain" aria-hidden="true" />

        {/* INNER glass layer — creates the double-layer depth */}
        <span className="dock-inner-layer" aria-hidden="true" />

        {visible.map((item) => {
          const active = pathname === item.href;
          const Icon   = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`dock-item${active ? " dock-item-active" : ""}`}
              onMouseEnter={() => router.prefetch(item.href)}
            >
              {/* tooltip label — appears ABOVE the icon on hover only */}
              <span className="dock-tooltip">{item.label}</span>

              {/* icon — flat by default; pure CSS :hover on this item lifts/scales it */}
              <span className="dock-icon-shell">
                <Icon className="dock-icon" size={18} strokeWidth={active ? 2.3 : 1.9} />
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
