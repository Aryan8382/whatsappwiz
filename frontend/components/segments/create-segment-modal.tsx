"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Filter, Plus, Trash2, Zap, Folder, ChevronDown, Search, Check } from "lucide-react";
import ModalPortal from "@/components/ui/modal-portal";
import { api } from "@/lib/api";

interface FilterRow { id: string; field: string; operator: string; value: string; }
interface CreateSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (segment: any) => void;
  initialSegment?: any;
}

const FIELD_OPTIONS = ["Name", "Phone Number", "Email", "City", "Country"];
const OPERATOR_OPTIONS = ["Is", "Is Not", "Contains", "Does Not Contains", "Starts With", "Ends With", "Is Empty", "Is Not Empty"];

function parseFilters(raw: any): FilterRow[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") { try { arr = JSON.parse(raw); } catch { arr = []; } }
  return arr.filter(f => f && f.field).map((f, i) => ({
    id: String(i + 1),
    field: f.field || "",
    operator: f.operator || "Is",
    value: f.value || "",
  }));
}

interface DropdownPortalProps {
  rect: DOMRect;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}

function DropdownPortal({ rect, options, selected, onSelect, onClose }: DropdownPortalProps) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // slight delay so the opening click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  const filtered = options.filter(o => !search || o.toLowerCase().includes(search.toLowerCase()));

  const style: React.CSSProperties = {
    position: "fixed",
    top: rect.bottom + 4,
    left: rect.left,
    width: Math.max(rect.width, 200),
    zIndex: 1000005,
    background: "rgba(255,255,255,0.99)",
    backdropFilter: "blur(20px)",
    borderRadius: 14,
    border: "1px solid rgba(16,185,129,0.25)",
    boxShadow: "0 16px 48px rgba(16,185,129,0.22), 0 4px 16px rgba(0,0,0,0.14)",
    padding: 8,
  };

  return createPortal(
    <div id="floating-dd" ref={ref} style={style} onClick={e => e.stopPropagation()}>
      <div style={{ position: "relative", marginBottom: 4 }}>
        <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#6b7280" }} />
        <input
          autoFocus
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", height: 28, paddingLeft: 28, paddingRight: 8, borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.1)", fontSize: 11.5, outline: "none", background: "#f9fafb",
          }}
        />
      </div>
      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {filtered.map(o => (
          <div
            key={o}
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onSelect(o); onClose(); }}
            style={{
              padding: "6px 12px", borderRadius: 10, cursor: "pointer", fontSize: 12,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontWeight: selected === o ? 800 : 500,
              background: selected === o ? "rgba(16,185,129,0.12)" : "transparent",
              color: selected === o ? "#064e3b" : "#374151",
            }}
            onMouseEnter={e => { if (selected !== o) (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.06)"; }}
            onMouseLeave={e => { if (selected !== o) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <span>{o}</span>
            {selected === o && <Check size={13} color="#059669" />}
          </div>
        ))}
        {filtered.length === 0 && <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", padding: "8px 0" }}>No results</p>}
      </div>
    </div>,
    document.body
  );
}

export function CreateSegmentModal({ isOpen, onClose, onSuccess, initialSegment }: CreateSegmentModalProps) {
  const [segmentName, setSegmentName] = useState("");
  const [conditions, setConditions] = useState<FilterRow[]>([]);
  const [appliedConditions, setAppliedConditions] = useState<FilterRow[]>([]);
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null);
  const [previewContacts, setPreviewContacts] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Active dropdown state — stores which row + which type + captured rect
  const [activeDD, setActiveDD] = useState<{ id: string; type: "field" | "operator"; rect: DOMRect } | null>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!popoverRect) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(target) &&
        !document.getElementById("floating-dd")?.contains(target)
      ) {
        setPopoverRect(null);
        setActiveDD(null);
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handleOutside), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [popoverRect]);

  useEffect(() => {
    if (!isOpen) return;
    setPopoverRect(null);
    setActiveDD(null);
    if (initialSegment) {
      setSegmentName(initialSegment.name || "");
      const rows = parseFilters(initialSegment.filters);
      setConditions(rows);
      setAppliedConditions(rows);
      if (rows.length > 0) doPreview(rows);
      else setPreviewContacts([]);
    } else {
      setSegmentName("");
      setConditions([]);
      setAppliedConditions([]);
      setPreviewContacts([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialSegment?.id]);

  const doPreview = useCallback(async (rows: FilterRow[]) => {
    const valid = rows.filter(r => r.field && (r.value.trim() || r.operator.toLowerCase().includes("empty")));
    if (valid.length === 0) { setPreviewContacts([]); return; }
    setLoadingPreview(true);
    try {
      const res = await api.post<any>("/segments/preview", {
        filters: valid.map(r => ({ field: r.field, operator: r.operator, value: r.value.trim() })),
      });
      setPreviewContacts(res?.items || []);
    } catch { setPreviewContacts([]); }
    finally { setLoadingPreview(false); }
  }, []);

  const handleApply = () => {
    const valid = conditions.filter(r => r.field && (r.value.trim() || r.operator.toLowerCase().includes("empty")));
    setAppliedConditions(valid);
    setPopoverRect(null);
    doPreview(valid);
  };

  const handleSave = async () => {
    if (!segmentName.trim()) { alert("Please enter a segment name!"); return; }
    const filters = conditions
      .filter(r => r.field && (r.value.trim() || r.operator.toLowerCase().includes("empty")))
      .map(r => ({ field: r.field, operator: r.operator, value: r.value.trim() }));
    try {
      let saved: any;
      if (initialSegment?.id) {
        saved = await api.put(`/segments/${initialSegment.id}`, { name: segmentName.trim(), filters });
      } else {
        saved = await api.post("/segments", { name: segmentName.trim(), filters });
      }
      onSuccess(saved);
      onClose();
    } catch (e: any) { alert(e.message || "Failed to save segment"); }
  };

  const updateCond = (id: string, patch: Partial<FilterRow>) =>
    setConditions(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));

  const addCondition = () =>
    setConditions(p => [...p, { id: String(Date.now()), field: "", operator: "Is", value: "" }]);

  const openDD = (e: React.MouseEvent<HTMLButtonElement>, id: string, type: "field" | "operator") => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveDD(prev => (prev?.id === id && prev?.type === type) ? null : { id, type, rect });
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={() => { onClose(); setActiveDD(null); }}>
        <div
          className="modal-panel w-full max-w-none bg-[var(--gg0)] border border-[var(--b1)] shadow-2xl animate-scale-in flex flex-col"
          style={{ maxHeight: "92vh", width: "96vw" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--b2)] bg-[var(--gg1)] shrink-0 rounded-t-2xl">
            <div>
              <h3 className="text-[16px] font-extrabold text-[var(--t1)]">{initialSegment ? "Edit Segment" : "Create Segment"}</h3>
              <p className="text-[12px] text-[var(--t3)]">{initialSegment ? "Update segment filters and conditions." : "Create segments to group your contacts."}</p>
            </div>
            <button className="btn-icon" onClick={onClose}><X size={16} /></button>
          </div>

          {/* Toolbar */}
          <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-[var(--g0)] border-b border-[var(--b2)] shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                ref={filterBtnRef}
                type="button"
                onClick={() => {
                  setActiveDD(null);
                  if (popoverRect) {
                    setPopoverRect(null);
                  } else {
                    const r = filterBtnRef.current?.getBoundingClientRect();
                    if (r) setPopoverRect(r);
                  }
                }}
                className="btn-secondary !py-1.5 !px-3.5 text-[12.5px] font-bold flex items-center gap-1.5"
              >
                <Filter size={14} className="text-emerald-700" /> Filter
              </button>

              {appliedConditions.map((c, i) => (
                <div key={i} className="badge-green font-bold text-[11.5px] flex items-center gap-1.5">
                  <span className="text-emerald-800">{c.field}</span>
                  <span className="text-emerald-600 font-normal">{c.operator.toLowerCase()}</span>
                  {c.value && <span className="text-emerald-950 font-extrabold">{c.value}</span>}
                </div>
              ))}

              <div className="px-2.5 py-1 rounded-full text-[11.5px] font-extrabold bg-emerald-100/80 text-emerald-900 border border-emerald-300/50 flex items-center gap-1">
                <span>Total contacts:</span>
                <span className="text-emerald-950 ml-0.5">{previewContacts.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                className="input !h-[34px] !w-56 !text-[12.5px]"
                placeholder="Segment name"
                value={segmentName}
                onChange={e => setSegmentName(e.target.value)}
              />
              <button type="button" onClick={handleSave} className="btn-primary !py-1.5 !px-4 text-xs font-bold flex items-center gap-1.5 shadow-md">
                <Zap size={13} />
                <span>{initialSegment ? "Update Segment" : "Create Segment"}</span>
              </button>
            </div>

          </div>

          {/* Preview Table */}
          <div className="p-6 flex-1 min-h-0 flex flex-col overflow-y-auto">
            <div className="card-raised overflow-hidden flex-1 flex flex-col">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="th" style={{ width: 70 }}>Sr.no</th>
                    <th className="th">Name</th>
                    <th className="th">Phone Number</th>
                  </tr>
                </thead>
                <tbody>
                  {previewContacts.map((c, i) => (
                    <tr key={c.id || i}>
                      <td className="td font-medium text-[var(--t3)]">{i + 1}</td>
                      <td className="td font-bold text-[var(--t1)]">{c.name}</td>
                      <td className="td font-mono text-[var(--t2)]">{c.phoneNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {previewContacts.length === 0 && !loadingPreview && (
                <div className="flex-1 p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100/50 flex items-center justify-center mb-3">
                    <span className="text-2xl text-emerald-600 font-extrabold">?</span>
                  </div>
                  <p className="text-[13.5px] font-bold text-[var(--t1)]">No data found</p>
                  <p className="text-[11.5px] text-[var(--t3)] mt-1">Set filters and click <strong>Apply Filters</strong> to preview contacts.</p>
                </div>
              )}

              {loadingPreview && (
                <div className="flex-1 p-12 flex items-center justify-center">
                  <span className="text-emerald-600 font-semibold text-sm animate-pulse">Loading contacts...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating dropdown rendered at body level — ALWAYS on top */}
      {activeDD && (
        <DropdownPortal
          rect={activeDD.rect}
          options={activeDD.type === "field" ? FIELD_OPTIONS : OPERATOR_OPTIONS}
          selected={
            conditions.find(c => c.id === activeDD.id)?.[activeDD.type === "field" ? "field" : "operator"] || ""
          }
          onSelect={v => updateCond(activeDD.id, activeDD.type === "field" ? { field: v } : { operator: v })}
          onClose={() => setActiveDD(null)}
        />
      )}

      {/* Conditions Popover — also body-level portal, fixed position */}
      {popoverRect && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: popoverRect.bottom + 6,
            left: popoverRect.left,
            width: "min(580px, 90vw)",
            zIndex: 1000000,
            background: "rgba(255,255,255,0.98)",
            backdropFilter: "blur(25px) saturate(190%)",
            borderRadius: 18,
            border: "1px solid rgba(16,185,129,0.25)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.18), 0 6px 16px rgba(16,185,129,0.15)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.07)", background: "rgba(16,185,129,0.05)", borderRadius: "18px 18px 0 0" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Segment conditions</span>
            <button onClick={() => setPopoverRect(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, display: "flex" }}><X size={16} /></button>
          </div>

          {/* Body */}
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
              <button type="button" onClick={addCondition} className="btn-secondary !py-1.5 !px-3 text-[12px] font-bold flex items-center gap-1.5"><Plus size={13} /> Add Condition</button>
              <button type="button" className="btn-secondary !py-1.5 !px-3 text-[12px] font-bold flex items-center gap-1.5"><Folder size={13} /> Group</button>
            </div>

            {conditions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <p style={{ fontWeight: 700, marginBottom: 6 }}>No filters yet</p>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>Add a filter to segment your contacts.</p>
                <button type="button" onClick={addCondition} className="btn-primary !py-2 !px-4 text-[12.5px] font-bold inline-flex items-center gap-1.5"><Plus size={14} /> Add Filter</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {conditions.map(cond => (
                  <div key={cond.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.7)" }}>
                    <button type="button" onClick={() => setConditions(p => p.filter(c => c.id !== cond.id))} style={{ padding: 6, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: "#9ca3af", display: "flex" }}>
                      <Trash2 size={15} />
                    </button>

                    <button type="button" onClick={e => openDD(e, cond.id, "field")} className="input !h-[36px] !py-0 !text-[12.5px] flex-1 min-w-[110px] text-left flex items-center justify-between bg-white/90">
                      <span style={{ fontWeight: cond.field ? 700 : 400, color: cond.field ? "inherit" : "#9ca3af" }}>{cond.field || "Select Field"}</span>
                      <ChevronDown size={14} color="#059669" />
                    </button>

                    <button type="button" onClick={e => openDD(e, cond.id, "operator")} className="input !h-[36px] !py-0 !text-[12.5px] flex-1 min-w-[120px] text-left flex items-center justify-between bg-white/90">
                      <span style={{ fontWeight: cond.operator ? 700 : 400, color: cond.operator ? "inherit" : "#9ca3af" }}>{cond.operator || "Select Operator"}</span>
                      <ChevronDown size={14} color="#059669" />
                    </button>

                    {!cond.operator.toLowerCase().includes("empty") && (
                      <input className="input !h-[36px] !py-0 !text-[12.5px] flex-1 min-w-[80px] bg-white/90" placeholder="Enter value" value={cond.value} onChange={e => updateCond(cond.id, { value: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid rgba(0,0,0,0.07)", background: "rgba(16,185,129,0.03)", borderRadius: "0 0 18px 18px" }}>
            <button type="button" onClick={() => setPopoverRect(null)} className="btn-ghost !text-red-600 hover:!bg-red-50 font-bold text-xs">Cancel</button>
            <button type="button" onClick={handleApply} className="btn-primary !py-1.5 !px-5 text-xs font-extrabold shadow-md">Apply Filters</button>
          </div>
        </div>,
        document.body
      )}
    </ModalPortal>
  );
}

export default CreateSegmentModal;
