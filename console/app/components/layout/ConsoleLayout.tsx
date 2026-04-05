import { Menu } from "lucide-react";
import { useCallback, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Sidebar } from "./Sidebar";

interface ConsoleLayoutProps {
  children: React.ReactNode;
}

export function ConsoleLayout({ children }: ConsoleLayoutProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const closeSidebar = useCallback(() => {
    const el = overlayRef.current;
    if (el) {
      el.style.display = "none";
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    const el = overlayRef.current;
    if (el) {
      el.style.display = el.style.display === "none" ? "" : "none";
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay - always in DOM, hidden by default */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 md:hidden"
        style={{ display: "none" }}
      >
        <button
          type="button"
          className="fixed inset-0 bg-background/80 backdrop-blur-sm cursor-default"
          onClick={closeSidebar}
          aria-label="Close sidebar"
        />
        <div className="fixed inset-y-0 left-0 z-50 w-52">
          <Sidebar onNavigate={closeSidebar} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-40 flex items-center gap-4 border-b border-border bg-background px-4 py-3">
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-bold">커뮹!</span>
        </header>

        {/* Page Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
