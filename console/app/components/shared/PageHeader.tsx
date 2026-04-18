import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Small label above the title (e.g. breadcrumb or section). */
  eyebrow?: string;
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Optional CTAs/actions on the right. */
  actions?: ReactNode;
  /** Render extra rich content below (e.g. tabs, filter row). */
  children?: ReactNode;
  /** Tone tints the eyebrow + soft background gradient. */
  tone?: "primary" | "mint" | "lilac" | "butter" | "blossom";
}

const TONES = {
  primary: {
    eyebrow: "text-primary",
    icon: "text-primary",
    iconBg: "bg-primary/15",
    blob: "from-primary/20 via-primary/10 to-transparent",
  },
  mint: {
    eyebrow: "text-mint-ink",
    icon: "text-mint-ink",
    iconBg: "bg-mint/40",
    blob: "from-mint/40 via-mint/20 to-transparent",
  },
  lilac: {
    eyebrow: "text-lilac-ink",
    icon: "text-lilac-ink",
    iconBg: "bg-lilac/40",
    blob: "from-lilac/40 via-lilac/20 to-transparent",
  },
  butter: {
    eyebrow: "text-butter-ink",
    icon: "text-butter-ink",
    iconBg: "bg-butter/40",
    blob: "from-butter/40 via-butter/20 to-transparent",
  },
  blossom: {
    eyebrow: "text-blossom-ink",
    icon: "text-blossom-ink",
    iconBg: "bg-blossom/40",
    blob: "from-blossom/40 via-blossom/20 to-transparent",
  },
} as const;

export function PageHeader({
  eyebrow,
  icon: Icon,
  title,
  description,
  actions,
  children,
  tone = "primary",
}: PageHeaderProps) {
  const t = TONES[tone];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 backdrop-blur-sm shadow-marsh px-6 sm:px-8 py-7 mb-6">
      <div
        className={`pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-gradient-to-br ${t.blob} blur-2xl`}
      />
      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {Icon && (
            <span
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${t.iconBg} ${t.icon} shadow-marsh`}
            >
              <Icon className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p
                className={`text-[11px] uppercase tracking-[0.18em] font-semibold ${t.eyebrow} mb-1.5`}
              >
                {eyebrow}
              </p>
            )}
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
      {children && <div className="relative mt-5">{children}</div>}
    </section>
  );
}
