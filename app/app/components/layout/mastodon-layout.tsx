import type { ReactNode } from "react";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { SidebarNav } from "./sidebar-nav";

interface MastodonLayoutProps {
  children: ReactNode;
  communityName: string;
  consoleUrl: string;
  unreadCount: number;
  unreadMessageCount: number;
}

export function MastodonLayout({
  children,
  communityName,
  consoleUrl,
  unreadCount,
  unreadMessageCount,
}: MastodonLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Layout: 2-column grid */}
      <div className="hidden lg:grid lg:grid-cols-[280px_1fr] max-w-[960px] mx-auto">
        {/* Left Sidebar */}
        <SidebarNav
          communityName={communityName}
          consoleUrl={consoleUrl}
          unreadCount={unreadCount}
          unreadMessageCount={unreadMessageCount}
        />

        {/* Main Content */}
        <main className="min-h-screen border-x border-border">{children}</main>
      </div>

      {/* Tablet Layout: 2-column with collapsed sidebar */}
      <div className="hidden md:grid md:grid-cols-[72px_1fr] lg:hidden max-w-[1100px] mx-auto">
        {/* Collapsed Sidebar */}
        <SidebarNav
          communityName={communityName}
          consoleUrl={consoleUrl}
          unreadCount={unreadCount}
          unreadMessageCount={unreadMessageCount}
          collapsed
        />

        {/* Main Content */}
        <main className="min-h-screen border-x border-border">{children}</main>
      </div>

      {/* Mobile Layout: Single column */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold text-lg text-foreground">{communityName}</h1>
        </header>

        {/* Main Content */}
        <main className="pb-16">{children}</main>

        {/* Bottom Navigation */}
        <MobileBottomNav
          unreadCount={unreadCount}
          unreadMessageCount={unreadMessageCount}
        />
      </div>
    </div>
  );
}
