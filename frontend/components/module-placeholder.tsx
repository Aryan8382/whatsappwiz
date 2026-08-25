import { LucideIcon } from "lucide-react";

/**
 * ModulePlaceholder
 * ──────────────────
 * A clean, on-brand "module shell" used for new nav pages that don't have
 * a backend module wired up yet. Keeps every new page visually consistent
 * with the rest of the app (page-wrapper / card-raised / empty-state) so
 * they open properly instead of 404ing, and are ready to be wired to real
 * data later without any layout rework.
 */
export default function ModulePlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.01em" }}>
            {title}
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>{description}</p>
        </div>
      </div>

      <div className="card-raised">
        <div className="empty-state">
          <div className="empty-icon">
            <Icon size={22} />
          </div>
          <p className="empty-title">{title} is coming soon</p>
          <p className="empty-desc">
            This module is set up and ready in the navigation — we&apos;ll wire up the full experience here next.
          </p>
        </div>
      </div>
    </div>
  );
}
