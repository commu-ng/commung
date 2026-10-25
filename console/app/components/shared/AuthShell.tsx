import { MessagesSquare, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface AuthShellProps {
  /** Form/content card. */
  children: ReactNode;
  /** Headline above the card. */
  title: ReactNode;
  /** Sub-line below the title. */
  description?: ReactNode;
  /** Small label above the title (e.g. "환영해요" / "비밀번호 찾기"). */
  eyebrow?: string;
}

/**
 * Centered, friendly auth shell used by login/forgot/reset/verify/etc.
 * Pairs a soft hero with the form card.
 */
export function AuthShell({
  children,
  title,
  description,
  eyebrow,
}: AuthShellProps) {
  return (
    <div className="relative min-h-[calc(100vh-6rem)] flex items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute top-10 left-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-br from-blossom/40 via-primary/15 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-1/4 h-64 w-64 translate-x-1/2 rounded-full bg-gradient-to-tr from-mint/40 via-lilac/20 to-transparent blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-7">
          <Link
            to="/"
            aria-label="홈"
            className="bg-logo inline-flex h-14 w-14 items-center justify-center rounded-3xl shadow-marsh transition-transform hover:rotate-[-6deg] hover:scale-105"
          >
            <MessagesSquare
              className="h-6 w-6 text-primary-foreground"
              strokeWidth={1.75}
            />
          </Link>
          {eyebrow && (
            <p className="mt-5 text-[11px] uppercase tracking-[0.2em] font-semibold text-primary inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-2 text-foreground leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed max-w-sm mx-auto">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
