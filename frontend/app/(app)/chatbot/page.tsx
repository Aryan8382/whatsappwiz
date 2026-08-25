"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, Play, Eye, Trash2, X, Zap, Tag, Save,
  MessageSquare as MsgIcon, HelpCircle, Link as LinkIcon,
  Sparkles, ImageIcon, Settings2, Layers,
  Users, ChevronRight, Search, Send,
} from "lucide-react";
import { api } from "@/lib/api";
import StatusBadge from "@/components/ui/status-badge";

// ─── Edit form state shape ──────────────────────────────────────────
interface ProductForm {
  id: string;
  name: string;
  keywords: string; // comma separated
  images: string[];
  videos?: string[];
  documents?: string[];
  price?: number;
  currency?: string;
  description?: string;
}

interface ButtonForm {
  id: string;
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;   // button label
  value: string;  // URL or phone number — unused for QUICK_REPLY
}

interface EditForm {
  project:     string;
  headerType:  "None" | "Image" | "Video" | "Document";
  headerMediaUrl: string;
  body:        string;
  footer:      string;
  messageType: "Text" | "Image" | "Video" | "Document" | "Audio";
  greeting:    string;
  products:    ProductForm[];
  buttons:     ButtonForm[];
}

function freshEditForm(): EditForm {
  return {
    project: "",
    headerType: "None",
    headerMediaUrl: "",
    body: "",
    footer: "",
    messageType: "Text",
    greeting: "Hi! How can I help you today?",
    products: [],
    buttons: [],
  };
}

// ──────────────────────────────────────────────────────────────────
// Design tokens — "wet emerald glass". Only ONE level of blur is ever
// applied per region (no nested backdrop-filter stacking — that was
// what made buttons render inconsistently before). Small interactive
// elements (buttons, tabs, chips) use flat tinted backgrounds and sit
// on top of a single blurred shell per region.
// ──────────────────────────────────────────────────────────────────
const T = {
  bg1: "#061a13",
  bg0: "#040807",
  bg2: "#03110c",

  shell:       "rgba(10, 26, 20, 0.55)",  // the ONE blurred layer per region
  shellSoft:   "rgba(10, 26, 20, 0.38)",
  shellStrong: "rgba(6, 18, 14, 0.72)",

  surface:      "rgba(255,255,255,0.035)", // flat, no blur — sits on a shell
  surfaceHover: "rgba(120,255,200,0.07)",
  surfaceActive:"rgba(34,201,138,0.16)",

  ink:        "#eafff4",
  inkSoft:    "rgba(234,255,244,0.62)",
  inkFaint:   "rgba(234,255,244,0.36)",

  hairline:   "rgba(120,255,200,0.10)",
  hairlineMd: "rgba(120,255,200,0.18)",
  hairlineHi: "rgba(120,255,200,0.34)",

  mint:     "#5ffbc0",
  mintText: "#7bffce",
  emerald:  "#22c98a",

  gold: "#d9c07a",

  danger:     "#ff9a8a",
  dangerSoft: "rgba(255,110,90,0.14)",
};

// The ONE blur layer for a region (sidebar, toolbar, inspector, modal, node card).
function shell(depth: "soft" | "1" | "strong" = "1"): React.CSSProperties {
  const bg = { soft: T.shellSoft, "1": T.shell, strong: T.shellStrong }[depth];
  return {
    background: bg,
    backdropFilter: "blur(20px) saturate(150%)",
    WebkitBackdropFilter: "blur(20px) saturate(150%)",
    border: `1px solid ${T.hairline}`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
  };
}

function safeParseConfig(raw: any): any {
  if (!raw) return {};
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
  return raw;
}

// ──────────────────────────────────────────────────────────────────
// Reusable primitives
// ──────────────────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[10.5px] font-semibold uppercase mb-1.5" style={{ color: T.inkFaint, letterSpacing: "0.07em" }}>
      {children} {required && <span style={{ color: T.danger }}>*</span>}
    </label>
  );
}

const inputBase: React.CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.28)",
  border: `1px solid ${T.hairlineMd}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 12.5,
  color: T.ink,
  outline: "none",
  transition: "border-color 150ms ease, box-shadow 150ms ease",
};
function focusRing(e: React.FocusEvent<any>) { e.currentTarget.style.borderColor = T.mint; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(34,201,138,0.14)`; }
function blurRing(e: React.FocusEvent<any>) { e.currentTarget.style.borderColor = T.hairlineMd; e.currentTarget.style.boxShadow = "none"; }

function DInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  return <input {...rest} style={{ ...inputBase, ...style }} onFocus={focusRing} onBlur={blurRing} />;
}
function DTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { style, ...rest } = props;
  return <textarea {...rest} style={{ ...inputBase, resize: "vertical", lineHeight: 1.55, ...style }} onFocus={focusRing} onBlur={blurRing} />;
}
function DSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { style, ...rest } = props;
  return <select {...rest} style={{ ...inputBase, ...style }} />;
}

// Buttons are flat (no blur, no fragile gradient-text tricks) so they
// render reliably at any size and never get eaten by a parent's blur.
function GhostButton({ children, onClick, disabled, danger, small }:
  { children: React.ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean; small?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 font-medium transition-colors shrink-0"
      style={{
        fontSize: small ? 11 : 12,
        padding: small ? "6px 11px" : "8px 14px",
        borderRadius: 9,
        whiteSpace: "nowrap",
        color: danger ? T.danger : T.inkSoft,
        background: T.surface,
        border: `1px solid ${danger ? "rgba(255,110,90,0.28)" : T.hairlineMd}`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = danger ? T.dangerSoft : T.surfaceHover; e.currentTarget.style.color = danger ? T.danger : T.ink; e.currentTarget.style.borderColor = danger ? "rgba(255,110,90,0.4)" : T.hairlineHi; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = T.surface; e.currentTarget.style.color = danger ? T.danger : T.inkSoft; e.currentTarget.style.borderColor = danger ? "rgba(255,110,90,0.28)" : T.hairlineMd; } }}>
      {children}
    </button>
  );
}

function PrimaryButton({ children, onClick, gold, full, small }:
  { children: React.ReactNode; onClick?: () => void; gold?: boolean; full?: boolean; small?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 font-semibold transition-transform shrink-0 min-w-0"
      style={{
        fontSize: small ? 12 : 12.5,
        padding: small ? "8px 12px" : "9px 14px",
        borderRadius: 10,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: gold ? "#241d09" : "#02150e",
        backgroundColor: gold ? "#d9c07a" : "#5ffbc0",
        backgroundImage: gold ? "linear-gradient(180deg, #ecdca0, #c7a55a)" : "linear-gradient(180deg, #7bffce, #22c98a)",
        border: `1px solid ${gold ? "rgba(217,192,122,0.5)" : "rgba(95,251,192,0.5)"}`,
        width: full ? "100%" : undefined,
        boxShadow: gold
          ? "0 6px 16px -8px rgba(217,192,122,0.5)"
          : "0 6px 16px -8px rgba(95,251,192,0.55)",
        letterSpacing: "0.01em",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.06)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.filter = "brightness(1)"; }}>
      {children}
    </button>
  );
}

function RailIcon({ icon: Icon, active, label }: { icon: any; active?: boolean; label: string }) {
  return (
    <button title={label}
      className="flex items-center justify-center rounded-xl transition-colors shrink-0"
      style={{
        width: 38, height: 38,
        background: active ? T.surfaceActive : "transparent",
        border: `1px solid ${active ? T.hairlineHi : "transparent"}`,
        color: active ? T.mintText : T.inkFaint,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.surfaceHover; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      <Icon size={16} />
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
const INSPECTOR_TABS = [
  { id: "message",  label: "Message",  icon: MsgIcon },
  { id: "buttons",  label: "Buttons",  icon: LinkIcon },
  { id: "products", label: "Products", icon: Tag },
  { id: "flow",     label: "Links",    icon: Layers },
  { id: "setup",    label: "Setup",    icon: Settings2 },
] as const;
type InspectorTab = typeof INSPECTOR_TABS[number]["id"];

const NODE_TYPES = [
  { id: "message",  label: "Message",  icon: MsgIcon },
  { id: "question", label: "Question", icon: HelpCircle },
] as const;

// ──────────────────────────────────────────────────────────────────
export default function ChatbotPage() {
  const [flows,    setFlows]    = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number|null>(null);
  const [detail,   setDetail]   = useState<any>(null);
  const [newName,  setNewName]  = useState("");
  const [showNew,  setShowNew]  = useState(false);
  const [nodeForm, setNodeForm] = useState<{ nodeType: string; text: string }>({ nodeType: "message", text: "" });
  const [preview,  setPreview]  = useState<any>(null);
  const [conn,     setConn]     = useState({ source: 0, target: 0 });
  const [editForm, setEditForm] = useState<EditForm>(freshEditForm());

  const [tab, setTab] = useState<InspectorTab>("message");
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setFlows((await api.get<any[]>("/bots")) || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const hydrateForm = (d: any) => {
    const savedConfig = safeParseConfig(d?.config);
    const firstMsgNode = d?.nodes?.find((n: any) => n.nodeType === "message");
    const firstMsgConfig = safeParseConfig(firstMsgNode?.config);

    const rawProducts = savedConfig?.products || firstMsgConfig?.products;
    let loadedProducts: ProductForm[] = [];
    if (Array.isArray(rawProducts)) {
      loadedProducts = rawProducts.map((p: any) => ({
        id: p.id || `prod-${Math.random().toString(36).substring(2, 7)}`,
        name: p.name || "",
        keywords: Array.isArray(p.keywords) ? p.keywords.join(", ") : p.keywords || "",
        images: Array.isArray(p.images) ? p.images : [],
        videos: Array.isArray(p.videos) ? p.videos : [],
        documents: Array.isArray(p.documents) ? p.documents : [],
        price: p.price,
        currency: p.currency || "₹",
        description: p.description || "",
      }));
    }

    const rawButtons = savedConfig?.buttons || firstMsgConfig?.buttons;
    let loadedButtons: ButtonForm[] = [];
    if (Array.isArray(rawButtons)) {
      loadedButtons = rawButtons.map((b: any) => ({
        id: b.id || `btn-${Math.random().toString(36).substring(2, 7)}`,
        type: (b.type as ButtonForm["type"]) || "QUICK_REPLY",
        text: b.text || "",
        value: b.value || b.url || b.phone_number || "",
      }));
    }

    const bodyText = firstMsgConfig?.text || savedConfig?.greeting || "Hi! How can I help you today?";

    setEditForm({
      project:     d?.name || "",
      headerType:  firstMsgConfig?.headerType || savedConfig?.headerType || "None",
      headerMediaUrl: firstMsgConfig?.headerMediaUrl || savedConfig?.headerMediaUrl || "",
      body:        bodyText,
      footer:      firstMsgConfig?.footer || savedConfig?.footer || "",
      messageType: "Text",
      greeting:    savedConfig?.greeting || bodyText,
      products:    loadedProducts,
      buttons:     loadedButtons,
    });
  };

  const open = async (id: number) => {
    setActiveId(id);
    setDetail(null);
    setPreview(null);
    setNodeForm({ nodeType: "message", text: "" });
    setConn({ source: 0, target: 0 });
    setTab("message");
    try {
      const d = await api.get<any>(`/bots/${id}`);
      setDetail(d);
      hydrateForm(d);
    } catch (e: any) { alert(e.message); }
  };

  const create = async () => {
    if (!newName) return;
    try { const f = await api.post<any>("/bots", { name: newName }); setShowNew(false); setNewName(""); load(); open(f.id); }
    catch (e: any) { alert(e.message); }
  };

  const addNode = async () => {
    if (!activeId || !nodeForm.text) return;
    try {
      const cfg: any = { text: nodeForm.text };
      if (nodeForm.nodeType === "question") cfg.answers = [{ text: nodeForm.text, targetNodeId: null }];
      await api.post(`/bots/${activeId}/nodes`, { nodeType: nodeForm.nodeType, config: cfg });
      const d = await api.get<any>(`/bots/${activeId}`); setDetail(d);
      setNodeForm({ nodeType: "message", text: "" });
    } catch (e: any) { alert(e.message); }
  };

  const deleteNode = async (nodeId: number) => {
    if (!activeId) return;
    if (!confirm("Delete this node?")) return;
    try {
      await api.del(`/bots/${activeId}/nodes/${nodeId}`);
      const d = await api.get<any>(`/bots/${activeId}`); setDetail(d);
    } catch (e: any) { alert(e.message); }
  };

  const addConn = async () => {
    if (!activeId || !conn.source || !conn.target) return;
    try {
      await api.post(`/bots/${activeId}/connections`, conn);
      const d = await api.get<any>(`/bots/${activeId}`); setDetail(d);
      setConn({ source: 0, target: 0 });
    } catch (e: any) { alert(e.message); }
  };

  const publish = async () => {
    if (!activeId) return;
    try { const r = await api.post<any>(`/bots/${activeId}/publish`); alert(`Flow "${r.name}" is now live`); open(activeId); load(); }
    catch (e: any) { alert(e.message); }
  };

  const showPreview = async () => {
    if (!activeId) return;
    try { setPreview(await api.get<any>(`/bots/${activeId}/preview`)); }
    catch (e: any) { alert(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this flow?")) return;
    try { await api.del(`/bots/${id}`); if (activeId === id) { setDetail(null); setActiveId(null); } load(); }
    catch (e: any) { alert(e.message); }
  };

  const saveEdit = async () => {
    if (!activeId) return;
    setSaving(true);
    try {
      const formattedProducts = editForm.products.map(p => ({
        id: p.id, name: p.name.trim(),
        keywords: p.keywords.split(",").map(k => k.trim()).filter(Boolean),
        images: (p.images || []).filter(img => img && img.trim() !== ""),
        videos: (p.videos || []).filter(v => v && v.trim() !== ""),
        documents: (p.documents || []).filter(doc => doc && doc.trim() !== ""),
        price: p.price, currency: p.currency || "₹", description: p.description?.trim() || "",
      }));

      const formattedButtons = editForm.buttons
        .filter(b => b.text.trim()).slice(0, 3)
        .map(b => ({ id: b.id, type: b.type, text: b.text.trim(), value: b.value.trim() }));

      const botConfig = {
        greeting: editForm.body.trim() || editForm.greeting || "Hi! How can I help you today?",
        headerType: editForm.headerType,
        headerMediaUrl: editForm.headerType !== "None" ? editForm.headerMediaUrl.trim() : "",
        footer: editForm.footer.trim(),
        products: formattedProducts,
        buttons: formattedButtons,
      };

      try {
        await api.put(`/bots/${activeId}`, { name: editForm.project.trim() || detail?.name, config: botConfig });
      } catch { /* endpoint may not exist — config saved via node below */ }

      const firstMsg = detail?.nodes?.find((n: any) => n.nodeType === "message");
      if (firstMsg) {
        await api.put(`/bots/${activeId}/nodes/${firstMsg.id}`, { config: { text: botConfig.greeting, ...botConfig } });
      } else {
        await api.post(`/bots/${activeId}/nodes`, { nodeType: "message", config: { text: botConfig.greeting, ...botConfig } });
      }

      await load();
      const d = await api.get<any>(`/bots/${activeId}`);
      setDetail(d);
      hydrateForm(d);
    } catch (e: any) {
      alert(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const publishFromEdit = async () => { await saveEdit(); await publish(); };

  const nodes = detail?.nodes || [];
  const outCount = (nodeId: number) => (detail?.connections || []).filter((c: any) => Number(c.sourceNode) === Number(nodeId)).length;
  const filteredFlows = flows.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{
      height: "calc(100vh - 128px)",
      minHeight: 560,
      fontFamily: "var(--font-sans, ui-sans-serif, system-ui)",
      color: T.ink,
      position: "relative",
      background: `
        radial-gradient(1100px 640px at 12% -8%, rgba(95,251,192,0.13), transparent 60%),
        radial-gradient(900px 560px at 100% 8%, rgba(34,201,138,0.09), transparent 55%),
        linear-gradient(160deg, ${T.bg1} 0%, ${T.bg0} 55%, ${T.bg2} 100%)
      `,
    }}>
      <div className="flex h-full rounded-[24px] overflow-hidden relative"
        style={{
          border: `1px solid ${T.hairlineMd}`,
          boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 40px 90px -35px rgba(0,0,0,0.75)",
        }}>

        {/* ══════════════ ICON RAIL ══════════════ */}
        <div className="w-[60px] shrink-0 flex flex-col items-center gap-2 py-4"
          style={{ ...shell("strong"), borderRadius: 0, borderTop: "none", borderBottom: "none", borderLeft: "none" }}>
          <div className="flex items-center justify-center rounded-xl mb-3 shrink-0"
            style={{
              width: 36, height: 36,
              backgroundImage: "linear-gradient(180deg, #7bffce, #22c98a)",
              boxShadow: "0 0 18px rgba(95,251,192,0.4)",
            }}>
            <Zap size={15} color="#02150e" />
          </div>
          <RailIcon icon={Layers} active label="Bot flows" />
          <RailIcon icon={Users} label="Contacts" />
          <div className="flex-1" />
          <RailIcon icon={Settings2} label="Settings" />
        </div>

        {/* ══════════════ FLOWS SIDEBAR ══════════════ */}
        <div className="w-[252px] shrink-0 flex flex-col min-h-0" style={{ ...shell("1"), borderRadius: 0, borderTop: "none", borderBottom: "none" }}>
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 shrink-0">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold tracking-tight" style={{ color: T.ink }}>Bot flows</p>
              <p className="text-[10.5px] mt-0.5" style={{ color: T.inkFaint }}>
                {flows.length} total · {flows.filter(f => f.published).length} live
              </p>
            </div>
            <button onClick={() => setShowNew(v => !v)}
              className="flex items-center justify-center rounded-lg shrink-0 transition-colors"
              style={{ width: 26, height: 26, background: T.surface, border: `1px solid ${T.hairlineMd}`, color: T.inkSoft }}
              onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHover; e.currentTarget.style.color = T.mintText; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.color = T.inkSoft; }}>
              <Plus size={13} />
            </button>
          </div>

          {showNew && (
            <div className="px-4 pb-3 flex gap-1.5 shrink-0">
              <DInput autoFocus placeholder="New flow name" value={newName}
                onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && create()}
                style={{ fontSize: 11.5, padding: "7px 10px", minWidth: 0, flex: 1 }} />
              <PrimaryButton small onClick={create}>Add</PrimaryButton>
            </div>
          )}

          <div className="px-4 pb-3 shrink-0">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.hairline}` }}>
              <Search size={12} style={{ color: T.inkFaint }} />
              <input placeholder="Search flows…" value={filter} onChange={e => setFilter(e.target.value)}
                className="bg-transparent outline-none text-[12px] flex-1 min-w-0" style={{ color: T.ink }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 space-y-1.5 pb-4 min-h-0">
            {filteredFlows.map(f => (
              <button key={f.id} onClick={() => open(f.id)}
                className="w-full text-left px-3.5 py-3 rounded-xl transition-colors group relative block"
                style={activeId === f.id
                  ? { background: T.surfaceActive, border: `1px solid ${T.hairlineHi}` }
                  : { background: "transparent", border: "1px solid transparent" }}
                onMouseEnter={e => { if (activeId !== f.id) e.currentTarget.style.background = T.surfaceHover; }}
                onMouseLeave={e => { if (activeId !== f.id) e.currentTarget.style.background = "transparent"; }}>
                <div className="flex items-center gap-2 min-w-0 pr-5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                    background: f.published ? T.mint : "rgba(234,255,244,0.25)",
                    boxShadow: f.published ? "0 0 8px rgba(95,251,192,0.7)" : "none",
                  }} />
                  <p className="text-[12.5px] font-semibold truncate" style={{ color: T.ink }}>{f.name}</p>
                </div>
                <p className="text-[10.5px] mt-1 pl-3.5" style={{ color: T.inkFaint }}>
                  {f._count?.nodes || 0} nodes · {f.published ? "live" : "draft"}
                </p>
                <span
                  className="absolute right-2.5 top-2.5 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: T.inkFaint }}
                  onClick={e => { e.stopPropagation(); remove(f.id); }}
                  onMouseEnter={e => { e.currentTarget.style.color = T.danger; }}
                  onMouseLeave={e => { e.currentTarget.style.color = T.inkFaint; }}>
                  <Trash2 size={12} />
                </span>
              </button>
            ))}
            {filteredFlows.length === 0 && (
              <p className="text-[12px] text-center py-8" style={{ color: T.inkFaint }}>No flows match.</p>
            )}
          </div>
        </div>

        {/* ══════════════ CANVAS + INSPECTOR ══════════════ */}
        {!detail ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-center rounded-3xl"
              style={{ width: 52, height: 52, backgroundImage: "linear-gradient(180deg, #7bffce, #22c98a)", boxShadow: "0 0 34px rgba(95,251,192,0.38)" }}>
              <Zap size={22} color="#02150e" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[14px]" style={{ color: T.ink }}>No flow open</p>
              <p className="text-[12px] mt-1" style={{ color: T.inkSoft }}>Pick a flow on the left, or create a new one.</p>
            </div>
            <PrimaryButton onClick={() => setShowNew(true)}><Sparkles size={12} /> New flow</PrimaryButton>
          </div>
        ) : (
          <>
            {/* ── CANVAS ── */}
            <div className="flex-1 min-w-0 flex flex-col min-h-0">

              {/* Toolbar row 1 — identity + global actions */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5 shrink-0" style={{ borderBottom: `1px solid ${T.hairline}` }}>
                <div className="min-w-0 mr-auto">
                  <p className="text-[13.5px] font-semibold truncate" style={{ color: T.ink }}>{detail.name}</p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: T.inkFaint }}>
                    {nodes.length} node{nodes.length === 1 ? "" : "s"} · {(detail.connections || []).length} connection{(detail.connections || []).length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={detail.published ? "approved" : "draft"} label={detail.published ? "Live" : "Draft"} />
                  <GhostButton onClick={showPreview}><Eye size={12} /> Preview</GhostButton>
                </div>
              </div>

              {/* Toolbar row 2 — add node */}
              <div className="flex flex-wrap items-center gap-2.5 px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${T.hairline}` }}>
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: T.surface, border: `1px solid ${T.hairline}` }}>
                  {NODE_TYPES.map(nt => {
                    const Icon = nt.icon; const active = nodeForm.nodeType === nt.id;
                    return (
                      <button key={nt.id} onClick={() => setNodeForm({ ...nodeForm, nodeType: nt.id })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-medium transition-colors whitespace-nowrap"
                        style={active ? { background: T.surfaceActive, color: T.mintText } : { color: T.inkFaint }}>
                        <Icon size={12.5} />{nt.label}
                      </button>
                    );
                  })}
                </div>
                <DInput placeholder="Node text, then Enter…" value={nodeForm.text}
                  onChange={e => setNodeForm({ ...nodeForm, text: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && addNode()}
                  style={{ flex: "1 1 160px", minWidth: 160 }} />
                <PrimaryButton small onClick={addNode}><Plus size={13} /> Add node</PrimaryButton>
              </div>

              {/* Node canvas + phone preview (side-by-side, no overlap) */}
              <div className="flex-1 min-h-0 flex overflow-hidden">
                <div className="flex-1 min-w-0 overflow-y-auto" style={{
                  backgroundImage: "radial-gradient(rgba(120,255,200,0.06) 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                }}>
                  <div className="p-6 max-w-[560px]">
                    {nodes.length === 0 && (
                      <div className="text-center py-16 rounded-2xl" style={{ border: `1px dashed ${T.hairlineMd}` }}>
                        <p className="text-[12.5px]" style={{ color: T.inkFaint }}>No nodes yet — add one above to start the flow.</p>
                      </div>
                    )}
                    <div className="relative">
                      {nodes.length > 1 && (
                        <div className="absolute left-[13px] top-3 bottom-3 w-px"
                          style={{ background: `linear-gradient(180deg, ${T.hairlineHi}, transparent)` }} />
                      )}
                      {nodes.map((n: any) => {
                        const cfg = safeParseConfig(n.config);
                        const Icon = n.nodeType === "question" ? HelpCircle : MsgIcon;
                        return (
                          <div key={n.id} className="relative flex gap-3.5 mb-3.5">
                            <div className="relative z-10 mt-3.5 w-[27px] h-[27px] rounded-full flex items-center justify-center shrink-0"
                              style={{ background: T.shellStrong, border: `1px solid ${T.hairlineHi}` }}>
                              <Icon size={12} color={T.mintText} />
                            </div>
                            <div className="flex-1 min-w-0 rounded-xl p-4" style={shell("soft")}>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.inkFaint }}>{n.nodeType}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.25)", color: T.inkFaint, fontFamily: "ui-monospace, monospace" }}>#{n.id}</span>
                                  <button onClick={() => deleteNode(n.id)} className="p-0.5 rounded" style={{ color: T.inkFaint }}
                                    onMouseEnter={e => { e.currentTarget.style.color = T.danger; }} onMouseLeave={e => { e.currentTarget.style.color = T.inkFaint; }}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[12.5px] leading-relaxed"
                                style={{ color: T.ink, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {cfg.text || n.name}
                              </p>
                              <p className="text-[10px] mt-2.5" style={{ color: T.inkFaint }}>{outCount(n.id)} outbound</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Phone preview — own column, never overlaps cards */}
                <div className="hidden xl:flex flex-col w-[260px] shrink-0 p-5 overflow-y-auto" style={{ borderLeft: `1px solid ${T.hairline}` }}>
                  <p className="text-[10.5px] font-semibold uppercase mb-3" style={{ color: T.inkFaint, letterSpacing: "0.07em" }}>Live preview</p>
                  <div className="rounded-[22px] overflow-hidden shrink-0" style={{ ...shell("strong"), boxShadow: "0 24px 50px -24px rgba(0,0,0,0.7)" }}>
                    <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ borderBottom: `1px solid ${T.hairline}` }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{ backgroundImage: "linear-gradient(180deg, #7bffce, #22c98a)", color: "#02150e" }}>
                        {(editForm.project || "F")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: T.ink }}>{editForm.project || "Untitled flow"}</p>
                        <p className="text-[9px]" style={{ color: T.mintText }}>online</p>
                      </div>
                    </div>
                    <div className="px-3.5 py-4 space-y-2.5 min-h-[240px]">
                      <div className="rounded-2xl rounded-tl-sm px-3 py-2.5" style={{ background: "rgba(0,0,0,0.24)", border: `1px solid ${T.hairline}` }}>
                        <p className="text-[11.5px] leading-relaxed" style={{ color: T.ink, display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {editForm.body || "Your welcome message…"}
                        </p>
                        {editForm.footer && <p className="text-[9px] mt-2" style={{ color: T.inkFaint }}>{editForm.footer}</p>}
                        <p className="text-[8.5px] text-right mt-1.5" style={{ color: T.inkFaint }}>12:45 PM</p>
                      </div>
                      {editForm.buttons.slice(0, 3).map((b, i) => (
                        <button key={b.id || i} className="w-full text-center text-[11px] font-semibold py-2 rounded-full truncate px-2 transition-colors"
                          style={{ background: T.surface, border: `1px solid ${T.hairlineMd}`, color: T.mintText }}
                          onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHover; }}
                          onMouseLeave={e => { e.currentTarget.style.background = T.surface; }}>
                          {b.text || "Button"}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: `1px solid ${T.hairline}` }}>
                      <div className="flex-1 rounded-full px-3 py-1.5" style={{ background: "rgba(0,0,0,0.24)" }}>
                        <p className="text-[10px]" style={{ color: T.inkFaint }}>Message…</p>
                      </div>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundImage: "linear-gradient(180deg, #7bffce, #22c98a)" }}>
                        <Send size={11} color="#02150e" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── INSPECTOR ── */}
            <div className="w-[352px] shrink-0 flex flex-col min-h-0" style={{ ...shell("1"), borderRadius: 0, borderTop: "none", borderBottom: "none", borderRight: "none" }}>
              <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: `1px solid ${T.hairline}` }}>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold tracking-tight" style={{ color: T.ink }}>Inspector</p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: T.inkSoft }}>{detail.name}</p>
                </div>
                <StatusBadge status={detail.published ? "approved" : "draft"} label={detail.published ? "Live" : "Draft"} />
              </div>

              <div className="grid grid-cols-5 gap-1 px-3 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${T.hairline}` }}>
                {INSPECTOR_TABS.map(t => {
                  const Icon = t.icon; const active = tab === t.id;
                  return (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      className="flex flex-col items-center gap-1 py-1.5 rounded-lg text-[9.5px] font-medium transition-colors"
                      style={active ? { background: T.surfaceActive, color: T.mintText } : { color: T.inkFaint }}>
                      <Icon size={13} />{t.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-h-0">

                {tab === "setup" && (
                  <>
                    <div>
                      <FieldLabel required>Flow name</FieldLabel>
                      <DInput placeholder="Enter bot flow / project name…" value={editForm.project}
                        onChange={e => setEditForm({ ...editForm, project: e.target.value })} />
                    </div>
                    <div className="rounded-xl p-4" style={{ background: T.surface, border: `1px solid ${T.hairline}` }}>
                      <StatusBadge status={detail.published ? "approved" : "draft"} label={detail.published ? "Live in Inbox" : "Draft — not active"} />
                      {!detail.published && (
                        <p className="text-[11px] mt-2" style={{ color: T.inkSoft }}>Publish to activate this flow in Inbox.</p>
                      )}
                    </div>
                    <div>
                      <FieldLabel><span className="mb-0">How it works</span></FieldLabel>
                      <div className="space-y-1.5 mt-2">
                        {[
                          "hi / hello → configured greeting message",
                          "User types product keyword → product details & gallery",
                          "Multiple products & keywords supported dynamically",
                          "Draft bot → silent in Inbox",
                        ].map((tip, i) => (
                          <p key={i} className="text-[11.5px] leading-relaxed flex gap-1.5" style={{ color: T.inkSoft }}>
                            <span style={{ color: T.mintText }}>·</span>{tip}
                          </p>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {tab === "message" && (
                  <>
                    <div>
                      <FieldLabel required>Message body</FieldLabel>
                      <DTextarea rows={5} placeholder="Enter the first message your chatbot will send…"
                        value={editForm.body} onChange={e => setEditForm({ ...editForm, body: e.target.value })} />
                    </div>

                    <div>
                      <FieldLabel>Header type</FieldLabel>
                      <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.hairline}` }}>
                        {(["None", "Image", "Video", "Document"] as const).map(t => (
                          <button key={t} onClick={() => setEditForm({ ...editForm, headerType: t })}
                            className="px-2 py-1.5 rounded-md text-[10.5px] font-medium transition-colors truncate"
                            style={editForm.headerType === t ? { background: T.surfaceActive, color: T.mintText } : { color: T.inkFaint }}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {editForm.headerType !== "None" && (
                      <div className="pl-3.5" style={{ borderLeft: `2px solid ${T.hairlineHi}` }}>
                        <FieldLabel required>{editForm.headerType} URL</FieldLabel>
                        <DInput placeholder={`Paste ${editForm.headerType.toLowerCase()} URL (e.g. https://...)`}
                          value={editForm.headerMediaUrl} onChange={e => setEditForm({ ...editForm, headerMediaUrl: e.target.value })} />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Message type</FieldLabel>
                        <DSelect value={editForm.messageType} onChange={e => setEditForm({ ...editForm, messageType: e.target.value as EditForm["messageType"] })}>
                          {["Text", "Image", "Video", "Document", "Audio"].map(t => <option key={t}>{t}</option>)}
                        </DSelect>
                      </div>
                      <div>
                        <FieldLabel>Footer</FieldLabel>
                        <DInput placeholder="Enter footer" value={editForm.footer} onChange={e => setEditForm({ ...editForm, footer: e.target.value })} />
                      </div>
                    </div>
                  </>
                )}

                {tab === "buttons" && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11.5px]" style={{ color: T.inkSoft }}>Up to 3 buttons under the first message.</p>
                      <GhostButton small onClick={() => {
                        if (editForm.buttons.length >= 3) return;
                        setEditForm({ ...editForm, buttons: [...editForm.buttons, { id: `btn-${Date.now()}`, type: "QUICK_REPLY", text: "", value: "" }] });
                      }}><Plus size={11} /> Add</GhostButton>
                    </div>

                    {editForm.buttons.map((b, bIdx) => (
                      <div key={b.id || bIdx} className="rounded-xl p-3.5 space-y-2.5" style={{ background: T.surface, border: `1px solid ${T.hairline}` }}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[10.5px] uppercase tracking-wide" style={{ color: T.mintText }}>Button {bIdx + 1}</span>
                          <button className="p-1 rounded-md" style={{ color: T.inkFaint }}
                            onClick={() => setEditForm({ ...editForm, buttons: editForm.buttons.filter((_, i) => i !== bIdx) })}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <DSelect value={b.type} onChange={e => {
                          const updated = [...editForm.buttons];
                          updated[bIdx] = { ...updated[bIdx], type: e.target.value as ButtonForm["type"], value: "" };
                          setEditForm({ ...editForm, buttons: updated });
                        }}>
                          <option value="QUICK_REPLY">Quick reply</option>
                          <option value="URL">Website (URL)</option>
                          <option value="PHONE_NUMBER">Call (phone)</option>
                        </DSelect>
                        <DInput placeholder="Button label" value={b.text} onChange={e => {
                          const updated = [...editForm.buttons]; updated[bIdx] = { ...updated[bIdx], text: e.target.value };
                          setEditForm({ ...editForm, buttons: updated });
                        }} />
                        {b.type !== "QUICK_REPLY" && (
                          <DInput placeholder={b.type === "URL" ? "https://example.com" : "+91XXXXXXXXXX"} value={b.value} onChange={e => {
                            const updated = [...editForm.buttons]; updated[bIdx] = { ...updated[bIdx], value: e.target.value };
                            setEditForm({ ...editForm, buttons: updated });
                          }} />
                        )}
                      </div>
                    ))}
                    {editForm.buttons.length === 0 && (
                      <div className="text-center py-8 rounded-xl" style={{ border: `1px dashed ${T.hairlineMd}` }}>
                        <p className="text-[11.5px]" style={{ color: T.inkFaint }}>No buttons yet.</p>
                      </div>
                    )}
                  </>
                )}

                {tab === "products" && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11.5px]" style={{ color: T.inkSoft }}>Match keywords to product cards.</p>
                      <GhostButton small onClick={() => {
                        setEditForm({ ...editForm, products: [...editForm.products, {
                          id: `prod-${Date.now()}`, name: "New Product", keywords: "item, product",
                          images: ["https://images.pexels.com/photos/265906/pexels-photo-265906.jpeg?w=400&h=400&fit=crop"],
                          price: 999, currency: "₹",
                        }] });
                      }}><Plus size={11} /> Add</GhostButton>
                    </div>

                    {editForm.products.map((p, pIdx) => (
                      <div key={p.id || pIdx} className="rounded-xl p-3.5 space-y-3" style={{ background: T.surface, border: `1px solid ${T.hairline}` }}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[10.5px] uppercase tracking-wide" style={{ color: T.gold }}>Product {pIdx + 1}</span>
                          <button className="p-1 rounded-md" style={{ color: T.inkFaint }}
                            onClick={() => setEditForm({ ...editForm, products: editForm.products.filter((_, i) => i !== pIdx) })}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <DInput placeholder="Product name" value={p.name} onChange={e => {
                          const updated = [...editForm.products]; updated[pIdx].name = e.target.value;
                          setEditForm({ ...editForm, products: updated });
                        }} />
                        <DInput placeholder="Trigger keywords, comma separated" value={p.keywords} onChange={e => {
                          const updated = [...editForm.products]; updated[pIdx].keywords = e.target.value;
                          setEditForm({ ...editForm, products: updated });
                        }} />
                        <DInput type="number" placeholder="Price (optional)" value={p.price || ""} onChange={e => {
                          const updated = [...editForm.products]; updated[pIdx].price = Number(e.target.value) || undefined;
                          setEditForm({ ...editForm, products: updated });
                        }} />
                        <div className="flex items-center gap-1.5 pt-1">
                          <ImageIcon size={11} style={{ color: T.inkFaint }} />
                          <span className="text-[10.5px]" style={{ color: T.inkFaint }}>{p.images.length} image(s)</span>
                          <div className="ml-auto">
                            <GhostButton small onClick={() => {
                              const updated = [...editForm.products];
                              updated[pIdx].images.push("https://images.pexels.com/photos/265906/pexels-photo-265906.jpeg?w=400&h=400&fit=crop");
                              setEditForm({ ...editForm, products: updated });
                            }}>+ Image URL</GhostButton>
                          </div>
                        </div>
                        {p.images.map((imgUrl, imgIdx) => (
                          <div key={imgIdx} className="flex items-center gap-2">
                            <img src={imgUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" style={{ border: `1px solid ${T.hairlineMd}` }}
                              onError={(e) => { (e.target as HTMLElement).style.display = "none"; }} />
                            <DInput placeholder="Image URL" value={imgUrl} onChange={e => {
                              const updated = [...editForm.products]; updated[pIdx].images[imgIdx] = e.target.value;
                              setEditForm({ ...editForm, products: updated });
                            }} style={{ fontSize: 11, minWidth: 0 }} />
                            <button className="p-1 shrink-0" style={{ color: T.inkFaint }}
                              onClick={() => {
                                const updated = [...editForm.products]; updated[pIdx].images = updated[pIdx].images.filter((_, i) => i !== imgIdx);
                                setEditForm({ ...editForm, products: updated });
                              }}><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    ))}
                    {editForm.products.length === 0 && (
                      <div className="text-center py-8 rounded-xl" style={{ border: `1px dashed ${T.hairlineMd}` }}>
                        <p className="text-[11.5px]" style={{ color: T.inkFaint }}>No products yet.</p>
                      </div>
                    )}
                  </>
                )}

                {tab === "flow" && (
                  <>
                    <div>
                      <FieldLabel>Connections ({(detail.connections || []).length})</FieldLabel>
                      <div className="space-y-1.5 mt-2">
                        {(detail.connections || []).map((c: any) => (
                          <div key={c.id} className="text-[11px] px-3 py-2 rounded-lg flex items-center gap-1.5"
                            style={{ background: T.surface, border: `1px solid ${T.hairline}`, color: T.ink }}>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: T.surfaceActive, color: T.mintText, fontFamily: "ui-monospace, monospace" }}>#{c.sourceNode}</span>
                            <ChevronRight size={11} style={{ color: T.inkFaint }} />
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: T.surfaceActive, color: T.mintText, fontFamily: "ui-monospace, monospace" }}>#{c.targetNode}</span>
                          </div>
                        ))}
                        {(!detail.connections || detail.connections.length === 0) && (
                          <p className="text-[11.5px]" style={{ color: T.inkFaint }}>No connections yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <FieldLabel>From node</FieldLabel>
                        <DSelect value={conn.source} onChange={e => setConn({ ...conn, source: Number(e.target.value) })}>
                          <option value={0}>Select node</option>
                          {nodes.map((n: any) => <option key={n.id} value={Number(n.id)}>#{n.id} {n.nodeType}</option>)}
                        </DSelect>
                      </div>
                      <div>
                        <FieldLabel>To node</FieldLabel>
                        <DSelect value={conn.target} onChange={e => setConn({ ...conn, target: Number(e.target.value) })}>
                          <option value={0}>Select node</option>
                          {nodes.map((n: any) => <option key={n.id} value={Number(n.id)}>#{n.id} {n.nodeType}</option>)}
                        </DSelect>
                      </div>
                      <GhostButton onClick={addConn}><LinkIcon size={11} /> Connect nodes</GhostButton>
                    </div>
                  </>
                )}

              </div>

              {/* Footer actions — wrap on narrow widths instead of squeezing */}
              <div className="p-5 flex flex-wrap gap-2.5 shrink-0" style={{ borderTop: `1px solid ${T.hairline}` }}>
                <div className="flex-1 min-w-[130px]">
                  <PrimaryButton full onClick={saveEdit}><Save size={13} /> {saving ? "Saving…" : "Save changes"}</PrimaryButton>
                </div>
                <div className="flex-1 min-w-[110px]">
                  <PrimaryButton full gold onClick={publishFromEdit}><Play size={13} /> Publish</PrimaryButton>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══════════════ PREVIEW MODAL ══════════════ */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(2,10,7,0.6)", backdropFilter: "blur(6px)" }}
          onClick={() => setPreview(null)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ ...shell("strong"), boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.hairline}` }}>
              <p className="font-semibold text-[13px]" style={{ color: T.ink }}>Preview: {preview.flowName}</p>
              <button className="p-1 rounded-md" style={{ color: T.inkFaint }}
                onMouseEnter={e => { e.currentTarget.style.color = T.danger; }} onMouseLeave={e => { e.currentTarget.style.color = T.inkFaint; }}
                onClick={() => setPreview(null)}><X size={15} /></button>
            </div>
            <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {preview.preview.map((p: any, i: number) => {
                const outbound = p.nodeType === "message" || p.nodeType === "question";
                return (
                  <div key={i} className="text-[13px] max-w-[85%] rounded-2xl px-3.5 py-2.5"
                    style={outbound
                      ? { marginLeft: "auto", backgroundImage: "linear-gradient(180deg, #7bffce, #22c98a)", color: "#02150e" }
                      : { background: "rgba(0,0,0,0.24)", border: `1px solid ${T.hairlineMd}`, color: T.ink }}>
                    <span className="text-[9px] uppercase tracking-widest opacity-60 block mb-0.5">{p.nodeType}</span>
                    {p.text}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}