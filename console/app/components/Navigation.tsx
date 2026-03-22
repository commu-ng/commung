import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  FileText,
  Home,
  LogIn,
  MessageSquare,
  Search,
  Star,
  UserIcon,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router";
import { AdministratorNavigation } from "~/components/AdministratorNavigation";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface Community {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  role: string;
  custom_domain?: string | null;
  domain_verified?: string | null;
  banner_image_url?: string | null;
  banner_image_width?: number | null;
  banner_image_height?: number | null;
  hashtags?: { id: string; tag: string }[];
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
  description: string | null;
  allow_comments: boolean;
  created_at: string;
  updated_at: string;
}

async function fetchBoards(): Promise<Board[]> {
  const res = await api.console.boards.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch boards");
  }
  const json = await res.json();
  return json.data;
}

export function Navigation() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Fetch communities to get pending application counts
  const { data: communities } = useQuery({
    queryKey: ["communities", "mine"],
    queryFn: fetchMyCommunities,
    enabled: isAuthenticated,
  });

  // Fetch boards
  const { data: boards } = useQuery({
    queryKey: ["boards"],
    queryFn: fetchBoards,
  });

  // Calculate total pending applications across owned/moderated communities
  const totalPendingApplications =
    communities
      ?.filter((c) => c.role === "owner" || c.role === "moderator")
      .reduce((sum, c) => sum + (c.pending_application_count || 0), 0) || 0;

  return (
    <nav>
      <div className="flex flex-col items-center justify-center bg-background space-y-6 py-8 px-4">
        <h1 className="text-4xl font-bold text-foreground flex flex-col items-center gap-2">
          <span className="text-6xl commu-ng">
            <Star width={48} height={48} />
          </span>
          <Link to="/" className="flex items-center gap-2">
            커뮹!
          </Link>
        </h1>
        <p className="text-muted-foreground max-w-2xl text-center">
          타임라인 기반 커뮤 플랫폼
        </p>

        {isAuthenticated && user && !user.email_verified && (
          <Alert variant="destructive" className="max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>이메일 인증이 필요합니다</AlertTitle>
            <AlertDescription>
              비밀번호 재설정, 커뮤 지원서 알림 수신 등 중요한 기능을 사용하려면
              이메일 인증이 필요합니다.{" "}
              <Link to="/account" className="underline font-medium">
                계정 설정에서 이메일을 인증하세요
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap justify-center gap-2 max-w-2xl w-full">
          {isLoading ? (
            <div className="col-span-2 sm:col-span-3 flex justify-center py-2">
              <Spinner />
            </div>
          ) : isAuthenticated ? (
            <>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto relative"
              >
                <Link to="/communities/mine">
                  <Home className="h-4 w-4" />내 커뮤
                  {totalPendingApplications > 0 && (
                    <Badge className="ml-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      {totalPendingApplications}
                    </Badge>
                  )}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto"
              >
                <Link to="/communities">
                  <Search className="h-4 w-4" />
                  커뮤 둘러보기
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto"
              >
                <Link to="/applications">
                  <FileText className="h-4 w-4" />내 지원서
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto"
              >
                <Link to="/account">
                  <UserIcon className="h-4 w-4" />내 계정
                </Link>
              </Button>
              <ThemeToggle />
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto col-span-2"
              >
                <Link to="/communities">
                  <Search className="h-4 w-4" />
                  커뮤 둘러보기
                </Link>
              </Button>
              <Button size="sm" asChild className="w-full md:w-auto">
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  로그인
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto"
              >
                <Link to="/signup">
                  <UserPlus className="h-4 w-4" />
                  회원가입
                </Link>
              </Button>
              <ThemeToggle />
            </>
          )}
        </div>

        {/* Boards Navigation */}
        {boards && boards.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl w-full">
            {boards.map((board) => (
              <Button
                key={board.id}
                variant="ghost"
                size="sm"
                asChild
                className="text-muted-foreground hover:text-foreground"
              >
                <Link to={`/boards/${board.slug}`}>
                  <MessageSquare className="h-4 w-4" />
                  {board.name}
                </Link>
              </Button>
            ))}
          </div>
        )}

        {/* Administrator Navigation */}
        {isAuthenticated && user?.is_admin && <AdministratorNavigation />}
      </div>
    </nav>
  );
}
