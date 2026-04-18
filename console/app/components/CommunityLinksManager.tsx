import {
  Edit2,
  ExternalLink,
  Link as LinkIcon,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/lib/api-client";
import { formatError, getErrorMessage } from "~/lib/errors";

interface CommunityLink {
  id: string;
  title: string;
  url: string;
  created_at: string;
  updated_at: string;
}

interface CommunityLinksManagerProps {
  communityId: string;
}

export function CommunityLinksManager({
  communityId,
}: CommunityLinksManagerProps) {
  const newTitleId = useId();
  const newUrlId = useId();
  const [links, setLinks] = useState<CommunityLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState({ title: "", url: "" });
  const [editLink, setEditLink] = useState({ title: "", url: "" });

  const fetchLinks = useCallback(async () => {
    try {
      const response = await api.console.communities[":id"].links.$get({
        param: { id: communityId },
      });

      if (response.ok) {
        const data = await response.json();
        setLinks(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch links:", error);
      toast.error("링크를 불러오는 데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const createLink = async () => {
    if (!newLink.title.trim() || !newLink.url.trim()) {
      toast.error("제목과 URL을 모두 입력해주세요");
      return;
    }

    try {
      const response = await api.console.communities[":id"].links.$post({
        param: { id: communityId },
        json: newLink,
      });
      if (response.ok) {
        const createdLink = await response.json();
        setLinks([createdLink.data, ...links]);
        setNewLink({ title: "", url: "" });
        setIsCreating(false);
        toast.success("링크가 추가되었습니다");
      } else {
        const errorMessage = await getErrorMessage(
          response,
          "링크 추가에 실패했습니다",
        );
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Failed to create link:", error);
      toast.error(formatError(error, "링크 추가에 실패했습니다"));
    }
  };

  const updateLink = async (linkId: string) => {
    if (!editLink.title.trim() || !editLink.url.trim()) {
      toast.error("제목과 URL을 모두 입력해주세요");
      return;
    }

    try {
      const response = await api.console.communities[":id"].links[
        ":linkId"
      ].$put({ param: { id: communityId, linkId }, json: editLink });
      if (response.ok) {
        const updatedLink = await response.json();
        setLinks(
          links.map((link) => (link.id === linkId ? updatedLink.data : link)),
        );
        setEditingId(null);
        toast.success("링크가 수정되었습니다");
      } else {
        const errorMessage = await getErrorMessage(
          response,
          "링크 수정에 실패했습니다",
        );
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Failed to update link:", error);
      toast.error(formatError(error, "링크 수정에 실패했습니다"));
    }
  };

  const deleteLink = async (linkId: string) => {
    try {
      const response = await api.console.communities[":id"].links[
        ":linkId"
      ].$delete({ param: { id: communityId, linkId } });
      if (response.ok) {
        setLinks(links.filter((link) => link.id !== linkId));
        toast.success("링크가 삭제되었습니다");
      } else {
        const errorMessage = await getErrorMessage(
          response,
          "링크 삭제에 실패했습니다",
        );
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Failed to delete link:", error);
      toast.error(formatError(error, "링크 삭제에 실패했습니다"));
    }
  };

  const startEdit = (link: CommunityLink) => {
    setEditingId(link.id);
    setEditLink({ title: link.title, url: link.url });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLink({ title: "", url: "" });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            커뮤 링크
          </CardTitle>
          <CardDescription>
            커뮤에 표시될 유용한 링크를 관리하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              커뮤 링크
            </CardTitle>
            <CardDescription>
              커뮤에 표시될 유용한 링크를 관리하세요
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreating(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            링크 추가
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Create form */}
        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">새 링크 추가</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={newTitleId}>링크 제목</Label>
                <Input
                  id={newTitleId}
                  type="text"
                  placeholder="링크 제목 (예: 공식 웹사이트)"
                  value={newLink.title}
                  onChange={(e) =>
                    setNewLink({ ...newLink, title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={newUrlId}>URL</Label>
                <Input
                  id={newUrlId}
                  type="url"
                  placeholder="URL (예: https://example.com)"
                  value={newLink.url}
                  onChange={(e) =>
                    setNewLink({ ...newLink, url: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createLink} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  저장
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewLink({ title: "", url: "" });
                  }}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Links list */}
        {links.length === 0 && !isCreating ? (
          <div className="text-center py-8">
            <LinkIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-foreground mb-2">
              아직 링크가 없습니다
            </h4>
            <p className="text-muted-foreground mb-4">
              첫 번째 커뮤 링크를 추가해보세요
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              링크 추가
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <Card key={link.id}>
                <CardContent className="p-4">
                  {editingId === link.id ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-title-${link.id}`}>
                          링크 제목
                        </Label>
                        <Input
                          id={`edit-title-${link.id}`}
                          type="text"
                          value={editLink.title}
                          onChange={(e) =>
                            setEditLink({ ...editLink, title: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-url-${link.id}`}>URL</Label>
                        <Input
                          id={`edit-url-${link.id}`}
                          type="url"
                          value={editLink.url}
                          onChange={(e) =>
                            setEditLink({ ...editLink, url: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => updateLink(link.id)}
                          className="flex-1"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          저장
                        </Button>
                        <Button
                          variant="outline"
                          onClick={cancelEdit}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-2" />
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
                          >
                            <span>{link.title}</span>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {link.url}
                        </p>
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          생성일:{" "}
                          {new Date(link.created_at).toLocaleString("ko-KR")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(link)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>링크 삭제</DialogTitle>
                              <DialogDescription>
                                "{link.title}" 링크를 삭제하시겠습니까? 이
                                작업은 되돌릴 수 없습니다.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">취소</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  onClick={() => deleteLink(link.id)}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  삭제
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
