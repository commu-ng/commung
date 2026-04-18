import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Edit2 } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { BoardPostForm } from "~/components/BoardPostForm";
import { LoadingState } from "~/components/shared/LoadingState";
import { PageHeader } from "~/components/shared/PageHeader";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import type { Route } from "./+types/boards.$boardSlug.posts.$postId.edit";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `게시물 수정 - ${params.boardSlug}` },
    { name: "description", content: "게시물 수정" },
  ];
}

interface BoardPost {
  id: string;
  title: string;
  content: string;
  image: {
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  } | null;
  hashtags: {
    id: string;
    tag: string;
  }[];
  author: {
    id: string;
    login_name: string;
  };
  created_at: string;
  updated_at: string;
}

async function fetchBoardPost(
  boardSlug: string,
  postId: string,
): Promise<BoardPost> {
  const res = await api.console.board[":board_slug"].posts[
    ":board_post_id"
  ].$get({
    param: { board_slug: boardSlug, board_post_id: postId },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch board post");
  }
  const json = await res.json();
  return json.data;
}

export default function EditBoardPost({ params }: Route.ComponentProps) {
  const { boardSlug, postId } = params;
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();

  const {
    data: post,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["board-post", boardSlug, postId],
    queryFn: () => fetchBoardPost(boardSlug, postId),
    enabled: isAuthenticated,
  });

  const handleSuccess = () => {
    navigate(`/boards/${boardSlug}`);
  };

  if (authLoading || isLoading) {
    return <LoadingState message="게시물을 불러오는 중..." />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center bg-background py-12">
        <div className="text-center space-y-6">
          <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
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

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>오류 발생</EmptyTitle>
            <EmptyDescription>게시물을 불러올 수 없습니다</EmptyDescription>
          </EmptyHeader>
          <div className="flex gap-2">
            <Button onClick={() => refetch()}>다시 시도</Button>
            <Button variant="outline" asChild>
              <Link to={`/boards/${boardSlug}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                게시판으로 돌아가기
              </Link>
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  // Check if user is the author
  if (post.author.id !== user?.id) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>권한 없음</EmptyTitle>
            <EmptyDescription>
              본인의 게시물만 수정할 수 있습니다
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" asChild>
            <Link to={`/boards/${boardSlug}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              게시판으로 돌아가기
            </Link>
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-2">
        <Button variant="ghost" asChild>
          <Link to={`/boards/${boardSlug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            게시판으로 돌아가기
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="게시글 수정"
        icon={Edit2}
        title="게시글 수정"
        description="내용을 다듬어요"
        tone="lilac"
      />

      <Card>
        <CardContent className="pt-6">
          <BoardPostForm
            boardSlug={boardSlug}
            postId={postId}
            initialData={{
              title: post.title,
              content: post.content,
              imageId: post.image?.id || null,
              imageUrl: post.image?.url || null,
              hashtags: post.hashtags.map((h) => h.tag),
            }}
            onSuccess={handleSuccess}
          />
        </CardContent>
      </Card>
    </div>
  );
}
