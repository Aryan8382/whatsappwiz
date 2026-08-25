"use client";

import { useEffect, useState } from "react";
import { Users as UsersIcon } from "lucide-react";
import { api } from "@/lib/api";
import StatusBadge from "@/components/ui/status-badge";

/*
  Dedicated "Users" nav page.
  Reuses the existing /users and /users/roles endpoints (already used on
  the Settings page) to show a read-only team directory. User creation /
  editing stays on Settings → Team members, so this page adds a proper
  top-level view without touching or duplicating that existing logic.
*/
export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any>("/users").then(d => setUsers(d.items || d || [])).catch(() => {}),
      api.get<any[]>("/users/roles").then(setRoles).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const roleName = (id: number) => roles.find(r => r.id === id)?.name || "—";

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>Users</h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>
            Everyone with access to this organization.
          </p>
        </div>
      </div>

      <div className="card-raised overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><span className="loading-row"><span className="spinner" /></span></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Email</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="td font-semibold" style={{ color: "var(--t1)" }}>{u.firstName} {u.lastName || ""}</td>
                    <td className="td">{u.email}</td>
                    <td className="td capitalize">{u.role?.name || roleName(u.roleId)}</td>
                    <td className="td"><StatusBadge status={u.status} /></td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="td py-0">
                      <div className="empty-state">
                        <div className="empty-icon"><UsersIcon size={20} /></div>
                        <p className="empty-title">No users found</p>
                        <p className="empty-desc">Add team members from Settings → Team members.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
