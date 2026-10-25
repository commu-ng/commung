import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Edit,
  LayoutList,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { LoadingState } from "~/components/shared/LoadingState";
import { PageHeader } from "~/components/shared/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/admin.boards";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "게시판 관리" },
    { name: "description", content: "게시판 생성 및 관리" },
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

async function fetchBoards(): Promise<Board[]> {
  const res = await api.console.boards.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch boards");
  }
  const json = await res.json();
  return json.data;
}

export default function AdminBoards() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);

  const nameId = useId();
  const slugId = useId();
  const descriptionId = useId();

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
  });

  const {
    data: boards,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["boards"],
    queryFn: fetchBoards,
    enabled: isAuthenticated,
  });

  const createBoardMutation = useMutation({
    mutationFn: async () => {
      const res = await api.console.boards.$post({
        json: {
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          getErrorMessage(errorData, "게시판 생성에 실패했습니다"),
        );
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success("게시판이 성공적으로 생성되었습니다");
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setIsCreateDialogOpen(false);
      setFormData({ name: "", slug: "", description: "" });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateBoardMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoard) return;
      const res = await api.console.boards[":board_id"].$patch({
        param: { board_id: selectedBoard.id },
        json: {
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          getErrorMessage(errorData, "게시판 수정에 실패했습니다"),
        );
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success("게시판이 성공적으로 수정되었습니다");
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setIsEditDialogOpen(false);
      setSelectedBoard(null);
      setFormData({ name: "", slug: "", description: "" });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (boardId: string) => {
      const res = await api.console.boards[":board_id"].$delete({
        param: { board_id: boardId },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          getErrorMessage(errorData, "게시판 삭제에 실패했습니다"),
        );
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success("게시판이 성공적으로 삭제되었습니다");
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setIsDeleteDialogOpen(false);
      setSelectedBoard(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCreateClick = () => {
    setFormData({ name: "", slug: "", description: "" });
    setIsCreateDialogOpen(true);
  };

  const handleEditClick = (board: Board) => {
    setSelectedBoard(board);
    setFormData({
      name: board.name,
      slug: board.slug,
      description: board.description || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (board: Board) => {
    setSelectedBoard(board);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBoardMutation.mutate();
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBoardMutation.mutate();
  };

  const handleDeleteConfirm = () => {
    if (selectedBoard) {
      deleteBoardMutation.mutate(selectedBoard.id);
    }
  };

  if (authLoading || isLoading) {
    return <LoadingState message="게시판 목록을 불러오는 중..." />;
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
          </div>
        </div>
      </div>
    );
  }

  if (!user?.is_admin) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>접근 권한 없음</EmptyTitle>
            <EmptyDescription>
              관리자만 이 페이지에 접근할 수 있습니다
            </EmptyDescription>
          </EmptyHeader>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </Button>
        </Empty>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
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

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <PageHeader
        eyebrow="관리자"
        icon={LayoutList}
        title="게시판 관리"
        description="전체 게시판을 관리해요"
        tone="primary"
        actions={
          <Button onClick={handleCreateClick} className="rounded-full">
            <Plus className="h-4 w-4" />
            게시판 생성
          </Button>
        }
      />

      {!boards || boards.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Settings />
                </EmptyMedia>
                <EmptyTitle>게시판이 없습니다</EmptyTitle>
                <EmptyDescription>
                  첫 번째 게시판을 생성해보세요
                </EmptyDescription>
              </EmptyHeader>
              <Button onClick={handleCreateClick}>
                <Plus className="h-4 w-4 mr-2" />
                게시판 생성
              </Button>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>전체 게시판 ({boards.length}개)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>슬러그</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boards.map((board) => (
                  <TableRow key={board.id}>
                    <TableCell className="font-medium">{board.name}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {board.slug}
                      </code>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {board.description || "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(board.created_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(board)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(board)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>게시판 생성</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label htmlFor={nameId}>이름</Label>
              <Input
                id={nameId}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="게시판 이름"
                required
              />
            </div>
            <div>
              <Label htmlFor={slugId}>슬러그</Label>
              <Input
                id={slugId}
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="board-slug"
                pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                title="소문자, 숫자, 하이픈만 사용 가능 (연속 하이픈 불가)"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                소문자, 숫자, 하이픈만 사용 가능합니다
              </p>
            </div>
            <div>
              <Label htmlFor={descriptionId}>설명 (선택)</Label>
              <Textarea
                id={descriptionId}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="게시판 설명"
                rows={3}
                maxLength={1000}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={createBoardMutation.isPending}>
                {createBoardMutation.isPending ? "생성 중..." : "생성"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>게시판 수정</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor={nameId}>이름</Label>
              <Input
                id={nameId}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="게시판 이름"
                required
              />
            </div>
            <div>
              <Label htmlFor={slugId}>슬러그</Label>
              <Input
                id={slugId}
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="board-slug"
                pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                title="소문자, 숫자, 하이픈만 사용 가능 (연속 하이픈 불가)"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                소문자, 숫자, 하이픈만 사용 가능합니다
              </p>
            </div>
            <div>
              <Label htmlFor={descriptionId}>설명 (선택)</Label>
              <Textarea
                id={descriptionId}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="게시판 설명"
                rows={3}
                maxLength={1000}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={updateBoardMutation.isPending}>
                {updateBoardMutation.isPending ? "수정 중..." : "수정"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>게시판을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              게시판 "{selectedBoard?.name}"을(를) 삭제합니다. 이 작업은 되돌릴
              수 없으며, 게시판의 모든 게시물도 삭제될 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteBoardMutation.isPending}
            >
              {deleteBoardMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
