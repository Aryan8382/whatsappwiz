"use client";

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    approved:    "badge-green",
    active:      "badge-green",
    connected:   "badge-green",
    completed:   "badge-green",
    delivered:   "badge-green",
    read:        "badge-green",
    open:        "badge-green",
    resolved:    "badge-green",
    running:     "badge-green",
    sent:        "badge-green",
    pending:     "badge-amber",
    paused:      "badge-amber",
    scheduled:   "badge-amber",
    draft:       "badge-gray",
    received:    "badge-gray",
    closed:      "badge-gray",
    inactive:    "badge-gray",
    rejected:    "badge-red",
    failed:      "badge-red",
    disconnected:"badge-red",
  };
  return map[status] ?? "badge-gray";
}

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={statusBadgeClass(status)}>
      {label ?? status}
    </span>
  );
}
