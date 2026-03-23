import type { ReactNode } from "react";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { SidebarNav } from "./sidebar-nav";

interface MastodonLayoutProps {
  children: ReactNode;
  isAuthenticated: boolean;
  communityName: string;
  consoleUrl: string;
  unreadCount: number;
  unreadMessageCount: number;
}

export function MastodonLayout({
  children,
  isAuthenticated,
  communityName,
  consoleUrl,
  unreadCount,
  unreadMessageCount,
}: MastodonLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isAuthenticated && (
        <header className="sticky top-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center justify-between md:hidden">
          <h1 className="font-bold text-lg text-foreground">{communityName}</h1>
        </header>
      )}

      {/* Responsive grid when authenticated, plain container otherwise */}
      <div
        className={
          isAuthenticated
            ? "md:grid md:grid-cols-[72px_1fr] lg:grid-cols-[280px_1fr] max-w-[960px] mx-auto"
            : ""
        }
      >
        {/* Sidebar: hidden on mobile, sticky on tablet+ */}
        {isAuthenticated && (
          <div className="hidden md:block sticky top-0 h-screen overflow-y-auto">
            {/* Tablet: collapsed sidebar */}
            <div className="lg:hidden">
              <SidebarNav
                communityName={communityName}
                consoleUrl={consoleUrl}
                unreadCount={unreadCount}
                unreadMessageCount={unreadMessageCount}
                collapsed
              />
            </div>
            {/* Desktop: full sidebar */}
            <div className="hidden lg:block">
              <SidebarNav
                communityName={communityName}
                consoleUrl={consoleUrl}
                unreadCount={unreadCount}
                unreadMessageCount={unreadMessageCount}
              />
            </div>
          </div>
        )}

        {/* Main Content - always at same tree position */}
        <main
          className={
            isAuthenticated
              ? "min-h-screen border-x border-border pb-16 md:pb-0"
              : "min-h-screen"
          }
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isAuthenticated && (
        <MobileBottomNav
          unreadCount={unreadCount}
          unreadMessageCount={unreadMessageCount}
        />
      )}
    </div>
  );
}
