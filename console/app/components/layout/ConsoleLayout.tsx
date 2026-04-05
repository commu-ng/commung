import { Menu, X } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { Button } from "~/components/ui/button";
import { Sidebar } from "./Sidebar";

interface ConsoleLayoutProps {
  children: React.ReactNode;
}

export function ConsoleLayout({ children }: ConsoleLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSidebarClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="fixed inset-0 bg-background/80 backdrop-blur-sm cursor-default"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: event delegation to close sidebar on link click */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: event delegation to close sidebar on link click */}
          <div
            className="fixed inset-y-0 left-0 z-50 w-52"
            onClick={handleSidebarClick}
          >
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-40 flex items-center gap-4 border-b border-border bg-background px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <span className="font-bold">커뮹!</span>
        </header>

        {/* Page Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
