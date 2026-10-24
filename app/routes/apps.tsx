import { useQuery } from "@tanstack/react-query";
import { ChevronRight, LayoutGrid, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { query } from "~/lib/naru";

export function meta() {
  return [
    { title: "앱" },
    {
      name: "description",
      content: "이 커뮤에서 사용할 수 있는 앱과 슬래시 명령어",
    },
  ];
}

interface AppListEntry {
  builtin_id: string;
  version: string;
  profile: { name: string; username: string };
  description: string;
  commands: Array<{
    name: string;
    description: string;
    required_role: "owner" | "moderator" | null;
  }>;
}

async function fetchApps(): Promise<AppListEntry[]> {
  return await query<AppListEntry[]>("apps:list");
}

export default function AppsDirectoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["app-directory"],
    queryFn: fetchApps,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutGrid className="h-6 w-6" />앱
        </h1>
        <p className="text-sm text-muted-foreground">
          이 커뮤에서 사용할 수 있는 슬래시 명령어를 모아 둔 곳입니다. 카드를
          눌러 사용법과 예시를 확인하세요.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((k) => (
            <Skeleton key={k} className="h-24 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              설치된 앱이 없습니다. 소유자가 앱을 설치하면 여기에 표시됩니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((app) => (
            <Link
              key={app.builtin_id}
              to={`/apps/${app.builtin_id}`}
              className="block group"
            >
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-lg">
                          {app.profile.name}
                        </h2>
                        <Badge variant="secondary" className="text-xs">
                          {app.builtin_id} v{app.version}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {app.description}
                      </p>
                      {app.commands.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {app.commands.slice(0, 6).map((cmd) => (
                            <code
                              key={cmd.name}
                              className="text-xs px-1.5 py-0.5 rounded bg-muted text-foreground/80 font-mono"
                            >
                              /{cmd.name}
                            </code>
                          ))}
                          {app.commands.length > 6 && (
                            <span className="text-xs text-muted-foreground self-center">
                              +{app.commands.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1 group-hover:text-foreground transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
