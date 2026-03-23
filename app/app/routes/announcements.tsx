import { ArrowLeft, Megaphone } from "lucide-react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PostCard } from "~/components/post-card";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { client } from "~/lib/api-client";

export default function Announcements() {
  const { currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const currentProfileId = currentProfile?.id;

  const {
    data: announcements = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["announcements", currentProfileId],
    queryFn: async () => {
      const response = await client.app.announcements.$get({
        query: currentProfileId ? { profile_id: currentProfileId } : {},
      });

      if (!response.ok) {
        throw new Error("공지사항을 불러오는 데 실패했습니다");
      }

      const result = await response.json();
      return result.data;
    },
  });

  const handleAnnouncementDelete = () => {
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          <p className="text-muted-foreground">공지사항을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {error.message}
          </h1>
          <Link
            to="/"
            className="text-primary hover:text-primary/90 font-medium"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {announcements.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              아직 공지사항이 없습니다
            </h3>
            <p className="text-muted-foreground mb-4">
              커뮤 운영자가 공지사항을 게시하면 여기에 표시됩니다.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/90 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {announcements.map((announcement) => (
              <PostCard
                key={announcement.id}
                post={announcement}
                currentProfileId={currentProfileId}
                onDelete={handleAnnouncementDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
