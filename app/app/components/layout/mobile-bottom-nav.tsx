import { Bell, Home, MessageCircle, Search, User } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useAuth } from "~/hooks/useAuth";

interface MobileBottomNavProps {
  unreadCount: number;
  unreadMessageCount: number;
}

export function MobileBottomNav({
  unreadCount,
  unreadMessageCount,
}: MobileBottomNavProps) {
  const location = useLocation();
  const { currentProfile } = useAuth();

  const getNavClasses = (path: string) => {
    const isActive =
      location.pathname === path ||
      (path === "/" && location.pathname === "/") ||
      (path !== "/" && location.pathname.startsWith(path));

    return `flex items-center justify-center flex-1 py-2 ${
      isActive ? "text-primary" : "text-muted-foreground"
    }`;
  };

  const navItems = [
    { to: "/", icon: Home },
    { to: "/search", icon: Search },
    {
      to: "/notifications",
      icon: Bell,
      badge: unreadCount,
    },
    {
      to: "/messages",
      icon: MessageCircle,
      badge: unreadMessageCount,
    },
    {
      to: currentProfile ? `/@${currentProfile.username}` : "/settings",
      icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 md:hidden">
      <div className="flex items-center justify-around h-12">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className={getNavClasses(item.to)}>
              <div className="relative">
                <Icon className="h-6 w-6" />
                {item.badge !== undefined && item.badge > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 rounded-full flex items-center justify-center px-0.5">
                    <span className="text-[9px] text-white font-bold">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
