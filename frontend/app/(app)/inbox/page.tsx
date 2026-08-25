"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Send, Check, CheckCheck, MoreVertical, Phone, MessageSquare,
  Paperclip, FileText, Film, Image as ImageIcon, Download, X, Bot, Plus,
  Search, UserPlus,
} from "lucide-react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn, formatTime, formatDate, formatExactTimeOrDate, initials, timeAgo } from "@/lib/utils";
import StatusBadge from "@/components/ui/status-badge";
import {
  useBotEngine,
  ALL_CATEGORIES,
  makeTextMessage,
  makeProductImages,
  makeProductList,
  getCatalog,
  isValidImageUrl,
  type BotMessage,
  type JewelleryCategory,
  type BotInstance,
} from "@/lib/jewellery-bot";

// ─────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM — "Dispatch Console"
// Dark ink rail (manifest) + warm paper canvas (correspondence). Accent
// cobalt marks human/agent action; amber marks automated (bot) activity.
// ─────────────────────────────────────────────────────────────────────────
const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');";

const F = {
  display: "'Fraunces', ui-serif, Georgia, serif",
  sans: "'Inter', ui-sans-serif, system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
};

const C = {
  paper:      "#f5f2ea",
  paperDim:   "#eeebe1",
  ink:        "#14171d",
  ink2:       "#1c2029",
  inkLine:    "rgba(255,255,255,0.09)",
  onDark:     "#f4f1e8",
  onDarkDim:  "rgba(244,241,232,0.56)",
  onDarkFaint:"rgba(244,241,232,0.32)",
  accent:     "#3452ff",
  accentDeep: "#2338c9",
  accentSoft: "rgba(52,82,255,0.12)",
  accentSoft2:"rgba(52,82,255,0.20)",
  accentText: "#b7c2ff",
  amber:      "#e8952e",
  amberSoft:  "rgba(232,149,46,0.14)",
  amberSoft2: "rgba(232,149,46,0.22)",
  emerald:    "#1f9d6b",
  emeraldSoft:"rgba(31,157,107,0.14)",
  rose:       "#d94a4a",
  roseSoft:   "rgba(217,74,74,0.12)",
  line:       "rgba(20,23,29,0.09)",
  lineSoft:   "rgba(20,23,29,0.05)",
  textInk:    "#171a1f",
  textMuted:  "rgba(20,23,29,0.55)",
  textFaint:  "rgba(20,23,29,0.38)",
  mine:       "#e9edff",
  bot:        "#fdf1de",
  theirs:     "#ffffff",
};

function FontLoader() {
  return <style>{FONT_IMPORT}</style>;
}

// ─────────────────────────────────────────────────────────────────────────
// PERSISTENCE — bot chat history in localStorage so it survives page reloads
// ─────────────────────────────────────────────────────────────────────────
const LS_KEY = (convId: number) => `wiz_bot_msgs_${convId}`;
const LS_PROCESSED = (convId: number) => `wiz_bot_proc_${convId}`;
const LS_DRAFT = (convId: number) => `wiz_draft_${convId}`;
const LS_ACTIVE_BOT = (convId: number) => `wiz_active_bot_${convId}`;
const LS_BOT_ENABLED = (convId: number) => `wiz_bot_on_${convId}`;

function loadBotMsgs(convId: number): BotMessage[] {
  try {
    const raw = localStorage.getItem(LS_KEY(convId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveBotMsgs(convId: number, msgs: BotMessage[]) {
  try { localStorage.setItem(LS_KEY(convId), JSON.stringify(msgs)); } catch {}
}

function loadProcessed(convId: number): Set<string | number> {
  try {
    const raw = localStorage.getItem(LS_PROCESSED(convId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveProcessed(convId: number, set: Set<string | number>) {
  try { localStorage.setItem(LS_PROCESSED(convId), JSON.stringify(Array.from(set))); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// BOT STATE — per conversation, persisted
// ─────────────────────────────────────────────────────────────────────────
interface BotState {
  messages:        BotMessage[];
  processedMsgIds: Set<string | number>;
}

function freshBotState(): BotState {
  return { messages: [], processedMsgIds: new Set() };
}

const FALLBACK_IMG = "https://images.pexels.com/photos/265906/pexels-photo-265906.jpeg?w=400&h=400&fit=crop";

function ImageGalleryModal({
  images, productName, onClose,
}: {
  images: string[]; productName?: string; onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;
  const totalPages = Math.max(1, Math.ceil(images.length / PER_PAGE));
  const pageImages = images.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background:"rgba(15,17,22,0.82)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in"
        style={{ background: C.paper, borderRadius: 4, border: `1px solid ${C.line}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom:`1px solid ${C.line}`, background: C.ink }}>
          <div>
            <p className="text-[15px]" style={{ color: C.onDark, fontFamily: F.display, fontWeight: 600 }}>
              {productName || "Product Gallery"}
            </p>
            <p className="text-[10.5px] mt-0.5 tracking-wide" style={{ color: C.onDarkDim, fontFamily: F.mono }}>
              {images.length} IMAGES · PAGE {page + 1} / {totalPages}
            </p>
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center transition-colors"
            style={{ background:"rgba(255,255,255,0.08)", borderRadius: 3 }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            onClick={onClose}
          >
            <X size={15} style={{ color: C.onDark }} />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {pageImages.map((url, i) => {
              const globalIdx = page * PER_PAGE + i;
              return (
                <a
                  key={globalIdx}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-square overflow-hidden bg-gray-100 group relative block"
                  style={{ borderRadius: 3, border: `1px solid ${C.line}` }}
                >
                  <img
                    src={url}
                    alt={`${productName || "img"} ${globalIdx + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                  />
                  <span
                    className="absolute bottom-1 right-1 text-[9.5px] font-semibold px-1.5 py-0.5"
                    style={{ background: "rgba(20,23,29,0.72)", color: C.onDark, fontFamily: F.mono, borderRadius: 2 }}
                  >
                    {globalIdx + 1}
                  </span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-5 py-3"
            style={{ borderTop:`1px solid ${C.line}`, background: C.paperDim }}>
            <button
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-40"
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className="w-7 h-7 text-[11px] font-bold transition-all"
                style={{
                  background: page === i ? C.accent : "rgba(20,23,29,0.06)",
                  color: page === i ? "#fff" : C.textInk,
                  borderRadius: 2,
                  fontFamily: F.mono,
                }}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({ msg }: { msg: BotMessage }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const rawImages = msg.productImages ?? [];
  const images = rawImages.filter(u => isValidImageUrl(u));
  const videos = msg.productVideos ?? [];
  const docs   = msg.productDocuments ?? [];
  const PREVIEW = 4;
  const extra  = images.length - PREVIEW;

  return (
    <>
      <div
        className="overflow-hidden max-w-[340px]"
        style={{
          background: "#fffdf8",
          border: `1px solid ${C.line}`,
          borderLeft: `3px solid ${C.amber}`,
          borderRadius: 4,
        }}
      >
        <div className="px-3.5 pt-3.5 pb-2.5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[14px] leading-tight" style={{ color: C.textInk, fontFamily: F.display, fontWeight: 600 }}>
              {msg.productName || "Product"}
            </p>
            {msg.productPrice && (
              <p className="text-[13px] shrink-0" style={{ color: C.accentDeep, fontFamily: F.mono, fontWeight: 700 }}>
                {msg.productCurrency || "₹"}{msg.productPrice.toLocaleString("en-IN")}
              </p>
            )}
          </div>
          {msg.productDescription && (
            <p className="text-[12px] leading-relaxed" style={{ color: C.textMuted }}>
              {msg.productDescription}
            </p>
          )}
        </div>

        {images.length > 0 && (
          <div className="relative px-3.5 pb-2.5">
            <div className="grid grid-cols-4 gap-1.5">
              {images.slice(0, PREVIEW).map((url, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer"
                  style={{ borderRadius: 3 }}
                  onClick={() => setGalleryOpen(true)}
                >
                  <img
                    src={url}
                    alt={`${msg.productName} ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                  />
                  {i === PREVIEW - 1 && extra > 0 && (
                    <div
                      className="absolute inset-0 flex items-center justify-center font-bold text-white text-[14px]"
                      style={{ background:"rgba(20,23,29,0.55)", fontFamily: F.mono }}
                    >
                      +{extra}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {images.length > 0 && (
              <button
                onClick={() => setGalleryOpen(true)}
                className="mt-2 w-full text-[11px] font-semibold py-1.5 transition-colors"
                style={{ background: C.amberSoft, color: "#95601a", borderRadius: 3 }}
                onMouseEnter={e => (e.currentTarget.style.background = C.amberSoft2)}
                onMouseLeave={e => (e.currentTarget.style.background = C.amberSoft)}
              >
                <ImageIcon size={11} className="inline mr-1" />
                View all {images.length} images
              </button>
            )}
          </div>
        )}

        {(videos.length > 0 || docs.length > 0) && (
          <div style={{ height:1, background: C.line }} />
        )}

        {videos.map((vUrl, i) => (
          <a
            key={i}
            href={vUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3.5 py-2.5 transition-colors"
            onMouseEnter={e => (e.currentTarget.style.background = C.lineSoft)}
            onMouseLeave={e => (e.currentTarget.style.background = "")}
          >
            <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: C.ink, borderRadius: 3 }}>
              <Film size={16} style={{ color: C.amber }} />
            </div>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: C.textInk }}>Product Video #{i + 1}</p>
              <p className="text-[10px]" style={{ color: C.textFaint, fontFamily: F.mono }}>Tap to play</p>
            </div>
          </a>
        ))}

        {docs.map((dUrl, i) => (
          <a
            key={i}
            href={dUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3.5 py-2.5 transition-colors"
            onMouseEnter={e => (e.currentTarget.style.background = C.lineSoft)}
            onMouseLeave={e => (e.currentTarget.style.background = "")}
          >
            <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: "rgba(20,23,29,0.06)", borderRadius: 3 }}>
              <FileText size={16} style={{ color: C.accentDeep }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: C.textInk }}>
                {dUrl.split("/").pop() || "Document"}
              </p>
              <p className="text-[10px]" style={{ color: C.textFaint, fontFamily: F.mono }}>Tap to download</p>
            </div>
            <Download size={14} style={{ color: C.textFaint }} />
          </a>
        ))}
      </div>
      {galleryOpen && (
        <ImageGalleryModal
          images={images}
          productName={msg.productName}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </>
  );
}

function ContentResultsCard({ msg }: { msg: BotMessage }) {
  const sections = msg.contentSections ?? [];
  const matchedKws: string[] = msg.matchedKeywords ?? [];
  const [activeGallery, setActiveGallery] = useState<any>(null);

  if (sections.length === 0) return null;

  const imgSections = sections.filter(s => s.kind === "images");
  const vidSections = sections.filter(s => s.kind === "videos");
  const docSections = sections.filter(s => s.kind === "documents");
  const resSections = sections.filter(s => s.kind === "resources");

  function imgsFrom(sec: any) { return (sec.items ?? []).filter(isValidImageUrl); }
  function itemsFrom(sec: any) { return sec.items ?? []; }
  function openGal(imgs: any) { setActiveGallery({ images: imgs, title: "Images" }); }
  function closeGal() { setActiveGallery(null); }
  function imgErr(e: any) { (e.currentTarget as any).src = FALLBACK_IMG; }

  const firstTitle = sections[0].title;
  const firstImages = imgSections.length > 0 ? imgsFrom(imgSections[0]) : [];

  return (
    <>
      <div className="overflow-hidden max-w-[360px]" style={{ background: "#fffdf8", border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.amber}`, borderRadius: 4 }}>
        {matchedKws.length > 0 && (
          <div className="px-3.5 pt-3 pb-2">
            <p className="text-[13px] leading-tight mb-1.5" style={{ color: C.textInk, fontFamily: F.display, fontWeight: 600 }}>{firstTitle}</p>
            <div className="flex flex-wrap gap-1">
              {Array.from(matchedKws).slice(0, 5).map(function (word: string, idx: number) {
                return React.createElement("span", {
                  key: idx,
                  className: "text-[10px] font-semibold px-2 py-0.5",
                  style: { background: C.amberSoft, color: "#95601a", border: `1px solid ${C.amberSoft2}`, borderRadius: 999 },
                }, word);
              })}
            </div>
          </div>
        )}

        {imgSections.map(function (isec: any, i: number) {
          const imgs = imgsFrom(isec);
          if (imgs.length === 0) return null;
          const showTitle = i > 0 || matchedKws.length === 0;
          const extra = imgs.length - 8;
          return (
            <div key={"i" + i} className={showTitle ? "px-3.5 pt-3 pb-2.5" : "px-3.5 pb-2.5"}>
              {showTitle && <p className="text-[13px] mb-2" style={{ color: C.textInk, fontFamily: F.display, fontWeight: 600 }}>{isec.title}</p>}
              <div className="grid grid-cols-4 gap-1.5">
                {imgs.slice(0, 8).map(function (url: string, idx: number) {
                  const showExtra = idx === 7 && extra > 0;
                  return (
                    <div key={idx} className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer" style={{ borderRadius: 3 }} onClick={function () { openGal(imgs); }}>
                      <img src={url} alt={"img " + (idx + 1)} className="w-full h-full object-cover" loading="lazy" onError={imgErr} />
                      {showExtra ? <div className="absolute inset-0 flex items-center justify-center font-bold text-white text-[13px]" style={{ background: "rgba(20,23,29,0.60)", fontFamily: F.mono }}>{"+" + extra}</div> : null}
                    </div>
                  );
                })}
              </div>
              <button onClick={function () { openGal(imgs); }} className="mt-2 w-full text-[11px] font-semibold py-1.5" style={{ background: C.amberSoft, color: "#95601a", borderRadius: 3 }}>
                <ImageIcon size={11} className="inline mr-1" /> View all {imgs.length} images
              </button>
            </div>
          );
        })}

        {vidSections.map(function (vsec: any, i: number) {
          const urls = itemsFrom(vsec);
          if (urls.length === 0) return null;
          return (
            <div key={"v" + i}>
              <div style={{ height: 1, background: C.line }} />
              <div className="px-3.5 pt-3 pb-2">
                <p className="text-[13px]" style={{ color: C.textInk, fontFamily: F.display, fontWeight: 600 }}>{vsec.title}</p>
              </div>
              {urls.map(function (url: string, idx: number) {
                return (
                  <a key={idx} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3.5 py-2.5 transition-colors" style={{ background: "" }}>
                    <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: C.ink, borderRadius: 3 }}>
                      <Film size={16} style={{ color: C.amber }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: C.textInk }}>{url.split("/").pop() || ("Video " + (idx + 1))}</p>
                      <p className="text-[10px]" style={{ color: C.textFaint, fontFamily: F.mono }}>Tap to play · Video {"#" + (idx + 1)}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          );
        })}

        {docSections.map(function (dsec: any, i: number) {
          const urls = itemsFrom(dsec);
          if (urls.length === 0) return null;
          return (
            <div key={"d" + i}>
              <div style={{ height: 1, background: C.line }} />
              <div className="px-3.5 pt-3 pb-2">
                <p className="text-[13px]" style={{ color: C.textInk, fontFamily: F.display, fontWeight: 600 }}>{dsec.title}</p>
              </div>
              {urls.map(function (url: string, idx: number) {
                return (
                  <a key={idx} href={url} download target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: "rgba(20,23,29,0.06)", borderRadius: 3 }}>
                      <FileText size={16} style={{ color: C.accentDeep }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: C.textInk }}>{url.split("/").pop() || "Document"}</p>
                      <p className="text-[10px]" style={{ color: C.textFaint, fontFamily: F.mono }}>Tap to download</p>
                    </div>
                    <Download size={14} style={{ color: C.textFaint }} />
                  </a>
                );
              })}
            </div>
          );
        })}

        {resSections.map(function (rsec: any, i: number) {
          const urls = itemsFrom(rsec);
          if (urls.length === 0) return null;
          return (
            <div key={"r" + i}>
              <div style={{ height: 1, background: C.line }} />
              <div className="px-3.5 pt-3 pb-2">
                <p className="text-[13px]" style={{ color: C.textInk, fontFamily: F.display, fontWeight: 600 }}>{rsec.title}</p>
              </div>
              {urls.map(function (url: string, idx: number) {
                return (
                  <a key={idx} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: C.emeraldSoft, borderRadius: 3 }}>
                      <FileText size={16} style={{ color: C.emerald }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: C.textInk }}>{url.split("/").pop() || ("Resource " + (idx + 1))}</p>
                      <p className="text-[10px]" style={{ color: C.textFaint, fontFamily: F.mono }}>Tap to open</p>
                    </div>
                  </a>
                );
              })}
            </div>
          );
        })}
      </div>

      {activeGallery ? <ImageGalleryModal images={activeGallery.images} productName={activeGallery.title} onClose={closeGal} /> : null}
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────
// CONTACT PICKER MODAL — New Conversation
// ─────────────────────────────────────────────────────────────────────────
function ContactPickerModal({
  numbers,
  onClose,
  onConversationCreated,
}: {
  numbers: any[];
  onClose: () => void;
  onConversationCreated: (convId: number) => void;
}) {
  const [query,       setQuery]       = useState("");
  const [debouncedQ,  setDebouncedQ]  = useState("");
  const [contacts,    setContacts]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [sending,     setSending]     = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm,     setNewForm]     = useState({ firstName:"", lastName:"", mobile:"", email:"" });
  const [sessionErr,  setSessionErr]  = useState(false);
  const [selContact,  setSelContact]  = useState<any>(null);
  const [templates,   setTemplates]   = useState<any[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch contacts when debounced query changes
  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ page:"1", limit:"20" });
    if (debouncedQ) q.set("search", debouncedQ);
    api.get<any>(`/contacts?${q}`)
      .then(d => setContacts(d.items || []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [debouncedQ]);

  // Load templates (for 24h session fallback)
  useEffect(() => {
    api.get<any[]>("/templates").then(setTemplates).catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  // Focus search on mount
  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 80); }, []);

  const numberId = numbers[0]?.id;

  const startConversation = async (contact: any, templateOverride?: any) => {
    if (!numberId) { alert("No active WABA number configured."); return; }
    setSending(true);
    setSessionErr(false);
    try {
      if (templateOverride) {
        const params = (templateOverride.body || "").match(/{{(\d+)}}/g)
          ?.map((_: string, i: number) => contact.firstName || `Customer ${i + 1}`) || [];
        await api.post("/messages/template", {
          whatsappNumberId: numberId,
          to: contact.mobile,
          templateName: templateOverride.name,
          parameters: params,
        });
      } else {
        await api.post("/messages/send", {
          whatsappNumberId: numberId,
          to: contact.mobile,
          text: "",
        });
      }
      // Fetch updated conversations and find the new one
      const convData = await api.get<any>("/conversations?limit=50");
      const convs: any[] = convData.items || [];
      const match = convs.find(c => c.contact?.mobile === contact.mobile);
      if (match) onConversationCreated(match.id);
      else onClose();
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("24") || err.message?.toLowerCase().includes("session") || err.status === 400) {
        setSessionErr(true);
        setSelContact(contact);
      } else {
        alert(err.message || "Failed to start conversation");
      }
    } finally {
      setSending(false);
    }
  };

  const addContact = async () => {
    if (!newForm.firstName || !newForm.mobile) return;
    try {
      const created = await api.post<any>("/contacts", newForm);
      setShowAddForm(false);
      setNewForm({ firstName:"", lastName:"", mobile:"", email:"" });
      setQuery(newForm.firstName);
      // Immediately try to start conversation with newly created contact
      await startConversation(created);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ background: "rgba(15,17,22,0.78)" }}>
      <div
        className="w-full max-w-md flex flex-col"
        style={{ background: C.paper, borderRadius: 4, border: `1px solid ${C.line}`, maxHeight: "82vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom:`1px solid ${C.line}`, background: C.ink }}>
          <h3 className="text-[15px]" style={{ color: C.onDark, fontFamily: F.display, fontWeight: 600 }}>
            New conversation
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center transition-colors"
            style={{ background:"rgba(255,255,255,0.08)", borderRadius: 3 }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          >
            <X size={15} style={{ color: C.onDark }} />
          </button>
        </div>

        {/* 24-hour session error */}
        {sessionErr && selContact && (
          <div className="mx-4 mt-3 p-3.5"
            style={{ background: C.amberSoft, border: `1px solid ${C.amberSoft2}`, borderRadius: 3 }}>
            <p className="text-[12.5px] font-semibold mb-1" style={{ color:"#7a4c12" }}>
              ⚠ Outside 24-hour WhatsApp session
            </p>
            <p className="text-[11.5px] mb-3" style={{ color:"#8f5a17" }}>
              This contact is outside the 24-hour WhatsApp session. Send an approved template to start this conversation.
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {templates.filter(t => !t.status || ["approved", "active", "pending", "draft"].includes(t.status.toLowerCase())).map(t => (
                <button
                  key={t.id}
                  onClick={() => startConversation(selContact, t)}
                  disabled={sending}
                  className="w-full text-left px-3.5 py-2.5 transition-colors"
                  style={{ background:"rgba(255,255,255,0.85)", border:`1px solid ${C.line}`, borderRadius: 3 }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.accentSoft)}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.85)")}
                >
                  <p className="text-[12.5px] font-semibold" style={{ color: C.textInk }}>{t.name}</p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: C.textMuted }}>{t.body}</p>
                </button>
              ))}
              {templates.filter(t => !t.status || ["approved", "active", "pending", "draft"].includes(t.status.toLowerCase())).length === 0 && (
                <p className="text-[12px]" style={{ color:"#8f5a17" }}>No approved templates yet.</p>
              )}
            </div>
            <button className="btn-secondary w-full mt-2 !text-xs" onClick={() => { setSessionErr(false); setSelContact(null); }}>
              ← Back
            </button>
          </div>
        )}

        {!sessionErr && (
          <>
            {/* Search */}
            <div className="px-4 pt-3.5 pb-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.textFaint }} />
                <input
                  ref={searchRef}
                  className="w-full h-10 pl-9 pr-4 text-[13px] outline-none"
                  style={{
                    background: "rgba(20,23,29,0.04)",
                    border:     `1px solid ${C.line}`,
                    color:      C.textInk,
                    borderRadius: 3,
                  }}
                  placeholder="Search contacts…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accentSoft}`; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.boxShadow = ""; }}
                />
              </div>
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2" style={{ minHeight:0 }}>
              {loading && (
                <div className="flex items-center justify-center py-8 gap-2" style={{ color: C.textFaint }}>
                  <span className="spinner spinner-sm" /> Loading…
                </div>
              )}
              {!loading && contacts.length === 0 && (
                <div className="py-8 text-center text-[13px]" style={{ color: C.textFaint }}>
                  {debouncedQ ? `No contacts found for "${debouncedQ}"` : "No contacts yet."}
                </div>
              )}
              {!loading && contacts.map(c => (
                <button
                  key={c.id}
                  onClick={() => startConversation(c)}
                  disabled={sending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
                  style={{ borderRadius: 3 }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.accentSoft)}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                    style={{
                      background: C.accentSoft,
                      color: C.accentDeep,
                      border: `1.5px solid ${C.accentSoft2}`,
                      fontFamily: F.mono,
                    }}
                  >
                    {initials(c.firstName, c.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold truncate" style={{ color: C.textInk }}>
                      {c.firstName} {c.lastName || ""}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: C.textMuted, fontFamily: F.mono }}>{c.mobile}</p>
                  </div>
                  {sending && selContact?.id === c.id && (
                    <span className="spinner spinner-sm shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Add new contact */}
            <div className="px-4 pb-4 pt-1" style={{ borderTop:`1px solid ${C.line}` }}>
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold transition-colors"
                  style={{ color: C.accentDeep, borderRadius: 3 }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.accentSoft)}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <UserPlus size={15} /> + Add new contact
                </button>
              ) : (
                <div className="space-y-2.5 pt-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.textFaint, fontFamily: F.mono }}>Add contact</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input !text-[12.5px]" placeholder="First name *" value={newForm.firstName}
                      onChange={e => setNewForm({...newForm, firstName:e.target.value})} />
                    <input className="input !text-[12.5px]" placeholder="Last name" value={newForm.lastName}
                      onChange={e => setNewForm({...newForm, lastName:e.target.value})} />
                  </div>
                  <input className="input !text-[12.5px]" placeholder="Mobile * (e.g. 919xxxxxxxxx)" value={newForm.mobile}
                    onChange={e => setNewForm({...newForm, mobile:e.target.value})} />
                  <input className="input !text-[12.5px]" placeholder="Email (optional)" value={newForm.email}
                    onChange={e => setNewForm({...newForm, email:e.target.value})} />
                  <div className="flex gap-2">
                    <button className="btn-secondary flex-1 !text-xs" onClick={() => setShowAddForm(false)}>Cancel</button>
                    <button className="flex-1 !text-xs font-semibold py-2 transition-colors" style={{ background: C.accent, color: "#fff", borderRadius: 3, opacity: (!newForm.firstName || !newForm.mobile) ? 0.4 : 1 }} onClick={addContact}
                      disabled={!newForm.firstName || !newForm.mobile}>
                      Save & Start Chat
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────
function BotBubble({
  msg,
  onCategory,
  onProductClick,
}: {
  msg:            BotMessage;
  onCategory:     (c: JewelleryCategory) => void;
  onProductClick: (p: any) => void;
}) {
  const ts = msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";

  if (msg.type === "text") {
    return (
      <div className="flex items-start gap-1.5 justify-end">
        <div className="flex flex-col items-end max-w-[78%] sm:max-w-[60%]">
          <div
            className="px-3.5 py-2"
            style={{
              background: C.bot,
              borderRadius:"3px 3px 0px 3px",
              border: `1px solid ${C.amberSoft2}`,
              color: C.textInk,
              wordBreak:"break-word",
            }}
          >
            <p className="text-[14px] leading-[19px] whitespace-pre-wrap">{msg.text}</p>
            <p className="text-[10px] text-right mt-1 -mb-0.5" style={{ color: C.textFaint, fontFamily: F.mono }}>
              {ts}
            </p>
          </div>
        </div>
        <div
          className="w-7 h-7 flex items-center justify-center shrink-0"
          style={{ background: C.ink, borderRadius: 3 }}
        >
          <Bot size={13} style={{ color: C.amber }} />
        </div>
      </div>
    );
  }

  if (msg.type === "category-menu") {
    return (
      <div className="flex items-start gap-1.5 justify-end">
        <div className="flex flex-col items-end max-w-[78%] sm:max-w-[60%]">
          <div
            className="px-3 py-2"
            style={{
              background: C.bot,
              borderRadius:"3px 3px 0px 3px",
              border: `1px solid ${C.amberSoft2}`,
            }}
          >
            <p className="text-[13px] font-semibold mb-2 text-right" style={{ color: C.textInk }}>Choose a category:</p>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {ALL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => onCategory(cat)}
                  className="text-[12px] font-semibold px-3 py-1.5 transition-all"
                  style={{
                    background:"rgba(255,255,255,0.65)",
                    color: "#95601a",
                    border:`1px solid ${C.amberSoft2}`,
                    borderRadius: 999,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.95)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.65)"; }}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-right mt-2 -mb-0.5" style={{ color: C.textFaint, fontFamily: F.mono }}>
              {ts}
            </p>
          </div>
        </div>
        <div
          className="w-7 h-7 flex items-center justify-center shrink-0"
          style={{ background: C.ink, borderRadius: 3 }}
        >
          <Bot size={13} style={{ color: C.amber }} />
        </div>
      </div>
    );
  }

  if (msg.type === "product-images") {
    return (
      <div className="flex items-start gap-1.5 justify-end">
        <div className="flex flex-col items-end max-w-[82%] sm:max-w-[62%]">
          <ProductCard msg={msg} />
          <p className="text-[10px] mt-0.5 mr-1" style={{ color: C.textFaint, fontFamily: F.mono }}>{ts}</p>
        </div>
        <div
          className="w-7 h-7 flex items-center justify-center shrink-0"
          style={{ background: C.ink, borderRadius: 3 }}
        >
          <Bot size={13} style={{ color: C.amber }} />
        </div>
      </div>
    );
  }

  if (msg.type === "product-list") {
    const prods = msg.products ?? [];
    return (
      <div className="flex items-start gap-1.5 justify-end">
        <div className="flex flex-col items-end max-w-[85%] sm:max-w-[70%]">
          <div
            className="px-2.5 py-2"
            style={{
              background: C.bot,
              borderRadius:"3px 3px 0px 3px",
              border: `1px solid ${C.amberSoft2}`,
            }}
          >
            <p className="text-[11.5px] font-semibold mb-2 px-1 text-right" style={{ color:"#8a5a1a" }}>
              {prods.length} products found · tap to open →
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {prods.slice(0, 9).map(p => {
                const imgSrc = p.image || FALLBACK_IMG;
                const price  = typeof p.price === "number" ? p.price : Number(p.price) || 0;
                return (
                  <div
                    key={String(p.id)}
                    onClick={() => onProductClick(p)}
                    className="overflow-hidden bg-gray-50 border cursor-pointer transition-all hover:scale-[1.03] hover:shadow-md active:scale-[0.97]"
                    style={{ borderColor: C.line, borderRadius: 3 }}
                  >
                    <img
                      src={imgSrc}
                      alt={p.name}
                      className="w-full h-20 object-cover"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                    />
                    <div className="p-1.5">
                      <p className="text-[10.5px] font-semibold truncate" style={{ color: C.textInk }}>{p.name}</p>
                      <p className="text-[10.5px] font-bold" style={{ color: C.accentDeep, fontFamily: F.mono }}>
                        {p.currency || "₹"}{price.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {prods.length > 9 && (
              <p className="text-[11px] mt-2 text-center" style={{ color:"#8a5a1a" }}>+{prods.length - 9} more items</p>
            )}
            <p className="text-[10px] text-right mt-2 -mb-0.5 px-1" style={{ color: C.textFaint, fontFamily: F.mono }}>
              {ts}
            </p>
          </div>
        </div>
        <div
          className="w-7 h-7 flex items-center justify-center shrink-0"
          style={{ background: C.ink, borderRadius: 3 }}
        >
          <Bot size={13} style={{ color: C.amber }} />
        </div>
      </div>
    );
  }

  if (msg.type === "content-results") {
    return (
      <div className="flex items-start gap-1.5 justify-end">
        <div className="flex flex-col items-end max-w-[86%] sm:max-w-[66%]">
          <ContentResultsCard msg={msg} />
          <p className="text-[10px] mt-0.5 mr-1" style={{ color: C.textFaint, fontFamily: F.mono }}>{ts}</p>
        </div>
        <div
          className="w-7 h-7 flex items-center justify-center shrink-0"
          style={{ background: C.ink, borderRadius: 3 }}
        >
          <Bot size={13} style={{ color: C.amber }} />
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN INBOX PAGE
// ─────────────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeId,      setActiveId]      = useState<number | null>(null);
  const [search,        setSearch]        = useState("");
  const [filter,        setFilter]        = useState("all");
  const [messages,      setMessages]      = useState<any[]>([]);
  const [text,          setText]          = useState("");
  const [sending,       setSending]       = useState(false);
  const [agents,        setAgents]        = useState<any[]>([]);
  const [templates,     setTemplates]     = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [numbers,       setNumbers]       = useState<any[]>([]);
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  // ── New conversation modal ──────────────────────────────────────────────
  const [showNewConv,   setShowNewConv]   = useState(false);

  // ── Bot engine ─────────────────────────────────────────────────────────
  const botEngine = useBotEngine();

  // ── Per-conversation bot messages (in memory + localStorage) ──────────
  const [botStates, setBotStates] = useState<Record<number, BotState>>({});

  const getBotState = useCallback((id: number): BotState => {
    if (botStates[id]) return botStates[id];
    // Hydrate from localStorage on first access
    const msgs      = loadBotMsgs(id);
    const processed = loadProcessed(id);
    return { messages: msgs, processedMsgIds: processed };
  }, [botStates]);

  const appendBotMessages = useCallback((convId: number, newMsgs: BotMessage[]) => {
    setBotStates(prev => {
      const current = prev[convId] ?? { messages: loadBotMsgs(convId), processedMsgIds: loadProcessed(convId) };
      const updated = [...current.messages, ...newMsgs];
      saveBotMsgs(convId, updated);
      return { ...prev, [convId]: { ...current, messages: updated } };
    });
  }, []);

  const markProcessed = useCallback((convId: number, msgId: string | number) => {
    setBotStates(prev => {
      const current = prev[convId] ?? { messages: loadBotMsgs(convId), processedMsgIds: loadProcessed(convId) };
      const next = new Set(current.processedMsgIds);
      next.add(msgId);
      saveProcessed(convId, next);
      return { ...prev, [convId]: { ...current, processedMsgIds: next } };
    });
  }, []);

  // ── Category button click ──────────────────────────────────────────────
  const handleCategorySelect = useCallback((cat: JewelleryCategory) => {
    if (!activeId) return;
    const products = getCatalog(cat);
    appendBotMessages(activeId, [
      makeTextMessage(`Here's our *${cat}* collection ✨ — ${products.length} pieces:`),
      makeProductList(products, "grid"),
    ]);
  }, [activeId, appendBotMessages]);

  // ── Product click from product-list card → show detailed view ──────────
  const handleProductClick = useCallback((clickedProduct: any) => {
    if (!activeId || !clickedProduct) return;
    const botProduct: any = clickedProduct._botProduct || {
      id: clickedProduct.id,
      name: clickedProduct.name,
      keywords: [clickedProduct.name?.toLowerCase() || "", clickedProduct.material?.toLowerCase() || ""],
      images: [clickedProduct.image || FALLBACK_IMG],
      price: clickedProduct.price ?? 0,
      currency: clickedProduct.currency || "₹",
      description: clickedProduct.material
        ? `${clickedProduct.material} ${(clickedProduct.category || "Jewellery")?.toLowerCase() || ""} piece`
        : "Premium curated piece",
    };
    appendBotMessages(activeId, [
      makeTextMessage(`✨ *${botProduct.name}* details & gallery:`),
      makeProductImages(botProduct),
    ]);
  }, [activeId, appendBotMessages]);

  // ── Per-conversation draft text ────────────────────────────────────────
  const saveDraft = useCallback((convId: number, val: string) => {
    try { localStorage.setItem(LS_DRAFT(convId), val); } catch {}
  }, []);

  const loadDraft = useCallback((convId: number): string => {
    try { return localStorage.getItem(LS_DRAFT(convId)) || ""; } catch { return ""; }
  }, []);

  // ── Per-conversation active bot selection ──────────────────────────────
  const [convActiveBot, setConvActiveBot] = useState<Record<number, number>>({});
  const [convBotEnabled, setConvBotEnabled] = useState<Record<number, boolean>>({});

  const loadActiveBot = useCallback((convId: number): number | null => {
    try {
      const raw = localStorage.getItem(LS_ACTIVE_BOT(convId));
      return raw ? Number(raw) : null;
    } catch { return null; }
  }, []);

  const saveActiveBot = useCallback((convId: number, botId: number) => {
    try {
      localStorage.setItem(LS_ACTIVE_BOT(convId), String(botId));
      setConvActiveBot(prev => ({ ...prev, [convId]: botId }));
    } catch {}
  }, []);

  const loadBotEnabled = useCallback((convId: number): boolean => {
    try {
      const raw = localStorage.getItem(LS_BOT_ENABLED(convId));
      if (raw === null) return true;
      return raw !== "0";
    } catch { return true; }
  }, []);

  const saveBotEnabled = useCallback((convId: number, enabled: boolean) => {
    try {
      localStorage.setItem(LS_BOT_ENABLED(convId), enabled ? "1" : "0");
      setConvBotEnabled(prev => ({ ...prev, [convId]: enabled }));
    } catch {}
  }, []);

  const getBotEnabledForConv = useCallback((convId: number): boolean => {
    if (convBotEnabled[convId] !== undefined) return convBotEnabled[convId];
    return loadBotEnabled(convId);
  }, [convBotEnabled, loadBotEnabled]);

  const getActiveBotForConv = useCallback((convId: number): BotInstance | null => {
    const published = botEngine.getPublished();
    if (published.length === 0) return null;
    const savedId = convActiveBot[convId] ?? loadActiveBot(convId);
    if (savedId) {
      const match = published.find(b => b.id === savedId);
      if (match) return match;
    }
    return published[0] ?? null;
  }, [botEngine, convActiveBot, loadActiveBot]);

  // ── WABA data loaders ─────────────────────────────────────────────────
  const loadConvs = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (filter !== "all") q.set("status", filter);
      if (search) q.set("search", search);
      setConversations((await api.get<any>(`/conversations?${q}`)).items || []);
    } catch {}
  }, [filter, search]);

  useEffect(() => {
    loadConvs();
    api.get<any>("/users").then(d => setAgents(d.items || d || [])).catch(() => {});
    api.get<any>("/templates").then(setTemplates).catch(() => {});
    api.get<any>("/waba/numbers").then(setNumbers).catch(() => {});
  }, [loadConvs]);

  const loadMsgs = useCallback(async (id: number | null) => {
    if (!id) return;
    try {
      const d    = await api.get<any>(`/messages/conversation/${id}`);
      const msgs: any[] = Array.isArray(d) ? d : [];
      setMessages(msgs);

      const botEnabled = getBotEnabledForConv(id);
      const activeBot = getActiveBotForConv(id);
      const state = getBotState(id);
      const todo  = msgs.filter(m => m.senderType === "customer" && !state.processedMsgIds.has(m.id));

      for (const m of todo) {
        markProcessed(id, m.id);
        if (!botEnabled) continue;
        let resp = null;
        if (activeBot) {
          resp = botEngine.processMessageForBot(activeBot.id, m.messageText || "");
        } else {
          resp = botEngine.processMessage(m.messageText || "");
        }
        if (resp && resp.messages.length > 0) {
          const spaced = resp.messages.map((msg, i) => ({
            ...msg,
            sentAt: Date.now() + i * 350,
          }));
          appendBotMessages(id, spaced);
        }
      }
    } catch { setMessages([]); }
  }, [getBotState, markProcessed, appendBotMessages, botEngine, getActiveBotForConv, getBotEnabledForConv]);

  // ── Select conversation ────────────────────────────────────────────────
  const select = useCallback(async (id: number) => {
    // Save draft for current convo before switching
    if (activeId) saveDraft(activeId, text);

    setActiveId(id);
    // Load draft for new convo
    setText(loadDraft(id));

    // Hydrate bot state from localStorage immediately (no flicker)
    if (!botStates[id]) {
      const msgs      = loadBotMsgs(id);
      const processed = loadProcessed(id);
      setBotStates(prev => ({ ...prev, [id]: { messages: msgs, processedMsgIds: processed } }));
    }
    // Hydrate bot enabled flag
    if (convBotEnabled[id] === undefined) {
      setConvBotEnabled(prev => ({ ...prev, [id]: loadBotEnabled(id) }));
    }

    await loadMsgs(id);
  }, [activeId, text, botStates, saveDraft, loadDraft, loadMsgs, loadBotEnabled, convBotEnabled]);

  const refreshAll = useCallback(async () => {
    await loadConvs();
    if (activeId) await loadMsgs(activeId);
  }, [activeId, loadConvs, loadMsgs]);

  useEffect(() => {
    const s = getSocket(); if (!s) return;
    const evs = ["message:new","message:status","conversation:updated","conversation:note"];
    evs.forEach(ev => s.on(ev, refreshAll));
    return () => evs.forEach(ev => s.off(ev));
  }, [refreshAll]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId, botStates]);

  // ── Send message ───────────────────────────────────────────────────────
  const sendMessage = async () => {
    if ((!text.trim() && !selectedFile) || !activeId || sending) return;
    setSending(true);
    const conv     = conversations.find(c => c.id === activeId);
    const numberId = conv?.whatsappNumberId || numbers[0]?.id;
    const userText = text.trim();

    try {
      if (selectedFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", selectedFile);
        const uploaded = await api.upload<any>("/upload", fd);
        const mediaUrl = uploaded?.url || uploaded?.path || String(uploaded);
        let mediaType: string;
        if (selectedFile.type.startsWith("image/"))      mediaType = "image";
        else if (selectedFile.type.startsWith("video/")) mediaType = "video";
        else                                              mediaType = "document";
        await api.post("/messages/media", {
          whatsappNumberId: numberId, to: conv?.contact?.mobile,
          type: mediaType, mediaUrl, caption: userText || undefined,
        });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        await api.post("/messages/send", {
          whatsappNumberId: numberId, to: conv?.contact?.mobile, text: userText,
        });
      }

      saveDraft(activeId, "");
      setText("");
      await loadMsgs(activeId);
      await loadConvs();

      if (userText && getBotEnabledForConv(activeId)) {
        const activeBot = getActiveBotForConv(activeId);
        let resp = null;
        if (activeBot) {
          resp = botEngine.processMessageForBot(activeBot.id, userText);
        } else {
          resp = botEngine.processMessage(userText);
        }
        if (resp && resp.messages.length > 0) {
          const spaced = resp.messages.map((msg, i) => ({
            ...msg,
            sentAt: Date.now() + i * 400,
          }));
          appendBotMessages(activeId, spaced);
        }
      }
    } catch (e: any) {
      const errMsg = String(e.message || '');
      const isSessionError =
        errMsg.toLowerCase().includes("session") ||
        errMsg.toLowerCase().includes("expired") ||
        errMsg.toLowerCase().includes("24-hour") ||
        errMsg.toLowerCase().includes("24 hour");

      if (isSessionError) {
        setShowTemplates(true);
        alert(
          "⚠️ 24-Hour WhatsApp Session Expired\n\nMeta rules do not allow plain text messages to recipients who haven't messaged your WhatsApp account in the last 24 hours.\n\nTo message this contact, please select an approved Template Message (such as dev_test_utility) from the template menu below."
        );
      } else {
        alert(errMsg || "Failed to send message");
      }
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const sendTemplate = async (template: any) => {
    const conv = conversations.find(c => c.id === activeId); if (!conv) return;
    try {
      const numberId = conv?.whatsappNumberId || numbers[0]?.id;
      const params   = (template.body || "").match(/{{(\d+)}}/g)
        ?.map((_: string, i: number) => `Customer ${i + 1}`) || [];
      await api.post("/messages/template", {
        whatsappNumberId: numberId,
        to: conv?.contact?.mobile,
        templateName: template.name,
        language: template.language || "en",
        parameters: params.length > 0 ? params : undefined,
      });
      setShowTemplates(false);
      await loadMsgs(activeId!);
      await loadConvs();
    } catch (e: any) { alert(e.message); }
  };

  const setStatus   = async (status: string) => {
    if (!activeId) return;
    try { await api.post(`/conversations/${activeId}/status`, { status }); await refreshAll(); }
    catch (e: any) { alert(e.message); }
  };
  const assignAgent = async (agentId: number) => {
    if (!activeId) return;
    try { await api.post(`/conversations/${activeId}/assign`, { agentId }); await refreshAll(); }
    catch (e: any) { alert(e.message); }
  };

  // ── Build time-ordered message list ───────────────────────────────────
  const active         = conversations.find(c => c.id === activeId);
  const activeBotState = activeId ? getBotState(activeId) : freshBotState();

  type DisplayItem =
    | { kind: "waba"; msg: any;       sentAt: number }
    | { kind: "bot";  msg: BotMessage; sentAt: number };

  const allDisplayMessages: DisplayItem[] = [
    ...messages.map(m => ({
      kind: "waba" as const,
      msg:  m,
      sentAt: m.createdAt ? new Date(m.createdAt).getTime() : 0,
    })),
    ...activeBotState.messages.map(m => ({
      kind: "bot" as const,
      msg:  m,
      sentAt: m.sentAt,
    })),
  ].sort((a, b) => a.sentAt - b.sentAt);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    // Inbox breaks out of the layout's scroll+padding wrapper and fills
    // the entire main area. position:absolute + inset-0 on a relative parent.
    // Each column (sidebar + chat panel) manages its own internal scroll.
    <div
      className="flex absolute inset-0 overflow-hidden"
      style={{ zIndex: 0, fontFamily: F.sans }}
    >
      <FontLoader />

      {/* signature signal rail */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] z-10"
        style={{ background: `linear-gradient(180deg, ${C.accent} 0%, ${C.amber} 100%)` }}
      />

      {/* ── Contact picker modal ── */}
      {showNewConv && (
        <ContactPickerModal
          numbers={numbers}
          onClose={() => setShowNewConv(false)}
          onConversationCreated={async (convId) => {
            setShowNewConv(false);
            await loadConvs();
            await select(convId);
          }}
        />
      )}

      {/* ── Conversation list (manifest rail) ── */}
      <div
        className="w-[336px] shrink-0 flex flex-col overflow-hidden pl-[3px]"
        style={{ background: C.ink }}
      >
        {/* ── List header ── */}
        <div
          className="flex items-center justify-between px-5 pt-5 pb-4"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: C.onDarkFaint, fontFamily: F.mono }}>WHATSAPP WIZ</p>
            <span className="text-[19px]" style={{ color: C.onDark, fontFamily: F.display, fontWeight: 600 }}>Chats</span>
          </div>
          <button
            onClick={() => setShowNewConv(true)}
            className="w-9 h-9 flex items-center justify-center transition-colors"
            style={{ background: C.accent, color: "#fff", borderRadius: 3 }}
            title="New conversation"
            onMouseEnter={e => (e.currentTarget.style.background = C.accentDeep)}
            onMouseLeave={e => (e.currentTarget.style.background = C.accent)}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* ── Search ── */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.onDarkFaint }} />
            <input
              className="w-full h-[34px] pl-8 pr-3 text-[12.5px] outline-none"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${C.inkLine}`,
                color: C.onDark,
                borderRadius: 3,
              }}
              placeholder="Search or start new chat"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.accent; }}
              onBlur={e  => { e.currentTarget.style.borderColor = C.inkLine; }}
            />
          </div>
        </div>

        {/* ── Filter pills ── */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto no-scrollbar">
          {(["all","open","pending","resolved","closed"] as const).map(s => {
            const count = s === "all" ? conversations.length : conversations.filter(c => c.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="flex items-center gap-1 px-3 py-1 text-[11.5px] font-semibold shrink-0 transition-all"
                style={filter === s
                  ? { background: C.accent, color: "#fff", borderRadius: 3 }
                  : { background: "rgba(255,255,255,0.06)", color: C.onDarkDim, borderRadius: 3 }}
              >
                <span className="capitalize">{s}</span>
                {count > 0 && (
                  <span className="text-[10px] font-bold px-1" style={{ fontFamily: F.mono, color: filter === s ? "rgba(255,255,255,0.8)" : C.onDarkFaint }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Conversation rows ── */}
        <div className="flex-1 overflow-y-auto" style={{ borderTop: `1px solid ${C.inkLine}` }}>
          {conversations.length === 0 && (
            <div className="empty-state !py-10">
              <div className="empty-icon"><MessageSquare size={18} /></div>
              <p className="empty-desc" style={{ color: C.onDarkDim }}>No conversations yet.</p>
            </div>
          )}
          {conversations.map(c => {
            const isActive = activeId === c.id;
            const unread   = c.unreadCount ?? 0;
            const lastMsg  = c.messages?.[0]?.messageText || c.contact?.mobile || "";
            const statusDot: Record<string, string> = {
              open: C.emerald, pending: C.amber, resolved: C.accent, closed: "#6b7280",
            };
            return (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className="w-full flex items-center gap-3 px-4 py-[11px] text-left transition-colors"
                style={{
                  borderBottom: `1px solid ${C.inkLine}`,
                  background:   isActive ? C.accentSoft.replace("0.12", "0.14") : "transparent",
                  borderLeft:   isActive ? `3px solid ${C.accent}` : "3px solid transparent",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Avatar with online dot */}
                <div className="relative shrink-0">
                  <div
                    className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-[13px] font-bold"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      color:  C.accentText,
                      border: `1.5px solid ${C.inkLine}`,
                      fontFamily: F.mono,
                    }}
                  >
                    {initials(c.contact?.firstName, c.contact?.lastName)}
                  </div>
                  <span
                    className="absolute bottom-0 right-0 w-3 h-3 rounded-full"
                    style={{ background: statusDot[c.status] || "#6b7280", border: `2px solid ${C.ink}` }}
                  />
                </div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-1 mb-[2px]">
                    <p className="text-[14px] font-semibold truncate" style={{ color: C.onDark }}>
                      {c.contact?.firstName} {c.contact?.lastName || ""}
                    </p>
                    <span
                      className="text-[10.5px] shrink-0 font-normal"
                      style={{ color: unread > 0 ? C.accentText : C.onDarkFaint, fontFamily: F.mono }}
                    >
                      {formatExactTimeOrDate(c.messages?.[0]?.createdAt || c.updatedAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-1">
                    <p className="text-[12.5px] truncate flex-1 leading-snug" style={{ color: C.onDarkFaint }}>
                      {lastMsg}
                    </p>
                    {unread > 0 && (
                      <span
                        className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1 shrink-0"
                        style={{ background: C.accent, fontFamily: F.mono }}
                      >
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat panel ── */}
<div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: C.paper }}>

        {/* ── Chat header — ALWAYS rendered so height never shifts ── */}
        <div
          className="px-5 flex items-center gap-3 shrink-0"
          style={{
            height:       "60px",           /* fixed, never changes */
            borderBottom: `1px solid ${C.line}`,
            background:   "#fffdf8",
          }}
        >
          {active ? (
            <>
              <div className="w-[38px] h-[38px] text-[12px] shrink-0 rounded-full flex items-center justify-center font-bold"
                style={{ background: C.accentSoft, color: C.accentDeep, border: `1.5px solid ${C.accentSoft2}`, fontFamily: F.mono }}>
                {initials(active.contact?.firstName, active.contact?.lastName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] truncate leading-tight" style={{ color: C.textInk, fontFamily: F.display, fontWeight: 600 }}>
                  {active.contact?.firstName} {active.contact?.lastName || ""}
                </p>
                <div className="flex items-center gap-2 mt-[2px] flex-wrap">
                  {(() => {
                    const publishedBots = botEngine.getPublished();
                    const curBot = activeId ? getActiveBotForConv(activeId) : null;
                    const botOn  = activeId ? getBotEnabledForConv(activeId) : true;
                    const toggle = () => { if (activeId) saveBotEnabled(activeId, !botOn); };
                    return (
                      <>
                        <p className="text-[11px]" style={{ color: C.textMuted, fontFamily: F.mono }}>{active.contact?.mobile}</p>
                        {publishedBots.length > 0 && (
                          <button
                            onClick={toggle}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 transition-all"
                            style={{
                              background: botOn ? C.amberSoft : C.roseSoft,
                              color:      botOn ? "#95601a" : "#a53434",
                              border:     `1px solid ${botOn ? C.amberSoft2 : C.roseSoft}`,
                              borderRadius: 999,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: botOn ? C.amber : C.rose }} />
                            {botOn ? (publishedBots.length === 1 ? `${curBot?.name || publishedBots[0].name}` : "Bot Active") : "Bot Paused"}
                          </button>
                        )}
                        {publishedBots.length > 1 && (
                          <select
                            value={curBot?.id || ""}
                            onChange={e => { if (activeId) saveActiveBot(activeId, Number(e.target.value)); }}
                            disabled={!botOn}
                            className="!py-0.5 !px-2 !text-[10px] font-semibold cursor-pointer disabled:opacity-40"
                            style={{ background: C.amberSoft, color: "#95601a", border: `1px solid ${C.amberSoft2}`, outline: "none", borderRadius: 999 }}
                          >
                            {publishedBots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <StatusBadge status={active.status} />
                <select
                  className="input !w-auto !py-1 !px-2 text-[11.5px] max-w-[120px] !rounded-lg"
                  value={active.assignedAgentId || ""}
                  onChange={e => assignAgent(Number(e.target.value))}
                >
                  <option value="">Unassigned</option>
                  {agents.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName || ""}</option>
                  ))}
                </select>
                <button className="btn-secondary !px-2 !py-1.5" onClick={() => setStatus("resolved")} title="Resolve">
                  <Check size={13} />
                </button>
                <button className="btn-secondary !px-2 !py-1.5" onClick={() => setStatus("closed")} title="Close">
                  <Phone size={13} />
                </button>
                <button className="btn-secondary !px-2 !py-1.5" title="More"><MoreVertical size={13} /></button>
              </div>
            </>
          ) : (
            /* placeholder — keeps header height stable when no chat is selected */
            <p className="text-[13px] font-semibold" style={{ color: C.textFaint, fontFamily: F.mono }}>WHATSAPP WIZ · INBOX</p>
          )}
        </div>

        {/* ── Body: empty state OR messages + composer ── */}
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 flex items-center justify-center" style={{ background: C.accentSoft, borderRadius: 4 }}>
              <Send size={22} style={{ color: C.accentDeep }} />
            </div>
            <p className="text-[16px]" style={{ color: C.textInk, fontFamily: F.display, fontWeight: 600 }}>Select a conversation</p>
            <p className="text-[13px]" style={{ color: C.textMuted }}>Choose a conversation to start chatting.</p>
          </div>
        ) : (
          <>
            {/* ── Messages area ── */}
            <div
              className="flex-1 overflow-y-auto py-3 px-2 sm:px-3"
              style={{
                background:      C.paper,
                display:         "flex",
                flexDirection:   "column",
                gap:             "2px",
              }}
            >
              {allDisplayMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
                  <MessageSquare size={32} />
                  <p className="text-sm">No messages yet. Say hi!</p>
                </div>
              )}

              {allDisplayMessages.map((item, idx) => {
                if (item.kind === "waba") {
                  const m    = item.msg;
                  const mine = m.senderType !== "customer";
                  return (
                    <div
                      key={`waba-${m.id ?? idx}`}
                      className={cn("flex items-end gap-1.5 px-2 mb-[1px]", mine ? "justify-end" : "justify-start")}
                    >
                      {!mine && (
                        <div
                          className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mb-0.5"
                          style={{ background: C.accentSoft, color: C.accentDeep, fontFamily: F.mono }}
                        >
                          {initials(active.contact?.firstName, active.contact?.lastName)}
                        </div>
                      )}
                      <div className="max-w-[65%] sm:max-w-[58%]">
                        <div
                          className="px-[10px] pt-[6px] pb-[4px]"
                          style={mine
                            ? { background: C.mine, borderRadius: "3px 3px 0 3px", border: `1px solid ${C.accentSoft2}`, color: C.textInk }
                            : { background: "#fff", borderRadius: "0 3px 3px 3px", border: `1px solid ${C.line}`, color: C.textInk }
                          }
                        >
                          {m.messageType !== "text" && m.messageType !== "template" && m.messageType && (
                            <p className="text-[9px] uppercase tracking-wider font-semibold flex items-center gap-1 mb-1"
                              style={{ color: mine ? C.accentDeep : "#666", fontFamily: F.mono }}>
                              {m.messageType === "image"    && <ImageIcon size={10} />}
                              {m.messageType === "video"    && <Film size={10} />}
                              {m.messageType === "document" && <FileText size={10} />}
                              {m.messageType}
                            </p>
                          )}
                          {m.messageType === "image" && m.mediaUrl && (
                            <div className="overflow-hidden mb-1 -mx-[10px] -mt-[6px]" style={{ borderRadius: "3px 3px 0 0" }}>
                              <a href={m.mediaUrl} target="_blank" rel="noreferrer">
                                <img src={m.mediaUrl} alt="img" className="w-full max-h-60 object-cover" />
                              </a>
                            </div>
                          )}
                          {m.messageType === "video" && m.mediaUrl && (
                            <div className="overflow-hidden mb-1 bg-black -mx-[10px] -mt-[6px]" style={{ borderRadius: "3px 3px 0 0" }}>
                              <video src={m.mediaUrl} controls className="w-full max-h-60 object-contain" />
                            </div>
                          )}
                          {m.messageType === "document" && m.mediaUrl && (
                            <a href={m.mediaUrl} download target="_blank" rel="noreferrer"
                              className="flex items-center gap-2 my-1 px-2 py-2"
                              style={{ background: mine ? "rgba(52,82,255,0.06)" : "rgba(20,23,29,0.04)", borderRadius: 3 }}>
                              <FileText size={18} style={{ color: C.accentDeep }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold truncate" style={{ color: C.textInk }}>{m.mediaUrl.split("/").pop()}</p>
                                <p className="text-[10px]" style={{ color: C.textFaint, fontFamily: F.mono }}>Tap to download</p>
                              </div>
                              <Download size={14} style={{ color: C.textFaint }} />
                            </a>
                          )}
                          {m.messageText && (
                            <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]" style={{ color: C.textInk }}>
                              {m.messageText}
                            </p>
                          )}
                          {/* Timestamp + tick row — floated right */}
                          <div className="flex items-center justify-end gap-[3px] mt-[2px] -mb-[2px]">
                            <span style={{ fontSize: "10.5px", color: C.textFaint, lineHeight: 1, fontFamily: F.mono }}>
                              {formatTime(m.createdAt)}
                            </span>
                            {mine && (
                              m.status === "read"
                                ? <CheckCheck size={14} style={{ color: C.accent }} />
                                : m.status === "delivered"
                                  ? <CheckCheck size={14} style={{ color: C.textFaint }} />
                                  : <Check size={14} style={{ color: C.textFaint }} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                // Bot message
                return (
                  <BotBubble
                    key={item.msg.id}
                    msg={item.msg}
                    onCategory={handleCategorySelect}
                    onProductClick={handleProductClick}
                  />
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* ── Input bar ── */}
            <div
              className="flex items-end gap-2 px-3 py-2.5 shrink-0 relative"
              style={{ background: "#fffdf8", borderTop: `1px solid ${C.line}` }}
            >
              {showTemplates && (
                <div className="absolute bottom-[64px] left-3 w-[22rem] max-h-72 overflow-y-auto z-20 p-2 animate-scale-in"
                  style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 12px 32px rgba(20,23,29,0.18)" }}>
                  <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.textFaint, fontFamily: F.mono }}>Approved templates</p>
                  {templates.filter(t => !t.status || ["approved", "active", "pending", "draft"].includes(t.status.toLowerCase())).map(t => (
                    <button key={t.id} onClick={() => sendTemplate(t)} className="w-full text-left px-3 py-2 transition-colors" style={{ borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.accentSoft)}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <div>
                        <p className="font-semibold text-[13px]" style={{ color: C.textInk }}>{t.name}</p>
                        <p className="text-[11px] truncate" style={{ color: C.textMuted }}>{t.body}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Attach / template buttons */}
              <div className="flex items-center gap-1 shrink-0 mb-[5px]">
                <button
                  className="w-[38px] h-[38px] flex items-center justify-center transition-colors"
                  style={{ color: C.textMuted, borderRadius: 3 }}
                  onClick={() => setShowTemplates(!showTemplates)}
                  title="Templates"
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(20,23,29,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <Plus size={20} />
                </button>
                <button
                  type="button"
                  className="w-[38px] h-[38px] flex items-center justify-center transition-colors"
                  style={{
                    color:      selectedFile ? "#fff" : C.textMuted,
                    background: selectedFile ? C.accent : "transparent",
                    borderRadius: 3,
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  onMouseEnter={e => { if (!selectedFile) e.currentTarget.style.background = "rgba(20,23,29,0.06)"; }}
                  onMouseLeave={e => { if (!selectedFile) e.currentTarget.style.background = "transparent"; }}
                >
                  <Paperclip size={20} />
                </button>
              </div>

              {/* Text input pill */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* File preview strip */}
                {selectedFile && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 mb-1"
                    style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 3 }}
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center shrink-0"
                      style={{
                        background: selectedFile.type.startsWith("image/") ? C.emeraldSoft
                          : selectedFile.type.startsWith("video/") ? C.accentSoft : C.amberSoft,
                        borderRadius: 3,
                      }}
                    >
                      {selectedFile.type.startsWith("image/") && <ImageIcon size={14} style={{ color: C.emerald }} />}
                      {selectedFile.type.startsWith("video/") && <Film size={14} style={{ color: C.accentDeep }} />}
                      {!selectedFile.type.startsWith("image/") && !selectedFile.type.startsWith("video/") && (
                        <FileText size={14} style={{ color: "#95601a" }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-semibold truncate" style={{ color: C.textInk }}>{selectedFile.name}</p>
                      <p className="text-[10px]" style={{ color: C.textFaint, fontFamily: F.mono }}>{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(20,23,29,0.08)" }}
                    >
                      <X size={12} style={{ color: C.textMuted }} />
                    </button>
                  </div>
                )}
                <div
                  className="flex items-center px-3.5 py-[9px]"
                  style={{ background: "#fff", minHeight: "42px", border: `1px solid ${C.line}`, borderRadius: 3 }}
                >
                  <input
                    className="flex-1 text-[14px] leading-[20px] outline-none bg-transparent"
                    style={{ color: C.textInk, caretColor: C.accent }}
                    placeholder={selectedFile ? "Add a caption…" : "Type a message"}
                    value={text}
                    onChange={e => { setText(e.target.value); if (activeId) saveDraft(activeId, e.target.value); }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  />
                </div>
              </div>

              {/* Send button */}
              <button
                className="w-[42px] h-[42px] flex items-center justify-center shrink-0 transition-all disabled:opacity-40 mb-[0px]"
                style={{
                  background: (text.trim() || selectedFile) ? C.accent : "#d8d4c8",
                  color: "#fff",
                  borderRadius: 3,
                }}
                onClick={sendMessage}
                disabled={sending || uploading || (!text.trim() && !selectedFile)}
                title="Send"
              >
                {uploading
                  ? <span className="text-xs font-bold animate-pulse">···</span>
                  : <Send size={18} style={{ transform: "translateX(1px)" }} />
                }
              </button>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}