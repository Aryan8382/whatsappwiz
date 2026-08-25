"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Workflow, Play, Pause, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/utils";

const TRIGGER_LABELS: Record<string, string> = {
  incoming_message: "Incoming Message",
  conversation_closed: "Conversation Closed",
  custom_field_changed: "Custom Field Changed",
  new_contact: "New Contact",
  scheduled: "Scheduled",
};

export default function AutomationPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, active: 0, draft: 0, paused: 0 });
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [perPage, setPerPage] = useState(25);

  const load = useCallback(async () => {
    try {
      const [s, q] = await Promise.all([
        api.get<any>("/automation/stats"),
        api.get<any>(`/automation?${new URLSearchParams({ search, status })}`),
      ]);
      setStats(s);
      setItems(q.items || []);
    } catch {}
  }, [search, status]);

  useEffect(() => { load(); }, [load]);

  const createWorkflow = async () => {
    try {
      const w = await api.post<any>("/automation", { name: "Untitled workflow" });
      router.push(`/automation/${w.id}`);
    } catch (e: any) { alert(e.message); }
  };

  const toggle = async (w: any) => {
    try {
      if (w.status === "active") await api.post(`/automation/${w.id}/pause`);
      else await api.post(`/automation/${w.id}/activate`);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this workflow?")) return;
    try { await api.del(`/automation/${id}`); load(); } catch (e: any) { alert(e.message); }
  };

  const visible = items.slice(0, perPage);

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>Automation Studio</h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>Design and monitor workflow journeys.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total workflows" value={stats.total} color="var(--t1)" dot="#0f172a" />
        <StatCard label="Active" value={stats.active} color="#16a34a" dot="#22c55e" />
        <StatCard label="Drafts" value={stats.draft} color="#d97706" dot="#f59e0b" />
        <StatCard label="Paused" value={stats.paused} color="#2563eb" dot="#3b82f6" />
      </div>

      <div className="section-header">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--t3)" }}>Show records :</span>
          <select className="input" style={{ width: 68, padding: "5px 8px", fontSize: "12px" }} value={perPage} onChange={e => setPerPage(Number(e.target.value))}>
            <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
          </select>
        </div>
        <div className="search-wrap" style={{ maxWidth: 220 }}>
          <Search size={13} className="search-icon" />
          <input className="input" placeholder="Search workflows..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 140, fontSize: 12 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
        <div className="flex-1" />
        <button className="btn-primary" onClick={createWorkflow}>
          <Plus size={13} /> New Workflow
        </button>
      </div>

      <div className="card-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Status</th>
                <th className="th">Trigger</th>
                <th className="th">Steps</th>
                <th className="th">Last run</th>
                <th className="th" style={{ width: 90 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(w => (
                <tr key={w.id} className="cursor-pointer" onClick={() => router.push(`/automation/${w.id}`)}>
                  <td className="td font-semibold" style={{ color: "var(--t1)" }}>{w.name}</td>
                  <td className="td">
                    <span className={
                      w.status === "active" ? "badge-green" : w.status === "paused" ? "badge-amber" : "badge-gray"
                    }>{w.status}</span>
                  </td>
                  <td className="td text-[12.5px]">{w.triggerType ? TRIGGER_LABELS[w.triggerType] : "—"}</td>
                  <td className="td text-[12.5px]">{w.stepCount}</td>
                  <td className="td text-[12.5px]" style={{ color: "var(--gp)" }}>{w.lastRunAt ? timeAgo(w.lastRunAt) : "Never"}</td>
                  <td className="td text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button className="btn-icon" title={w.status === "active" ? "Pause" : "Activate"} onClick={() => toggle(w)}>
                        {w.status === "active" ? <Pause size={13} /> : <Play size={13} />}
                      </button>
                      <button className="btn-icon" style={{ color: "#dc2626" }} onClick={() => remove(w.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="td py-0">
                    <div className="empty-state">
                      <div className="empty-icon"><Workflow size={20} /></div>
                      <p className="empty-title">No workflows yet</p>
                      <p className="empty-desc">Create your first automation to start sending scheduled or event-based WhatsApp journeys.</p>
                      <button className="btn-primary mt-2" onClick={createWorkflow}>
                        <Plus size={13} /> Create workflow
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, dot }: { label: string; value: number; color: string; dot: string }) {
  return (
    <div className="card-raised p-4 flex items-center justify-between">
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.03em", textTransform: "uppercase" }}>{label}</p>
        <p style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{value}</p>
      </div>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: dot }} />
    </div>
  );
}
