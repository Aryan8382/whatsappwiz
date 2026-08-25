"use client";

import { useEffect, useState } from "react";
import { UserCircle, Lock, Users, Plus, Webhook, CheckCircle, XCircle, Radio, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import StatusBadge from "@/components/ui/status-badge";

export default function SettingsPage() {
  const [me,      setMe]      = useState<any>(null);
  const [users,   setUsers]   = useState<any[]>([]);
  const [roles,   setRoles]   = useState<any[]>([]);
  const [pwd,     setPwd]     = useState({ currentPassword:"", newPassword:"" });
  const [newUser, setNewUser] = useState({ firstName:"", lastName:"", email:"", roleId:0, password:"" });
  const [msg,     setMsg]     = useState<{ ok:boolean; text:string }|null>(null);

  // Messenger API state
  const [messengerStatus, setMessengerStatus] = useState<{ tokenValid: boolean; baseUrl: string } | null>(null);
  const [webhookInfo,     setWebhookInfo]     = useState<any>(null);
  const [webhookUrl,      setWebhookUrl]      = useState("");
  const [webhookLoading,  setWebhookLoading]  = useState(false);

  useEffect(() => {
    api.get<any>("/auth/me").then(setMe).catch(() => {});
    api.get<any>("/users").then(d => setUsers(d.items||d||[])).catch(() => {});
    api.get<any[]>("/users/roles").then(setRoles).catch(() => {});
    api.get<any>("/messenger/status").then(setMessengerStatus).catch(() => {});
    api.get<any>("/messenger/webhook").then(setWebhookInfo).catch(() => {});
  }, []);

  const showMsg = (ok: boolean, text: string) => { setMsg({ok,text}); setTimeout(() => setMsg(null), 4000); };

  const changePassword = async () => {
    try { await api.post("/auth/change-password", pwd); showMsg(true,"Password changed successfully"); setPwd({ currentPassword:"", newPassword:"" }); }
    catch (e: any) { showMsg(false, e.message); }
  };

  const createUser = async () => {
    try {
      await api.post("/users", newUser); showMsg(true,"User created successfully");
      setNewUser({ firstName:"", lastName:"", email:"", roleId:0, password:"" });
      const d = await api.get<any>("/users"); setUsers(d.items||d||[]);
    } catch (e: any) { showMsg(false, e.message); }
  };

  const roleName = (id: number) => roles.find(r => r.id===id)?.name || "—";

  const registerWebhook = async () => {
    if (!webhookUrl.trim()) return showMsg(false, "Please enter a webhook URL");
    setWebhookLoading(true);
    try {
      const res = await api.post<any>("/messenger/webhook", { url: webhookUrl });
      showMsg(true, "Webhook registered successfully");
      setWebhookInfo(res);
    } catch (e: any) { showMsg(false, e.message); }
    finally { setWebhookLoading(false); }
  };

  const deleteWebhook = async () => {
    setWebhookLoading(true);
    try {
      await api.del("/messenger/webhook");
      showMsg(true, "Webhook deleted");
      setWebhookInfo(null);
    } catch (e: any) { showMsg(false, e.message); }
    finally { setWebhookLoading(false); }
  };

  return (
    <div className="page-wrapper">

      {msg && <div className={msg.ok ? "alert alert-success animate-slide-up" : "alert alert-error animate-slide-up"}>{msg.text}</div>}

      {/* ─── Profile & Password ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card-raised p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="icon-box-sm"><UserCircle size={13}/></div>
            <h3 className="font-bold text-[12.5px]" style={{ color:"var(--t1)" }}>Profile</h3>
          </div>
          {me ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">First name</label><input className="input" defaultValue={me.firstName}/></div>
                <div><label className="label">Last name</label><input className="input" defaultValue={me.lastName||""}/></div>
              </div>
              <div><label className="label">Email</label><input className="input" defaultValue={me.email} disabled/></div>
              <div><label className="label">Role</label><div className="mt-1.5"><StatusBadge status="approved" label={roleName(me.roleId)}/></div></div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32"><span className="loading-row"><span className="spinner"/></span></div>
          )}
        </div>

        <div className="card-raised p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="icon-box-sm"><Lock size={13}/></div>
            <h3 className="font-bold text-[12.5px]" style={{ color:"var(--t1)" }}>Change password</h3>
          </div>
          <div className="space-y-4">
            <div><label className="label">Current password</label><input className="input" type="password" value={pwd.currentPassword} onChange={e => setPwd({...pwd,currentPassword:e.target.value})} placeholder="••••••••"/></div>
            <div><label className="label">New password</label><input className="input" type="password" value={pwd.newPassword} onChange={e => setPwd({...pwd,newPassword:e.target.value})} placeholder="Min 8 characters"/></div>
            <button className="btn-primary" onClick={changePassword}>Update password</button>
          </div>
        </div>
      </div>

      {/* ─── Team Members ─── */}
      <div className="card-raised p-5">
        <div className="flex items-center gap-2 mb-5">
          <div className="icon-box-sm"><Users size={13}/></div>
          <h3 className="font-bold text-[12.5px]" style={{ color:"var(--t1)" }}>Team members</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5 p-4 card-green">
          <div><label className="label">First name</label><input className="input" placeholder="Jane" value={newUser.firstName} onChange={e => setNewUser({...newUser,firstName:e.target.value})}/></div>
          <div><label className="label">Last name</label><input className="input" placeholder="Smith" value={newUser.lastName} onChange={e => setNewUser({...newUser,lastName:e.target.value})}/></div>
          <div><label className="label">Email</label><input className="input" type="email" placeholder="jane@co.com" value={newUser.email} onChange={e => setNewUser({...newUser,email:e.target.value})}/></div>
          <div><label className="label">Password</label><input className="input" placeholder="Password" value={newUser.password} onChange={e => setNewUser({...newUser,password:e.target.value})}/></div>
          <div><label className="label">Role</label><select className="input" value={newUser.roleId} onChange={e => setNewUser({...newUser,roleId:Number(e.target.value)})}><option value={0}>Select role</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
          <div className="flex items-end"><button className="btn-primary w-full" onClick={createUser}><Plus size={13}/> Add</button></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Status</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="td font-semibold" style={{ color:"var(--t1)" }}>{u.firstName} {u.lastName||""}</td>
                  <td className="td">{u.email}</td>
                  <td className="td capitalize">{u.role?.name || roleName(u.roleId)}</td>
                  <td className="td"><StatusBadge status={u.status}/></td>
                </tr>
              ))}
              {users.length===0 && <tr><td colSpan={4} className="td py-0"><div className="empty-state !py-8"><div className="empty-icon"><Users size={16}/></div><p className="empty-desc">No team members yet.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Messenger API ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* API Status Card */}
        <div className="card-raised p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="icon-box-sm"><Radio size={13}/></div>
            <h3 className="font-bold text-[12.5px]" style={{ color:"var(--t1)" }}>Messenger API Status</h3>
          </div>
          {messengerStatus ? (
            <div className="space-y-3">
              <div
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: messengerStatus.tokenValid ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}
              >
                {messengerStatus.tokenValid
                  ? <CheckCircle size={18} className="text-green-500 flex-shrink-0"/>
                  : <XCircle size={18} className="text-red-500 flex-shrink-0"/>
                }
                <div>
                  <p className="font-semibold text-[12px]" style={{ color:"var(--t1)" }}>
                    {messengerStatus.tokenValid ? "Connected & Authenticated" : "Authentication Failed"}
                  </p>
                  <p className="text-[11px]" style={{ color:"var(--t3)" }}>
                    {messengerStatus.tokenValid
                      ? "API key is valid and active"
                      : "Check MESSENGER_API_KEY in backend .env"}
                  </p>
                </div>
              </div>
              <div>
                <label className="label">Base URL</label>
                <input className="input" value={messengerStatus.baseUrl} disabled/>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-24"><span className="loading-row"><span className="spinner"/></span></div>
          )}
        </div>

        {/* Webhook Management Card */}
        <div className="card-raised p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="icon-box-sm"><Webhook size={13}/></div>
            <h3 className="font-bold text-[12.5px]" style={{ color:"var(--t1)" }}>Webhook Management</h3>
          </div>
          <div className="space-y-4">
            {webhookInfo?.data?.url && (
              <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background:"rgba(59,130,246,0.08)" }}>
                <CheckCircle size={14} className="text-blue-500 mt-0.5 flex-shrink-0"/>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium" style={{ color:"var(--t2)" }}>Current webhook</p>
                  <p className="text-[11px] break-all" style={{ color:"var(--t3)" }}>{webhookInfo.data.url}</p>
                </div>
              </div>
            )}
            <div>
              <label className="label">Webhook URL</label>
              <input
                className="input"
                placeholder="https://yourdomain.com/api/v1/messages/webhook"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={registerWebhook} disabled={webhookLoading}>
                {webhookLoading ? <span className="spinner"/> : <><Webhook size={12}/> Register Webhook</>}
              </button>
              {webhookInfo?.data?.url && (
                <button className="btn-danger" onClick={deleteWebhook} disabled={webhookLoading} title="Delete webhook">
                  <Trash2 size={13}/>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
