import { useQuery } from "@tanstack/react-query";
import { AlertCircle, MessageSquare, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { BoardPostList } from "~/components/BoardPostList";
import { HashtagFilter } from "~/components/HashtagFilter";
import { LoadingState } from "~/components/shared/LoadingState";
import { PageHeader } from "~/components/shared/PageHeader";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import type { Route } from "./+types/boards.$boardSlug";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `게시판 - ${params.boardSlug}` },
    { name: "description", content: "게시판" },
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

async function fetchBoardHashtags(boardSlug: string): Promise<string[]> {
  const res = await api.console.board[":board_slug"].hashtags.$get({
    param: { board_slug: boardSlug },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch board hashtags");
  }
  const json = await res.json();
  return json.data;
}

export default function BoardDetail({ params }: Route.ComponentProps) {
  const { boardSlug } = params;
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);

  const {
    data: board,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["board", boardSlug],
    queryFn: () => fetchBoard(boardSlug),
  });

  const { data: allHashtags = [] } = useQuery({
    queryKey: ["board-hashtags", boardSlug],
    queryFn: () => fetchBoardHashtags(boardSlug),
  });

  const toggleHashtag = (hashtag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(hashtag)
        ? prev.filter((h) => h !== hashtag)
        : [...prev, hashtag],
    );
  };

  if (authLoading || isLoading) {
    return <LoadingState message="게시판을 불러오는 중..." />;
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
      <PageHeader
        eyebrow="게시판"
        icon={MessageSquare}
        title={board.name}
        description={board.description ?? undefined}
        tone="lilac"
        actions={
          isAuthenticated ? (
            <Button asChild className="rounded-full">
              <Link to={`/boards/${boardSlug}/create`}>
                <Plus className="h-4 w-4" />
                게시물 작성
              </Link>
            </Button>
          ) : undefined
        }
      />

      <HashtagFilter
        allHashtags={allHashtags}
        selectedHashtags={selectedHashtags}
        onToggleHashtag={toggleHashtag}
        onClearFilters={() => setSelectedHashtags([])}
      />

      <div>
        <h2 className="text-2xl font-bold mb-4">게시물</h2>
        <BoardPostList
          boardSlug={boardSlug}
          hashtags={selectedHashtags.length > 0 ? selectedHashtags : undefined}
        />
      </div>
    </div>
  );
}
