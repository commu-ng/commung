import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Globe,
  Heart,
  Home,
  LayoutList,
  LogIn,
  Menu,
  Search,
  Sparkles,
  UserCog,
  UserIcon,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import { cn } from "~/lib/utils";

interface Community {
  id: string;
  role: string;
  pending_application_count?: number;
}

async function fetchMyCommunities(): Promise<Community[]> {
  const res = await api.console.communities.mine.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch communities");
  }
  const json = await res.json();
  return json.data;
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: number;
  authOnly?: boolean;
  adminOnly?: boolean;
}

function isPathActive(pathname: string, to: string, allPaths: string[]) {
  if (to === "/") return pathname === "/";
  if (pathname !== to && !pathname.startsWith(`${to}/`)) return false;
  return !allPaths.some(
    (other) =>
      other !== to &&
      other.startsWith(`${to}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
}

export function TopNav() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const { data: communities } = useQuery({
    queryKey: ["communities", "mine"],
    queryFn: fetchMyCommunities,
    enabled: isAuthenticated,
  });

  const totalPending =
    communities
      ?.filter((c) => c.role === "owner" || c.role === "moderator")
      .reduce((sum, c) => sum + (c.pending_application_count || 0), 0) || 0;

  const navItems: NavItem[] = [
    { to: "/", label: "홈", icon: Home },
    { to: "/communities", label: "커뮤 둘러보기", icon: Search },
    {
      to: "/communities/mine",
      label: "내 커뮤",
      icon: Heart,
      badge: totalPending,
      authOnly: true,
    },
    {
      to: "/applications",
      label: "내 지원서",
      icon: FileText,
      authOnly: true,
    },
  ];

  const accountItems: NavItem[] = [
    { to: "/account", label: "내 계정", icon: UserIcon, authOnly: true },
    {
      to: "/admin/communities",
      label: "커뮤니티 관리",
      icon: Globe,
      adminOnly: true,
    },
    {
      to: "/admin/boards",
      label: "게시판 관리",
      icon: LayoutList,
      adminOnly: true,
    },
    {
      to: "/admin/masquerade",
      label: "사용자 전환",
      icon: UserCog,
      adminOnly: true,
    },
  ];

  const visibleNav = navItems.filter((item) => {
    if (item.authOnly && !isAuthenticated) return false;
    return true;
  });

  const visibleAccount = accountItems.filter((item) => {
    if (item.authOnly && !isAuthenticated) return false;
    if (item.adminOnly && !user?.is_admin) return false;
    return true;
  });

  const allPaths = [...navItems, ...accountItems].map((item) => item.to);

  const renderNavLink = (
    item: NavItem,
    options: { onClick?: () => void; mobile?: boolean } = {},
  ) => {
    const Icon = item.icon;
    const active = isPathActive(location.pathname, item.to, allPaths);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={options.onClick}
        className={cn(
          "relative inline-flex items-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200",
          options.mobile
            ? "px-4 py-2.5 text-[15px] w-full"
            : "px-3.5 py-2 text-sm",
          active
            ? "bg-primary/15 text-primary shadow-marsh"
            : "text-foreground/75 hover:text-foreground hover:bg-accent/70",
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <Badge className="ml-0.5 bg-butter/40 text-butter-ink dark:bg-butter/25 px-2 py-0">
            {item.badge}
          </Badge>
        )}
      </Link>
    );
  };

  const renderAuthCta = (mobile: boolean) => {
    if (isLoading) return null;
    if (isAuthenticated) {
      return visibleAccount.map((item) =>
        renderNavLink(item, { mobile, onClick: () => setOpen(false) }),
      );
    }
    return (
      <>
        <Button
          asChild
          variant="outline"
          size={mobile ? "default" : "sm"}
          className={mobile ? "w-full" : ""}
        >
          <Link to="/login" onClick={() => setOpen(false)}>
            <LogIn className="h-4 w-4" />
            로그인
          </Link>
        </Button>
        <Button
          asChild
          size={mobile ? "default" : "sm"}
          className={mobile ? "w-full" : ""}
        >
          <Link to="/signup" onClick={() => setOpen(false)}>
            <UserPlus className="h-4 w-4" />
            회원가입
          </Link>
        </Button>
      </>
    );
  };

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3">
      <div className="mx-auto max-w-6xl rounded-full border border-border/70 bg-card/85 backdrop-blur-xl shadow-marsh-lg flex items-center gap-2 px-3 py-2">
        <Link
          to="/"
          aria-label="홈"
          className="bg-logo flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5 shadow-marsh transition-transform duration-300 hover:rotate-[-3deg] hover:scale-[1.02]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-card/30 backdrop-blur">
            <Heart
              className="h-4 w-4 text-primary-foreground"
              fill="currentColor"
              strokeWidth={1.5}
            />
          </span>
          <span className="font-display text-lg font-bold text-primary-foreground tracking-tight">
            커뮹!
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 ml-2">
          {visibleNav.map((item) => renderNavLink(item))}
        </nav>

        <div className="flex-1" />

        {/* Desktop right cluster */}
        <div className="hidden md:flex items-center gap-1.5">
          {renderAuthCta(false)}
          <ThemeToggle />
        </div>

        {/* Mobile trigger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="메뉴 열기"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-accent/60 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[300px] p-0 border-l border-border/70 bg-sidebar"
          >
            <SheetTitle className="sr-only">메뉴</SheetTitle>
            <div className="flex flex-col h-full py-4 px-4">
              <div className="flex items-center gap-3 px-1 pb-3">
                <span className="bg-logo flex h-11 w-11 items-center justify-center rounded-2xl shadow-marsh">
                  <Heart
                    className="h-5 w-5 text-primary-foreground"
                    fill="currentColor"
                    strokeWidth={1.5}
                  />
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="font-display text-2xl font-bold tracking-tight">
                    커뮹!
                  </span>
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    함께하는 우리의 커뮤
                  </span>
                </div>
              </div>

              <nav className="flex flex-col gap-1 mt-2 flex-1 overflow-y-auto">
                {visibleNav.map((item) =>
                  renderNavLink(item, {
                    mobile: true,
                    onClick: () => setOpen(false),
                  }),
                )}
              </nav>

              <div className="mt-3 flex flex-col gap-2">
                {renderAuthCta(true)}
                <div className="flex justify-center pt-2">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
