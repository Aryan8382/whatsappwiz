export function formatTime(iso?: string | number | null | Date): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso?: string | number | null | Date): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

export function formatDateTime(iso?: string | number | null | Date): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatExactTimeOrDate(iso?: string | number | null | Date): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return `${d.toLocaleDateString([], { day: "2-digit", month: "short" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first || "?").charAt(0)}${(last || "").charAt(0) || ""}`.toUpperCase();
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    rejected: "bg-red-100 text-red-700",
    draft: "bg-gray-100 text-gray-600",
    running: "bg-blue-100 text-blue-700",
    paused: "bg-amber-100 text-amber-700",
    completed: "bg-green-100 text-green-700",
    scheduled: "bg-indigo-100 text-indigo-700",
    failed: "bg-red-100 text-red-700",
    sent: "bg-blue-100 text-blue-700",
    delivered: "bg-green-100 text-green-700",
    read: "bg-emerald-100 text-emerald-700",
    received: "bg-gray-100 text-gray-600",
    open: "bg-green-100 text-green-700",
    pending_conv: "bg-amber-100 text-amber-700",
    resolved: "bg-blue-100 text-blue-700",
    closed: "bg-gray-200 text-gray-500",
    active: "bg-green-100 text-green-700",
    inactive: "bg-gray-100 text-gray-500",
    connected: "bg-green-100 text-green-700",
    disconnected: "bg-red-100 text-red-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}
