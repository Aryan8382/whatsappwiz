"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Trash2, Type, TextCursorInput, ChevronDown, CheckSquare, Send } from "lucide-react";
import { api } from "@/lib/api";

const COMPONENT_TYPES = [
  { value: "heading", label: "Heading", icon: Type },
  { value: "text", label: "Text body", icon: Type },
  { value: "text_input", label: "Text input", icon: TextCursorInput },
  { value: "dropdown", label: "Dropdown", icon: ChevronDown },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "footer_button", label: "Footer button", icon: Send },
];

function newScreen(n: number) {
  return { id: `${Date.now()}`, title: `Screen ${n}`, components: [] as any[] };
}

export default function FlowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [flow, setFlow] = useState<any>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [screens, setScreens] = useState<any[]>([]);
  const [activeScreen, setActiveScreen] = useState(0);
  const [countdown, setCountdown] = useState(9);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const f = await api.get<any>(`/flows/${id}`);
      setFlow(f); setName(f.name); setCategory(f.category);
      setScreens(Array.isArray(f.screens) && f.screens.length ? f.screens : []);
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    try {
      const updated = await api.put<any>(`/flows/${id}`, { name, category, screens });
      setFlow(updated); setDirty(false); setCountdown(9);
    } catch (e: any) { alert(e.message); }
  }, [id, name, category, screens]);

  // Auto-save countdown, matching the reference UI
  useEffect(() => {
    if (!dirty) return;
    if (countdown <= 0) { save(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [dirty, countdown, save]);

  const markDirty = () => { setDirty(true); setCountdown(9); };

  const addScreen = () => {
    const next = [...screens, newScreen(screens.length + 1)];
    setScreens(next); setActiveScreen(next.length - 1); markDirty();
  };

  const removeScreen = (idx: number) => {
    const next = screens.filter((_, i) => i !== idx);
    setScreens(next); setActiveScreen(Math.max(0, idx - 1)); markDirty();
  };

  const renameScreen = (idx: number, title: string) => {
    setScreens(screens.map((s, i) => (i === idx ? { ...s, title } : s)));
    markDirty();
  };

  const addComponent = (type: string) => {
    const comp = { id: `${Date.now()}`, type, label: COMPONENT_TYPES.find(c => c.value === type)?.label || "" };
    setScreens(screens.map((s, i) => (i === activeScreen ? { ...s, components: [...s.components, comp] } : s)));
    markDirty();
  };

  const removeComponent = (compIdx: number) => {
    setScreens(screens.map((s, i) =>
      i === activeScreen ? { ...s, components: s.components.filter((_: any, ci: number) => ci !== compIdx) } : s
    ));
    markDirty();
  };

  const publish = async () => {
    try {
      await save();
      const updated = await api.post<any>(`/flows/${id}/publish`);
      setFlow(updated);
    } catch (e: any) { alert(e.message); }
  };

  if (!flow) return <div className="page-wrapper"><div className="loading-row"><span className="spinner" /> Loading…</div></div>;

  const current = screens[activeScreen];

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <input
          className="input"
          style={{ maxWidth: 260, fontWeight: 700 }}
          value={name}
          onChange={e => { setName(e.target.value); markDirty(); }}
        />
        <select
          className="input"
          style={{ maxWidth: 220 }}
          value={category}
          onChange={e => { setCategory(e.target.value); markDirty(); }}
        >
          {["SIGN_UP","SIGN_IN","APPOINTMENT_BOOKING","LEAD_GENERATION","CONTACT_US","CUSTOMER_SUPPORT","SURVEY","OTHER"].map(c => (
            <option key={c} value={c}>{c.replace(/_/g," ")}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button className="btn-primary" onClick={save}>Save</button>
      </div>

      <div className="flex items-center gap-1.5 mb-3" style={{ fontSize: 12, color: "var(--t3)" }}>
        Auto Save Time Remaining : 0:{String(countdown).padStart(2, "0")}
        <span className={dirty ? "spinner" : ""} style={{ width: 12, height: 12 }} />
        {!dirty && <span className="badge-green">Saved</span>}
      </div>

      <div className="grid md:grid-cols-[220px_1fr_300px] gap-4">
        {/* Screens list */}
        <div className="card-raised p-4">
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 12 }}>Screens</p>
          <div className="flex flex-col gap-1.5">
            {screens.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer"
                style={{
                  background: activeScreen === i ? "rgba(220,252,231,0.6)" : "transparent",
                  border: activeScreen === i ? "1px solid rgba(34,197,94,0.35)" : "1px solid transparent",
                }}
                onClick={() => setActiveScreen(i)}
              >
                <span className="text-[12.5px] font-medium truncate" style={{ color: "var(--t1)" }}>{s.title}</span>
                <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={e => { e.stopPropagation(); removeScreen(i); }}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
          <button className="btn-ghost mt-3 w-full justify-center" onClick={addScreen}>
            <Plus size={13} /> Add screen
          </button>
        </div>

        {/* Editor */}
        <div className="card-raised p-4">
          {current ? (
            <>
              <input
                className="input mb-4"
                style={{ fontWeight: 700, fontSize: 14 }}
                value={current.title}
                onChange={e => renameScreen(activeScreen, e.target.value)}
              />
              <div className="flex flex-col gap-2 mb-4">
                {current.components.length === 0 && (
                  <p style={{ fontSize: 12.5, color: "var(--t3)" }}>No components on this screen yet — add one below.</p>
                )}
                {current.components.map((c: any, ci: number) => (
                  <div key={c.id} className="card-raised p-3 flex items-center justify-between">
                    <span style={{ fontSize: 12.5, color: "var(--t1)", fontWeight: 600 }}>{c.label}</span>
                    <button className="btn-icon" onClick={() => removeComponent(ci)}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {COMPONENT_TYPES.map(c => (
                  <button key={c.value} className="btn-secondary" onClick={() => addComponent(c.value)}>
                    <c.icon size={13} /> {c.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p className="empty-title">No content to display</p>
              <p className="empty-desc">Add a screen to start building this flow.</p>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="card-raised p-4">
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 12 }}>Preview</p>
          {current ? (
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>{current.title}</p>
              <div className="flex flex-col gap-2">
                {current.components.map((c: any) => (
                  <div key={c.id}>
                    {c.type === "heading" && <p style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</p>}
                    {c.type === "text" && <p style={{ fontSize: 12, color: "var(--t3)" }}>{c.label}</p>}
                    {(c.type === "text_input") && <div className="input" style={{ fontSize: 12, color: "var(--t3)" }}>Text input</div>}
                    {c.type === "dropdown" && <div className="input flex items-center justify-between" style={{ fontSize: 12, color: "var(--t3)" }}>Dropdown <ChevronDown size={13} /></div>}
                    {c.type === "checkbox" && <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" disabled /> Checkbox option</label>}
                    {c.type === "footer_button" && <button className="btn-primary w-full justify-center">Continue</button>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--t3)" }}>No content to display</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button className="btn-ghost" style={{ color: "#dc2626" }} onClick={() => router.push("/flow")}>Reset</button>
        <button className="btn-primary" onClick={publish}>
          {flow.status === "published" ? "Republish" : "Publish"}
        </button>
      </div>
    </div>
  );
}
