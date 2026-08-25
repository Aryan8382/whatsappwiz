"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus, Play, Pause, BarChart3, Trash2, X, RotateCcw,
  ArrowLeft, ArrowRight, Search, Check, Info, Calendar,
  Users, Users as UsersIcon, Send, Sparkles, CheckCheck, FileText,
  Clock, Shield, Settings, SlidersHorizontal, RefreshCw, AlertCircle, Radio, MoreVertical, Cloud
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/ui/status-badge";
import ModalPortal from "@/components/ui/modal-portal";
import CreateSegmentModal from "@/components/segments/create-segment-modal";
import { getSocket } from "@/lib/socket";

/* ─────────────────────────────────────────────────────────────────────────
   MAIN CAMPAIGNS / BROADCAST PAGE
   ───────────────────────────────────────────────────────────────────────── */
export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTemplateId = searchParams.get("templateId");

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  // Workflow Mode: "list" | "wizard"
  const [mode, setMode] = useState<"list" | "wizard">("list");
  // Wizard Step: 1 = Select template, 2 = Choose segment, 3 = Map template variables, 4 = Schedule broadcast
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Wizard Selections
  const [searchTemplate, setSearchTemplate] = useState("");
  const [searchSegment, setSearchSegment] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<number[]>([]);
  const [showCreateSegment, setShowCreateSegment] = useState(false);

  // Step 3: Variables Mapping e.g. { "1": "firstName", "2": "HEALTH" }
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});

  // Step 4: Broadcast Settings
  const [broadcastName, setBroadcastName] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [ratePerMinute, setRatePerMinute] = useState(60);

  const [totalContactsCount, setTotalContactsCount] = useState<number>(0);
  const [showTestModal, setShowTestModal] = useState(false);

  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [selectedPhoneNumbers, setSelectedPhoneNumbers] = useState<string[]>([]);

  // Load Campaigns & Templates & Tags/Segments from Backend
  const load = useCallback(async () => {
    try {
      setCampaigns((await api.get<any[]>("/campaigns")) || []);
    } catch {}
  }, []);

  const loadTemplatesAndSegments = useCallback(async () => {
    try {
      const tmpl = await api.get<any[]>("/templates");
      setTemplates(tmpl || []);

      // Fetch Total Contacts Count
      const contactsRes = await api.get<any>("/contacts?limit=1").catch(() => null);
      if (contactsRes && typeof contactsRes.total === "number") {
        setTotalContactsCount(contactsRes.total);
      }

      // Check if arriving from Contacts page with specific selected contacts
      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem("wiz_broadcast_contacts");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const ids = parsed.map((c: any) => Number(c.id)).filter(Boolean);
              const mobiles = parsed.map((c: any) => String(c.mobile || c.phone || "")).filter(Boolean);
              setSelectedContactIds(ids);
              setSelectedPhoneNumbers(mobiles);
              setMode("wizard");
              setStep(1);
            }
          } catch {}
          sessionStorage.removeItem("wiz_broadcast_contacts");
        }
      }

      // If initialTemplateId query param present, auto-open wizard with that template!
      if (initialTemplateId && tmpl) {
        const found = tmpl.find(t => String(t.id) === String(initialTemplateId));
        if (found) {
          setSelectedTemplate(found);
          setMode("wizard");
          setStep(2);
        }
      }

      // Fetch Segments & Tags dynamically from Backend API
      const [segs, tags] = await Promise.all([
        api.get<any[]>("/segments").catch(() => []),
        api.get<any[]>("/contacts/tags").catch(() => []),
      ]);

      const combined: any[] = [];
      if (Array.isArray(segs)) {
        segs.forEach(s => {
          combined.push({
            id: s.id,
            name: s.name,
            contactCount: s.contactCount !== undefined ? s.contactCount : 0,
            createdBy: s.createdBy || "Talelight Media",
            createdAt: s.createdAt || new Date().toISOString(),
            isSegment: true
          });
        });
      }

      if (Array.isArray(tags)) {
        tags.forEach(t => {
          if (!combined.some(c => c.name === t.name)) {
            combined.push({
              id: t.id,
              name: t.name,
              contactCount: t.contactCount || 0,
              createdBy: "Talelight Media",
              createdAt: t.createdAt || new Date().toISOString(),
              isTag: true
            });
          }
        });
      }

      setSegments(combined);
    } catch {}
  }, [initialTemplateId]);

  useEffect(() => {
    load();
    loadTemplatesAndSegments();

    // Auto-refresh polling every 2.5s for instant live status & count updates
    const timer = setInterval(() => {
      load();
    }, 2500);

    // Socket.IO real-time event listener
    const s = getSocket();
    if (s) {
      const handleCampaignUpdated = (updated: any) => {
        setCampaigns((prev) =>
          prev.map((c) => (String(c.id) === String(updated.id) ? { ...c, ...updated } : c))
        );
        load();
      };
      s.on("campaign:updated", handleCampaignUpdated);
      return () => {
        clearInterval(timer);
        s.off("campaign:updated", handleCampaignUpdated);
      };
    }

    return () => {
      clearInterval(timer);
    };
  }, [load, loadTemplatesAndSegments]);

  // Open Wizard
  const openWizard = () => {
    setSelectedTemplate(null);
    setSelectedSegmentIds([]);
    setVariableMappings({});
    const now = new Date();
    setBroadcastName(`Broadcast ${now.toISOString().replace("T", " ").substring(0, 19)}`);
    setStep(1);
    setMode("wizard");
  };

  // Extract variables like {{1}}, {{2}} from template body
  const getTemplateVariables = (bodyText: string) => {
    if (!bodyText) return [];
    const matches = bodyText.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    const unique = Array.from(new Set(matches));
    return unique.map(m => m.replace(/[\{\}]/g, ""));
  };

  // Format preview body replacing {{1}} with mapped value or default
  const getMappedPreviewBody = () => {
    if (!selectedTemplate) return "";
    let text = selectedTemplate.body || "";
    Object.keys(variableMappings).forEach(vKey => {
      const val = variableMappings[vKey] || `{{${vKey}}}`;
      text = text.replace(new RegExp(`\\{\\{${vKey}\\}\\}`, "g"), val);
    });
    return text;
  };

  // Target Audience Count Computation
  const targetAudienceCount = useMemo(() => {
    if (selectedSegmentIds.length === 0) return totalContactsCount;
    return segments
      .filter(s => selectedSegmentIds.includes(s.id))
      .reduce((acc, s) => acc + (Number(s.contactCount) || 0), 0);
  }, [selectedSegmentIds, segments, totalContactsCount]);

  // Handle Select Template Card Click
  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    // Initialize variable mappings
    const vars = getTemplateVariables(template.body || "");
    const initialMap: Record<string, string> = {};
    vars.forEach(v => { initialMap[v] = `test`; });
    setVariableMappings(initialMap);

    const now = new Date();
    setBroadcastName(`Broadcast ${now.toISOString().replace("T", " ").substring(0, 19)}`);

    setStep(2);
  };

  // Submit Final Broadcast Campaign to Backend
  const handleFinalBroadcast = async () => {
    if (!selectedTemplate) {
      alert("Please select a template!");
      return;
    }
    try {
      const actualSegmentIds = segments
        .filter(s => selectedSegmentIds.includes(s.id) && s.isSegment)
        .map(s => s.id);
      const actualTagIds = segments
        .filter(s => selectedSegmentIds.includes(s.id) && s.isTag)
        .map(s => s.id);

      const payload = {
        name: broadcastName || `Broadcast ${selectedTemplate.name}`,
        templateId: selectedTemplate.id,
        segmentIds: actualSegmentIds.length > 0 ? actualSegmentIds : undefined,
        tagIds: actualTagIds.length > 0 ? actualTagIds : undefined,
        contactIds: selectedContactIds.length > 0 ? selectedContactIds : undefined,
        phoneNumbers: selectedPhoneNumbers.length > 0 ? selectedPhoneNumbers : undefined,
        ratePerMinute: ratePerMinute,
        scheduledAt: isScheduled && scheduledAt ? scheduledAt : undefined
      };
      const created = await api.post<any>("/campaigns", payload);
      // Immediately start campaign if not scheduled
      if (!isScheduled && created && created.id) {
        try {
          await api.post(`/campaigns/${created.id}/start`);
        } catch (startErr: any) {
          alert(`Broadcast created, but failed to start: ${startErr.message}`);
        }
      }
      setMode("list");
      load();
    } catch (e: any) {
      alert(e.message || "Failed to create broadcast");
    }
  };

  // Campaign Actions (start, pause, resume, delete)
  const act = async (id: number, action: "start" | "pause" | "resume" | "remove") => {
    if (action === "remove" && !confirm("Delete this broadcast?")) return;
    try {
      if (action === "remove") await api.del(`/campaigns/${id}`);
      else await api.post(`/campaigns/${id}/${action}`);
      load();
      if (action === "start") showFor(id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const showFor = async (id: number) => {
    try {
      setAnalytics(await api.get(`/campaigns/${id}/analytics`));
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Filter templates for selection grid (shows all templates with live Meta status)
  const approvedTemplates = templates.filter(t => {
    const matchesSearch = !searchTemplate || t.name.toLowerCase().includes(searchTemplate.toLowerCase()) || (t.category || "").toLowerCase().includes(searchTemplate.toLowerCase());
    return matchesSearch;
  });

  // Calculate total audience contact count
  const selectedSegmentsTotalContacts = segments
    .filter(s => selectedSegmentIds.includes(s.id))
    .reduce((acc, s) => acc + (s.contactCount || 1), 0);

  /* ─────────────────────────────────────────────────────────────────────────
     WIZARD WORKFLOW VIEW (4-Step Broadcast Builder)
     ───────────────────────────────────────────────────────────────────────── */
  if (mode === "wizard") {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] min-h-[580px] overflow-hidden -mx-1 -mt-1">
        {/* Top Title & Stepper Bar */}
        <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3 px-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (step > 1) setStep((step - 1) as any);
                else setMode("list");
              }}
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
                {step === 1 && "Broadcast - Please select the broadcast template."}
                {step === 2 && "Select template"}
                {step === 3 && "Broadcast - Map your value with a template and complete the template."}
                {step === 4 && "Broadcast - Broadcast your message to your target audience."}
              </h1>
              <p className="text-[12px]" style={{ color: "var(--t3)" }}>Create & launch WhatsApp broadcasts</p>
            </div>
          </div>

          {/* Stepper Navigation Bar */}
          <div
            className="flex items-center gap-1.5 p-1 rounded-2xl shrink-0"
            style={{
              background: "linear-gradient(145deg, rgba(220, 252, 231, 0.50) 0%, rgba(205, 248, 218, 0.30) 100%)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.70)"
            }}
          >
            {/* Step 1: Select template */}
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
                step === 1
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                  : step > 1
                  ? "bg-emerald-600 text-white"
                  : "text-gray-500"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
              <span>Select template</span>
            </button>

            {/* Step 2: Choose segment */}
            <button
              onClick={() => { if (selectedTemplate) setStep(2); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
                step === 2
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                  : step > 2
                  ? "bg-emerald-600 text-white"
                  : "text-gray-500"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
              <span>Choose segment</span>
            </button>

            {/* Step 3: Map template variables */}
            <button
              onClick={() => { if (selectedTemplate && selectedSegmentIds.length > 0) setStep(3); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
                step === 3
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                  : step > 3
                  ? "bg-emerald-600 text-white"
                  : "text-gray-500"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
              <span>Map template variables</span>
            </button>

            {/* Step 4: Schedule broadcast */}
            <button
              onClick={() => { if (selectedTemplate && selectedSegmentIds.length > 0) setStep(4); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
                step === 4
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                  : "text-gray-500"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">4</span>
              <span>Schedule broadcast</span>
            </button>
          </div>
        </div>

        {/* Selected Template Bar (Steps 2, 3, 4) */}
        {step > 1 && selectedTemplate && (
          <div className="shrink-0 mb-3 p-3 rounded-2xl card-raised flex items-center justify-between">
            <span className="text-[13px] font-bold" style={{ color: "var(--t1)" }}>
              Selected template name : <span className="text-emerald-700 font-extrabold">{selectedTemplate.name}</span>
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              {selectedTemplate.category}
            </span>
          </div>
        )}

        {/* STEP 1: SELECT TEMPLATE GRID */}
        {step === 1 && (
          <div className="flex-1 min-h-0 flex flex-col space-y-3.5 overflow-hidden">
            {/* Header Search & New Template button */}
            <div className="card-raised p-3 flex items-center justify-between gap-3">
              <div className="search-wrap flex-1 max-w-sm">
                <Search size={13} className="search-icon" />
                <input
                  className="search-input !h-[34px] !text-[12.5px]"
                  placeholder="Search template"
                  value={searchTemplate}
                  onChange={e => setSearchTemplate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res: any = await api.post("/templates/sync", {});
                      if (res && res.success) {
                        alert(`Synced ${res.count} templates from WhatsApp / Meta!`);
                        loadTemplatesAndSegments();
                      } else {
                        alert(res?.error || "Sync failed");
                      }
                    } catch (e: any) {
                      alert(e.message || "Failed to sync templates");
                    }
                  }}
                  className="btn-secondary !py-2 !px-3.5 text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCw size={13} /> Sync from Meta
                </button>
                <button
                  onClick={() => router.push("/templates")}
                  className="btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus size={14} /> New template message
                </button>
              </div>
            </div>

            {/* Template Cards Grid with HOVER GLASS OVERLAY + SELECT BUTTON */}
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {approvedTemplates.map(t => (
                <div
                  key={t.id}
                  className="group relative overflow-hidden rounded-2xl border border-[rgba(34,197,94,0.22)] bg-gradient-to-b from-[rgba(220,252,231,0.50)] to-[rgba(205,248,218,0.30)] backdrop-blur-md transition-all duration-300 hover:shadow-2xl hover:border-emerald-500/50 flex flex-col justify-between"
                  style={{ minHeight: "260px" }}
                >
                  {/* Card Top Header */}
                  <div className="p-3 bg-gradient-to-r from-emerald-900 to-emerald-950 text-white flex items-center justify-between gap-1.5 shrink-0">
                    <span className="text-[12px] font-extrabold truncate" title={t.name}>
                      {t.name} ({(t.language || "en").toUpperCase()})
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {(() => {
                        const st = (t.status || "approved").toLowerCase();
                        let badgeStyle = "bg-emerald-500/30 text-emerald-200 border-emerald-400/40";
                        if (st === "pending") badgeStyle = "bg-amber-500/30 text-amber-200 border-amber-400/40";
                        else if (st === "rejected") badgeStyle = "bg-red-500/30 text-red-200 border-red-400/40";
                        else if (st === "draft") badgeStyle = "bg-gray-500/30 text-gray-200 border-gray-400/40";
                        return (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeStyle}`}>
                            {st.toUpperCase()}
                          </span>
                        );
                      })()}
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/90">
                        {t.category}
                      </span>
                    </div>
                  </div>

                  {/* Card Body Preview Snippet */}
                  <div className="p-3.5 flex-1 text-[12px] leading-relaxed text-gray-800 overflow-hidden font-sans">
                    {t.header && <p className="font-bold text-[12.5px] mb-1 text-gray-900">{t.header}</p>}
                    <p className="line-clamp-6 whitespace-pre-wrap">{t.body}</p>
                  </div>

                  {/* Card Footer Date */}
                  <div className="p-2.5 px-3 bg-white/30 border-t border-[rgba(34,197,94,0.15)] flex items-center justify-end text-[10px] text-gray-500 shrink-0">
                    <span>{formatDateTime(t.updatedAt || t.createdAt)}</span>
                  </div>

                  {/* 🌟 HOVER OVERLAY WITH CENTERED SELECT BUTTON 🌟 */}
                  <div className="absolute inset-0 bg-emerald-950/45 backdrop-blur-[6px] opacity-0 group-hover:opacity-100 transition-all duration-250 flex items-center justify-center z-10 p-4">
                    <button
                      onClick={() => handleSelectTemplate(t)}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-extrabold text-[13.5px] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-white/30"
                    >
                      <span>Select</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              ))}

              {approvedTemplates.length === 0 && (
                <div className="col-span-full p-12 text-center border border-dashed border-emerald-500/25 rounded-2xl bg-white/40">
                  <FileText size={28} className="mx-auto text-emerald-600 mb-2" />
                  <p className="text-[14px] font-bold text-gray-700">No approved templates found</p>
                  <p className="text-[12px] text-gray-400 mt-1">Create a new template message to start your broadcast.</p>
                  <button
                    onClick={() => router.push("/templates")}
                    className="btn-primary mt-4 text-xs font-bold"
                  >
                    + Create Template
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: CHOOSE SEGMENT TABLE */}
        {step === 2 && (
          <div className="flex-1 min-h-0 flex flex-col space-y-3.5 overflow-hidden">
            <div className="card-raised p-4 flex-1 flex flex-col min-h-0 justify-between">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
                  <h3 className="text-[14px] font-bold" style={{ color: "var(--t1)" }}>Pick from segments</h3>
                  <div className="flex items-center gap-2">
                    <div className="search-wrap max-w-xs">
                      <Search size={13} className="search-icon" />
                      <input
                        className="search-input !h-[32px] !text-[12px]"
                        placeholder="Search segment"
                        value={searchSegment}
                        onChange={e => setSearchSegment(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => setShowCreateSegment(true)}
                      className="btn-primary !py-1.5 !px-3 text-xs font-bold flex items-center gap-1"
                    >
                      <Plus size={13} /> Add segment
                    </button>
                  </div>
                </div>

                {/* Segments Table */}
                <div className="flex-1 overflow-y-auto border border-[rgba(34,197,94,0.18)] rounded-xl bg-white/40">
                  <table className="w-full text-left">
                    <thead className="bg-emerald-100/60 sticky top-0 z-10 border-b border-[rgba(34,197,94,0.20)]">
                      <tr>
                        <th className="th" style={{ width: 40 }}></th>
                        <th className="th" style={{ width: 60 }}>Sr.no</th>
                        <th className="th">Segment name</th>
                        <th className="th">Total contacts</th>
                        <th className="th">Created by</th>
                        <th className="th">Created at</th>
                        <th className="th" style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {segments
                        .filter(s => !searchSegment || s.name.toLowerCase().includes(searchSegment.toLowerCase()))
                        .map((seg, idx) => {
                          const isChecked = selectedSegmentIds.includes(seg.id);
                          return (
                            <tr
                              key={seg.id}
                              onClick={() => {
                                if (isChecked) setSelectedSegmentIds(selectedSegmentIds.filter(id => id !== seg.id));
                                else setSelectedSegmentIds([...selectedSegmentIds, seg.id]);
                              }}
                              className={`cursor-pointer transition-colors ${isChecked ? "bg-emerald-100/40 font-semibold" : "hover:bg-emerald-50/40"}`}
                            >
                              <td className="td text-center" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) setSelectedSegmentIds(selectedSegmentIds.filter(id => id !== seg.id));
                                    else setSelectedSegmentIds([...selectedSegmentIds, seg.id]);
                                  }}
                                  style={{ accentColor: "var(--gp)", width: 16, height: 16 }}
                                />
                              </td>
                              <td className="td text-[12px] text-gray-500">{idx + 1}</td>
                              <td className="td text-[13px] font-bold text-gray-900">{seg.name}</td>
                              <td className="td text-[12px]">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    alert(`Segment "${seg.name}" contains ${seg.contactCount || 1} contact(s).`);
                                  }}
                                  className="text-gray-800 font-bold hover:text-emerald-700 underline decoration-dotted text-[12px]"
                                >
                                  View count {seg.contactCount !== undefined ? `(${seg.contactCount})` : ""}
                                </button>
                              </td>
                              <td className="td text-[12px] text-gray-600">{seg.createdBy || "Talelight Media"}</td>
                              <td className="td text-[12px] text-gray-500">{formatDateTime(seg.createdAt)}</td>
                              <td className="td text-center" onClick={e => e.stopPropagation()}>
                                <button type="button" className="p-1 rounded hover:bg-gray-200/60 text-gray-500">
                                  <MoreVertical size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Showing results counter */}
                <div className="pt-2 text-[11px] text-gray-400 font-medium">
                  Showing 1 to {segments.filter(s => !searchSegment || s.name.toLowerCase().includes(searchSegment.toLowerCase())).length} of {segments.length} results
                </div>
              </div>

              {/* Table Footer Bar */}
              <div className="pt-3 border-t border-emerald-500/15 flex items-center justify-between text-[11.5px] text-gray-500 shrink-0 mt-2">
                <span>These segments update dynamically based on the applied filters. Click &apos;View count&apos; to check the number of contacts.</span>
                <span className="font-bold text-emerald-800">
                  {selectedSegmentIds.length} Segment{selectedSegmentIds.length !== 1 ? "s" : ""} selected
                </span>
              </div>
              {/* Create Segment Modal */}
              <CreateSegmentModal
                isOpen={showCreateSegment}
                onClose={() => setShowCreateSegment(false)}
                onSuccess={(segment) => {
                  setShowCreateSegment(false);
                  loadTemplatesAndSegments();
                }}
              />
            </div>
          </div>
        )}

        {/* STEP 3: MAP TEMPLATE VARIABLES (2-COLUMN LAYOUT WITH LIVE PREVIEW) */}
        {step === 3 && selectedTemplate && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
            {/* Left Column: Variable Mappings */}
            <div className="lg:col-span-8 flex flex-col h-full min-h-0 overflow-y-auto pr-1 space-y-4">
              <div className="card-raised p-4 space-y-3 flex-1">
                <h3 className="text-[14px] font-bold" style={{ color: "var(--t1)" }}>Map template variables</h3>
                <p className="text-[12px] text-gray-500">Set dynamic values or attributes for each body variable.</p>

                {getTemplateVariables(selectedTemplate.body || "").length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-emerald-500/20 rounded-2xl bg-emerald-50/20">
                    <p className="text-[13px] font-bold text-gray-700">No variables found in this template</p>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">Click &quot;Continue&quot; to proceed to scheduling.</p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    {getTemplateVariables(selectedTemplate.body || "").map(varKey => (
                      <div key={varKey} className="p-3.5 rounded-xl border border-emerald-500/20 bg-white/50 space-y-1.5">
                        <label className="label text-[12.5px]">
                          Body variable <span className="font-mono text-emerald-700">{`{{${varKey}}}`}</span> <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            className="input flex-1"
                            placeholder="Enter test value or custom fallback"
                            value={variableMappings[varKey] || ""}
                            onChange={e => setVariableMappings({ ...variableMappings, [varKey]: e.target.value })}
                          />
                          <select className="input shrink-0" style={{ width: 180 }}>
                            <option value="">Dynamic database value</option>
                            <option value="firstName">Contact First Name</option>
                            <option value="lastName">Contact Last Name</option>
                            <option value="mobile">Contact Mobile Number</option>
                            <option value="city">Contact City</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live WhatsApp Message Preview */}
            <div className="lg:col-span-4 flex flex-col h-full shrink-0">
              <div className="card-raised p-4 h-full flex flex-col items-center justify-between overflow-hidden">
                <h3 className="text-[14px] font-bold mb-2 self-start flex items-center gap-1.5" style={{ color: "var(--t1)" }}>
                  <Sparkles size={15} className="text-emerald-600" /> Message preview
                </h3>

                {/* WhatsApp Phone Mockup Frame */}
                <div
                  className="w-full max-w-[300px] flex-1 rounded-[28px] overflow-hidden border-[5px] border-emerald-900/40 flex flex-col shadow-2xl relative"
                  style={{
                    background: "#e5ddd5",
                    backgroundImage: "radial-gradient(#000000 0.5px, transparent 0.5px)",
                    backgroundSize: "12px 12px",
                    maxHeight: "520px"
                  }}
                >
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

                  <div className="flex-1 p-3 overflow-y-auto space-y-2 flex flex-col justify-end">
                    <div className="bg-white rounded-2xl p-3 shadow-md border border-black/5 max-w-[90%] self-start space-y-2 relative">
                      {selectedTemplate.header && (
                        <p className="font-extrabold text-[13px] text-gray-900 leading-tight">{selectedTemplate.header}</p>
                      )}
                      <p className="text-[12.5px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {getMappedPreviewBody()}
                      </p>
                      {selectedTemplate.footer && (
                        <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">{selectedTemplate.footer}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 text-[9px] text-gray-400 pt-0.5">
                        <span>01:02 pm</span>
                        <CheckCheck size={11} className="text-emerald-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-100 px-2 py-1.5 flex items-center gap-1.5 shrink-0 border-t border-gray-200">
                    <div className="flex-1 bg-white rounded-full px-3 py-1 text-[10px] text-gray-400 truncate">
                      Message
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#128c7e] text-white flex items-center justify-center shrink-0">
                      <Send size={12} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SCHEDULE BROADCAST (FINAL STEP WITH COMPACT SIDE-BY-SIDE LAYOUT) */}
        {step === 4 && selectedTemplate && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5 overflow-hidden">
            {/* Left Column: Broadcast Settings (Combined compact card) */}
            <div className="lg:col-span-8 flex flex-col min-h-0 overflow-y-auto pr-1">
              <div className="card-raised p-4 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Broadcast Name & Schedule Row */}
                  <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-white/40 space-y-3">
                    <h4 className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: "var(--t1)" }}>
                      <Radio size={15} className="text-emerald-600" /> Broadcast Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-7">
                        <label className="label text-[12px] font-bold">Broadcast Name</label>
                        <input
                          className="input !h-[36px] !text-[12.5px]"
                          placeholder="Enter broadcast name"
                          value={broadcastName}
                          onChange={e => setBroadcastName(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-5 flex items-center h-[36px] px-2.5">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-[12.5px]" style={{ color: "var(--t1)" }}>
                          <input
                            type="checkbox"
                            checked={isScheduled}
                            onChange={e => setIsScheduled(e.target.checked)}
                            style={{ accentColor: "var(--gp)", width: 16, height: 16 }}
                          />
                          Schedule for Later
                        </label>
                      </div>
                    </div>

                    {isScheduled && (
                      <div className="pt-2 border-t border-emerald-500/15 animate-fade-in">
                        <label className="label text-[12px] font-bold">Schedule Date & Time</label>
                        <input
                          type="datetime-local"
                          className="input !h-[36px] !text-[12.5px]"
                          value={scheduledAt}
                          onChange={e => setScheduledAt(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Target Audience & Delivery Settings Side-by-Side Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Target Audience Summary Box */}
                    <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-white/40 space-y-2.5 flex flex-col justify-between">
                      <div>
                        <h4 className="text-[12.5px] font-bold flex items-center gap-1.5" style={{ color: "var(--t1)" }}>
                          <Users size={14} className="text-emerald-600" /> Target Audience
                        </h4>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-gray-600 font-semibold">Total Contacts</span>
                            <span className="font-extrabold text-emerald-800 text-[13px] px-2 py-0.5 rounded bg-emerald-100/80">
                              {targetAudienceCount}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-gray-600 font-semibold">Segments</span>
                            <div className="flex flex-wrap gap-1 max-w-[160px] justify-end">
                              {selectedSegmentIds.length === 0 ? (
                                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300/50">
                                  All Contacts
                                </span>
                              ) : (
                                segments
                                  .filter(s => selectedSegmentIds.includes(s.id))
                                  .map(s => (
                                    <span key={s.id} className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300/50">
                                      {s.name}
                                    </span>
                                  ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Delivery & Retry Settings Box */}
                    <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-white/40 space-y-2.5 flex flex-col justify-between">
                      <div>
                        <h4 className="text-[12.5px] font-bold flex items-center gap-1.5" style={{ color: "var(--t1)" }}>
                          <Clock size={14} className="text-emerald-600" /> Retry & Rate Control
                        </h4>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-gray-600 font-semibold">Failed Retries</span>
                            <button type="button" className="btn-secondary !py-0.5 !px-2.5 text-[11px] font-bold flex items-center gap-1">
                              + Add retry
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-gray-600 font-semibold">Rate Limit</span>
                            <span className="text-[11px] font-bold text-gray-700">60 msgs / min</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11.5px] text-emerald-900 flex items-center gap-2">
                  <Sparkles size={14} className="text-emerald-600 shrink-0" />
                  <span>Ready to broadcast! Check your message preview on the right before launching.</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live WhatsApp Message Preview */}
            <div className="lg:col-span-4 flex flex-col h-full shrink-0">
              <div className="card-raised p-3.5 h-full flex flex-col items-center justify-between overflow-hidden">
                <h3 className="text-[13.5px] font-bold mb-2 self-start flex items-center gap-1.5" style={{ color: "var(--t1)" }}>
                  <Sparkles size={14} className="text-emerald-600" /> Message preview
                </h3>

                <div
                  className="w-full max-w-[290px] flex-1 rounded-[24px] overflow-hidden border-[4px] border-emerald-900/40 flex flex-col shadow-xl relative"
                  style={{
                    background: "#e5ddd5",
                    backgroundImage: "radial-gradient(#000000 0.5px, transparent 0.5px)",
                    backgroundSize: "12px 12px",
                    maxHeight: "420px"
                  }}
                >
                  <div className="bg-[#075e54] px-3 py-2 text-white flex items-center gap-2 shrink-0 shadow-md">
                    <ArrowLeft size={15} className="text-white/90" />
                    <div className="w-7 h-7 rounded-full bg-emerald-700 border border-white/30 flex items-center justify-center font-bold text-[11px] text-white shrink-0">
                      TM
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold leading-tight truncate">Talelight Media</p>
                      <p className="text-[9px] text-emerald-200">Business Account</p>
                    </div>
                  </div>

                  <div className="flex-1 p-2.5 overflow-y-auto space-y-2 flex flex-col justify-end">
                    <div className="bg-white rounded-2xl p-2.5 shadow-md border border-black/5 max-w-[92%] self-start space-y-1.5 relative">
                      {selectedTemplate.header && (
                        <p className="font-extrabold text-[12.5px] text-gray-900 leading-tight">{selectedTemplate.header}</p>
                      )}
                      <p className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {getMappedPreviewBody()}
                      </p>
                      {selectedTemplate.footer && (
                        <p className="text-[9.5px] text-gray-400 pt-1 border-t border-gray-100">{selectedTemplate.footer}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 text-[8.5px] text-gray-400 pt-0.5">
                        <span>01:03 pm</span>
                        <CheckCheck size={10} className="text-emerald-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-100 px-2 py-1 flex items-center gap-1.5 shrink-0 border-t border-gray-200">
                    <div className="flex-1 bg-white rounded-full px-2.5 py-1 text-[9.5px] text-gray-400 truncate">
                      Message
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#128c7e] text-white flex items-center justify-center shrink-0">
                      <Send size={11} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM ACTION FOOTER BAR */}
        <div
          className="shrink-0 mt-3 p-3 rounded-2xl flex items-center justify-between"
          style={{
            background: "linear-gradient(145deg, rgba(220, 252, 231, 0.75) 0%, rgba(205, 248, 218, 0.60) 100%)",
            border: "1px solid rgba(34, 197, 94, 0.30)",
            boxShadow: "var(--s2)"
          }}
        >
          <div>
            <button
              type="button"
              onClick={() => {
                if (step > 1) setStep((step - 1) as any);
                else setMode("list");
              }}
              className="btn-secondary !py-1.5 !px-4 text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !selectedTemplate) {
                    alert("Please select a template first!");
                    return;
                  }
                  setStep((step + 1) as any);
                }}
                className="btn-primary !py-2 !px-6 text-xs font-bold shadow-md"
              >
                Continue →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowTestModal(true)}
                  className="btn-secondary !py-2 !px-4 text-xs font-bold"
                >
                  Test Broadcast
                </button>
                <button
                  type="button"
                  onClick={handleFinalBroadcast}
                  className="btn-primary !py-2 !px-7 text-xs font-extrabold shadow-md bg-gradient-to-r from-emerald-600 to-green-700 flex items-center gap-1.5"
                >
                  <Send size={13} /> {isScheduled ? "Schedule Broadcast" : "Broadcast"}
                </button>
              </>
            )}
          </div>
        </div>

        <TestBroadcastModal
          isOpen={showTestModal}
          onClose={() => setShowTestModal(false)}
          template={selectedTemplate}
        />
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     MAIN BROADCAST DASHBOARD LIST VIEW
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="page-wrapper space-y-4">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>
            Broadcast
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>
            Manage all the broadcast campaigns
          </p>
        </div>
        <div className="flex-1" />
        <button className="btn-primary" onClick={openWizard}>
          <Plus size={14} /> Add broadcast
        </button>
      </div>

      {analytics && (
        <div className="card-raised p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-[13px]" style={{ color: "var(--t1)" }}>
              {analytics.name} — Analytics
            </p>
            <button className="btn-icon" onClick={() => setAnalytics(null)}>
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {[
              ["Total", analytics.totalContacts],
              ["Sent", analytics.sentCount],
              ["Delivered", `${analytics.deliveredCount} (${analytics.deliveryRate}%)`],
              ["Read", `${analytics.readCount} (${analytics.readRate}%)`],
              ["Failed", analytics.failedCount],
              ["Pending", analytics.pendingCount],
              ["Status", analytics.status],
              ["Completed", analytics.completedAt ? formatDateTime(analytics.completedAt) : "—"],
            ].map(([l, v]) => (
              <div key={String(l)} className="card-green p-3.5 text-center">
                <p className="text-[16px] font-bold" style={{ color: "var(--t1)" }}>{v}</p>
                <p className="text-[10px] font-semibold mt-0.5 capitalize" style={{ color: "var(--t3)" }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Recently sent broadcast</p>

      <div className="card-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th" style={{ width: 50 }}>Sr.no</th>
                <th className="th">Broadcast</th>
                <th className="th">Template</th>
                <th className="th">Sent/total</th>
                <th className="th">Progress</th>
                <th className="th">Sent</th>
                <th className="th">Failed</th>
                <th className="th">Error</th>
                <th className="th">Retry attempt</th>
                <th className="th">Status</th>
                <th className="th w-28" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const total = c.totalContacts || 0;
                const progress = total > 0 ? Math.round(((c.sentCount + c.failedCount) / total) * 100) : (c.status === "completed" ? 100 : 0);
                return (
                  <tr key={c.id}>
                    <td className="td" style={{ fontSize: 12.5, color: "var(--t3)" }}>{i + 1}</td>
                    <td className="td font-semibold" style={{ color: "var(--t1)", textDecoration: "underline" }}>{c.name}</td>
                    <td className="td text-[12px]">{c.template?.name || "—"}</td>
                    <td className="td text-[12.5px]">{c.sentCount + c.failedCount} / {total}</td>
                    <td className="td text-[12.5px]">{progress}%</td>
                    <td className="td">{c.sentCount}</td>
                    <td className="td">{c.failedCount}</td>
                    <td className="td">{c.errorCount ?? 0}</td>
                    <td className="td">{c.retryAttempt ?? 0}</td>
                    <td className="td"><StatusBadge status={c.status} /></td>
                    <td className="td">
                      <div className="flex items-center gap-1 justify-end">
                        {c.status === "draft" && <button className="btn-secondary !px-2 !py-1.5" onClick={() => act(c.id, "start")} title="Start"><Play size={12} /></button>}
                        {c.status === "running" && <button className="btn-secondary !px-2 !py-1.5" onClick={() => act(c.id, "pause")} title="Pause"><Pause size={12} /></button>}
                        {c.status === "paused" && <button className="btn-secondary !px-2 !py-1.5" onClick={() => act(c.id, "resume")} title="Resume"><Play size={12} /></button>}
                        {c.failedCount > 0 && c.status !== "running" && <button className="btn-secondary !px-2 !py-1.5" onClick={() => act(c.id, "start")} title="Retry failed"><RotateCcw size={12} /></button>}
                        <button className="btn-secondary !px-2 !py-1.5" onClick={() => showFor(c.id)} title="Analytics"><BarChart3 size={12} /></button>
                        {c.status !== "running" && <button className="btn-icon" style={{ color: "#dc2626" }} onClick={() => act(c.id, "remove")}><Trash2 size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {campaigns.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><BarChart3 size={20} /></div>
              <p className="empty-title">No broadcasts yet</p>
              <p className="empty-desc">Click &quot;Add broadcast&quot; to launch your first WhatsApp broadcast campaign.</p>
            </div>
          )}
          {campaigns.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid rgba(34,197,94,0.18)" }}>
              <span className="text-[12px] font-medium" style={{ color: "var(--gp)" }}>
                Showing 1 to {campaigns.length} of {campaigns.length} results
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TEST BROADCAST MODAL
   ───────────────────────────────────────────────────────────────────────── */
function TestBroadcastModal({
  isOpen,
  onClose,
  template
}: {
  isOpen: boolean;
  onClose: () => void;
  template?: any;
}) {
  const [countryCode, setCountryCode] = useState("91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleSendNow = async () => {
    if (!phoneNumber.trim()) {
      alert("Please enter a valid phone number");
      return;
    }
    setSending(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;
      let res: any;
      if (template && template.name) {
        const bodyVars = (template.body || '').match(/\{\{(\d+)\}\}/g) || [];
        const parameters = bodyVars.map(() => 'Customer');
        res = await api.post<any>("/messages/template", {
          whatsappNumberId: 1,
          to: fullPhone,
          templateName: template.name,
          language: template.language || "en",
          parameters: parameters.length > 0 ? parameters : undefined,
        });
      } else {
        res = await api.post<any>("/messages/send", {
          whatsappNumberId: 1,
          to: fullPhone,
          text: `[TEST BROADCAST]\nThis is a test message sent to ${fullPhone}.`
        });
      }

      if (res && res.status === "failed") {
        alert(`Failed to send test broadcast: ${res.error || "Meta API error"}`);
      } else {
        alert(`Test broadcast sent successfully to +${fullPhone}!`);
        onClose();
      }
    } catch (e: any) {
      alert(e.message || "Failed to send test broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="px-5 py-3.5 bg-[#e6eef5] border-b border-slate-200/80 flex items-center justify-between">
            <h3 className="text-[14.5px] font-bold text-slate-800">Test Broadcast</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Info Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
              <Cloud size={18} className="text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-slate-600 leading-relaxed font-sans">
                Template variables and URLs will be taken from the first contact in the selected segment or Excel sheet. This ensures accurate message quality and engagement testing.
              </p>
            </div>

            {/* Phone Number Field */}
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-bold text-slate-700 block">Phone number</label>
              <div className="flex border border-slate-300 rounded-xl overflow-hidden focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 bg-white transition-all">
                <select
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value)}
                  className="bg-slate-50 text-[12.5px] font-bold text-slate-700 px-3 py-2 border-r border-slate-200 outline-none cursor-pointer"
                >
                  <option value="91">IN (91)</option>
                  <option value="1">US (1)</option>
                  <option value="44">UK (44)</option>
                  <option value="971">UAE (971)</option>
                </select>
                <input
                  type="text"
                  placeholder="999-999-9999"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="flex-1 px-3 py-2 text-[13px] text-slate-800 outline-none font-medium"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="px-4 py-2 rounded-xl bg-[#fee2e2] text-[#dc2626] hover:bg-[#fca5a5]/40 font-bold text-[12.5px] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendNow}
                disabled={sending}
                className="px-5 py-2 rounded-xl bg-[#1e293b] hover:bg-[#0f172a] text-white font-extrabold text-[12.5px] shadow-md transition-all flex items-center gap-1.5"
              >
                {sending ? "Sending..." : "Send now"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
