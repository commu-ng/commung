import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  Copy,
  Eye,
  EyeOff,
  Key,
  Plus,
  Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import { Link, useParams } from "react-router";
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
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import { api, getErrorMessage } from "~/lib/api-client";
import { env } from "~/lib/env";
import type { Route } from "./+types/communities.$slug.bots";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "봇 관리" },
    {
      name: "description",
      content: "커뮤니티 봇을 관리할 수 있습니다",
    },
  ];
}

interface Community {
  id: string;
  name: string;
  slug: string;
  user_role?: string | null;
}

interface BotData {
  id: string;
  name: string;
  description: string | null;
  profileId: string;
  profileName: string;
  profileUsername: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface BotToken {
  id: string;
  name: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

interface NewBotToken {
  id: string;
  token: string;
  name: string | null;
  created_at: string;
  expires_at: string | null;
}

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

async function fetchBots(slug: string): Promise<BotData[]> {
  const response = await api.console.communities[":id"].bots.$get({
    param: { id: slug },
  });
  if (!response.ok) {
    throw new Error("봇 목록을 가져오는데 실패했습니다");
  }
  const result = await response.json();
  return result.data as BotData[];
}

async function fetchBotTokens(
  slug: string,
  botId: string,
): Promise<BotToken[]> {
  const response = await api.console.communities[":id"].bots[
    ":botId"
  ].tokens.$get({
    param: { id: slug, botId },
  });
  if (!response.ok) {
    throw new Error("토큰 목록을 가져오는데 실패했습니다");
  }
  const result = await response.json();
  return result.data as BotToken[];
}

function TokenDisplay({ token }: { token: string }) {
  const [visible, setVisible] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(token);
    toast.success("토큰이 클립보드에 복사되었습니다");
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
      <span className="flex-1 truncate">
        {visible ? token : "••••••••••••••••••••••••••••••••••••"}
      </span>
      <Button variant="ghost" size="sm" onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={copyToClipboard}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CreateBotDialog({
  slug,
  onSuccess,
}: {
  slug: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const nameId = useId();
  const descriptionId = useId();
  const profileNameId = useId();
  const profileUsernameId = useId();

  const createBotMutation = useMutation({
    mutationFn: async () => {
      const response = await api.console.communities[":id"].bots.$post({
        param: { id: slug },
        json: {
          name,
          description: description || null,
          profile_name: profileName,
          profile_username: profileUsername,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "봇 생성에 실패했습니다"));
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("봇이 성공적으로 생성되었습니다");
      setOpen(false);
      setName("");
      setDescription("");
      setProfileName("");
      setProfileUsername("");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />봇 추가
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 봇 생성</DialogTitle>
          <DialogDescription>
            커뮤니티에 새 봇을 추가합니다. 봇은 API를 통해 포스트를 읽고 작성할
            수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor={nameId}>봇 이름</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 공지사항 봇"
            />
          </div>
          <div>
            <Label htmlFor={descriptionId}>설명 (선택)</Label>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="봇이 하는 일에 대한 설명"
            />
          </div>
          <div>
            <Label htmlFor={profileNameId}>프로필 이름</Label>
            <Input
              id={profileNameId}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="예: 공지사항 봇"
            />
          </div>
          <div>
            <Label htmlFor={profileUsernameId}>프로필 사용자명</Label>
            <Input
              id={profileUsernameId}
              value={profileUsername}
              onChange={(e) => setProfileUsername(e.target.value)}
              placeholder="예: announcement_bot"
            />
            <p className="text-xs text-muted-foreground mt-1">
              영문, 숫자, 밑줄(_)만 사용 가능합니다
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            onClick={() => createBotMutation.mutate()}
            disabled={
              createBotMutation.isPending ||
              !name ||
              !profileName ||
              !profileUsername
            }
          >
            {createBotMutation.isPending ? "생성 중..." : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTokenDialog({
  slug,
  botId,
  onSuccess,
}: {
  slug: string;
  botId: string;
  onSuccess: (token: NewBotToken) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const tokenNameId = useId();

  const createTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await api.console.communities[":id"].bots[
        ":botId"
      ].tokens.$post({
        param: { id: slug, botId },
        json: {
          name: name || null,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "토큰 생성에 실패했습니다"));
      }
      return response.json();
    },
    onSuccess: (result) => {
      toast.success(
        "토큰이 성공적으로 생성되었습니다. 이 토큰은 다시 볼 수 없으니 안전하게 저장하세요.",
      );
      setOpen(false);
      setName("");
      onSuccess(result.data as NewBotToken);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Key className="w-4 h-4 mr-2" />
          토큰 생성
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 API 토큰 생성</DialogTitle>
          <DialogDescription>
            봇 API 접근을 위한 새 토큰을 생성합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor={tokenNameId}>토큰 이름 (선택)</Label>
            <Input
              id={tokenNameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: production, development"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            onClick={() => createTokenMutation.mutate()}
            disabled={createTokenMutation.isPending}
          >
            {createTokenMutation.isPending ? "생성 중..." : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BotCard({ bot, slug }: { bot: BotData; slug: string }) {
  const [newToken, setNewToken] = useState<NewBotToken | null>(null);
  const queryClient = useQueryClient();

  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ["bot-tokens", slug, bot.id],
    queryFn: () => fetchBotTokens(slug, bot.id),
  });

  const deleteBotMutation = useMutation({
    mutationFn: async () => {
      const response = await api.console.communities[":id"].bots[
        ":botId"
      ].$delete({
        param: { id: slug, botId: bot.id },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "봇 삭제에 실패했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("봇이 성공적으로 삭제되었습니다");
      queryClient.invalidateQueries({ queryKey: ["bots", slug] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      const response = await api.console.communities[":id"].bots[
        ":botId"
      ].tokens[":tokenId"].$delete({
        param: { id: slug, botId: bot.id, tokenId },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "토큰 폐기에 실패했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("토큰이 성공적으로 폐기되었습니다");
      queryClient.invalidateQueries({ queryKey: ["bot-tokens", slug, bot.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const activeTokens = tokens?.filter((t) => !t.revokedAt) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {bot.name}
            </CardTitle>
            <CardDescription>
              @{bot.profileUsername} &middot; {bot.profileName}
            </CardDescription>
            {bot.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {bot.description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (
                confirm(
                  "정말로 이 봇을 삭제하시겠습니까? 모든 토큰도 폐기됩니다.",
                )
              ) {
                deleteBotMutation.mutate();
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {newToken && (
          <div className="p-4 bg-mint/40 border border-mint/60 rounded-lg space-y-2">
            <p className="text-sm font-medium text-mint-ink">
              새 토큰이 생성되었습니다. 이 토큰은 다시 볼 수 없으니 안전하게
              저장하세요.
            </p>
            <TokenDisplay token={newToken.token} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewToken(null)}
            >
              확인
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">API 토큰</h4>
            <CreateTokenDialog
              slug={slug}
              botId={bot.id}
              onSuccess={(token) => {
                setNewToken(token);
                queryClient.invalidateQueries({
                  queryKey: ["bot-tokens", slug, bot.id],
                });
              }}
            />
          </div>

          {tokensLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : activeTokens.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              토큰이 없습니다. 토큰을 생성하여 API에 접근하세요.
            </p>
          ) : (
            <div className="space-y-2">
              {activeTokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {token.name || "이름 없음"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      생성: {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsedAt &&
                        ` · 마지막 사용: ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("정말로 이 토큰을 폐기하시겠습니까?")) {
                        revokeTokenMutation.mutate(token.id);
                      }
                    }}
                  >
                    폐기
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommunityBots() {
  const { slug } = useParams();
  const queryClient = useQueryClient();

  const {
    data: community,
    isLoading: communityLoading,
    error: communityError,
  } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => fetchCommunity(slug ?? ""),
    enabled: !!slug,
  });

  const { data: bots, isLoading: botsLoading } = useQuery({
    queryKey: ["bots", slug],
    queryFn: () => fetchBots(slug ?? ""),
    enabled: !!slug && !!community,
  });

  const userRole = community?.user_role as
    | "owner"
    | "moderator"
    | "member"
    | null;
  const hasAccess = userRole === "owner";
  const error = communityError ? (communityError as Error).message : "";

  if (communityLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-9 w-32" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full" />
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
                <Bot className="w-5 h-5" />봇 관리
              </CardTitle>
              <CardDescription>봇 관리 권한이 없습니다</CardDescription>
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to={`/communities/${slug}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              커뮤로 돌아가기
            </Button>
          </Link>
          <CreateBotDialog
            slug={slug ?? ""}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["bots", slug] });
            }}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />봇 관리
            </CardTitle>
            <CardDescription>
              {community?.name} 커뮤의 봇을 관리할 수 있습니다. 봇은 API를 통해
              포스트를 읽고 작성할 수 있습니다.
            </CardDescription>
          </CardHeader>
          {community && (
            <CardContent className="pt-0">
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">API 엔드포인트</h4>
                <div className="space-y-1 text-sm text-muted-foreground font-mono">
                  <p>
                    GET {env.apiBaseUrl}/bot/communities/{community.id}/posts
                  </p>
                  <p>
                    POST {env.apiBaseUrl}/bot/communities/{community.id}/posts
                  </p>
                  <p>
                    GET {env.apiBaseUrl}/bot/communities/{community.id}
                    /posts/:postId
                  </p>
                  <p>
                    PUT {env.apiBaseUrl}/bot/communities/{community.id}
                    /posts/:postId
                  </p>
                  <p>
                    DELETE {env.apiBaseUrl}/bot/communities/{community.id}
                    /posts/:postId
                  </p>
                  <p>
                    POST {env.apiBaseUrl}/bot/communities/{community.id}
                    /posts/:postId/reactions
                  </p>
                  <p>
                    DELETE {env.apiBaseUrl}/bot/communities/{community.id}
                    /posts/:postId/reactions/:emoji
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  API 문서:{" "}
                  <a
                    href={`${env.apiBaseUrl}/bot/docs`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {env.apiBaseUrl}/bot/docs
                  </a>
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {botsLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        ) : bots?.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                아직 생성된 봇이 없습니다. 봇을 추가하여 API를 통해 커뮤니티와
                상호작용하세요.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bots?.map((bot) => (
              <BotCard key={bot.id} bot={bot} slug={slug ?? ""} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
