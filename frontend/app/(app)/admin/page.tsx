"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Shield, Building2 } from "lucide-react";
import { api, getSessionUser } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/ui/status-badge";

export default function AdminPage() {
  const user = getSessionUser();
  const [orgs,      setOrgs]      = useState<any[]>([]);
  const [audit,     setAudit]     = useState<any[]>([]);
  const [orgDetail, setOrgDetail] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setOrgs((await api.get<any>("/organizations")).items || []);
      setAudit((await api.get<any>("/audit")).items || []);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const openOrg = async (id: number) => { try { setOrgDetail(await api.get<any>(`/organizations/${id}`)); } catch {} };

  if (user?.role !== "super_admin") return (
    <div className="card-raised">
      <div className="empty-state">
        <div className="empty-icon icon-box-xl"><Shield size={22}/></div>
        <p className="empty-title">Restricted area</p>
        <p className="empty-desc">This area is restricted to super admins only.</p>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="card-raised overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom:"1px solid rgba(34,197,94,0.18)" }}>
          <div className="icon-box-sm"><Building2 size={13}/></div>
          <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)" }}>Organizations</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <th className="th">Name</th><th className="th">Slug</th><th className="th">Users</th>
              <th className="th">Numbers</th><th className="th">Wallet</th><th className="th">Status</th>
              <th className="th">Created</th><th className="th w-20"/>
            </tr></thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.id}>
                  <td className="td font-semibold" style={{ color:"var(--t1)" }}>{o.name}</td>
                  <td className="td"><span className="code-tag">{o.slug}</span></td>
                  <td className="td">{o.userCount}</td><td className="td">{o.numberCount}</td>
                  <td className="td font-medium">{o.walletCurrency||"INR"} {o.walletBalance}</td>
                  <td className="td"><StatusBadge status={o.status}/></td>
                  <td className="td text-[12px]">{formatDateTime(o.createdAt)}</td>
                  <td className="td text-right"><button className="btn-secondary !py-1 !px-3 text-xs" onClick={() => openOrg(o.id)}>Details</button></td>
                </tr>
              ))}
              {orgs.length===0 && <tr><td colSpan={8} className="td py-0"><div className="empty-state !py-10"><div className="empty-icon"><Building2 size={18}/></div><p className="empty-desc">No organizations found.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {orgDetail && (
        <div className="card-raised p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)" }}>{orgDetail.name}</h3>
            <button className="btn-icon" onClick={() => setOrgDetail(null)}><X size={13}/></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(orgDetail.stats || {}).map(([k,v]) => (
              <div key={k} className="card-green p-3.5 text-center">
                <p className="text-[16px] font-bold" style={{ color:"var(--t1)" }}>{String(v)}</p>
                <p className="text-[10px] font-semibold mt-0.5 capitalize" style={{ color:"var(--t3)" }}>{k.replace("wallet"," wallet ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-raised overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom:"1px solid rgba(34,197,94,0.18)" }}>
          <div className="icon-box-sm"><Shield size={13}/></div>
          <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)" }}>Audit log</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0" style={{ backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)" }}>
              <tr><th className="th">Time</th><th className="th">User</th><th className="th">Action</th><th className="th">Entity</th><th className="th">IP</th></tr>
            </thead>
            <tbody>
              {audit.map(a => (
                <tr key={a.id}>
                  <td className="td text-[12px]">{formatDateTime(a.createdAt)}</td>
                  <td className="td font-medium" style={{ color:"var(--t1)" }}>{a.user ? `${a.user.firstName} ${a.user.lastName||""}` : "system"}</td>
                  <td className="td"><span className="code-tag">{a.action}</span></td>
                  <td className="td">{a.entity||"—"}</td>
                  <td className="td text-[12px] font-mono">{a.ipAddress||"—"}</td>
                </tr>
              ))}
              {audit.length===0 && <tr><td colSpan={5} className="td py-0"><div className="empty-state !py-10"><div className="empty-icon"><Shield size={18}/></div><p className="empty-desc">No audit entries yet.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
