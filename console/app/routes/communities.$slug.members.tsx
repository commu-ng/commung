import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import { Link, useParams } from "react-router";
import { CommunityMemberManagement } from "~/components/CommunityMemberManagement";
import { PageHeader } from "~/components/shared/PageHeader";
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
import type { Route } from "./+types/communities.$slug.members";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "멤버 관리" },
    {
      name: "description",
      content: "커뮤 멤버를 관리할 수 있습니다",
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

export default function CommunityMembers() {
  const { slug } = useParams();
  const { user: currentUser } = useAuth();

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

  // Check if user has permission to access member management (owner only)
  const hasAccess = userRole === "owner";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-9 w-32" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
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
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                멤버 관리
              </CardTitle>
              <CardDescription>멤버 관리 권한이 없습니다</CardDescription>
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-2">
          <Link to={`/communities/${slug}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              커뮤로 돌아가기
            </Button>
          </Link>
        </div>

        <PageHeader
          eyebrow="운영"
          icon={Users}
          title="멤버 관리"
          description="커뮤 멤버를 살펴보고 역할을 조정해요"
          tone="lilac"
        />

        <Card>
          <CardContent className="pt-6">
            {currentUser && slug && (
              <CommunityMemberManagement
                communityId={slug}
                currentUserRole={userRole}
                currentUserId={currentUser.id}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
