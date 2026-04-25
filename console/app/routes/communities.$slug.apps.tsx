import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  LayoutGrid,
  Package,
  Pencil,
  Plus,
  Power,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { PageHeader } from "~/components/shared/PageHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
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
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/communities.$slug.apps";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "앱 관리" },
    { name: "description", content: "커뮤니티에 설치된 앱을 관리합니다" },
  ];
}

interface CatalogCommand {
  default_name: string;
  description: string;
  handler_builtin_id: string;
}

interface CatalogEntry {
  id: string;
  version: string;
  description: string;
  default_profile: { name: string; username: string };
  commands: CatalogCommand[];
}

interface InstalledAppRow {
  id: string;
  communityId: string;
  profileId: string;
  builtinId: string;
  version: string;
  config: Record<string, unknown>;
  installedById: string;
  createdAt: string;
  updatedAt: string;
  profileName: string;
  profileUsername: string;
}

interface BotCommand {
  id: string;
  communityId: string;
  installedAppId: string;
  name: string;
  description: string | null;
  handlerBuiltinId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InstallDetail extends InstalledAppRow {
  commands: BotCommand[];
}

async function fetchCatalog(slug: string): Promise<CatalogEntry[]> {
  const response = await api.console.communities[":id"].apps.catalog.$get({
    param: { id: slug },
  });
  if (!response.ok) {
    throw new Error("카탈로그를 가져오는데 실패했습니다");
  }
  const result = await response.json();
  return result.data as CatalogEntry[];
}

async function fetchInstalled(slug: string): Promise<InstalledAppRow[]> {
  const response = await api.console.communities[":id"].apps.$get({
    param: { id: slug },
  });
  if (!response.ok) {
    throw new Error("설치된 앱 목록을 가져오는데 실패했습니다");
  }
  const result = await response.json();
  return result.data as InstalledAppRow[];
}

async function fetchInstall(
  slug: string,
  installId: string,
): Promise<InstallDetail> {
  const response = await api.console.communities[":id"].apps[":installId"].$get(
    {
      param: { id: slug, installId },
    },
  );
  if (!response.ok) {
    throw new Error("앱 정보를 가져오는데 실패했습니다");
  }
  const result = await response.json();
  return result.data as InstallDetail;
}

function CatalogDialog({
  slug,
  installed,
  onSuccess,
}: {
  slug: string;
  installed: InstalledAppRow[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);

  const { data: catalog, isLoading } = useQuery({
    queryKey: ["app-catalog", slug],
    queryFn: () => fetchCatalog(slug),
    enabled: open,
  });

  const installedIds = useMemo(
    () => new Set(installed.map((i) => i.builtinId)),
    [installed],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSelected(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />앱 설치
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        {selected ? (
          <InstallForm
            slug={slug}
            entry={selected}
            onCancel={() => setSelected(null)}
            onSuccess={() => {
              setOpen(false);
              setSelected(null);
              onSuccess();
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>앱 카탈로그</DialogTitle>
              <DialogDescription>
                커뮤니티에 설치할 앱을 선택하세요. 각 앱은 슬래시 명령어를
                제공합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : catalog?.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  사용 가능한 앱이 없습니다.
                </p>
              ) : (
                catalog?.map((entry) => {
                  const already = installedIds.has(entry.id);
                  return (
                    <Card key={entry.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{entry.id}</h3>
                              <Badge variant="secondary">
                                v{entry.version}
                              </Badge>
                              {already && (
                                <Badge variant="outline">설치됨</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {entry.description}
                            </p>
                            <div className="text-xs text-muted-foreground mt-2 font-mono">
                              {entry.commands
                                .map((c) => `/${c.default_name}`)
                                .join(", ")}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={already}
                            onClick={() => setSelected(entry)}
                          >
                            {already ? "설치됨" : "선택"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InstallForm({
  slug,
  entry,
  onCancel,
  onSuccess,
}: {
  slug: string;
  entry: CatalogEntry;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [profileName, setProfileName] = useState(entry.default_profile.name);
  const [profileUsername, setProfileUsername] = useState(
    entry.default_profile.username,
  );
  const [overrides, setOverrides] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      entry.commands.map((c) => [c.default_name, c.default_name]),
    ),
  );
  const profileNameId = useId();
  const profileUsernameId = useId();

  const installMutation = useMutation({
    mutationFn: async () => {
      const command_overrides = Object.fromEntries(
        Object.entries(overrides)
          .filter(([defaultName, name]) => name && name !== defaultName)
          .map(([defaultName, name]) => [defaultName, { name }]),
      );
      const response = await api.console.communities[":id"].apps.$post({
        param: { id: slug },
        json: {
          builtin_id: entry.id,
          profile_name: profileName,
          profile_username: profileUsername,
          ...(Object.keys(command_overrides).length > 0
            ? { command_overrides }
            : {}),
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "앱 설치에 실패했습니다"));
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("앱이 설치되었습니다");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{entry.id} 설치</DialogTitle>
        <DialogDescription>{entry.description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor={profileNameId}>프로필 이름</Label>
          <Input
            id={profileNameId}
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={profileUsernameId}>프로필 사용자명</Label>
          <Input
            id={profileUsernameId}
            value={profileUsername}
            onChange={(e) => setProfileUsername(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            영문, 숫자, 밑줄(_)만 사용 가능합니다
          </p>
        </div>
        <div>
          <Label>슬래시 명령어</Label>
          <div className="space-y-2 mt-2">
            {entry.commands.map((cmd) => (
              <div key={cmd.default_name} className="flex items-center gap-2">
                <span className="text-muted-foreground">/</span>
                <Input
                  value={overrides[cmd.default_name] ?? cmd.default_name}
                  onChange={(e) =>
                    setOverrides((prev) => ({
                      ...prev,
                      [cmd.default_name]: e.target.value,
                    }))
                  }
                  className="font-mono"
                />
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  {cmd.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          뒤로
        </Button>
        <Button
          onClick={() => installMutation.mutate()}
          disabled={
            installMutation.isPending || !profileName || !profileUsername
          }
        >
          {installMutation.isPending ? "설치 중..." : "설치"}
        </Button>
      </DialogFooter>
    </>
  );
}

function CommandRow({
  slug,
  installId,
  command,
  onChanged,
}: {
  slug: string;
  installId: string;
  command: BotCommand;
  onChanged: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(command.name);
  const renameId = useId();

  const update = useMutation({
    mutationFn: async (body: { name?: string; enabled?: boolean }) => {
      const response = await api.console.communities[":id"].apps[":installId"][
        "commands"
      ][":commandId"].$patch({
        param: { id: slug, installId, commandId: command.id },
        json: body,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          getErrorMessage(errorData, "명령어 수정에 실패했습니다"),
        );
      }
      return response.json();
    },
    onSuccess: () => {
      onChanged();
      setRenaming(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="flex items-center gap-2 py-2 border-b last:border-b-0">
      <Power
        className={`h-4 w-4 ${
          command.enabled ? "text-green-600" : "text-muted-foreground"
        }`}
      />
      {renaming ? (
        <>
          <span className="text-muted-foreground">/</span>
          <Input
            id={renameId}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 font-mono"
          />
          <Button
            size="sm"
            onClick={() => update.mutate({ name: newName })}
            disabled={update.isPending || newName === command.name}
          >
            저장
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRenaming(false);
              setNewName(command.name);
            }}
          >
            취소
          </Button>
        </>
      ) : (
        <>
          <span className="font-mono">/{command.name}</span>
          {command.description && (
            <span className="text-xs text-muted-foreground flex-1 truncate ml-2">
              {command.description}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRenaming(true)}
            title="이름 변경"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => update.mutate({ enabled: !command.enabled })}
            disabled={update.isPending}
            title={command.enabled ? "비활성화" : "활성화"}
          >
            {command.enabled ? "사용 중" : "사용 안 함"}
          </Button>
        </>
      )}
    </div>
  );
}

function InstallCard({
  slug,
  install,
}: {
  slug: string;
  install: InstalledAppRow;
}) {
  const queryClient = useQueryClient();
  const installKey = ["installed-app", slug, install.id];

  const { data: detail } = useQuery({
    queryKey: installKey,
    queryFn: () => fetchInstall(slug, install.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: installKey });
    queryClient.invalidateQueries({ queryKey: ["installed-apps", slug] });
  };

  const upgrade = useMutation({
    mutationFn: async () => {
      const response = await api.console.communities[":id"].apps[":installId"][
        "upgrade"
      ].$post({
        param: { id: slug, installId: install.id },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          getErrorMessage(errorData, "업그레이드에 실패했습니다"),
        );
      }
      return response.json();
    },
    onSuccess: (result) => {
      const added = (result.data as { addedCommands: BotCommand[] })
        .addedCommands;
      toast.success(
        added.length === 0
          ? "이미 최신 버전입니다"
          : `업그레이드되었습니다 (+${added.length}개 명령어)`,
      );
      invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const uninstall = useMutation({
    mutationFn: async () => {
      const response = await api.console.communities[":id"].apps[
        ":installId"
      ].$delete({
        param: { id: slug, installId: install.id },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "제거에 실패했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("앱이 제거되었습니다");
      invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">{install.builtinId}</h3>
              <Badge variant="secondary">v{install.version}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {install.profileName}{" "}
              <span className="text-muted-foreground/70">
                @{install.profileUsername}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => upgrade.mutate()}
              disabled={upgrade.isPending}
              title="업그레이드"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm("이 앱을 제거하시겠습니까?")) {
                  uninstall.mutate();
                }
              }}
              disabled={uninstall.isPending}
              title="제거"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            슬래시 명령어
          </p>
          {!detail ? (
            <Skeleton className="h-6 w-full" />
          ) : detail.commands.length === 0 ? (
            <p className="text-sm text-muted-foreground">명령어가 없습니다.</p>
          ) : (
            <div>
              {detail.commands.map((command) => (
                <CommandRow
                  key={command.id}
                  slug={slug}
                  installId={install.id}
                  command={command}
                  onChanged={invalidate}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AppsPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

  const { data: installed, isLoading } = useQuery({
    queryKey: ["installed-apps", slug],
    queryFn: () => fetchInstalled(slug ?? ""),
    enabled: !!slug,
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to={`/communities/${slug}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              커뮤로 돌아가기
            </Button>
          </Link>
          <CatalogDialog
            slug={slug ?? ""}
            installed={installed ?? []}
            onSuccess={() => {
              queryClient.invalidateQueries({
                queryKey: ["installed-apps", slug],
              });
            }}
          />
        </div>

        <PageHeader
          eyebrow="운영"
          icon={LayoutGrid}
          title="앱"
          description="커뮤니티에 슬래시 명령어를 추가하는 앱을 관리해요"
          tone="butter"
        />

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : installed?.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                설치된 앱이 없습니다. 카탈로그에서 앱을 설치해 슬래시 명령어를
                추가해보세요.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {installed?.map((install) => (
              <InstallCard
                key={install.id}
                slug={slug ?? ""}
                install={install}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
