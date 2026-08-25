"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import StatusBadge from "@/components/ui/status-badge";

export default function ReportsPage() {
  const [dash,      setDash]      = useState<any>(null);
  const [agents,    setAgents]    = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      setDash(await api.get<any>("/reports/dashboard"));
      setAgents((await api.get<any[]>("/reports/agents")) || []);
      setCampaigns((await api.get<any[]>("/reports/campaigns")) || []);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const exportCsv = (type: string) => {
    api.text(`/reports/export?type=${type}`).then(csv => {
      Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type:"text/csv" })), download:`${type}.csv` }).click();
    }).catch(() => {});
  };

  if (!dash) return <div className="loading-row"><span className="spinner" /><span>Loading reports…</span></div>;
  const k = dash.kpis;

  return (
    <div className="page-wrapper">
      <div className="section-header">
        {["messages","campaigns","agents"].map(type => (
          <button key={type} className="btn-secondary" onClick={() => exportCsv(type)}><Download size={12}/> Export {type}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[["Delivered Rate",`${k.deliveredRate}%`],["Read Rate",`${k.readRate}%`],
          ["Failed Messages",k.failedCount],["Active Agents",k.activeAgents],
          ["Connected Numbers",k.connectedNumbers],["Messages Sent",k.messagesSent],
          ["Messages Received",k.messagesReceived],["Open Conversations",k.openConversations],
        ].map(([label,value]) => (
          <div key={String(label)} className="stat-card">
            <p className="text-[23px] font-black tracking-tight" style={{ color:"var(--t1)", letterSpacing:"-0.04em" }}>{value}</p>
            <p className="text-[11px] font-medium" style={{ color:"var(--t3)" }}>{label}</p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)", letterSpacing:"-0.02em" }}>Message volume</h3>
          <div className="flex gap-3">
            {[["#16a34a","Sent"],["rgba(22,163,74,0.40)","Received"]].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color:"var(--t3)" }}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c as string }}/>{l}
              </span>
            ))}
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dash.messageTrend} margin={{ top:4, right:4, left:-24, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize:11 }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
              <Tooltip />
              <Bar dataKey="sent"     name="Sent"     fill="#16a34a"              radius={[5,5,0,0]}/>
              <Bar dataKey="received" name="Received" fill="rgba(22,163,74,0.35)" radius={[5,5,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card-raised overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:"1px solid rgba(34,197,94,0.18)" }}>
            <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)" }}>Campaign performance</h3>
          </div>
          <table className="w-full">
            <thead><tr><th className="th">Name</th><th className="th">Status</th><th className="th">Delivery</th><th className="th">Read</th></tr></thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id}><td className="td font-semibold" style={{ color:"var(--t1)" }}>{c.name}</td><td className="td"><StatusBadge status={c.status}/></td><td className="td">{c.deliveryRate}%</td><td className="td">{c.readRate}%</td></tr>
              ))}
              {campaigns.length===0 && <tr><td colSpan={4} className="td py-0"><div className="empty-state !py-8"><div className="empty-icon"><TrendingUp size={16}/></div><p className="empty-desc">No campaign data.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card-raised overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:"1px solid rgba(34,197,94,0.18)" }}>
            <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)" }}>Agent activity</h3>
          </div>
          <table className="w-full">
            <thead><tr><th className="th">Agent</th><th className="th">Convs</th><th className="th">Resolved</th><th className="th">Msgs</th><th className="th">Delivered</th></tr></thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id}><td className="td font-semibold" style={{ color:"var(--t1)" }}>{a.name}</td><td className="td">{a.conversationsAssigned}</td><td className="td">{a.resolved}</td><td className="td">{a.messagesSent}</td><td className="td">{a.delivered}</td></tr>
              ))}
              {agents.length===0 && <tr><td colSpan={5} className="td py-0"><div className="empty-state !py-8"><div className="empty-icon"><TrendingUp size={16}/></div><p className="empty-desc">No agent data.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
