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
      {isAuthenticated && (
        <>
          {/* Desktop Sidebar */}
          <div className="hidden lg:fixed lg:inset-y-0 lg:left-[max(0px,calc(50%-480px))] lg:block lg:w-[280px]">
            <SidebarNav
              communityName={communityName}
              consoleUrl={consoleUrl}
              unreadCount={unreadCount}
              unreadMessageCount={unreadMessageCount}
            />
          </div>

          {/* Tablet Sidebar (collapsed) */}
          <div className="hidden md:fixed md:inset-y-0 md:left-0 md:block md:w-[72px] lg:hidden">
            <SidebarNav
              communityName={communityName}
              consoleUrl={consoleUrl}
              unreadCount={unreadCount}
              unreadMessageCount={unreadMessageCount}
              collapsed
            />
          </div>

          {/* Mobile Header */}
          <header className="sticky top-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center justify-between md:hidden">
            <h1 className="font-bold text-lg text-foreground">
              {communityName}
            </h1>
          </header>
        </>
      )}

      {/* Main Content - rendered once */}
      <main
        className={
          isAuthenticated
            ? "min-h-screen pb-16 md:pb-0 md:ml-[72px] lg:ml-[280px] lg:mr-0 lg:max-w-[680px] lg:mx-auto lg:border-x lg:border-border"
            : ""
        }
      >
        {children}
      </main>

      {isAuthenticated && (
        /* Mobile Bottom Navigation */
        <div className="md:hidden">
          <MobileBottomNav
            unreadCount={unreadCount}
            unreadMessageCount={unreadMessageCount}
          />
        </div>
      )}
    </div>
  );
}
