"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, ArrowRight, X } from "lucide-react";
import { api } from "@/lib/api";

export default function TemplateLibraryPage() {
  const router = useRouter();
  const [type, setType] = useState<"UTILITY" | "AUTHENTICATION">("UTILITY");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<{ industries: string[]; topics: string[]; useCases: string[] }>({ industries: [], topics: [], useCases: [] });
  const [industry, setIndustry] = useState<string[]>([]);
  const [topic, setTopic] = useState<string[]>([]);
  const [useCase, setUseCase] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<any>(null);
  const limit = 12;

  useEffect(() => { api.get<any>("/template-library/filters").then(setFilters).catch(() => {}); }, []);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ type, page: String(page), limit: String(limit) });
      if (search) q.set("search", search);
      if (industry.length) q.set("industry", industry.join(","));
      if (topic.length) q.set("topic", topic.join(","));
      if (useCase.length) q.set("useCase", useCase.join(","));
      const d = await api.get<any>(`/template-library?${q}`);
      setItems(d.items || []); setTotal(d.total || 0);
    } catch {}
  }, [type, search, industry, topic, useCase, page]);

  useEffect(() => { setPage(1); }, [type, search, industry, topic, useCase]);
  useEffect(() => { load(); }, [load]);

  const toggle = (list: string[], setList: (v: string[]) => void, val: string) => {
    setList(list.includes(val) ? list.filter(v => v !== val) : [...list, val]);
  };

  const useTemplate = async (t: any) => {
    const name = prompt("Name this template:", t.id);
    if (!name) return;
    try {
      await api.post("/templates", {
        name, category: type, language: t.language,
        header: t.header, body: t.body, footer: t.footer,
      });
      alert("Template created from library. You can find it under Templates.");
      router.push("/templates");
    } catch (e: any) { alert(e.message); }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>Template Library</h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>Browse ready-made utility and authentication templates</p>
        </div>
      </div>

      <div className="section-header">
        <div className="search-wrap flex-1" style={{ maxWidth: 320 }}>
          <Search size={13} className="search-icon" />
          <input className="input" placeholder="Search utility templates" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-row">
          <button className={`tab-item${type === "UTILITY" ? " active" : ""}`} onClick={() => setType("UTILITY")}>Utility</button>
          <button className={`tab-item${type === "AUTHENTICATION" ? " active" : ""}`} onClick={() => setType("AUTHENTICATION")}>Authentication</button>
        </div>
        <select className="input" style={{ width: 140 }}>
          <option>English (US)</option>
        </select>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-4">
        <div className="card-raised p-4 h-fit">
          <FilterGroup title="Industry" options={filters.industries} selected={industry} onToggle={v => toggle(industry, setIndustry, v)} />
          <FilterGroup title="Topic" options={filters.topics} selected={topic} onToggle={v => toggle(topic, setTopic, v)} />
          <FilterGroup title="Use Case" options={filters.useCases} selected={useCase} onToggle={v => toggle(useCase, setUseCase, v)} />
        </div>

        <div>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginBottom: 10 }}>Showing {total} results</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {items.map((t: any) => (
              <div key={t.id} className="card-raised p-4 flex flex-col">
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>{t.name}</p>
                <p style={{ fontSize: 12.5, color: "var(--t2)", whiteSpace: "pre-line", flex: 1, lineHeight: 1.5 }}>
                  {t.body.length > 180 ? t.body.slice(0, 180) + "…" : t.body}
                </p>
                {t.buttonLabel && (
                  <button className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--gp)", textAlign: "left", background: "none", border: "none" }}>
                    {t.buttonLabel}
                  </button>
                )}
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <div>
                    <p className="text-[11.5px] font-mono" style={{ color: "var(--t1)" }}>{t.id}</p>
                    <p className="text-[10.5px]" style={{ color: "var(--t3)" }}>{t.language} • {t.type}</p>
                  </div>
                  <button className="btn-icon" onClick={() => setPreview(t)}><ArrowRight size={15} /></button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="empty-state col-span-2">
                <p className="empty-title">No templates match your filters</p>
                <p className="empty-desc">Try clearing a filter or searching a different keyword.</p>
              </div>
            )}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between mt-5">
              <span className="text-[12px]" style={{ color: "var(--gp)" }}>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
              </span>
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={13} /></button>
                {Array.from({ length: pages }).slice(0, 8).map((_, i) => (
                  <button key={i} className={`page-btn${page === i + 1 ? " active" : ""}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
                ))}
                <button className="page-btn" disabled={page === pages} onClick={() => setPage(p => p + 1)}><ChevronRight size={13} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div className="w-full max-w-md my-auto" onClick={e => e.stopPropagation()}>
            <div className="modal-panel">
              <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid rgba(34,197,94,0.18)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>{preview.name}</h3>
                <button className="btn-icon" onClick={() => setPreview(null)}><X size={16} /></button>
              </div>
              <div className="modal-body space-y-3">
                {preview.header && <p style={{ fontWeight: 700, marginBottom: 6 }}>{preview.header}</p>}
                <p style={{ fontSize: 13, color: "var(--t2)", whiteSpace: "pre-line", lineHeight: 1.6 }}>{preview.body}</p>
                {preview.footer && <p style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 8 }}>{preview.footer}</p>}
                {preview.buttonLabel && <button className="btn-secondary mt-3 w-full justify-center">{preview.buttonLabel}</button>}
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 shrink-0" style={{ borderTop: "1px solid rgba(34,197,94,0.18)" }}>
                <button className="btn-ghost" onClick={() => setPreview(null)}>Close</button>
                <button className="btn-primary" onClick={() => useTemplate(preview)}>Use this template</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, options, selected, onToggle }: {
  title: string; options: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  return (
    <div className="mb-5">
      <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>{title}</p>
      <div className="flex flex-col gap-1.5">
        {options.map(o => (
          <label key={o} className="flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: "var(--t2)" }}>
            <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}
