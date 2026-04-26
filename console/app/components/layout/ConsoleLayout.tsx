import { NavigationProgress } from "../NavigationProgress";
import { TopNav } from "./TopNav";

interface ConsoleLayoutProps {
  children: React.ReactNode;
}

export function ConsoleLayout({ children }: ConsoleLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavigationProgress />
      <TopNav />
      <main className="flex-1 pb-12">{children}</main>
    </div>
  );
}
