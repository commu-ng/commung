import { Heart, Plus } from "lucide-react";
import { Link } from "react-router";
import { CommunityList } from "~/components/CommunityList";
import { PageHeader } from "~/components/shared/PageHeader";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useAuth } from "~/hooks/useAuth";
import type { Route } from "./+types/communities.mine";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "내 커뮤" },
    { name: "description", content: "내 커뮤 목록" },
  ];
}

export default function MyCommunities() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="mb-8">
          <Skeleton className="h-9 w-32 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <div className="flex gap-4">
            <Button asChild>
              <Link to="/login">로그인</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/signup">회원가입</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <PageHeader
        eyebrow="내 커뮤"
        icon={Heart}
        title="내 커뮤"
        description="참여 중인 커뮤를 한눈에 확인해요"
        tone="blossom"
        actions={
          <Button asChild className="rounded-full">
            <Link to="/communities/create">
              <Plus className="h-4 w-4" />
              커뮤 만들기
            </Link>
          </Button>
        }
      />
      <CommunityList showHeader={false} />
    </div>
  );
}
