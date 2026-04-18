import { useQuery } from "@tanstack/react-query";
import { AlertCircle, MessageSquare } from "lucide-react";
import { Link } from "react-router";
import { LoadingState } from "~/components/shared/LoadingState";
import { PageHeader } from "~/components/shared/PageHeader";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import type { Route } from "./+types/boards";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "게시판" }, { name: "description", content: "게시판 목록" }];
}

interface Board {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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

export default function Boards() {
  const { isLoading: authLoading } = useAuth();

  const {
    data: boards,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["boards"],
    queryFn: fetchBoards,
  });

  if (authLoading || isLoading) {
    return <LoadingState message="게시판 목록을 불러오는 중..." />;
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
            <EmptyDescription>
              게시판 목록을 불러올 수 없습니다
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => refetch()}>다시 시도</Button>
        </Empty>
      </div>
    );
  }

  if (!boards || boards.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquare />
            </EmptyMedia>
            <EmptyTitle>게시판이 없습니다</EmptyTitle>
            <EmptyDescription>아직 생성된 게시판이 없습니다</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <PageHeader
        eyebrow="게시판"
        icon={MessageSquare}
        title="전체 게시판"
        description="모든 게시판을 한자리에서 둘러봐요"
        tone="lilac"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {boards.map((board) => (
          <Link key={board.id} to={`/boards/${board.slug}`}>
            <Card className="hover:bg-accent transition-colors h-full">
              <CardHeader>
                <CardTitle>{board.name}</CardTitle>
                {board.description && (
                  <CardDescription>{board.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  게시글 보기
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
