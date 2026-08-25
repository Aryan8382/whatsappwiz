"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search, ImageIcon, UploadCloud, Trash2, ExternalLink, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

function formatSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 2 : 0)} ${units[i]}`;
}

export default function MediaPage() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(25);
  const [view, setView] = useState<"list" | "upload">("list");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      const d = await api.get<any>(`/media?${q}`);
      setItems(d.items || []);
    } catch {}
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const doUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert("Maximum size is 5 MB"); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      await api.upload<any>("/media", fd);
      setView("list"); load();
    } catch (e: any) { alert(e.message); }
    setUploading(false);
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this media file?")) return;
    try { await api.del(`/media/${id}`); load(); } catch (e: any) { alert(e.message); }
  };

  const visible = items.slice(0, perPage);

  if (view === "upload") {
    return (
      <div className="page-wrapper">
        <div className="section-header">
          <div className="flex items-center gap-2.5">
            <button className="btn-icon" onClick={() => setView("list")}><ArrowLeft size={16} /></button>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>Media</h1>
              <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>Manage all the media</p>
            </div>
          </div>
        </div>

        <div className="card-raised p-6">
          <div
            className="flex flex-col items-center justify-center gap-3 text-center"
            style={{
              border: `1.5px dashed ${dragOver ? "var(--gp)" : "rgba(0,0,0,0.15)"}`,
              borderRadius: 14, padding: "56px 24px",
              background: dragOver ? "rgba(220,252,231,0.35)" : "rgba(255,255,255,0.35)",
              transition: "all .15s",
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) doUpload(f);
            }}
          >
            <div className="empty-icon" style={{ width: 64, height: 64 }}>
              <UploadCloud size={26} />
            </div>
            <input ref={fileRef} type="file" className="hidden" accept=".jpeg,.jpg,.png,.bmp,.heic,.pdf,.xls,.xlsx,.mp3,.mp4,.mov"
              onChange={e => e.target.files?.[0] && doUpload(e.target.files[0])} />
            <button
              className="font-bold"
              style={{ color: "var(--gp)", fontSize: 15, background: "none", border: "none", cursor: "pointer" }}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "+ Upload new image"}
            </button>
            <p style={{ fontSize: 12.5, color: "var(--t3)" }}>Drag and drop</p>
          </div>
          <div className="flex items-center justify-between mt-3" style={{ fontSize: 11.5, color: "var(--t3)" }}>
            <span>jpeg, png, bmp, heic, pdf, xls, xlsx, mp3, mp4, mov extensions are allowed</span>
            <span>Maximum size 5 MB</span>
          </div>
          <div className="flex justify-center mt-6">
            <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <UploadCloud size={13} /> {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>Media</h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>Manage all the media</p>
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
        <button className="btn-primary" onClick={() => setView("upload")}>
          <Plus size={13} /> Add media
        </button>
      </div>

      <div className="card-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th" style={{ width: 60 }}>Sr.no</th>
                <th className="th">Media id</th>
                <th className="th">Name</th>
                <th className="th">Mime</th>
                <th className="th">Size</th>
                <th className="th">Status</th>
                <th className="th">Created by</th>
                <th className="th" style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m, i) => (
                <tr key={m.id}>
                  <td className="td" style={{ fontSize: 12.5, color: "var(--t3)" }}>{i + 1}</td>
                  <td className="td text-[12.5px]">{m.mediaId}</td>
                  <td className="td">
                    <a href={m.url} target="_blank" rel="noreferrer" className="font-semibold inline-flex items-center gap-1" style={{ color: "var(--t1)", textDecoration: "underline" }}>
                      {m.name} <ExternalLink size={11} style={{ color: "var(--gp)" }} />
                    </a>
                  </td>
                  <td className="td text-[12.5px]">{m.mimeType}</td>
                  <td className="td text-[12.5px]">{formatSize(Number(m.size))}</td>
                  <td className="td"><span className={m.status === "active" ? "badge-green" : "badge-red"}>{m.status === "active" ? "Active" : "Expired"}</span></td>
                  <td className="td text-[12.5px]">{m.createdByName || "—"}</td>
                  <td className="td text-center">
                    <button className="btn-icon" style={{ color: "#dc2626" }} onClick={() => remove(m.id)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="td py-0">
                    <div className="empty-state">
                      <div className="empty-icon"><ImageIcon size={20} /></div>
                      <p className="empty-title">No media found</p>
                      <p className="empty-desc">Upload images, documents, or videos to reuse them in your messages.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {items.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid rgba(34,197,94,0.18)" }}>
            <span className="text-[12px] font-medium" style={{ color: "var(--gp)" }}>
              Showing 1 to {visible.length} of {items.length} results
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
