"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MessagesSquare, Users, Inbox, Send, Bot, Wallet as WIcon, TrendingUp, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { timeAgo, initials } from "@/lib/utils";
import StatusBadge from "@/components/ui/status-badge";

type Dashboard = {
  kpis: {
    totalConversations: number; openConversations: number;
    messagesSent: number; messagesReceived: number;
    deliveredRate: number; readRate: number; failedCount: number;
    activeAgents: number; connectedNumbers: number;
    walletBalance: number; walletCurrency: string; activeCampaigns: number;
  };
  messageTrend: { date: string; sent: number; received: number }[];
  campaigns: any[];
  recentConversations: any[];
};

const STAT_META = [
  { icon: MessagesSquare, label: "Conversations",    key: "totalConversations"  },
  { icon: Inbox,          label: "Open",             key: "openConversations"   },
  { icon: Send,           label: "Messages Sent",    key: "messagesSent"        },
  { icon: Users,          label: "Received",         key: "messagesReceived"    },
  { icon: TrendingUp,     label: "Delivered Rate",   key: "deliveredRate",  pct: true },
  { icon: Zap,            label: "Read Rate",        key: "readRate",       pct: true },
  { icon: Bot,            label: "Campaigns Active", key: "activeCampaigns"     },
  { icon: WIcon,          label: "Wallet",           key: "wallet"              },
];

export default function DashboardPage() {
  const [data,  setData]  = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Dashboard>("/reports/dashboard").then(setData).catch((e: any) => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data)  return <div className="loading-row"><span className="spinner" /><span>Loading dashboard…</span></div>;

  const k = data.kpis;

  const statValue = (key: string, pct?: boolean) => {
    if (key === "wallet") return `${k.walletCurrency} ${k.walletBalance}`;
    const v = (k as any)[key];
    return pct ? `${v}%` : v;
  };

  return (
    <div className="page-wrapper">

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAT_META.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="stat-card">
              <div className="icon-box-md">
                <Icon size={17} />
              </div>
              <div>
                <p className="text-[23px] font-black tracking-tight" style={{ color:"var(--t1)", letterSpacing:"-0.04em" }}>
                  {statValue(s.key, (s as any).pct)}
                </p>
                <p className="text-[11px] font-medium mt-0.5" style={{ color:"var(--t3)" }}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)", letterSpacing:"-0.02em" }}>
              Message volume — 14 days
            </h3>
            <div className="flex gap-3">
              {[["#16a34a","Sent"],["rgba(22,163,74,0.40)","Received"]].map(([c,l]) => (
                <span key={l} className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color:"var(--t3)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: c as string }} />{l}
                </span>
              ))}
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.messageTrend} margin={{ top:4, right:4, left:-24, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize:11 }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="sent"     name="Sent"     stroke="#16a34a" strokeWidth={2.5} dot={false} activeDot={{ r:4, strokeWidth:0 }} />
                <Line type="monotone" dataKey="received" name="Received" stroke="rgba(22,163,74,0.45)" strokeWidth={2} dot={false} strokeDasharray="5 3" activeDot={{ r:4, strokeWidth:0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)", letterSpacing:"-0.02em" }}>Campaigns</h3>
            <Link href="/campaigns" className="text-[12px] font-semibold" style={{ color:"var(--gp)" }}>View all</Link>
          </div>
          {data.campaigns.length === 0 ? (
            <div className="empty-state !py-8">
              <div className="empty-icon"><Bot size={20} /></div>
              <p className="empty-desc">No campaigns yet. <Link href="/campaigns" className="font-bold" style={{ color:"var(--gp)" }}>Create one</Link></p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.campaigns.map(c => (
                <div key={c.id} className="card-green flex items-center justify-between px-3 py-2">
                  <span className="text-[12px] font-semibold truncate max-w-[130px]" style={{ color:"var(--t1)" }}>{c.name}</span>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent conversations */}
      <div className="card-raised overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:"1px solid rgba(34,197,94,0.18)" }}>
          <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)", letterSpacing:"-0.02em" }}>Recent conversations</h3>
          <Link href="/inbox" className="text-[12px] font-semibold" style={{ color:"var(--gp)" }}>Open inbox</Link>
        </div>
        {data.recentConversations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Inbox size={20} /></div>
            <p className="empty-title">No conversations yet</p>
            <p className="empty-desc">Send a message or simulate an incoming WhatsApp message.</p>
          </div>
        ) : (
          <div>
            {data.recentConversations.map((c: any) => (
              <Link key={c.id} href="/inbox"
                className="flex items-center gap-3 px-5 py-3.5 transition-colors"
                style={{ borderTop:"1px solid rgba(255,255,255,0.35)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,252,231,0.30)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <div className="avatar w-9 h-9 text-[11px]">{initials(c.contact?.firstName, c.contact?.lastName)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color:"var(--t1)" }}>{c.contact?.firstName} {c.contact?.lastName || ""}</p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color:"var(--t3)" }}>{c.messages?.[0]?.messageText || "No messages"}</p>
                </div>
                <span className="text-[11px]" style={{ color:"var(--t3)" }}>{timeAgo(c.updatedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
