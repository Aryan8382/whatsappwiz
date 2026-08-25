"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus, Search, SlidersHorizontal, X, MoreVertical, Trash2, Pencil,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import Switch from "@/components/ui/switch";
import ModalPortal from "@/components/ui/modal-portal";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "boolean", label: "Yes / No" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];

const emptyForm = {
  id: 0,
  name: "",
  fieldType: "",
  defaultValue: "",
  showInListing: true,
  status: true,
  mandatory: false,
};

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      const d = await api.get<any>(`/custom-fields?${q}`);
      setFields(d.items || []);
    } catch {}
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm); setShowForm(true); };
  const openEdit = (f: any) => {
    setForm({
      id: f.id, name: f.name, fieldType: f.fieldType, defaultValue: f.defaultValue || "",
      showInListing: f.showInListing, status: f.status, mandatory: f.mandatory,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.fieldType) return;
    const payload = {
      name: form.name, fieldType: form.fieldType, defaultValue: form.defaultValue || undefined,
      showInListing: form.showInListing, status: form.status, mandatory: form.mandatory,
    };
    try {
      if (form.id) await api.put(`/custom-fields/${form.id}`, payload);
      else await api.post("/custom-fields", payload);
      setShowForm(false); setForm(emptyForm); load();
    } catch (e: any) { alert(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this custom field?")) return;
    try { await api.del(`/custom-fields/${id}`); load(); } catch (e: any) { alert(e.message); }
  };

  const visible = fields.slice(0, perPage);

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>Custom fields</h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>Create and manage your Custom Field</p>
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
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={13} /> Add field
        </button>
      </div>

      <div className="card-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th" style={{ width: 60 }}>Sr.no</th>
                <th className="th">Field</th>
                <th className="th">Type</th>
                <th className="th">Status</th>
                <th className="th">Mandatory</th>
                <th className="th">Show in listing</th>
                <th className="th">Created by</th>
                <th className="th">Created at</th>
                <th className="th" style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f, i) => (
                <tr key={f.id}>
                  <td className="td" style={{ fontSize: 12.5, color: "var(--t3)" }}>{i + 1}</td>
                  <td className="td font-semibold" style={{ color: "var(--t1)" }}>{f.name}</td>
                  <td className="td text-[12.5px] capitalize">{f.fieldType}</td>
                  <td className="td"><span className={f.status ? "badge-green" : "badge-gray"}>{f.status ? "Active" : "Inactive"}</span></td>
                  <td className="td"><span className={f.mandatory ? "badge-amber" : "badge-gray"}>{f.mandatory ? "Yes" : "No"}</span></td>
                  <td className="td"><span className={f.showInListing ? "badge-green" : "badge-gray"}>{f.showInListing ? "Yes" : "No"}</span></td>
                  <td className="td text-[12.5px]">{f.createdByName || "—"}</td>
                  <td className="td text-[12.5px]" style={{ color: "var(--gp)" }}>{formatDateTime(f.createdAt)}</td>
                  <td className="td text-center">
                    <ActionMenu onEdit={() => openEdit(f)} onDelete={() => remove(f.id)} />
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={9} className="td py-0">
                    <div className="empty-state">
                      <div className="empty-icon"><SlidersHorizontal size={20} /></div>
                      <p className="empty-title">No data found</p>
                      <p className="empty-desc">Add a custom field to capture extra data on your contacts.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setShowForm(false)}>
            <div className="modal-panel w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid rgba(34,197,94,0.18)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>
                  {form.id ? "Edit custom field" : "Create custom field"}
                </h3>
                <button className="btn-icon" onClick={() => setShowForm(false)}><X size={16} /></button>
              </div>
              <div className="modal-body flex flex-col gap-4">
                <div>
                  <label className="label">Field name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input className="input" placeholder="Please enter field name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Field type <span style={{ color: "#dc2626" }}>*</span></label>
                  <select className="input" value={form.fieldType} onChange={e => setForm({ ...form, fieldType: e.target.value })}>
                    <option value="">Field type</option>
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Field default value <span style={{ fontWeight: 400, color: "var(--t3)" }}>(Optional)</span></label>
                  <input className="input" placeholder="Field default value" value={form.defaultValue} onChange={e => setForm({ ...form, defaultValue: e.target.value })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="label" style={{ margin: 0 }}>Show in listing</span>
                  <Switch checked={form.showInListing} onChange={v => setForm({ ...form, showInListing: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="label" style={{ margin: 0 }}>Status</span>
                  <Switch checked={form.status} onChange={v => setForm({ ...form, status: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="label" style={{ margin: 0 }}>Mandatory</span>
                  <Switch checked={form.mandatory} onChange={v => setForm({ ...form, mandatory: v })} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 shrink-0" style={{ borderTop: "1px solid rgba(34,197,94,0.18)" }}>
                <button className="btn-ghost" style={{ color: "#dc2626" }} onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary" onClick={save}>Save</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

function ActionMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
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
          <button className="dropdown-item" onClick={() => { onEdit(); setOpen(false); }}>
            <Pencil size={13} /> Edit
          </button>
          <button className="dropdown-item danger" onClick={() => { onDelete(); setOpen(false); }}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
