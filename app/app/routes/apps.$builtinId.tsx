import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { client } from "~/lib/api-client";
import { getReadOnlyMarkdownInstance } from "~/lib/markdown-utils";

const md = getReadOnlyMarkdownInstance();

interface AppExample {
  input: string;
  output: string;
  note: string | null;
}

interface AppCommand {
  name: string;
  default_name: string;
  description: string;
  long_description: string | null;
  required_role: "owner" | "moderator" | null;
  examples: AppExample[];
}

interface AppDetail {
  builtin_id: string;
  version: string;
  profile: { name: string; username: string };
  description: string;
  long_description: string | null;
  commands: AppCommand[];
}

export function meta({ params }: { params: { builtinId?: string } }) {
  return [{ title: `앱: ${params.builtinId ?? ""}` }];
}

async function fetchApp(builtinId: string): Promise<AppDetail | null> {
  const r = await client.app.apps[":builtinId"].$get({
    param: { builtinId },
  });
  if (!r.ok) return null;
  const result = await r.json();
  return result.data as unknown as AppDetail;
}

function MarkdownProse({ text }: { text: string }) {
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:text-foreground"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized html
      dangerouslySetInnerHTML={{ __html: md.render(text) }}
    />
  );
}

function ExampleBlock({ example }: { example: AppExample }) {
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="px-3 py-2 bg-muted/50 border-b">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
          입력
        </div>
        <code className="text-sm font-mono">{example.input}</code>
      </div>
      <div className="px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          출력
        </div>
        <MarkdownProse text={example.output} />
      </div>
      {example.note && (
        <div className="px-3 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
          💡 {example.note}
        </div>
      )}
    </div>
  );
}

function CommandSection({ command }: { command: AppCommand }) {
  return (
    <section id={command.name} className="space-y-3 scroll-mt-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-semibold font-mono">/{command.name}</h2>
          {command.name !== command.default_name && (
            <Badge variant="outline" className="text-xs">
              기본: /{command.default_name}
            </Badge>
          )}
          {command.required_role === "owner" && (
            <Badge variant="secondary" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              소유자 전용
            </Badge>
          )}
          {command.required_role === "moderator" && (
            <Badge variant="secondary" className="text-xs">
              <ShieldCheck className="h-3 w-3 mr-1" />
              모더레이터 이상
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{command.description}</p>
      </div>
      {command.long_description && (
        <MarkdownProse text={command.long_description} />
      )}
      {command.examples.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            예시
          </h3>
          <div className="space-y-3">
            {command.examples.map((ex) => (
              <ExampleBlock key={`${command.name}-${ex.input}`} example={ex} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function AppDetailPage() {
  const { builtinId } = useParams<{ builtinId: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["app-detail", builtinId],
    queryFn: () => fetchApp(builtinId ?? ""),
    enabled: !!builtinId,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link to="/apps">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />앱 목록으로
          </Button>
        </Link>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            앱을 찾을 수 없습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <Link to="/apps">
        <Button variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />앱 목록으로
        </Button>
      </Link>

      {/* Hero */}
      <header className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-3xl font-bold">{data.profile.name}</h1>
          <Badge variant="secondary">v{data.version}</Badge>
          <span className="text-sm text-muted-foreground font-mono">
            @{data.profile.username}
          </span>
        </div>
        <p className="text-base text-muted-foreground">{data.description}</p>
      </header>

      {/* Long description */}
      {data.long_description && (
        <Card>
          <CardContent className="p-5">
            <MarkdownProse text={data.long_description} />
          </CardContent>
        </Card>
      )}

      {/* Quick command index (only when more than 2) */}
      {data.commands.length > 2 && (
        <nav className="flex flex-wrap gap-2">
          {data.commands.map((cmd) => (
            <a
              key={cmd.name}
              href={`#${cmd.name}`}
              className="text-sm px-2.5 py-1 rounded-full bg-muted hover:bg-accent transition-colors font-mono"
            >
              /{cmd.name}
            </a>
          ))}
        </nav>
      )}

      {/* Commands */}
      <div className="space-y-10">
        {data.commands.map((cmd) => (
          <CommandSection key={cmd.name} command={cmd} />
        ))}
      </div>
    </div>
  );
}
