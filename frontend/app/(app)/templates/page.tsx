"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, Send, Trash2, RefreshCw, FileText, X, ArrowLeft,
  ChevronDown, ChevronRight, Info, Smile, Bold, Italic, Strikethrough,
  Code, Link as LinkIcon, Phone, Ticket, Workflow, Check,
  Image as ImageIcon, Video, MapPin, Copy, ExternalLink,
  Layers, Search, CheckCheck, MessageSquare, Sparkles, AlertCircle
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/ui/status-badge";

/* ─────────────────────────────────────────────────────────────────────────
   CATEGORIES & SUB-CATEGORIES DATA
   ───────────────────────────────────────────────────────────────────────── */
const CATEGORIES_DATA = [
  {
    id: "MARKETING",
    name: "Marketing",
    description: "Promotions or information about your product, service or business.",
    subCategories: [
      { id: "Custom Marketing", label: "Custom Marketing", desc: "Send promotional information." },
      { id: "Carousel Marketing", label: "Carousel Marketing", desc: "Send 10 media cards." },
      { id: "Limited Time Offer", label: "Limited Time Offer-marketing", desc: "Send offer code with expiration dates." },
      { id: "Flow Marketing", label: "Flow Marketing", desc: "Send a form to capture customer interests, appointment request or runs surveys." },
      { id: "Call Permission Request", label: "Call Permission Request", desc: "Request permission to call customers." },
    ]
  },
  {
    id: "UTILITY",
    name: "Utility",
    description: "Send messages about an existing order or account.",
    subCategories: [
      { id: "Custom Utility", label: "Custom Utility", desc: "Send important updates." },
      { id: "Order Details", label: "Order Details", desc: "Send template with order details." },
      { id: "Carousel Utility", label: "Carousel Utility", desc: "Send upto 10 media cards." },
      { id: "Flow Utility", label: "Flow Utility", desc: "Send a form to capture customer interests, appointment request or runs surveys." },
      { id: "Call Permission Request", label: "Call Permission Request", desc: "Request permission to call customers." },
    ]
  },
  {
    id: "AUTHENTICATION",
    name: "Other",
    description: "Send OTP messages.",
    subCategories: [
      { id: "Authentication", label: "Authentication", desc: "Send code for verification." }
    ]
  }
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "gu", label: "Gujarati" },
  { code: "es", label: "Spanish" },
  { code: "ar", label: "Arabic" },
  { code: "pt", label: "Portuguese" },
];

/* ─────────────────────────────────────────────────────────────────────────
   MAIN PAGE COMPONENT
   ───────────────────────────────────────────────────────────────────────── */
export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");

  // Mode: "list" or "builder"
  const [mode, setMode] = useState<"list" | "builder">("list");
  // Builder Step: 1 = Basic info, 2 = Content, 3 = Buttons
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Builder Form State
  const [builderForm, setBuilderForm] = useState({
    name: "",
    language: "en",
    allowCategoryChange: "No",
    category: "MARKETING",
    subCategory: "Custom Marketing",
    headerType: "NONE" as "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION",
    headerText: "",
    headerMediaUrl: "",
    body: "",
    footer: "",
    buttons: [] as Array<{ id: string; type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COUPON"; text: string; value: string }>
  });

  // Expanded Accordion state in Step 1
  const [expandedCategory, setExpandedCategory] = useState<string>("MARKETING");

  const load = useCallback(async () => {
    try {
      setTemplates((await api.get<any[]>(`/templates${filter !== "all" ? `?status=${filter}` : ""}`)) || []);
    } catch {}
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Open Builder
  const openNewBuilder = () => {
    setBuilderForm({
      name: "",
      language: "en",
      allowCategoryChange: "No",
      category: "MARKETING",
      subCategory: "Custom Marketing",
      headerType: "NONE",
      headerText: "",
      headerMediaUrl: "",
      body: "",
      footer: "",
      buttons: []
    });
    setStep(1);
    setExpandedCategory("MARKETING");
    setMode("builder");
  };

  // Submit Template
  const handleSaveAndSubmit = async () => {
    if (!builderForm.name || !builderForm.body) {
      alert("Please fill in template name and body text!");
      return;
    }
    try {
      const payload = {
        name: builderForm.name.toLowerCase().replace(/\s+/g, "_"),
        category: builderForm.category,
        language: builderForm.language,
        header: builderForm.headerType === "TEXT" ? builderForm.headerText : builderForm.headerType !== "NONE" ? `[${builderForm.headerType}]` : "",
        body: builderForm.body,
        footer: builderForm.footer,
        buttons: builderForm.buttons
      };
      await api.post("/templates", payload);
      setMode("list");
      load();
    } catch (e: any) {
      alert(e.message || "Failed to create template");
    }
  };

  const submitExisting = async (id: number) => {
    try {
      const res: any = await api.post(`/templates/${id}/submit`);
      if (res?.warning) {
        alert(
          `Template submitted (status: pending).\n\n⚠️ Note: ${res.warning}\n\nYour template has been saved and will appear as "pending" until approved via Meta Business Manager.`
        );
      } else {
        alert("Template submitted for Meta approval! Status is now Pending.");
      }
      load();
    } catch (e: any) {
      alert(`Submission failed: ${e.message}`);
    }
  };

  const removeTemplate = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    try {
      await api.del(`/templates/${id}`);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Helper to insert variables into body
  const insertVariable = () => {
    const varCount = (builderForm.body.match(/\{\{\d+\}\}/g) || []).length + 1;
    setBuilderForm(prev => ({
      ...prev,
      body: prev.body + ` {{${varCount}}}`
    }));
  };

  // Format sample text for preview body (replace {{1}} with sample)
  const formatPreviewBody = (text: string) => {
    if (!text) return "Enter your template body text...";
    return text.replace(/\{\{(\d+)\}\}/g, (_, num) => `[Variable ${num}]`);
  };

  // Add button to step 3
  const addButton = (type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COUPON") => {
    if (type === "QUICK_REPLY" && builderForm.buttons.filter(b => b.type === "QUICK_REPLY").length >= 10) {
      alert("Maximum 10 quick reply buttons allowed");
      return;
    }
    if (type === "URL" && builderForm.buttons.filter(b => b.type === "URL").length >= 2) {
      alert("Maximum 2 URL buttons allowed");
      return;
    }
    if (type === "PHONE_NUMBER" && builderForm.buttons.filter(b => b.type === "PHONE_NUMBER").length >= 1) {
      alert("Maximum 1 Phone Number button allowed");
      return;
    }

    const newBtn = {
      id: String(Date.now()),
      type,
      text: type === "QUICK_REPLY" ? "Quick Reply" : type === "URL" ? "Visit Website" : type === "PHONE_NUMBER" ? "Call Us" : "Copy Code",
      value: type === "URL" ? "https://example.com" : type === "PHONE_NUMBER" ? "+919876543210" : type === "COUPON" ? "SAVE20" : ""
    };
    setBuilderForm(prev => ({ ...prev, buttons: [...prev.buttons, newBtn] }));
  };

  const removeButton = (id: string) => {
    setBuilderForm(prev => ({ ...prev, buttons: prev.buttons.filter(b => b.id !== id) }));
  };

  /* ─────────────────────────────────────────────────────────────────────────
     BUILDER VIEW (Multi-Step Wizard matching Screenshots)
     ───────────────────────────────────────────────────────────────────────── */
  if (mode === "builder") {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] min-h-[580px] overflow-hidden -mx-1 -mt-1">
        {/* Top Header & Stepper Bar */}
        <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3 px-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMode("list")}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: "rgba(220, 252, 231, 0.45)",
                border: "1px solid rgba(34, 197, 94, 0.28)",
                color: "var(--t1)"
              }}
            >
              <ArrowLeft size={17} />
            </button>
            <div>
              <h1 className="text-[17px] font-extrabold" style={{ color: "var(--t1)", letterSpacing: "-0.01em" }}>
                Template
              </h1>
              <p className="text-[12px]" style={{ color: "var(--t3)" }}>Create and manage your templates</p>
            </div>
          </div>

          {/* Stepper Bar */}
          <div
            className="flex items-center gap-1.5 p-1 rounded-2xl shrink-0"
            style={{
              background: "linear-gradient(145deg, rgba(220, 252, 231, 0.50) 0%, rgba(205, 248, 218, 0.30) 100%)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.70)"
            }}
          >
            {/* Step 1: Basic Info */}
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold transition-all ${
                step === 1
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                  : step > 1
                  ? "text-emerald-700 font-semibold"
                  : "text-gray-500"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-bold ${
                step === 1 ? "bg-white/20 text-white" : step > 1 ? "bg-emerald-200 text-emerald-800" : "bg-gray-200 text-gray-600"
              }`}>
                {step > 1 ? "✓" : "1"}
              </span>
              <span>Basic info</span>
            </button>

            <ChevronRight size={14} className="text-emerald-500/50" />

            {/* Step 2: Content */}
            <button
              onClick={() => { if (builderForm.name) setStep(2); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold transition-all ${
                step === 2
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                  : step > 2
                  ? "text-emerald-700 font-semibold"
                  : "text-gray-500"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-bold ${
                step === 2 ? "bg-white/20 text-white" : step > 2 ? "bg-emerald-200 text-emerald-800" : "bg-gray-200 text-gray-600"
              }`}>
                {step > 2 ? "✓" : "2"}
              </span>
              <span>Content</span>
            </button>

            <ChevronRight size={14} className="text-emerald-500/50" />

            {/* Step 3: Buttons */}
            <button
              onClick={() => { if (builderForm.name && builderForm.body) setStep(3); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold transition-all ${
                step === 3
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                  : "text-gray-500"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-bold ${
                step === 3 ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
              }`}>
                3
              </span>
              <span>Buttons</span>
            </button>
          </div>
        </div>

        {/* Main 2-Column Desktop Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          {/* Left Column: Interactive Form Steps (Cols 8) */}
          <div className="lg:col-span-8 flex flex-col h-full min-h-0 overflow-y-auto pr-1 space-y-4">

            {/* ═════════════════════════════════════════════════════════════
               STEP 1: BASIC INFO
               ═════════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <>
                {/* Top Parameters Card */}
                <div className="card-raised p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Template Name */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="label !mb-0">
                          Template name <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {builderForm.name.length}/60 characters
                        </span>
                      </div>
                      <input
                        className="input"
                        placeholder="Enter template name (e.g. order_update)"
                        maxLength={60}
                        value={builderForm.name}
                        onChange={e => setBuilderForm({ ...builderForm, name: e.target.value })}
                      />
                    </div>

                    {/* Language */}
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="label !mb-0">Language <span className="text-red-500">*</span></label>
                        <Info size={11} className="text-gray-400" />
                      </div>
                      <select
                        className="input"
                        value={builderForm.language}
                        onChange={e => setBuilderForm({ ...builderForm, language: e.target.value })}
                      >
                        {LANGUAGES.map(l => (
                          <option key={l.code} value={l.code}>{l.label} ({l.code})</option>
                        ))}
                      </select>
                    </div>

                    {/* Allow Category Change */}
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="label !mb-0">Allow category change <span className="text-red-500">*</span></label>
                        <Info size={11} className="text-gray-400" />
                      </div>
                      <select
                        className="input"
                        value={builderForm.allowCategoryChange}
                        onChange={e => setBuilderForm({ ...builderForm, allowCategoryChange: e.target.value })}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Category Accordion Card */}
                <div className="card-raised p-4 flex-1">
                  <div className="flex items-center gap-1.5 mb-3">
                    <label className="label !mb-0 font-bold text-[13px]">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <Info size={12} className="text-gray-400" />
                  </div>

                  <div className="space-y-2.5">
                    {CATEGORIES_DATA.map(cat => {
                      const isExpanded = expandedCategory === cat.id;
                      return (
                        <div
                          key={cat.id}
                          className="rounded-2xl border transition-all overflow-hidden"
                          style={{
                            background: isExpanded ? "rgba(220, 252, 231, 0.40)" : "rgba(255, 255, 255, 0.25)",
                            borderColor: isExpanded ? "rgba(34, 197, 94, 0.35)" : "rgba(34, 197, 94, 0.15)"
                          }}
                        >
                          {/* Category Header Bar */}
                          <button
                            onClick={() => setExpandedCategory(isExpanded ? "" : cat.id)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown size={16} className="text-emerald-600" /> : <ChevronRight size={16} className="text-gray-400" />}
                              <div>
                                <p className="text-[13.5px] font-bold" style={{ color: "var(--t1)" }}>{cat.name}</p>
                                <p className="text-[11.5px]" style={{ color: "var(--t3)" }}>{cat.description}</p>
                              </div>
                            </div>
                          </button>

                          {/* Category Sub-items list */}
                          {isExpanded && (
                            <div className="px-4 pb-3.5 pt-1 space-y-2 border-t border-[rgba(34,197,94,0.15)]">
                              {cat.subCategories.map(sub => {
                                const isSelected = builderForm.category === cat.id && builderForm.subCategory === sub.id;
                                return (
                                  <label
                                    key={sub.id}
                                    onClick={() => setBuilderForm({ ...builderForm, category: cat.id, subCategory: sub.id })}
                                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border"
                                    style={{
                                      background: isSelected ? "rgba(220, 252, 231, 0.70)" : "rgba(255, 255, 255, 0.40)",
                                      borderColor: isSelected ? "rgba(34, 197, 94, 0.40)" : "transparent"
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name="subCategoryRadio"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      className="mt-0.5"
                                      style={{ accentColor: "var(--gp)", width: 16, height: 16 }}
                                    />
                                    <div>
                                      <p className="text-[13px] font-bold" style={{ color: "var(--t1)" }}>{sub.label}</p>
                                      <p className="text-[11px]" style={{ color: "var(--t3)" }}>{sub.desc}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ═════════════════════════════════════════════════════════════
               STEP 2: CONTENT
               ═════════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <>
                {/* Summary bar */}
                <div className="card-raised p-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--t1)" }}>
                    Template name : <span className="font-bold text-emerald-700">{builderForm.name || "Xyz"}</span>
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {builderForm.category} · {builderForm.subCategory}
                  </span>
                </div>

                {/* Header (Optional) */}
                <div className="card-raised p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold" style={{ color: "var(--t1)" }}>Header</span>
                    <Info size={12} className="text-gray-400" />
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 uppercase">Optional</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "NONE", label: "None" },
                      { id: "TEXT", label: "Text" },
                      { id: "IMAGE", label: "Image" },
                      { id: "VIDEO", label: "Video" },
                      { id: "DOCUMENT", label: "Document" },
                      { id: "LOCATION", label: "Location" },
                    ].map(h => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setBuilderForm({ ...builderForm, headerType: h.id as any })}
                        className={`px-4 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all border ${
                          builderForm.headerType === h.id
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : "bg-white/40 text-gray-700 border-emerald-500/20 hover:bg-emerald-50"
                        }`}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>

                  {builderForm.headerType === "TEXT" && (
                    <div className="pt-2 animate-fade-in">
                      <label className="label">Header Text</label>
                      <input
                        className="input"
                        placeholder="Enter header text"
                        value={builderForm.headerText}
                        onChange={e => setBuilderForm({ ...builderForm, headerText: e.target.value })}
                      />
                    </div>
                  )}

                  {builderForm.headerType !== "NONE" && builderForm.headerType !== "TEXT" && (
                    <div className="p-3 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-50/50 text-center animate-fade-in">
                      <p className="text-[12px] font-semibold text-emerald-800">
                        {builderForm.headerType} header enabled
                      </p>
                      <p className="text-[10.5px] text-gray-500 mt-0.5">
                        Sample media will be shown in the preview window on the right.
                      </p>
                    </div>
                  )}
                </div>

                {/* Body Text */}
                <div className="card-raised p-4 space-y-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-bold" style={{ color: "var(--t1)" }}>Body text</span>
                      <Info size={12} className="text-gray-400" />
                    </div>
                    <span className="text-[10.5px] font-mono text-gray-400">
                      {builderForm.body.length} / 1024
                    </span>
                  </div>

                  <textarea
                    className="input flex-1 min-h-[140px] resize-none !text-[13px] leading-relaxed"
                    placeholder="Enter the text for your message in the language you've selected"
                    maxLength={1024}
                    value={builderForm.body}
                    onChange={e => setBuilderForm({ ...builderForm, body: e.target.value })}
                  />

                  {/* Body Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[rgba(34,197,94,0.15)]">
                    <button
                      type="button"
                      onClick={insertVariable}
                      className="btn-secondary !py-1 !px-3 !text-[11.5px] font-bold flex items-center gap-1.5"
                    >
                      <Plus size={13} /> Add variable
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Emoji"
                        onClick={() => setBuilderForm(prev => ({ ...prev, body: prev.body + " 😊" }))}
                        className="p-1.5 rounded-lg text-gray-600 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                      >
                        <Smile size={16} />
                      </button>
                      <button
                        type="button"
                        title="Bold (*text*)"
                        onClick={() => setBuilderForm(prev => ({ ...prev, body: prev.body + " *bold*" }))}
                        className="p-1.5 rounded-lg text-gray-600 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                      >
                        <Bold size={15} />
                      </button>
                      <button
                        type="button"
                        title="Italic (_text_)"
                        onClick={() => setBuilderForm(prev => ({ ...prev, body: prev.body + " _italic_" }))}
                        className="p-1.5 rounded-lg text-gray-600 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                      >
                        <Italic size={15} />
                      </button>
                      <button
                        type="button"
                        title="Strikethrough (~text~)"
                        onClick={() => setBuilderForm(prev => ({ ...prev, body: prev.body + " ~strikethrough~" }))}
                        className="p-1.5 rounded-lg text-gray-600 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                      >
                        <Strikethrough size={15} />
                      </button>
                      <button
                        type="button"
                        title="Monospace (```text```)"
                        onClick={() => setBuilderForm(prev => ({ ...prev, body: prev.body + " ```code```" }))}
                        className="p-1.5 rounded-lg text-gray-600 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                      >
                        <Code size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer (Optional) */}
                <div className="card-raised p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold" style={{ color: "var(--t1)" }}>Footer</span>
                      <Info size={12} className="text-gray-400" />
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 uppercase">Optional</span>
                    </div>
                    <span className="text-[10.5px] font-mono text-gray-400">{builderForm.footer.length} / 1024</span>
                  </div>
                  <input
                    className="input"
                    placeholder="Enter footer text (e.g. Reply STOP to unsubscribe)"
                    maxLength={1024}
                    value={builderForm.footer}
                    onChange={e => setBuilderForm({ ...builderForm, footer: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* ═════════════════════════════════════════════════════════════
               STEP 3: BUTTONS
               ═════════════════════════════════════════════════════════════ */}
            {step === 3 && (
              <>
                {/* Summary bar */}
                <div className="card-raised p-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--t1)" }}>
                    Template name : <span className="font-bold text-emerald-700">{builderForm.name || "Xyz"}</span>
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {builderForm.category}
                  </span>
                </div>

                {/* Button Selection Grid */}
                <div className="card-raised p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold" style={{ color: "var(--t1)" }}>Buttons</span>
                    <Info size={12} className="text-gray-400" />
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 uppercase">Optional</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    <button
                      type="button"
                      onClick={() => addButton("QUICK_REPLY")}
                      className="p-3 rounded-xl border border-emerald-500/20 bg-white/40 hover:bg-emerald-50 text-center transition-all flex flex-col items-center justify-center gap-1 group"
                    >
                      <Plus size={16} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                      <span className="text-[11.5px] font-bold text-gray-800">Quick reply</span>
                      <span className="text-[9.5px] text-gray-400">10 max</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => addButton("URL")}
                      className="p-3 rounded-xl border border-emerald-500/20 bg-white/40 hover:bg-emerald-50 text-center transition-all flex flex-col items-center justify-center gap-1 group"
                    >
                      <LinkIcon size={16} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                      <span className="text-[11.5px] font-bold text-gray-800">URL</span>
                      <span className="text-[9.5px] text-gray-400">2 max</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => addButton("PHONE_NUMBER")}
                      className="p-3 rounded-xl border border-emerald-500/20 bg-white/40 hover:bg-emerald-50 text-center transition-all flex flex-col items-center justify-center gap-1 group"
                    >
                      <Phone size={16} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                      <span className="text-[11.5px] font-bold text-gray-800">Phone</span>
                      <span className="text-[9.5px] text-gray-400">1 max</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => addButton("PHONE_NUMBER")}
                      className="p-3 rounded-xl border border-emerald-500/20 bg-white/40 hover:bg-emerald-50 text-center transition-all flex flex-col items-center justify-center gap-1 group"
                    >
                      <Phone size={16} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                      <span className="text-[11.5px] font-bold text-gray-800">Voice call</span>
                      <span className="text-[9.5px] text-gray-400">1 max</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => addButton("COUPON")}
                      className="p-3 rounded-xl border border-emerald-500/20 bg-white/40 hover:bg-emerald-50 text-center transition-all flex flex-col items-center justify-center gap-1 group"
                    >
                      <Ticket size={16} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                      <span className="text-[11.5px] font-bold text-gray-800">Coupon</span>
                      <span className="text-[9.5px] text-gray-400">1 max</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => addButton("QUICK_REPLY")}
                      className="p-3 rounded-xl border border-emerald-500/20 bg-white/40 hover:bg-emerald-50 text-center transition-all flex flex-col items-center justify-center gap-1 group"
                    >
                      <Workflow size={16} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                      <span className="text-[11.5px] font-bold text-gray-800">Flow</span>
                      <span className="text-[9.5px] text-gray-400">1 max</span>
                    </button>
                  </div>
                </div>

                {/* Added Buttons List */}
                <div className="card-raised p-4 space-y-3 flex-1">
                  <h4 className="text-[12.5px] font-bold text-gray-700">Configured Buttons</h4>

                  {builderForm.buttons.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-emerald-500/20 rounded-2xl bg-emerald-50/20">
                      <p className="text-[13px] font-bold text-gray-600">No buttons selected</p>
                      <p className="text-[11.5px] text-gray-400 mt-0.5">Click any button type above to attach quick replies or action buttons.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {builderForm.buttons.map(btn => (
                        <div key={btn.id} className="p-3 rounded-xl border border-emerald-500/25 bg-white/60 flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                            {btn.type === "QUICK_REPLY" && <MessageSquare size={14} />}
                            {btn.type === "URL" && <LinkIcon size={14} />}
                            {btn.type === "PHONE_NUMBER" && <Phone size={14} />}
                            {btn.type === "COUPON" && <Ticket size={14} />}
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              className="input !text-[12px] !py-1"
                              placeholder="Button Text"
                              value={btn.text}
                              onChange={e => {
                                const newText = e.target.value;
                                setBuilderForm(prev => ({
                                  ...prev,
                                  buttons: prev.buttons.map(b => b.id === btn.id ? { ...b, text: newText } : b)
                                }));
                              }}
                            />
                            {btn.type !== "QUICK_REPLY" && (
                              <input
                                className="input !text-[12px] !py-1"
                                placeholder={btn.type === "URL" ? "https://..." : btn.type === "PHONE_NUMBER" ? "+91..." : "COUPON_CODE"}
                                value={btn.value}
                                onChange={e => {
                                  const newVal = e.target.value;
                                  setBuilderForm(prev => ({
                                    ...prev,
                                    buttons: prev.buttons.map(b => b.id === btn.id ? { ...b, value: newVal } : b)
                                  }));
                                }}
                              />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeButton(btn.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

          </div>

          {/* Right Column: Interactive WhatsApp Live Mockup Preview (Cols 4) */}
          <div className="lg:col-span-4 flex flex-col h-full shrink-0">
            <div className="card-raised p-4 h-full flex flex-col items-center justify-between overflow-hidden">
              <h3 className="text-[14px] font-bold mb-2 self-start flex items-center gap-1.5" style={{ color: "var(--t1)" }}>
                <Sparkles size={15} className="text-emerald-600" /> Message preview
              </h3>

              {/* Realistic WhatsApp Phone Frame */}
              <div
                className="w-full max-w-[300px] flex-1 rounded-[28px] overflow-hidden border-[5px] border-emerald-900/40 flex flex-col shadow-2xl relative"
                style={{
                  background: "#e5ddd5",
                  backgroundImage: "radial-gradient(#000000 0.5px, transparent 0.5px)",
                  backgroundSize: "12px 12px",
                  maxHeight: "520px"
                }}
              >
                {/* Phone Notch & WhatsApp Header Bar */}
                <div className="bg-[#075e54] px-3.5 py-2.5 text-white flex items-center gap-2.5 shrink-0 shadow-md">
                  <ArrowLeft size={16} className="text-white/90" />
                  <div className="w-8 h-8 rounded-full bg-emerald-700 border border-white/30 flex items-center justify-center font-bold text-[12px] text-white shrink-0">
                    TM
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold leading-tight truncate">Talelight Media</p>
                    <p className="text-[9.5px] text-emerald-200">Business Account</p>
                  </div>
                </div>

                {/* WhatsApp Chat Area */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2 flex flex-col justify-end">
                  {/* WhatsApp Message Bubble */}
                  <div className="bg-white rounded-2xl p-3 shadow-md border border-black/5 max-w-[90%] self-start space-y-2 animate-scale-in relative">
                    {/* Optional Header Preview */}
                    {builderForm.headerType === "TEXT" && builderForm.headerText && (
                      <p className="font-extrabold text-[13px] text-gray-900 leading-tight">
                        {builderForm.headerText}
                      </p>
                    )}
                    {builderForm.headerType === "IMAGE" && (
                      <div className="w-full h-32 rounded-xl bg-emerald-100 flex items-center justify-center overflow-hidden border border-emerald-200">
                        <ImageIcon size={32} className="text-emerald-600" />
                      </div>
                    )}
                    {builderForm.headerType === "VIDEO" && (
                      <div className="w-full h-32 rounded-xl bg-emerald-950 flex items-center justify-center text-white">
                        <Video size={32} />
                      </div>
                    )}
                    {builderForm.headerType === "DOCUMENT" && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                        <FileText size={20} className="text-emerald-700" />
                        <span className="text-[11px] font-semibold text-emerald-900">Document_attachment.pdf</span>
                      </div>
                    )}
                    {builderForm.headerType === "LOCATION" && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                        <MapPin size={20} className="text-red-500" />
                        <span className="text-[11px] font-semibold text-gray-800">Shared Location</span>
                      </div>
                    )}

                    {/* Body Text */}
                    <p className="text-[12.5px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {formatPreviewBody(builderForm.body)}
                    </p>

                    {/* Footer Preview */}
                    {builderForm.footer && (
                      <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                        {builderForm.footer}
                      </p>
                    )}

                    {/* Timestamp & Read Checkmark */}
                    <div className="flex items-center justify-end gap-1 text-[9px] text-gray-400 pt-0.5">
                      <span>12:51 pm</span>
                      <CheckCheck size={11} className="text-emerald-600" />
                    </div>

                    {/* Buttons Preview */}
                    {builderForm.buttons.length > 0 && (
                      <div className="pt-1.5 space-y-1 border-t border-gray-100">
                        {builderForm.buttons.map(btn => (
                          <div
                            key={btn.id}
                            className="py-1.5 px-3 rounded-xl bg-emerald-50/90 text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-1.5 border border-emerald-200/60 hover:bg-emerald-100 transition-colors cursor-pointer"
                          >
                            {btn.type === "URL" && <ExternalLink size={11} />}
                            {btn.type === "PHONE_NUMBER" && <Phone size={11} />}
                            {btn.type === "COUPON" && <Copy size={11} />}
                            <span>{btn.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* WhatsApp Chat Input Mockup */}
                <div className="bg-gray-100 px-2 py-1.5 flex items-center gap-1.5 shrink-0 border-t border-gray-200">
                  <Smile size={16} className="text-gray-500" />
                  <div className="flex-1 bg-white rounded-full px-3 py-1 text-[10px] text-gray-400 truncate">
                    Type a message
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#128c7e] text-white flex items-center justify-center shrink-0">
                    <Send size={12} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Footer Bar */}
        <div
          className="shrink-0 mt-3 p-3 rounded-2xl flex items-center justify-between"
          style={{
            background: "linear-gradient(145deg, rgba(220, 252, 231, 0.75) 0%, rgba(205, 248, 218, 0.60) 100%)",
            border: "1px solid rgba(34, 197, 94, 0.30)",
            boxShadow: "var(--s2)"
          }}
        >
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as any)}
                className="btn-secondary !py-1.5 !px-4 text-xs"
              >
                ← Back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode("list")}
                className="btn-ghost text-red-600 text-xs font-semibold"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (!builderForm.name) {
                    alert("Please enter a template name first!");
                    return;
                  }
                  setStep((step + 1) as any);
                }}
                disabled={!builderForm.name}
                className="btn-primary !py-2 !px-6 text-xs font-bold shadow-md"
              >
                Save & Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveAndSubmit}
                disabled={!builderForm.name || !builderForm.body}
                className="btn-primary !py-2 !px-7 text-xs font-bold shadow-md bg-gradient-to-r from-emerald-600 to-green-700"
              >
                Submit Template ✓
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     TEMPLATES LIST VIEW (Management Dashboard)
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div className="tab-row">
          {["all", "approved", "pending", "rejected", "draft"].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`tab-item capitalize ${filter === s ? "active" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary flex items-center gap-1.5 text-xs font-bold"
            onClick={async () => {
              try {
                const res: any = await api.post("/templates/sync", {});
                if (res && res.success) {
                  alert(`Successfully synced ${res.count} templates from WhatsApp / Meta!`);
                  load();
                } else {
                  alert(res?.error || "Failed to sync templates");
                }
              } catch (e: any) {
                alert(e.message || "Failed to sync templates");
              }
            }}
          >
            <RefreshCw size={13} /> Sync from Meta
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-xs font-bold" onClick={openNewBuilder}>
            <Plus size={14} /> New template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {templates.map(t => (
          <div key={t.id} className="card-interactive card-raised p-4 flex flex-col gap-3">
            <div className="sheen" />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold truncate" style={{ color: "var(--t1)" }}>
                  {t.name}
                </p>
                <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: "var(--t3)" }}>
                  {t.category} · {t.language}
                </p>
              </div>
              <StatusBadge status={t.status} />
            </div>
            <div className="card-green px-3.5 py-3 text-[12px] leading-relaxed font-sans" style={{ color: "var(--t2)", minHeight: "56px" }}>
              {t.body}
            </div>
            <p className="text-[10.5px]" style={{ color: "var(--t3)" }}>
              Updated {formatDateTime(t.updatedAt)}
            </p>
            <div className="flex gap-2 mt-auto pt-1">
              {t.status === "draft" || t.status === "rejected" ? (
                <button
                  className="btn-primary !py-1.5 text-xs flex-1"
                  onClick={() => submitExisting(t.id)}
                >
                  <Send size={11} /> Submit for approval
                </button>
              ) : (
                <span className="text-[12px] flex-1 flex items-center gap-1.5 font-medium" style={{ color: "var(--t3)" }}>
                  {t.status === "pending" && <><RefreshCw size={11} className="animate-spin" /> Reviewing…</>}
                  {t.status === "approved" && <span style={{ color: "var(--gp)" }}>✓ Ready to use</span>}
                </span>
              )}
              {(t.status === "draft" || t.status === "rejected") && (
                <button
                  className="btn-icon"
                  style={{ color: "#dc2626" }}
                  onClick={() => removeTemplate(t.id)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full">
            <div className="empty-state">
              <div className="empty-icon"><FileText size={22} /></div>
              <p className="empty-title">No templates found</p>
              <p className="empty-desc">Click &quot;New template&quot; to build your WhatsApp message templates.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
