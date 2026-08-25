"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Bell, Plus, Pencil, Check, X, MessageSquare, Clock, GitBranch, Tag, Trash2,
} from "lucide-react";
import { api } from "@/lib/api";

const TRIGGERS = [
  { value: "incoming_message", label: "Incoming Message", desc: "Message Received" },
  { value: "conversation_closed", label: "Conversation Closed", desc: "Conversation Closed" },
  { value: "custom_field_changed", label: "Custom Field Changed", desc: "Custom Field Changed" },
  { value: "new_contact", label: "New Contact", desc: "New Contact Added" },
  { value: "scheduled", label: "Scheduled", desc: "Runs on a recurring schedule" },
];

const STEP_TYPES = [
  { value: "send_message", label: "Send Message", icon: MessageSquare },
  { value: "wait", label: "Wait / Delay", icon: Clock },
  { value: "condition", label: "Condition", icon: GitBranch },
  { value: "update_field", label: "Update Custom Field", icon: Tag },
];

export default function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<any>(null);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [steps, setSteps] = useState<any[]>([]);
  const [triggerType, setTriggerType] = useState("");
  const [selected, setSelected] = useState<"trigger" | number>("trigger");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"Setup" | "Focus">("Setup");

  const load = useCallback(async () => {
    try {
      const w = await api.get<any>(`/automation/${id}`);
      setWorkflow(w);
      setName(w.name);
      setSteps(Array.isArray(w.steps) ? w.steps : []);
      setTriggerType(w.triggerType || "");
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const persist = async (patch: any) => {
    setSaving(true);
    try {
      const updated = await api.put<any>(`/automation/${id}`, patch);
      setWorkflow(updated);
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  const saveName = () => { setEditingName(false); persist({ name }); };

  const pickTrigger = (val: string) => {
    setTriggerType(val);
    persist({ triggerType: val, triggerConfig: {} });
  };

  const addStep = (type: string) => {
    const next = [...steps, { id: `${Date.now()}`, type, config: {} }];
    setSteps(next);
    persist({ steps: next });
    setSelected(next.length - 1);
  };

  const updateStepConfig = (idx: number, config: any) => {
    const next = steps.map((s, i) => (i === idx ? { ...s, config } : s));
    setSteps(next);
    persist({ steps: next });
  };

  const removeStep = (idx: number) => {
    const next = steps.filter((_, i) => i !== idx);
    setSteps(next);
    persist({ steps: next });
    setSelected("trigger");
  };

  const activate = async () => {
    try {
      const updated = await api.post<any>(`/automation/${id}/activate`);
      setWorkflow(updated);
    } catch (e: any) { alert(e.message); }
  };

  if (!workflow) return <div className="page-wrapper"><div className="loading-row"><span className="spinner" /> Loading…</div></div>;

  const StepIcon = (type: string) => STEP_TYPES.find(s => s.value === type)?.icon || MessageSquare;

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <button className="btn-ghost" onClick={() => router.push("/automation")}>← Back</button>
        <div className="flex-1" />
      </div>

      <div className="card-raised">
        <div className="flex items-center justify-between px-5 py-4 flex-wrap gap-3" style={{ borderBottom: "1px solid rgba(34,197,94,0.18)" }}>
          <div className="flex items-center gap-3">
            <div className="empty-icon" style={{ width: 34, height: 34 }}><GitBranch size={16} /></div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Workflow</p>
              {editingName ? (
                <div className="flex items-center gap-1">
                  <input className="input" style={{ padding: "4px 8px", fontSize: 14, fontWeight: 700 }} value={name} autoFocus
                    onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveName()} />
                  <button className="btn-icon" onClick={saveName}><Check size={14} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 15, fontWeight: 800, color: "var(--t1)" }}>{workflow.name}</span>
                  <button className="btn-icon" onClick={() => setEditingName(true)}><Pencil size={12} /></button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={workflow.status === "active" ? "badge-green" : workflow.status === "paused" ? "badge-amber" : "badge-gray"}>
              {(workflow.status || "draft").toUpperCase()}
            </span>
            <span className="badge-gray">{steps.length} steps</span>
            <button className="btn-ghost" onClick={() => persist({})} disabled={saving}>{saving ? "Saving…" : "Save Draft"}</button>
            <button className="btn-secondary" onClick={() => alert("Test run queued — check the workflow's activity log once connected to a live WABA.")}>Test</button>
            <button className="btn-primary" onClick={activate}>Activate</button>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_360px]">
          {/* Canvas */}
          <div className="p-8 flex flex-col items-center gap-0" style={{ background: "rgba(255,255,255,0.25)" }}>
            <span className="badge-green mb-3">1 &nbsp;FLOW STARTS HERE</span>
            <div
              className="card-raised w-full max-w-md p-4 cursor-pointer"
              style={{ borderColor: selected === "trigger" ? "var(--gp)" : undefined, borderWidth: selected === "trigger" ? 1.5 : undefined }}
              onClick={() => setSelected("trigger")}
            >
              <div className="flex items-start gap-3">
                <div className="empty-icon" style={{ width: 34, height: 34, background: "rgba(254,226,226,0.6)", color: "#dc2626" }}><Bell size={16} /></div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.05em" }}>TRIGGER</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>
                    {triggerType ? TRIGGERS.find(t => t.value === triggerType)?.label : "Select trigger"}
                  </p>
                  <p style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 2 }}>
                    {triggerType ? TRIGGERS.find(t => t.value === triggerType)?.desc : "Runs when a new contact enters the selected workflow."}
                  </p>
                </div>
              </div>
            </div>

            {steps.map((s, i) => {
              const Icon = StepIcon(s.type);
              return (
                <div key={s.id} className="flex flex-col items-center w-full max-w-md">
                  <div style={{ width: 1, height: 24, background: "rgba(0,0,0,0.15)" }} />
                  <div
                    className="card-raised w-full p-4 cursor-pointer relative"
                    style={{ borderColor: selected === i ? "var(--gp)" : undefined, borderWidth: selected === i ? 1.5 : undefined }}
                    onClick={() => setSelected(i)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="empty-icon" style={{ width: 34, height: 34 }}><Icon size={16} /></div>
                      <div className="flex-1">
                        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.05em" }}>STEP {i + 1}</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>
                          {STEP_TYPES.find(t => t.value === s.type)?.label}
                        </p>
                        <p style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 2 }}>
                          {s.config?.message || s.config?.minutes ? `${s.config.minutes} min` : s.config?.field || "Not configured yet"}
                        </p>
                      </div>
                      <button className="btn-icon" onClick={e => { e.stopPropagation(); removeStep(i); }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div style={{ width: 1, height: 24, background: "rgba(0,0,0,0.15)" }} />
            <button className="btn-secondary" onClick={() => setSelected("trigger")}>
              <Plus size={13} /> Add step
            </button>
            {selected !== "trigger" || steps.length === 0 ? null : null}

            <div className="card-raised w-full max-w-md p-5 mt-4 text-center">
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Choose next steps</p>
              <p style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 2 }}>Use the plus button above to add actions.</p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                {STEP_TYPES.map(t => (
                  <button key={t.value} className="btn-ghost" onClick={() => addStep(t.value)}>
                    <t.icon size={13} /> {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ borderLeft: "1px solid rgba(34,197,94,0.18)" }}>
            <div className="tab-row px-4 pt-3">
              {(["Setup", "Focus"] as const).map(t => (
                <button key={t} className={`tab-item${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            <div className="p-5">
              {tab === "Setup" && selected === "trigger" && (
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Trigger setup</p>
                  <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, marginBottom: 14 }}>Choose the event that starts the automation.</p>
                  <div className="flex flex-col gap-2">
                    {TRIGGERS.map(t => (
                      <button
                        key={t.value}
                        className="card-raised p-3 text-left"
                        style={{ borderColor: triggerType === t.value ? "var(--gp)" : undefined, borderWidth: triggerType === t.value ? 1.5 : undefined }}
                        onClick={() => pickTrigger(t.value)}
                      >
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{t.label}</p>
                        <p style={{ fontSize: 11.5, color: "var(--t3)" }}>{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {tab === "Setup" && typeof selected === "number" && steps[selected] && (
                <StepConfigForm
                  step={steps[selected]}
                  onChange={(config) => updateStepConfig(selected, config)}
                />
              )}
              {tab === "Focus" && (
                <p style={{ fontSize: 12.5, color: "var(--t3)" }}>Focus mode zooms into the selected node — click a step on the canvas to inspect its recent runs once this workflow is active.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepConfigForm({ step, onChange }: { step: any; onChange: (c: any) => void }) {
  const [config, setConfig] = useState(step.config || {});
  useEffect(() => setConfig(step.config || {}), [step.id]);

  const commit = (patch: any) => {
    const next = { ...config, ...patch };
    setConfig(next);
    onChange(next);
  };

  if (step.type === "send_message") {
    return (
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Send message</p>
        <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, marginBottom: 14 }}>Configure the WhatsApp message to send.</p>
        <label className="label">Message</label>
        <textarea className="input" rows={5} value={config.message || ""} onChange={e => commit({ message: e.target.value })} placeholder="Type your message…" />
      </div>
    );
  }
  if (step.type === "wait") {
    return (
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Wait / delay</p>
        <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, marginBottom: 14 }}>Pause the workflow before continuing to the next step.</p>
        <label className="label">Minutes</label>
        <input type="number" min={1} className="input" value={config.minutes || ""} onChange={e => commit({ minutes: e.target.value })} />
      </div>
    );
  }
  if (step.type === "condition") {
    return (
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Condition</p>
        <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, marginBottom: 14 }}>Branch the workflow based on a field value.</p>
        <label className="label">Field</label>
        <input className="input" value={config.field || ""} onChange={e => commit({ field: e.target.value })} placeholder="e.g. contact.tag" />
        <label className="label mt-3">Equals</label>
        <input className="input" value={config.value || ""} onChange={e => commit({ value: e.target.value })} />
      </div>
    );
  }
  return (
    <div>
      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Update custom field</p>
      <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2, marginBottom: 14 }}>Set a custom field value on the contact.</p>
      <label className="label">Field name</label>
      <input className="input" value={config.field || ""} onChange={e => commit({ field: e.target.value })} />
      <label className="label mt-3">New value</label>
      <input className="input" value={config.value || ""} onChange={e => commit({ value: e.target.value })} />
    </div>
  );
}
