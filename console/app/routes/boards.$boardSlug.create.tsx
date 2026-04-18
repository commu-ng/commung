import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Plus } from "lucide-react";
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
import type { Route } from "./+types/boards.$boardSlug.create";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `게시물 작성 - ${params.boardSlug}` },
    { name: "description", content: "새 게시물 작성" },
  ];
}

interface Board {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchBoard(boardSlug: string): Promise<Board> {
  const res = await api.console.board[":board_slug"].$get({
    param: { board_slug: boardSlug },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch board");
  }
  const json = await res.json();
  return json.data;
}

export default function CreateBoardPost({ params }: Route.ComponentProps) {
  const { boardSlug } = params;
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const {
    data: board,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["board", boardSlug],
    queryFn: () => fetchBoard(boardSlug),
    enabled: isAuthenticated,
  });

  const handleSuccess = () => {
    navigate(`/boards/${boardSlug}`);
  };

  if (authLoading || isLoading) {
    return <LoadingState message="게시판을 불러오는 중..." />;
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
            <EmptyDescription>게시판을 불러올 수 없습니다</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => refetch()}>다시 시도</Button>
        </Empty>
      </div>
    );
  }

  if (!board) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-2">
        <Button variant="ghost" asChild>
          <Link to={`/boards/${boardSlug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {board.name}로 돌아가기
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="글쓰기"
        icon={Plus}
        title="새 게시글"
        description={`${board.name}에 글을 올려요`}
        tone="lilac"
      />

      <Card>
        <CardContent className="pt-6">
          <BoardPostForm boardSlug={boardSlug} onSuccess={handleSuccess} />
        </CardContent>
      </Card>
    </div>
  );
}
