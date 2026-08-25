"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet as WIcon, Plus, KeyRound, Copy, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/ui/status-badge";

export default function WalletPage() {
  const [wallet,   setWallet]   = useState<any>(null);
  const [txns,     setTxns]     = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [apiKeys,  setApiKeys]  = useState<any[]>([]);
  const [amount,   setAmount]   = useState(1000);
  const [newKey,   setNewKey]   = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setWallet(await api.get<any>("/wallet"));
      setTxns((await api.get<any>("/wallet/transactions")).items || []);
      setInvoices((await api.get<any[]>("/wallet/invoices")) || []);
      setApiKeys((await api.get<any[]>("/apikeys")) || []);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const recharge    = async () => { try { const r = await api.post<any>("/wallet/recharge", { amount, method:"razorpay_demo" }); alert(`Recharged! Balance: ${r.balance}`); load(); } catch (e: any) { alert(e.message); } };
  const generateKey = async () => { try { setNewKey(await api.post<any>("/apikeys", {})); load(); } catch (e: any) { alert(e.message); } };
  const revokeKey   = async (id: number) => { if (!confirm("Revoke this API key?")) return; try { await api.del(`/apikeys/${id}`); load(); } catch (e: any) { alert(e.message); } };
  const copy = (t: string) => navigator.clipboard?.writeText(t);

  return (
    <div className="page-wrapper">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Balance hero */}
        <div className="card-raised p-6 flex flex-col gap-4"
          style={{ background:"linear-gradient(155deg,rgba(34,197,94,0.38) 0%,rgba(21,128,61,0.50) 100%)", borderColor:"rgba(34,197,94,0.35)" }}>
          <div className="flex items-center gap-2" style={{ color:"var(--t2)" }}>
            <WIcon size={15}/><span className="text-[13px] font-semibold">Available balance</span>
          </div>
          <p className="text-[38px] font-black tracking-tight" style={{ color:"var(--t1)", letterSpacing:"-0.04em" }}>
            {wallet?.currency} <span>{wallet?.balance ?? 0}</span>
          </p>
          <div className="flex gap-2">
            <input className="input !w-24" type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
            <button className="btn-primary flex items-center gap-1.5" onClick={recharge}><Plus size={13}/> Recharge</button>
          </div>
        </div>

        {/* Message costs */}
        <div className="card-raised p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="icon-box-sm"><WIcon size={13}/></div>
            <h3 className="font-bold text-[12.5px]" style={{ color:"var(--t1)" }}>Message costs</h3>
          </div>
          <div className="space-y-2.5">
            {[["Text message","0.10"],["Media message","0.20"],["Template message","0.30"]].map(([label,cost]) => (
              <div key={label} className="card-green flex items-center justify-between px-3.5 py-2.5">
                <span className="text-[13px]" style={{ color:"var(--t2)" }}>{label}</span>
                <span className="text-[13px] font-bold" style={{ color:"var(--t1)" }}>{wallet?.currency} {cost}</span>
              </div>
            ))}
          </div>
        </div>

        {/* API Keys */}
        <div className="card-raised p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="icon-box-sm"><KeyRound size={13}/></div>
              <h3 className="font-bold text-[12.5px]" style={{ color:"var(--t1)" }}>API Keys</h3>
            </div>
            <button className="btn-secondary !py-1.5 text-xs" onClick={generateKey}><KeyRound size={11}/> Generate</button>
          </div>
          {newKey && (
            <div className="alert alert-warning mb-3 space-y-2">
              <p className="font-bold text-[12px]">Store securely — shown once:</p>
              {[["Key",newKey.apiKey],["Secret",newKey.secret]].map(([k,v]) => (
                <div key={k} className="flex items-start gap-2">
                  <span className="text-[11px] font-bold shrink-0">{k}:</span>
                  <code className="text-[10px] font-mono break-all flex-1">{v}</code>
                  <button className="btn-icon !p-0.5 shrink-0" onClick={() => copy(v as string)}><Copy size={10}/></button>
                </div>
              ))}
              <p className="text-[11px]">Send as <span className="code-tag">X-Api-Key</span> header</p>
            </div>
          )}
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {apiKeys.map(k => (
              <div key={k.id} className="card-green flex items-center justify-between px-3 py-2">
                <code className="text-[10px] truncate font-mono" style={{ color:"var(--t2)" }}>{k.apiKey}</code>
                <button className="text-[11px] font-bold ml-2 transition-opacity hover:opacity-70" style={{ color:"#dc2626" }} onClick={() => revokeKey(k.id)}>Revoke</button>
              </div>
            ))}
            {apiKeys.length===0 && <p className="text-[12px]" style={{ color:"var(--t3)" }}>No API keys yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card-raised overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:"1px solid rgba(34,197,94,0.18)" }}>
            <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)" }}>Transactions</h3>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {txns.map(t => (
              <div key={t.id} className="px-5 py-3.5 flex items-center justify-between transition-colors"
                style={{ borderTop:"1px solid rgba(255,255,255,0.35)" }}
                onMouseEnter={e => (e.currentTarget.style.background="rgba(220,252,231,0.25)")}
                onMouseLeave={e => (e.currentTarget.style.background="")}>
                <div>
                  <p className="text-[13px] font-semibold capitalize" style={{ color:"var(--t1)" }}>{t.type?.replace("_"," ")}</p>
                  <p className="text-[11px] mt-0.5" style={{ color:"var(--t3)" }}>{t.description||"—"} · {formatDateTime(t.createdAt)}</p>
                </div>
                <span className="text-[14px] font-bold" style={{ color: t.amount>=0 ? "var(--gp)" : "#dc2626" }}>
                  {t.amount>=0 ? "+" : ""}{wallet?.currency} {t.amount}
                </span>
              </div>
            ))}
            {txns.length===0 && <div className="empty-state !py-10"><div className="empty-icon"><WIcon size={18}/></div><p className="empty-desc">No transactions yet.</p></div>}
          </div>
        </div>
        <div className="card-raised overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:"1px solid rgba(34,197,94,0.18)" }}>
            <h3 className="font-bold text-[13px]" style={{ color:"var(--t1)" }}>Invoices</h3>
          </div>
          <div>
            {invoices.map(i => (
              <div key={i.id} className="px-5 py-3.5 flex items-center justify-between transition-colors"
                style={{ borderTop:"1px solid rgba(255,255,255,0.35)" }}
                onMouseEnter={e => (e.currentTarget.style.background="rgba(220,252,231,0.25)")}
                onMouseLeave={e => (e.currentTarget.style.background="")}>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color:"var(--t1)" }}>Invoice #{i.invoiceNumber}</p>
                  <p className="text-[11px] mt-0.5" style={{ color:"var(--t3)" }}>{formatDateTime(i.createdAt)}</p>
                </div>
                <StatusBadge status={i.status}/>
              </div>
            ))}
            {invoices.length===0 && <div className="empty-state !py-10"><div className="empty-icon"><Receipt size={18}/></div><p className="empty-desc">No invoices yet.</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
