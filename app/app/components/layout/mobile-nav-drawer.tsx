import { useState } from "react";
import {
  Bell,
  Bookmark,
  ExternalLink,
  Hash,
  Home,
  LayoutList,
  Menu,
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
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";

interface MobileNavDrawerProps {
  communityName: string;
  consoleUrl: string;
  unreadCount: number;
  unreadMessageCount: number;
}

export function MobileNavDrawer({
  communityName,
  consoleUrl,
  unreadCount,
  unreadMessageCount,
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const getNavLinkClasses = (path: string) => {
    const isActive =
      location.pathname === path ||
      (path === "/" && location.pathname === "/") ||
      (path !== "/" && location.pathname.startsWith(path));

    const baseClasses =
      "flex items-center gap-3 px-4 py-3 text-base rounded-full transition-colors w-full";

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1 -ml-1 text-foreground"
        aria-label="메뉴 열기"
      >
        <Menu className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          <div className="flex flex-col h-full py-2 px-3">
            {/* Community Logo/Name */}
            <div className="flex items-center gap-3 py-3 px-2">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0"
              >
                <Hash className="h-5 w-5 text-primary-foreground" />
              </Link>
              <h2 className="font-bold text-xl text-foreground truncate">
                {communityName || "커뮤"}
              </h2>
            </div>

            {/* Profile Switcher */}
            <div className="mt-2 px-2">
              <ProfileSwitcher compact={false} />
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
                    onClick={() => setOpen(false)}
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
                    <span className="text-lg">{item.label}</span>
                  </Link>
                );
              })}

              {/* Compose Button */}
              <Link to="/" onClick={() => setOpen(false)} className="mt-4">
                <Button
                  className="w-full py-3 text-lg font-bold rounded-full"
                  size="lg"
                >
                  <PenSquare className="h-5 w-5 mr-2" />새 글
                </Button>
              </Link>
            </nav>

            {/* Bottom Section */}
            <div className="flex items-center justify-between py-3">
              <ThemeToggle />
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
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
