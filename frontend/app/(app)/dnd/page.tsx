"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search, Ban, X, MoreVertical, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import ModalPortal from "@/components/ui/modal-portal";
import { formatDateTime } from "@/lib/utils";

export default function DndPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ number: "", message: "" });

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      const d = await api.get<any>(`/dnd?${q}`);
      setEntries(d.items || []);
    } catch {}
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.number.trim()) return;
    try {
      await api.post("/dnd", form);
      setShowForm(false); setForm({ number: "", message: "" }); load();
    } catch (e: any) { alert(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Remove this number from DND?")) return;
    try { await api.del(`/dnd/${id}`); load(); } catch (e: any) { alert(e.message); }
  };

  const visible = entries.slice(0, perPage);

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>Dnds</h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>Manage your dnd contacts</p>
        </div>
      </div>

      <div className="section-header">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--t3)" }}>Show records :</span>
          <select
            className="input"
            style={{ width: 68, padding: "5px 8px", fontSize: "12px" }}
            value={perPage}
            onChange={e => setPerPage(Number(e.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex-1" />
        <div className="search-wrap" style={{ maxWidth: 220 }}>
          <Search size={13} className="search-icon" />
          <input className="input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={13} /> Add number
        </button>
      </div>

      <div className="card-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th" style={{ width: 60 }}>Sr.no</th>
                <th className="th">Number</th>
                <th className="th">Added At</th>
                <th className="th">Message</th>
                <th className="th" style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((d, i) => (
                <tr key={d.id}>
                  <td className="td" style={{ fontSize: 12.5, color: "var(--t3)" }}>{i + 1}</td>
                  <td className="td font-semibold" style={{ color: "var(--t1)" }}>{d.number}</td>
                  <td className="td text-[12.5px]" style={{ color: "var(--gp)" }}>{formatDateTime(d.createdAt)}</td>
                  <td className="td text-[12.5px]">{d.message || "Stop"}</td>
                  <td className="td text-center">
                    <ActionMenu onDelete={() => remove(d.id)} />
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="td py-0">
                    <div className="empty-state">
                      <div className="empty-icon"><Ban size={20} /></div>
                      <p className="empty-title">No DND numbers found</p>
                      <p className="empty-desc">Numbers that opt out or reply "Stop" will show up here.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {entries.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid rgba(34,197,94,0.18)" }}>
            <span className="text-[12px] font-medium" style={{ color: "var(--gp)" }}>
              Showing 1 to {visible.length} of {entries.length} results
            </span>
          </div>
        )}
      </div>

      {showForm && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setShowForm(false)}>
            <div className="modal-panel w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid rgba(34,197,94,0.18)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>Add DND number</h3>
                <button className="btn-icon" onClick={() => setShowForm(false)}><X size={16} /></button>
              </div>
              <div className="modal-body flex flex-col gap-4">
                <div>
                  <label className="label">Phone number <span style={{ color: "#dc2626" }}>*</span></label>
                  <input className="input" placeholder="e.g. 919004348148" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
                </div>
                <div>
                  <label className="label">Reason <span style={{ fontWeight: 400, color: "var(--t3)" }}>(Optional)</span></label>
                  <input className="input" placeholder="Stop" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 shrink-0" style={{ borderTop: "1px solid rgba(34,197,94,0.18)" }}>
                <button className="btn-ghost" style={{ color: "#dc2626" }} onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary" onClick={create}>Save</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

function ActionMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button className="btn-icon" onClick={() => setOpen(!open)}><MoreVertical size={15} /></button>
      {open && (
        <div className="dropdown absolute right-0 top-full mt-1 z-50" style={{ minWidth: 120 }}>
          <button className="dropdown-item danger" onClick={() => { onDelete(); setOpen(false); }}>
            <Trash2 size={13} /> Remove
          </button>
        </div>
      )}
    </div>
  );
}
