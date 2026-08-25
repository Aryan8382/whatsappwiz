"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus, Upload, Download, Trash2, Search, Users,
  MoreVertical, X, Tag, Layers, Filter, ChevronDown,
  Edit2, MessageSquare, History, FileSpreadsheet, Check
} from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import ModalPortal from "@/components/ui/modal-portal";
import { CreateSegmentModal } from "@/components/segments/create-segment-modal";

/* ───────────────────── Types ───────────────────── */
type Tab = "contacts" | "segments" | "tags";

/* ───────────────────── Main Page ───────────────────── */
export default function ContactsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("contacts");

  return (
    <div className="page-wrapper space-y-4">
      {/* ── Page Header ── */}
      <div>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>
          {activeTab === "contacts" ? "Contacts" : activeTab === "segments" ? "Segments" : "Tags"}
        </h1>
        <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>
          {activeTab === "contacts"
            ? "Manage all the contacts"
            : activeTab === "segments"
            ? "Manage all the segments"
            : "Manage all the tags"}
        </p>
      </div>

      {/* ── Frosted Tab Bar ── */}
      <div className="flex items-center justify-start">
        <div className="tab-row">
          <button
            className={`tab-item ${activeTab === "contacts" ? "active" : ""}`}
            onClick={() => setActiveTab("contacts")}
          >
            <Users size={13} /> Contacts
          </button>
          <button
            className={`tab-item ${activeTab === "segments" ? "active" : ""}`}
            onClick={() => setActiveTab("segments")}
          >
            <Layers size={13} /> Segments
          </button>
          <button
            className={`tab-item ${activeTab === "tags" ? "active" : ""}`}
            onClick={() => setActiveTab("tags")}
          >
            <Tag size={13} /> Tags
          </button>
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "contacts" && <ContactsTab />}
      {activeTab === "segments" && <SegmentsTab />}
      {activeTab === "tags" && <TagsTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CONTACTS TAB (Image 4)
   ═══════════════════════════════════════════════════════ */
function ContactsTab() {
  const router = useRouter();
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<any | null>(null);
  const [perPage, setPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    city: "",
    optIn: true
  });
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadTags = useCallback(async () => {
    try {
      const res = await api.get<any[]>("/contacts/tags");
      setAvailableTags(res || []);
    } catch {}
  }, []);

  useEffect(() => { loadTags(); }, [loadTags]);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(perPage) });
      if (search) q.set("search", search);
      const d = await api.get<any>(`/contacts?${q}`);
      setContacts(d.items || []);
      setTotal(d.total || 0);
    } catch {}
  }, [page, search, perPage]);

  useEffect(() => { load(); }, [load]);

  const openCreateModal = () => {
    loadTags();
    setEditContact(null);
    setForm({ firstName: "", lastName: "", mobile: "", email: "", city: "", optIn: true });
    setSelectedTagIds([]);
    setShowForm(true);
  };

  const openEditModal = (c: any) => {
    loadTags();
    setEditContact(c);
    setForm({
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      mobile: c.mobile || "",
      email: c.email || "",
      city: c.city || "",
      optIn: c.optIn !== undefined ? c.optIn : true
    });
    setSelectedTagIds(c.tags ? c.tags.map((t: any) => Number(t.id)) : []);
    setShowForm(true);
  };

  const saveContact = async () => {
    if (!form.firstName || !form.mobile) return;
    try {
      if (editContact) {
        await api.put(`/contacts/${editContact.id}`, {
          firstName: form.firstName,
          lastName: form.lastName || undefined,
          mobile: form.mobile,
          email: form.email || undefined,
          city: form.city || undefined,
          optIn: form.optIn,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        });
      } else {
        await api.post("/contacts", {
          firstName: form.firstName,
          lastName: form.lastName || undefined,
          mobile: form.mobile,
          email: form.email || undefined,
          city: form.city || undefined,
          optIn: form.optIn,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        });
      }
      setShowForm(false);
      setEditContact(null);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this contact?")) return;
    try { await api.del(`/contacts/${id}`); load(); } catch (e: any) { alert(e.message); }
  };

  const importCsv = async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await api.upload<any>("/contacts/import", fd);
      alert(`Imported ${r.imported || 0} contacts (${r.skipped || 0} skipped)`);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const totalPages = Math.ceil(total / perPage);

  const toggleSelectAll = () => {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map(c => Number(c.id)));
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Toolbar */}
      <div className="section-header flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--t3)" }}>
            <span>Show records :</span>
            <select
              className="input !h-[34px]"
              style={{ width: 72, padding: "3px 8px", fontSize: "12.5px" }}
              value={perPage}
              onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && importCsv(e.target.files[0])} />

          {/* Import from Dropdown */}
          <div className="relative">
            <button
              className="btn-secondary !h-[34px] !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5"
              onClick={() => setShowImportDropdown(!showImportDropdown)}
            >
              <Upload size={13} /> Import from <ChevronDown size={12} />
            </button>
            {showImportDropdown && (
              <div className="dropdown absolute left-0 top-full mt-1 z-50 py-1" style={{ minWidth: 150 }}>
                <button
                  className="dropdown-item w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                  onClick={() => { setShowImportDropdown(false); fileRef.current?.click(); }}
                >
                  <FileSpreadsheet size={13} className="text-emerald-600" /> CSV File
                </button>
              </div>
            )}
          </div>

          <button
            className="btn-secondary !h-[34px] !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5"
            onClick={() => setShowHistoryModal(true)}
          >
            <History size={13} /> History
          </button>

          <button
            className="btn-secondary !h-[34px] !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5"
            onClick={() =>
              api.text("/contacts/export").then(csv => {
                Object.assign(document.createElement("a"), {
                  href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
                  download: "contacts.csv",
                }).click();
              })
            }
          >
            <Download size={13} /> Export
          </button>

          {selectedIds.length > 0 && (
            <button
              className="btn-primary !h-[34px] !py-1.5 !px-3.5 text-xs font-bold flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-700 shadow-md"
              onClick={() => {
                const selectedContacts = contacts.filter(c => selectedIds.includes(Number(c.id)));
                sessionStorage.setItem("wiz_broadcast_contacts", JSON.stringify(selectedContacts));
                router.push("/campaigns?fromContacts=true");
              }}
            >
              <MessageSquare size={13} /> Broadcast to Selected ({selectedIds.length})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="search-wrap" style={{ maxWidth: 220 }}>
            <Search size={13} className="search-icon" />
            <input
              className="search-input !h-[34px] !text-[12.5px]"
              placeholder="Search contact"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-primary !h-[34px] !py-1.5 !px-4 text-xs font-bold flex items-center gap-1.5" onClick={openCreateModal}>
            <Plus size={13} /> Add contact
          </button>
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setShowHistoryModal(false)}>
            <div className="modal-panel w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--b2)] bg-[var(--gg0)]">
                <h3 className="text-[15px] font-bold text-[var(--t1)] flex items-center gap-2">
                  <History size={16} className="text-emerald-700" /> Import History
                </h3>
                <button className="btn-icon" onClick={() => setShowHistoryModal(false)}><X size={16} /></button>
              </div>
              <div className="p-6 text-center text-xs text-[var(--t3)]">
                <p>All contact imports and sync events are tracked in real-time.</p>
                <p className="mt-2 text-emerald-800 font-bold">Total contacts in organization: {total}</p>
              </div>
              <div className="px-5 py-3 bg-[var(--g0)] border-t border-[var(--b2)] flex justify-end">
                <button className="btn-secondary text-xs" onClick={() => setShowHistoryModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Add / Edit Contact Modal — Wide Side-by-Side Layout */}
      {showForm && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => { setShowForm(false); setShowTagDropdown(false); }}>
            <div
              className="modal-panel w-full max-w-5xl my-auto border border-[var(--b1)] shadow-2xl animate-scale-in flex flex-col"
              style={{ maxHeight: "92vh" }}
              onClick={e => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-7 py-4 shrink-0 border-b border-[var(--b2)] bg-[var(--gg1)]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.22),rgba(52,211,153,0.12))", border: "1px solid rgba(16,185,129,0.3)" }}
                  >
                    <Users size={16} className="text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-extrabold text-[var(--t1)] leading-tight">
                      {editContact ? "Edit Contact" : "Create Contact"}
                    </h3>
                    <p className="text-[11.5px] text-[var(--t3)]">Fill in the details below</p>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => { setShowForm(false); setShowTagDropdown(false); }}>
                  <X size={17} />
                </button>
              </div>

              {/* ── Body: Side-by-Side ── */}
              <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-[var(--b2)] p-0 flex-1 min-h-0">

                {/* ── LEFT PANEL: Contact Fields ── */}
                <div className="flex-1 p-7 space-y-5 overflow-y-auto">
                  <p className="text-[11px] font-extrabold text-[var(--t3)] uppercase tracking-widest">Contact Details</p>

                  {/* Name + Last Name */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label text-[11px] font-bold">FIRST NAME <span className="text-red-500">*</span></label>
                      <input
                        className="input !h-[40px] !text-[13px]"
                        placeholder="Rahul"
                        value={form.firstName}
                        onChange={e => setForm({ ...form, firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label text-[11px] font-bold">LAST NAME</label>
                      <input
                        className="input !h-[40px] !text-[13px]"
                        placeholder="Kumar"
                        value={form.lastName}
                        onChange={e => setForm({ ...form, lastName: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="label text-[11px] font-bold">PHONE NUMBER <span className="text-red-500">*</span></label>
                    <input
                      className="input !h-[40px] !text-[13px] font-mono"
                      placeholder="e.g. 919876543210"
                      value={form.mobile}
                      onChange={e => setForm({ ...form, mobile: e.target.value })}
                    />
                    <p className="text-[10.5px] text-[var(--t3)] mt-1">Include country code. e.g. 91xxxxxxxxxx</p>
                  </div>

                  {/* Email + City */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label text-[11px] font-bold">EMAIL</label>
                      <input
                        className="input !h-[40px] !text-[13px]"
                        type="email"
                        placeholder="rahul@email.com"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label text-[11px] font-bold">CITY</label>
                      <input
                        className="input !h-[40px] !text-[13px]"
                        placeholder="Mumbai"
                        value={form.city}
                        onChange={e => setForm({ ...form, city: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Marketing Opt-In */}
                  <div
                    className="rounded-2xl p-4 border border-[var(--b1)]"
                    style={{ background: "rgba(16,185,129,0.04)" }}
                  >
                    <p className="text-[11px] font-extrabold text-[var(--t2)] uppercase tracking-wider mb-3">Marketing Opt-In</p>
                    <div className="flex items-center gap-5">
                      <label
                        className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border transition-all ${
                          form.optIn === true
                            ? "bg-emerald-100/70 border-emerald-400/50 text-emerald-900"
                            : "border-[var(--b2)] text-[var(--t3)] hover:bg-emerald-50/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="optIn"
                          checked={form.optIn === true}
                          onChange={() => setForm({ ...form, optIn: true })}
                          style={{ accentColor: "var(--gp)", width: 16, height: 16 }}
                        />
                        <div>
                          <p className="text-[13px] font-bold leading-tight">Yes</p>
                          <p className="text-[10.5px] opacity-70 leading-tight">Consent obtained</p>
                        </div>
                      </label>
                      <label
                        className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border transition-all ${
                          form.optIn === false
                            ? "bg-red-50 border-red-300/50 text-red-800"
                            : "border-[var(--b2)] text-[var(--t3)] hover:bg-red-50/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="optIn"
                          checked={form.optIn === false}
                          onChange={() => setForm({ ...form, optIn: false })}
                          style={{ accentColor: "#ef4444", width: 16, height: 16 }}
                        />
                        <div>
                          <p className="text-[13px] font-bold leading-tight">No</p>
                          <p className="text-[10.5px] opacity-70 leading-tight">No consent yet</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT PANEL: Tags ── */}
                <div className="lg:w-[340px] p-7 space-y-4 flex flex-col overflow-y-auto" style={{ background: "rgba(16,185,129,0.025)" }}>
                  <div>
                    <p className="text-[11px] font-extrabold text-[var(--t3)] uppercase tracking-widest mb-0.5">Assign Tags</p>
                    <p className="text-[11.5px] text-[var(--t3)]">Tag this contact to organise your audience.</p>
                  </div>

                  {/* Selected tag pills */}
                  {selectedTagIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags
                        .filter(t => selectedTagIds.includes(Number(t.id)))
                        .map(t => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-bold"
                            style={{
                              background: "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(52,211,153,0.12) 100%)",
                              border: "1px solid rgba(16,185,129,0.35)",
                              color: "var(--gp)",
                              backdropFilter: "blur(6px)",
                            }}
                          >
                            <Tag size={10} />
                            {t.name}
                            <button
                              type="button"
                              onClick={() => setSelectedTagIds(selectedTagIds.filter(id => id !== Number(t.id)))}
                              className="ml-0.5 text-emerald-700 hover:text-red-500 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Search + Tag List */}
                  <div className="flex-1 flex flex-col gap-2 min-h-0">
                    {/* Search */}
                    <div className="search-wrap">
                      <Search size={13} className="search-icon" />
                      <input
                        className="search-input !h-[36px] !text-[12px]"
                        placeholder="Search tags…"
                        value={tagSearch}
                        onChange={e => setTagSearch(e.target.value)}
                      />
                    </div>

                    {/* Tag list — always visible, no dropdown */}
                    <div
                      className="flex-1 rounded-2xl overflow-y-auto border border-[var(--b1)]"
                      style={{
                        background: "rgba(255,255,255,0.55)",
                        backdropFilter: "blur(18px) saturate(180%)",
                        WebkitBackdropFilter: "blur(18px) saturate(180%)",
                        minHeight: 160,
                      }}
                    >
                      {availableTags.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
                          <Tag size={22} className="text-emerald-700/40 mb-2" />
                          <p className="text-[12px] font-bold text-[var(--t2)]">No tags yet</p>
                          <p className="text-[11px] text-[var(--t3)] mt-0.5">Create tags from the Tags tab first.</p>
                        </div>
                      )}
                      {availableTags
                        .filter(t => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                        .map(tag => {
                          const isSelected = selectedTagIds.includes(Number(tag.id));
                          return (
                            <div
                              key={tag.id}
                              onClick={() => {
                                if (isSelected) setSelectedTagIds(selectedTagIds.filter(id => id !== Number(tag.id)));
                                else setSelectedTagIds([...selectedTagIds, Number(tag.id)]);
                              }}
                              className={`flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] cursor-pointer transition-all select-none border-b border-[var(--b2)]/40 last:border-0 ${
                                isSelected
                                  ? "bg-emerald-100/70 text-emerald-950 font-bold"
                                  : "hover:bg-emerald-50/50 text-[var(--t2)] font-medium"
                              }`}
                            >
                              <span
                                className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center"
                                style={{
                                  background: isSelected ? "var(--gp)" : "transparent",
                                  border: isSelected ? "none" : "1.5px solid var(--b2)",
                                }}
                              >
                                {isSelected && <Check size={10} color="white" strokeWidth={3} />}
                              </span>
                              <Tag size={12} className={isSelected ? "text-emerald-700" : "text-[var(--t3)]"} />
                              <span>{tag.name}</span>
                            </div>
                          );
                        })}
                      {availableTags.length > 0 && availableTags.filter(t => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && (
                        <p className="text-[12px] text-[var(--t3)] py-6 text-center">No tags match "{tagSearch}"</p>
                      )}
                    </div>

                    <p className="text-[10.5px] text-[var(--t3)] text-center">{selectedTagIds.length} tag{selectedTagIds.length !== 1 ? "s" : ""} selected</p>
                  </div>
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="flex items-center justify-between gap-3 px-7 py-4 shrink-0 border-t border-[var(--b2)] bg-[var(--gg1)]">
                <p className="text-[11.5px] text-[var(--t3)]">
                  <span className="text-red-500">*</span> Required fields
                </p>
                <div className="flex items-center gap-3">
                  <button
                    className="btn-ghost !text-red-600 hover:!bg-red-50 font-bold text-[13px]"
                    onClick={() => { setShowForm(false); setShowTagDropdown(false); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary !px-8 !py-2.5 text-[13px] font-extrabold shadow-md"
                    onClick={saveContact}
                    disabled={!form.firstName || !form.mobile}
                  >
                    {editContact ? "Update Contact" : "Save Contact"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Contacts Table (Image 4) */}
      <div className="card-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th" style={{ width: 140 }}>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="pill !py-1 !px-2.5 text-[11px] font-bold flex items-center gap-1 hover:scale-102 transition-all"
                    >
                      <span>Selected ({selectedIds.length})</span>
                      <ChevronDown size={12} />
                    </button>
                  </div>
                </th>
                <th className="th" style={{ width: 60 }}>#</th>
                <th className="th">Name</th>
                <th className="th">Phone number</th>
                <th className="th text-center" style={{ width: 70 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => {
                const isSelected = selectedIds.includes(Number(c.id));
                const fullName = `${c.firstName || ""} ${c.lastName || ""}`.trim();
                return (
                  <tr key={c.id} className={isSelected ? "bg-emerald-100/30" : ""}>
                    <td className="td" style={{ width: 140 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) setSelectedIds(selectedIds.filter(id => id !== Number(c.id)));
                          else setSelectedIds([...selectedIds, Number(c.id)]);
                        }}
                        style={{ accentColor: "var(--gp)", width: 15, height: 15 }}
                      />
                    </td>
                    <td className="td" style={{ fontSize: 12.5, color: "var(--t3)" }}>{(page - 1) * perPage + i + 1}</td>
                    <td className="td font-semibold text-[var(--t1)]">{fullName || "—"}</td>
                    <td className="td font-mono text-[12.5px] text-[var(--t2)]">{c.mobile}</td>
                    <td className="td text-center">
                      <ContactActionMenu
                        onEdit={() => openEditModal(c)}
                        onDelete={() => remove(c.id)}
                        onMessage={() => router.push(`/live-chat`)}
                      />
                    </td>
                  </tr>
                );
              })}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="td py-0">
                    <div className="empty-state">
                      <div className="empty-icon"><Users size={20} /></div>
                      <p className="empty-title">No contacts found</p>
                      <p className="empty-desc">Add a contact or import a CSV file.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--b2)]">
            <span className="text-[12px] font-medium text-[var(--gp)]">
              Showing {Math.min((page - 1) * perPage + 1, total)} to {Math.min(page * perPage, total)} of {total} results
            </span>
            {totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>←</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + Math.max(1, page - 2); if (p > totalPages) return null;
                  return <button key={p} className={`page-btn${p === page ? " active" : ""}`} onClick={() => setPage(p)}>{p}</button>;
                })}
                <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>→</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SEGMENTS TAB (Image 3)
   ═══════════════════════════════════════════════════════ */
function SegmentsTab() {
  const [segments, setSegments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editSegment, setEditSegment] = useState<any | null>(null);

  const loadSegments = useCallback(async () => {
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(perPage) });
      if (search) q.set("search", search);
      const res = await api.get<any>(`/segments?${q}`);
      if (Array.isArray(res)) {
        setSegments(res);
        setTotal(res.length);
      } else {
        setSegments(res.items || []);
        setTotal(res.total || 0);
      }
    } catch {
      setSegments([]);
    }
  }, [page, search, perPage]);

  useEffect(() => { loadSegments(); }, [loadSegments]);

  const totalPages = Math.ceil(total / perPage);

  const removeSegment = async (id: number) => {
    if (!confirm("Delete this segment?")) return;
    try {
      await api.del(`/segments/${id}`);
      loadSegments();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openEditModal = (seg: any) => {
    setEditSegment(seg);
    setShowCreateModal(true);
  };

  return (
    <div className="space-y-4">
      {/* Search & Action bar */}
      <div className="section-header flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--t3)" }}>
          <span>Show records :</span>
          <select
            className="input !h-[34px]"
            style={{ width: 72, padding: "3px 8px", fontSize: "12.5px" }}
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="search-wrap" style={{ maxWidth: 240 }}>
            <Search size={13} className="search-icon" />
            <input
              className="search-input !h-[34px] !text-[12.5px]"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn-primary !h-[34px] !py-1.5 !px-4 text-xs font-bold flex items-center gap-1.5"
            onClick={() => { setEditSegment(null); setShowCreateModal(true); }}
          >
            <Plus size={13} /> Add segment
          </button>
        </div>
      </div>

      {/* Create / Edit Segment Modal with Live Condition Filter Builder */}
      <CreateSegmentModal
        isOpen={showCreateModal}
        initialSegment={editSegment}
        onClose={() => { setShowCreateModal(false); setEditSegment(null); }}
        onSuccess={() => loadSegments()}
      />

      {/* Segments Table (Image 3) */}
      <div className="card-raised !overflow-visible relative z-10">
        <div className="overflow-x-auto !overflow-y-visible">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th" style={{ width: 70 }}>Sr.no</th>
                <th className="th">Segment name</th>
                <th className="th">Total contacts</th>
                <th className="th">Created by</th>
                <th className="th">Created at</th>
                <th className="th text-center" style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s, i) => (
                <tr key={s.id}>
                  <td className="td" style={{ fontSize: 12.5, color: "var(--t3)" }}>{(page - 1) * perPage + i + 1}</td>
                  <td className="td font-bold text-[var(--t1)]">{s.name}</td>
                  <td className="td">
                    <span className="badge-green font-bold">
                      {s.contactCount || 0}
                    </span>
                  </td>
                  <td className="td text-[12.5px] text-[var(--t2)]">{s.createdBy || "Talelight Media"}</td>
                  <td className="td text-[12.5px] text-[var(--t3)]">
                    {s.createdAt ? new Date(s.createdAt).toLocaleString("en-IN", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit", hour12: true,
                    }) : "—"}
                  </td>
                  <td className="td text-center">
                    <SegmentActionMenu
                      onEdit={() => openEditModal(s)}
                      onDelete={() => removeSegment(s.id)}
                    />
                  </td>
                </tr>
              ))}
              {segments.length === 0 && (
                <tr>
                  <td colSpan={6} className="td py-0">
                    <div className="empty-state">
                      <div className="empty-icon"><Layers size={20} /></div>
                      <p className="empty-title">No segments found</p>
                      <p className="empty-desc">Create a segment to group your contacts.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--b2)]">
            <span className="text-[12px] font-medium text-[var(--gp)]">
              Showing {Math.min((page - 1) * perPage + 1, total)} to {Math.min(page * perPage, total)} of {total} results
            </span>
            {totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>←</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + Math.max(1, page - 2); if (p > totalPages) return null;
                  return <button key={p} className={`page-btn${p === page ? " active" : ""}`} onClick={() => setPage(p)}>{p}</button>;
                })}
                <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>→</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAGS TAB (Image 1 & Image 2)
   ═══════════════════════════════════════════════════════ */
function TagsTab() {
  const [tags, setTags] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(25);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  // Modal for "View Contact List" (Image 2)
  const [selectedTagForContacts, setSelectedTagForContacts] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<any>("/contacts/tags");
      const list = Array.isArray(res) ? res : (res.items || res.data || []);
      setTags(list);
      setTotal(list.length);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const createTag = async () => {
    if (!newName.trim()) return;
    try {
      await api.post("/contacts/tags", { name: newName.trim() });
      setNewName("");
      setShowCreate(false);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const removeTag = async (id: number) => {
    if (!confirm("Delete this tag?")) return;
    try { await api.del(`/contacts/tags/${id}`); load(); } catch (e: any) { alert(e.message); }
  };

  const totalPages = Math.ceil(total / perPage);

  const filteredTags = tags.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Toolbar (Image 1) */}
      <div className="section-header flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--t3)" }}>
          <span>Show records :</span>
          <select
            className="input !h-[34px]"
            style={{ width: 72, padding: "3px 8px", fontSize: "12.5px" }}
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="search-wrap" style={{ maxWidth: 240 }}>
            <Search size={13} className="search-icon" />
            <input
              className="search-input !h-[34px] !text-[12.5px]"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn-primary !h-[34px] !py-1.5 !px-4 text-xs font-bold flex items-center gap-1.5"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={13} /> Add Tag
          </button>
        </div>
      </div>

      {/* Create Tag Modal */}
      {showCreate && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
            <div className="modal-panel w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-[var(--b2)] bg-[var(--gg0)]">
                <h3 className="text-[15px] font-bold text-[var(--t1)]">Create Tag</h3>
                <button className="btn-icon" onClick={() => setShowCreate(false)}><X size={16} /></button>
              </div>
              <div className="modal-body space-y-4 p-6">
                <label className="label text-[12px] font-bold">Tag name <span className="text-red-500">*</span></label>
                <input
                  className="input mb-2"
                  placeholder="Enter tag name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createTag()}
                />
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-3.5 bg-[var(--gg0)] border-t border-[var(--b2)]">
                <button className="btn-ghost !text-red-600 hover:!bg-red-50 font-bold text-xs" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn-primary !py-1.5 !px-4 text-xs font-bold" onClick={createTag}>Save</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Tags Table (Image 1) */}
      <div className="card-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th" style={{ width: 70 }}>Sr.no</th>
                <th className="th">Tag name</th>
                <th className="th">Total contacts</th>
                <th className="th">Created by</th>
                <th className="th">Created at</th>
                <th className="th text-center" style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTags.slice((page - 1) * perPage, page * perPage).map((t, i) => (
                <tr key={t.id}>
                  <td className="td" style={{ fontSize: 12.5, color: "var(--t3)" }}>{(page - 1) * perPage + i + 1}</td>
                  <td className="td font-bold text-[var(--t1)]">{t.name}</td>
                  <td className="td">
                    <button
                      type="button"
                      onClick={() => setSelectedTagForContacts(t)}
                      title="View Contacts"
                      className="text-emerald-700 font-bold hover:text-emerald-800 underline decoration-emerald-500/40 text-[12.5px] cursor-pointer"
                    >
                      View contacts
                    </button>
                  </td>
                  <td className="td text-[12.5px] text-[var(--t2)]">{t.createdByName || t.createdBy || "Talelight Media"}</td>
                  <td className="td text-[12.5px] text-[var(--t3)]">
                    {t.createdAt ? new Date(t.createdAt).toLocaleString("en-IN", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit", hour12: true,
                    }) : "—"}
                  </td>
                  <td className="td text-center">
                    <ActionMenu onDelete={() => removeTag(t.id)} />
                  </td>
                </tr>
              ))}
              {filteredTags.length === 0 && (
                <tr>
                  <td colSpan={6} className="td py-0">
                    <div className="empty-state">
                      <div className="empty-icon"><Tag size={20} /></div>
                      <p className="empty-title">No tags found</p>
                      <p className="empty-desc">Create a tag to categorize your contacts.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredTags.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--b2)]">
            <span className="text-[12px] font-medium text-[var(--gp)]">
              Showing {Math.min((page - 1) * perPage + 1, filteredTags.length)} to {Math.min(page * perPage, filteredTags.length)} of {filteredTags.length} results
            </span>
            {totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>←</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + Math.max(1, page - 2); if (p > totalPages) return null;
                  return <button key={p} className={`page-btn${p === page ? " active" : ""}`} onClick={() => setPage(p)}>{p}</button>;
                })}
                <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>→</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Contact List Modal (Image 2) */}
      {selectedTagForContacts && (
        <ViewContactListModal
          tag={selectedTagForContacts}
          onClose={() => {
            setSelectedTagForContacts(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   VIEW CONTACT LIST MODAL (Image 2)
   ═══════════════════════════════════════════════════════ */
function ViewContactListModal({
  tag,
  onClose
}: {
  tag: any;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadContacts = useCallback(async () => {
    if (!tag?.id) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(perPage) });
      if (search) q.set("search", search);
      const res = await api.get<any>(`/contacts/tags/${tag.id}/contacts?${q}`);
      setContacts(res.items || []);
      setTotal(res.total || 0);
    } catch {
      setContacts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tag?.id, page, perPage, search]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const handleRemoveFromTag = async (contactId: number) => {
    if (!confirm("Remove this contact from the tag?")) return;
    try {
      await api.del(`/contacts/tags/${tag.id}/contacts/${contactId}`);
      loadContacts();
    } catch (e: any) {
      alert(e.message || "Failed to remove contact from tag");
    }
  };

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={onClose}>
        <div
          className="modal-panel w-full max-w-2xl overflow-hidden border border-[var(--b1)] shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-[var(--gg1)] border-b border-[var(--b2)] flex items-center justify-between">
            <h3 className="text-[15.5px] font-extrabold text-[var(--t1)]">View Contact List</h3>
            <button
              onClick={onClose}
              className="btn-icon"
            >
              <X size={17} />
            </button>
          </div>

          {/* Subheader Toolbar (Image 2) */}
          <div className="px-6 py-3.5 bg-[var(--g0)] border-b border-[var(--b2)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--t3)]">
              <span>Show records :</span>
              <select
                className="input !h-[32px]"
                style={{ width: 68, padding: "2px 8px", fontSize: "12px" }}
                value={perPage}
                onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="search-wrap" style={{ maxWidth: 220 }}>
              <Search size={13} className="search-icon" />
              <input
                className="search-input !h-[32px] !text-[12px]"
                placeholder="Search contact"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Table (Image 2) */}
          <div className="overflow-x-auto min-h-[220px]">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="th" style={{ width: 60 }}>#</th>
                  <th className="th">Name</th>
                  <th className="th">Phone number</th>
                  <th className="th text-center" style={{ width: 170 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={c.id}>
                    <td className="td font-medium text-[var(--t3)]">{(page - 1) * perPage + i + 1}</td>
                    <td className="td font-bold text-[var(--t1)]">{c.name}</td>
                    <td className="td font-mono text-[12.5px] text-[var(--t2)]">{c.mobile}</td>
                    <td className="td text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveFromTag(c.id)}
                        className="btn-danger !py-1 !px-3 !text-[11.5px] font-bold shadow-sm"
                      >
                        <Tag size={12} />
                        <span>Remove From Tag</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[var(--t3)] text-xs">
                      No contacts found under this tag.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-3 bg-[var(--g0)] border-t border-[var(--b2)] flex items-center justify-between text-[11.5px] text-[var(--t3)]">
            <span>
              Showing {contacts.length > 0 ? (page - 1) * perPage + 1 : 0} to {Math.min(page * perPage, total)} of {total} results
            </span>
            {Math.ceil(total / perPage) > 1 && (
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>←</button>
                <button className="page-btn active">{page}</button>
                <button className="page-btn" disabled={page >= Math.ceil(total / perPage)} onClick={() => setPage(page + 1)}>→</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

/* ═══════════════════════════════════════════════════════
   ACTION MENUS (Three-Dot dropdowns)
   ═══════════════════════════════════════════════════════ */
function ContactActionMenu({
  onEdit,
  onDelete,
  onMessage,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onMessage: () => void;
}) {
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
      <button className="btn-icon" onClick={() => setOpen(!open)}>
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="dropdown absolute right-0 top-full mt-1 z-50 py-1" style={{ minWidth: 130 }}>
          <button className="dropdown-item w-full text-left px-3 py-2 text-xs flex items-center gap-2" onClick={() => { onEdit(); setOpen(false); }}>
            <Edit2 size={13} className="text-emerald-700" /> Edit
          </button>
          <button className="dropdown-item danger w-full text-left px-3 py-2 text-xs flex items-center gap-2" onClick={() => { onDelete(); setOpen(false); }}>
            <Trash2 size={13} /> Delete
          </button>
          <button className="dropdown-item w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-emerald-800 font-bold" onClick={() => { onMessage(); setOpen(false); }}>
            <MessageSquare size={13} className="text-emerald-600" /> Message
          </button>
        </div>
      )}
    </div>
  );
}

function SegmentActionMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
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
      <button className="btn-icon" onClick={() => setOpen(!open)}>
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          className="dropdown absolute right-0 top-full mt-1 z-[150] py-1 rounded-xl shadow-2xl border border-[var(--b1)] bg-white/95 backdrop-blur-xl animate-scale-in"
          style={{ minWidth: 120, boxShadow: "0 12px 32px rgba(16, 185, 129, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)" }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            className="dropdown-item w-full text-left px-3 py-2 text-xs flex items-center gap-2 font-semibold text-[var(--t1)] hover:bg-emerald-50/80"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Edit2 size={13} className="text-emerald-700 font-bold" /> Edit
          </button>
          <button
            type="button"
            className="dropdown-item danger w-full text-left px-3 py-2 text-xs flex items-center gap-2 font-semibold text-red-600 hover:bg-red-50/80"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ActionMenu({ onDelete }: { onDelete: () => void }) {
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
      <button className="btn-icon" onClick={() => setOpen(!open)}>
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="dropdown absolute right-0 top-full mt-1 z-50 py-1" style={{ minWidth: 120 }}>
          <button className="dropdown-item danger w-full text-left px-3 py-2 text-xs flex items-center gap-2" onClick={() => { onDelete(); setOpen(false); }}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
