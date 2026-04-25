import { ArrowRight, LayoutGrid, Lock, Sparkles, Users } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useAuth } from "~/hooks/useAuth";
import type { Route } from "./+types/about";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮹 소개" },
    {
      name: "description",
      content:
        "하나의 계정으로 커뮤마다 다른 페르소나. 페르소나는 다른 커뮤로 새지 않아요. 슬래시 명령으로 커뮤를 확장하세요.",
    },
  ];
}

function Hero({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-marsh-lg px-6 sm:px-12 py-14 text-center">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-blossom/50 via-primary/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-mint/40 via-lilac/30 to-transparent blur-3xl" />
      <Sparkles className="pointer-events-none absolute top-8 right-12 h-6 w-6 text-primary/60" />

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-xs font-semibold tracking-wide">
          <Sparkles className="h-3 w-3" />
          타임라인 기반 커뮤 플랫폼
        </span>
        <h1 className="font-display text-4xl sm:text-6xl font-bold mt-6 leading-[1.05] tracking-tight">
          커뮤마다 따로 계정 만들기,
          <br className="hidden sm:block" /> 이제{" "}
          <span className="text-primary">그만</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground mt-6 max-w-xl mx-auto leading-relaxed">
          하나의 계정으로 커뮤마다 다른 모습. 게이머일 때, 작가일 때, 본명일 때
          — 한 사람의 여러 모습을 한 곳에서 자연스럽게.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
          {isAuthenticated ? (
            <>
              <Button asChild size="lg" className="rounded-full">
                <Link to="/communities/create">
                  <Sparkles className="h-4 w-4" />
                  커뮤 만들기
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full"
              >
                <Link to="/apps">
                  <LayoutGrid className="h-4 w-4" />앱 둘러보기
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg" className="rounded-full">
                <Link to="/signup">
                  <Sparkles className="h-4 w-4" />
                  지금 시작하기
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full"
              >
                <Link to="/login">로그인</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

interface FeatureSectionProps {
  eyebrow: string;
  title: string;
  body: string;
  bullets: { label: string; sub: string }[];
  icon: typeof Users;
  tone: "mint" | "lilac" | "butter" | "blossom";
  reverse?: boolean;
}

const toneClasses = {
  mint: {
    eyebrow: "text-mint-ink",
    iconBg: "bg-mint/40 text-mint-ink",
    blob: "from-mint/40 via-mint/15 to-transparent",
  },
  lilac: {
    eyebrow: "text-lilac-ink",
    iconBg: "bg-lilac/40 text-lilac-ink",
    blob: "from-lilac/40 via-lilac/15 to-transparent",
  },
  butter: {
    eyebrow: "text-butter-ink",
    iconBg: "bg-butter/40 text-butter-ink",
    blob: "from-butter/40 via-butter/15 to-transparent",
  },
  blossom: {
    eyebrow: "text-blossom-ink",
    iconBg: "bg-blossom/40 text-blossom-ink",
    blob: "from-blossom/40 via-blossom/15 to-transparent",
  },
} as const;

function FeatureSection({
  eyebrow,
  title,
  body,
  bullets,
  icon: Icon,
  tone,
  reverse = false,
}: FeatureSectionProps) {
  const t = toneClasses[tone];
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-marsh">
      <div
        className={`pointer-events-none absolute ${reverse ? "-top-20 -left-16" : "-top-20 -right-16"} h-64 w-64 rounded-full bg-gradient-to-br ${t.blob} blur-3xl`}
      />
      <div
        className={`relative grid grid-cols-1 md:grid-cols-2 gap-6 p-6 sm:p-10 ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}
      >
        <div className="space-y-4">
          <span
            className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${t.iconBg} shadow-marsh`}
          >
            <Icon className="h-6 w-6" />
          </span>
          <p
            className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${t.eyebrow}`}
          >
            {eyebrow}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
            {title}
          </h2>
          <p className="text-muted-foreground leading-relaxed">{body}</p>
        </div>
        <div className="space-y-3">
          {bullets.map((b) => (
            <div
              key={b.label}
              className="rounded-2xl border border-border/60 bg-background/60 p-4"
            >
              <p className="font-semibold text-sm">{b.label}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {b.sub}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScenarioCard() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/30 px-6 sm:px-10 py-10">
      <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-primary text-center">
        구체적인 예시
      </p>
      <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-center mt-2">
        한 명의 사용자, 세 개의 모습
      </h2>
      <p className="text-muted-foreground text-center mt-3 max-w-xl mx-auto">
        같은 로그인 계정에서, 각 커뮤별로 완전히 다른 페르소나를 운영해요. 커뮤
        사이에 정보가 새지 않습니다.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8">
        {[
          {
            tone: "from-mint/30 to-mint/5",
            who: "게이머",
            persona: "@drago_slayer",
            community: "TRPG 캠페인 커뮤",
            activity: "/roll 1d20+5 으로 공격, /buy 검 으로 장비",
          },
          {
            tone: "from-lilac/30 to-lilac/5",
            who: "작가",
            persona: "@은하수",
            community: "글쓰기 모임",
            activity: "단편 소설 게시, 합평 답글",
          },
          {
            tone: "from-butter/30 to-butter/5",
            who: "동료",
            persona: "@김지영",
            community: "회사 팀 커뮤",
            activity: "본명 프로필, 업무 공지 확인",
          },
        ].map((s) => (
          <Card key={s.persona} className="overflow-hidden border-border/60">
            <div className={`bg-gradient-to-br ${s.tone} px-4 py-3`}>
              <p className="text-xs font-semibold text-foreground/70">
                {s.who}
              </p>
              <p className="font-mono text-sm font-bold mt-0.5">{s.persona}</p>
            </div>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {s.community}
              </p>
              <p className="text-sm">{s.activity}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-8 max-w-md mx-auto">
        세 페르소나는 같은 사람이지만, 다른 커뮤의 누구도 그 사실을 알 수
        없어요.
      </p>
    </section>
  );
}

function ClosingCTA({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-6 sm:px-12 py-12 text-center">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blossom/10" />
      <div className="relative">
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
          시작할 준비가 되셨나요?
        </h2>
        <p className="text-muted-foreground mt-4 max-w-md mx-auto">
          가입하면 첫 커뮤를 만들 수 있고, 다른 커뮤에는 별도 가입 없이 새
          페르소나로 합류할 수 있어요.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-7">
          {isAuthenticated ? (
            <Button asChild size="lg" className="rounded-full">
              <Link to="/communities/create">
                커뮤 만들기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="rounded-full">
                <Link to="/signup">
                  지금 시작하기
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full"
              >
                <Link to="/communities">둘러보기</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8">
      <Hero isAuthenticated={isAuthenticated} />

      <FeatureSection
        eyebrow="멀티 페르소나"
        title="한 계정, 커뮤마다 다른 나"
        body="새 커뮤에 가입할 때마다 새 계정을 만들 필요 없어요. 같은 로그인에서 커뮤별로 다른 이름, 다른 프로필, 다른 자기소개를 만들 수 있습니다. 페르소나끼리는 자유롭게 전환되고, 다른 커뮤의 활동은 절대 묻어 나오지 않아요."
        icon={Users}
        tone="mint"
        bullets={[
          {
            label: "커뮤마다 다른 이름과 프로필",
            sub: "본명으로, 닉네임으로, 캐릭터명으로 — 원하는 만큼.",
          },
          {
            label: "한 번 가입, 여러 커뮤",
            sub: "다른 커뮤로 옮길 때 새 계정을 만들지 않아도 됩니다.",
          },
          {
            label: "한 사용자가 한 커뮤에서 여러 페르소나",
            sub: "주 캐릭터, 보조 캐릭터, 부캐 — 한 커뮤 안에서도 분리 가능.",
          },
        ]}
      />

      <FeatureSection
        eyebrow="프라이버시"
        title="페르소나는 절대 다른 커뮤로 새지 않아요"
        body="각 페르소나는 그 커뮤 안에서만 존재합니다. 다른 커뮤의 멤버는 어떤 페르소나가 같은 사람인지 알 수 없어요. 게시물, 답글, 멘션, 알림 — 모두 그 커뮤 안에서만 흐릅니다. 본명이 들킬 걱정 없이 자유롭게 여러 모습으로 활동할 수 있어요."
        icon={Lock}
        tone="lilac"
        reverse
        bullets={[
          {
            label: "활동은 커뮤 안에서만",
            sub: "게시물·답글·멘션·반응이 다른 커뮤로 흘러가지 않습니다.",
          },
          {
            label: "멤버 목록도 분리",
            sub: "한 커뮤의 멤버 목록은 그 커뮤 안의 페르소나만 보여줍니다.",
          },
          {
            label: "검색에서도 안전",
            sub: "다른 커뮤의 활동을 추적해 같은 사람을 찾아낼 수 없어요.",
          },
        ]}
      />

      <ScenarioCard />

      <FeatureSection
        eyebrow="앱과 슬래시 명령"
        title="코드 한 줄 없이 커뮤를 확장"
        body="카탈로그에서 앱을 설치하면 멤버 누구나 슬래시 명령으로 사용할 수 있어요. TRPG 주사위, 동전 던지기, 무작위 선택, 통화·상점까지 — 클릭 몇 번으로 커뮤가 살아납니다. 새 명령은 자동으로 따라옵니다."
        icon={LayoutGrid}
        tone="butter"
        bullets={[
          {
            label: "TRPG 주사위와 RP",
            sub: "/roll 3d6, 1d20+5 같은 표준 다이스 표기법 그대로.",
          },
          {
            label: "통화와 상점",
            sub: "owner가 통화·상품을 정의하고, 멤버가 /balance, /buy, /use로 즐겨요.",
          },
          {
            label: "공식 문서로 미리 보기",
            sub: "설치하지 않아도 누구나 카탈로그에서 사용법과 예시를 볼 수 있어요.",
          },
        ]}
      />

      <ClosingCTA isAuthenticated={isAuthenticated} />
    </div>
  );
}
