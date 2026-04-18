import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  FileText,
  Globe,
  Home,
  LogIn,
  MessageSquare,
  Search,
  Settings,
  Star,
  UserCog,
  UserIcon,
  UserPlus,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import { cn } from "~/lib/utils";

interface Community {
  id: string;
  name: string;
  slug: string;
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

interface Board {
  id: string;
  name: string;
  slug: string;
}

async function fetchBoards(): Promise<Board[]> {
  const res = await api.console.boards.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch boards");
  }
  const json = await res.json();
  return json.data;
}

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
  onClick?: () => void;
}

function NavLink({ to, icon, children, badge, onClick }: NavLinkProps) {
  const location = useLocation();
  const isActive =
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {badge !== undefined && badge > 0 && (
        <Badge className="bg-butter/40 text-butter-ink">{badge}</Badge>
      )}
    </Link>
  );
}

function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <h3 className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  const { data: communities } = useQuery({
    queryKey: ["communities", "mine"],
    queryFn: fetchMyCommunities,
    enabled: isAuthenticated,
  });

  const { data: boards } = useQuery({
    queryKey: ["boards"],
    queryFn: fetchBoards,
  });

  const totalPendingApplications =
    communities
      ?.filter((c) => c.role === "owner" || c.role === "moderator")
      .reduce((sum, c) => sum + (c.pending_application_count || 0), 0) || 0;

  // Check if we're on auth pages (login, signup, etc.)
  const isAuthPage = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ].some((path) => location.pathname.startsWith(path));

  return (
    <aside className="w-52 border-r border-border bg-card flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2" onClick={onNavigate}>
          <span className="commu-ng">
            <Star className="h-8 w-8" />
          </span>
          <span className="text-xl font-bold">커뮹!</span>
        </Link>
        <p className="text-xs text-muted-foreground mt-1">
          타임라인 기반 커뮤 플랫폼
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : isAuthenticated ? (
          <>
            {/* Email verification alert */}
            {user && !user.email_verified && (
              <div className="mx-3 mb-2 p-2 bg-destructive/10 border border-destructive/20 text-xs">
                <div className="flex items-center gap-1 text-destructive font-medium">
                  <AlertCircle className="h-3 w-3" />
                  이메일 인증 필요
                </div>
                <Link
                  to="/account"
                  className="text-destructive underline"
                  onClick={onNavigate}
                >
                  계정 설정에서 인증하세요
                </Link>
              </div>
            )}

            <NavSection title="커뮤">
              <NavLink
                to="/communities/mine"
                icon={<Home className="h-4 w-4" />}
                badge={totalPendingApplications}
                onClick={onNavigate}
              >
                내 커뮤
              </NavLink>
              <NavLink
                to="/communities"
                icon={<Search className="h-4 w-4" />}
                onClick={onNavigate}
              >
                커뮤 둘러보기
              </NavLink>
              <NavLink
                to="/applications"
                icon={<FileText className="h-4 w-4" />}
                onClick={onNavigate}
              >
                내 지원서
              </NavLink>
            </NavSection>

            {boards && boards.length > 0 && (
              <NavSection title="게시판">
                {boards.map((board) => (
                  <NavLink
                    key={board.id}
                    to={`/boards/${board.slug}`}
                    icon={<MessageSquare className="h-4 w-4" />}
                    onClick={onNavigate}
                  >
                    {board.name}
                  </NavLink>
                ))}
              </NavSection>
            )}

            {user?.is_admin && (
              <NavSection title="관리자">
                <NavLink
                  to="/admin/communities"
                  icon={<Globe className="h-4 w-4" />}
                  onClick={onNavigate}
                >
                  커뮤니티 관리
                </NavLink>
                <NavLink
                  to="/admin/boards"
                  icon={<Settings className="h-4 w-4" />}
                  onClick={onNavigate}
                >
                  게시판 관리
                </NavLink>
                <NavLink
                  to="/admin/masquerade"
                  icon={<UserCog className="h-4 w-4" />}
                  onClick={onNavigate}
                >
                  사용자 전환
                </NavLink>
              </NavSection>
            )}
          </>
        ) : (
          <>
            <NavSection title="둘러보기">
              <NavLink
                to="/communities"
                icon={<Search className="h-4 w-4" />}
                onClick={onNavigate}
              >
                커뮤 둘러보기
              </NavLink>
            </NavSection>

            {boards && boards.length > 0 && (
              <NavSection title="게시판">
                {boards.map((board) => (
                  <NavLink
                    key={board.id}
                    to={`/boards/${board.slug}`}
                    icon={<MessageSquare className="h-4 w-4" />}
                    onClick={onNavigate}
                  >
                    {board.name}
                  </NavLink>
                ))}
              </NavSection>
            )}

            {!isAuthPage && (
              <NavSection title="계정">
                <NavLink
                  to="/login"
                  icon={<LogIn className="h-4 w-4" />}
                  onClick={onNavigate}
                >
                  로그인
                </NavLink>
                <NavLink
                  to="/signup"
                  icon={<UserPlus className="h-4 w-4" />}
                  onClick={onNavigate}
                >
                  회원가입
                </NavLink>
              </NavSection>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between">
          {isAuthenticated ? (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="flex-1 justify-start"
            >
              <Link to="/account" onClick={onNavigate}>
                <UserIcon className="h-4 w-4 mr-2" />
                <span className="truncate">
                  {user?.login_name || user?.email}
                </span>
              </Link>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">로그인하세요</span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
