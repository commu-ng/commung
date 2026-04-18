import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Link as LinkIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { CommunityLinksManager } from "~/components/CommunityLinksManager";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import type { Route } from "./+types/communities.$slug.links";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "링크 관리" },
    {
      name: "description",
      content: "커뮤 링크를 관리할 수 있습니다",
    },
  ];
}

interface Community {
  id: string;
  name: string;
  slug: string;
  owner_profile_id: string | null;
  user_role?: string | null;
}

// Fetch function
async function fetchCommunity(slug: string): Promise<Community> {
  const response = await api.console.communities[":id"].$get({
    param: { id: slug },
  });
  if (!response.ok) {
    throw new Error("커뮤 정보를 가져오는데 실패했습니다");
  }
  const result = await response.json();
  return result.data;
}

export default function CommunityLinks() {
  const { slug } = useParams();
  const { user: _currentUser } = useAuth();

  // Fetch community data (includes user_role)
  const {
    data: community,
    isLoading,
    error: communityError,
  } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => fetchCommunity(slug ?? ""),
    enabled: !!slug,
  });

  const userRole = community?.user_role as
    | "owner"
    | "moderator"
    | "member"
    | null;
  const error = communityError ? (communityError as Error).message : "";

  // Check if user has permission to access link management (owners only)
  const hasAccess = userRole === "owner";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-9 w-32" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-destructive mb-4">{error}</div>
              <Link to="/communities/mine">
                <Button variant="outline">내 커뮤로 돌아가기</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-muted p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                링크 관리
              </CardTitle>
              <CardDescription>
                링크 관리 권한이 없습니다. 커뮤 소유자만 링크를 관리할 수
                있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <Link to={`/communities/${slug}`}>
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    커뮤로 돌아가기
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to={`/communities/${slug}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              커뮤로 돌아가기
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              링크 관리
            </CardTitle>
            <CardDescription>
              {community?.name} 커뮤의 링크를 관리할 수 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {slug && <CommunityLinksManager communityId={slug} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
