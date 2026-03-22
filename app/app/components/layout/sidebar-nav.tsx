import {
  Bell,
  Bookmark,
  ExternalLink,
  Hash,
  Home,
  LayoutList,
  Megaphone,
  MessageCircle,
  PenSquare,
  Search,
  Settings,
  UserCheck,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { ProfileSwitcher } from "~/components/profile-switcher";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Button } from "~/components/ui/button";

interface SidebarNavProps {
  communityName: string;
  consoleUrl: string;
  unreadCount: number;
  unreadMessageCount: number;
  collapsed?: boolean;
}

export function SidebarNav({
  communityName,
  consoleUrl,
  unreadCount,
  unreadMessageCount,
  collapsed = false,
}: SidebarNavProps) {
  const location = useLocation();

  const getNavLinkClasses = (path: string) => {
    const isActive =
      location.pathname === path ||
      (path === "/" && location.pathname === "/") ||
      (path !== "/" && location.pathname.startsWith(path));

    const baseClasses = collapsed
      ? "flex items-center justify-center p-3 rounded-full transition-colors"
      : "flex items-center gap-3 px-4 py-3 text-base rounded-full transition-colors w-full";

    if (isActive) {
      return `${baseClasses} text-foreground bg-accent font-bold`;
    }

    return `${baseClasses} text-foreground hover:bg-accent`;
  };

  const navigationItems = [
    { to: "/", icon: Home, label: "홈" },
    {
      to: "/notifications",
      icon: Bell,
      label: "알림",
      badge: unreadCount,
    },
    {
      to: "/messages",
      icon: MessageCircle,
      label: "메시지",
      badge: unreadMessageCount,
    },
    {
      to: "/announcements",
      icon: Megaphone,
      label: "공지사항",
    },
    { to: "/boards", icon: LayoutList, label: "게시판" },
    { to: "/bookmarks", icon: Bookmark, label: "북마크" },
    { to: "/search", icon: Search, label: "검색" },
    { to: "/profiles", icon: UserCheck, label: "멤버" },
    { to: "/settings", icon: Settings, label: "설정" },
  ];

  return (
    <aside
      className={`flex flex-col h-screen sticky top-0 ${collapsed ? "w-[72px] items-center" : "w-[280px]"} py-2 px-3`}
    >
      {/* Community Logo/Name */}
      <div
        className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} py-3 px-2`}
      >
        <Link
          to="/"
          className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0"
        >
          <Hash className="h-5 w-5 text-primary-foreground" />
        </Link>
        {!collapsed && (
          <h1 className="font-bold text-xl text-foreground truncate">
            {communityName || "커뮤"}
          </h1>
        )}
      </div>

      {/* Profile Switcher */}
      <div className={`${collapsed ? "mt-2" : "mt-2 px-2"}`}>
        <ProfileSwitcher compact={collapsed} />
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-1 mt-4 flex-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={getNavLinkClasses(item.to)}
              title={item.label}
            >
              <div className="relative">
                <Icon className="h-6 w-6" />
                {item.badge !== undefined && item.badge > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center px-1">
                    <span className="text-[10px] text-white font-bold">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  </div>
                )}
              </div>
              {!collapsed && <span className="text-lg">{item.label}</span>}
            </Link>
          );
        })}

        {/* Compose Button */}
        <Link to="/" className="mt-4">
          <Button
            className={`${collapsed ? "w-12 h-12 p-0 rounded-full" : "w-full py-3 text-lg font-bold rounded-full"}`}
            size={collapsed ? "icon" : "lg"}
          >
            <PenSquare className={collapsed ? "h-5 w-5" : "h-5 w-5 mr-2"} />
            {!collapsed && "새 글"}
          </Button>
        </Link>
      </nav>

      {/* Bottom Section */}
      <div
        className={`flex ${collapsed ? "flex-col items-center gap-2" : "items-center justify-between"} py-3`}
      >
        <ThemeToggle />
        {!collapsed && (
          <a
            target="_blank"
            href={consoleUrl}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            title="콘솔로 이동"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            <span>콘솔</span>
          </a>
        )}
      </div>
    </aside>
  );
}
