"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, RefreshCw, GitBranch, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

const CATEGORIES = [
  "SIGN_UP", "SIGN_IN", "APPOINTMENT_BOOKING", "LEAD_GENERATION",
  "CONTACT_US", "CUSTOMER_SUPPORT", "SURVEY", "OTHER",
];

export default function FlowListPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "OTHER" });

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      const d = await api.get<any>(`/flows?${q}`);
      setItems(d.items || []);
    } catch {}
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name.trim()) return;
    try {
      const f = await api.post<any>("/flows", form);
      setShowForm(false); setForm({ name: "", category: "OTHER" });
      router.push(`/flow/${f.id}`);
    } catch (e: any) { alert(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this flow?")) return;
    try { await api.del(`/flows/${id}`); load(); } catch (e: any) { alert(e.message); }
  };

  const visible = items.slice(0, perPage);

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>WhatsApp Flows</h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>Build interactive, screen-based forms for WhatsApp.</p>
        </div>
      </div>

      <div className="section-header">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--t3)" }}>Show records :</span>
          <select className="input" style={{ width: 68, padding: "5px 8px", fontSize: "12px" }} value={perPage} onChange={e => setPerPage(Number(e.target.value))}>
            <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
          </select>
        </div>
        <div className="flex-1" />
        <div className="search-wrap" style={{ maxWidth: 220 }}>
          <Search size={13} className="search-icon" />
          <input className="input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-secondary" onClick={load}><RefreshCw size={13} /> Sync Flow</button>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={13} /> Add Flow</button>
      </div>

      <div className="card-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th" style={{ width: 60 }}>Sr.no</th>
                <th className="th">Flow ID</th>
                <th className="th">Name</th>
                <th className="th">Category</th>
                <th className="th">Status</th>
                <th className="th">Health Status</th>
                <th className="th">Created By</th>
                <th className="th">Created At</th>
                <th className="th" style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f, i) => (
                <tr key={f.id} className="cursor-pointer" onClick={() => router.push(`/flow/${f.id}`)}>
                  <td className="td" style={{ fontSize: 12.5, color: "var(--t3)" }}>{i + 1}</td>
                  <td className="td text-[12.5px]">{f.flowRef}</td>
                  <td className="td font-semibold" style={{ color: "var(--t1)" }}>{f.name}</td>
                  <td className="td text-[12.5px]">{f.category.replace(/_/g, " ")}</td>
                  <td className="td"><span className={f.status === "published" ? "badge-green" : "badge-gray"}>{f.status}</span></td>
                  <td className="td"><span className={f.healthStatus === "healthy" ? "badge-green" : "badge-red"}>{f.healthStatus}</span></td>
                  <td className="td text-[12.5px]">{f.createdByName || "—"}</td>
                  <td className="td text-[12.5px]" style={{ color: "var(--gp)" }}>{formatDateTime(f.createdAt)}</td>
                  <td className="td text-center" onClick={e => e.stopPropagation()}>
                    <button className="btn-icon" style={{ color: "#dc2626" }} onClick={() => remove(f.id)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={9} className="td py-0">
                    <div className="empty-state">
                      <div className="empty-icon"><GitBranch size={20} /></div>
                      <p className="empty-title">No Data Found</p>
                      <p className="empty-desc">Create a flow to collect structured information right inside WhatsApp.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-sm my-auto" onClick={e => e.stopPropagation()}>
            <div className="modal-panel">
              <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid rgba(34,197,94,0.18)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>New flow</h3>
                <button className="btn-icon" onClick={() => setShowForm(false)}>✕</button>
              </div>
              <div className="modal-body flex flex-col gap-4">
                <div>
                  <label className="label">Flow name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input className="input" placeholder="Enter name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Select category <span style={{ color: "#dc2626" }}>*</span></label>
                  <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 shrink-0" style={{ borderTop: "1px solid rgba(34,197,94,0.18)" }}>
                <button className="btn-ghost" style={{ color: "#dc2626" }} onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary" onClick={create}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
