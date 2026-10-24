import { ExternalLink, Megaphone } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";

export const NARU_URL = "https://naru.pub";
export const COMMUNG_APP_URL = "https://commung.naru.pub";

export function CommungOnNaruNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm">
      <Megaphone className="h-5 w-5 shrink-0 text-primary mt-0.5" />
      <div className="leading-relaxed">
        <p className="font-semibold text-primary">
          커뮹이 나루 앱으로 바뀌어요.
        </p>
        <p className="text-muted-foreground mt-0.5">
          새 커뮤는 나루에 커뮹을 설치해서 열어요. 지금 운영 중인 커뮤는
          종료일까지 그대로 이용할 수 있어요.
        </p>
      </div>
    </div>
  );
}

function CommungOnNaruIntro() {
  return (
    <section className="rounded-3xl border border-border/70 bg-card shadow-marsh px-6 sm:px-10 py-8">
      <p className="text-sm font-semibold text-muted-foreground mb-2">
        커뮹의 다음 모습
      </p>
      <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
        커뮹이 나루 앱으로 바뀌어요
      </h1>
      <div className="text-muted-foreground mt-3 max-w-xl leading-relaxed space-y-2">
        <p>
          이제 커뮹은 나루에 설치해서 쓰는 커뮤 앱이에요. 내 나루 주소에서
          커뮤를 열고, 디자인부터 구성까지 원하는 대로 바꿀 수 있어요.
        </p>
        <p>
          새 커뮤는 이제 나루에서 열어요. 여기서 운영 중인 커뮤는 종료일까지
          그대로 이용할 수 있어요.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-6">
        <Button asChild>
          <a href={COMMUNG_APP_URL} target="_blank" rel="noreferrer">
            커뮹 앱 알아보기
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={NARU_URL} target="_blank" rel="noreferrer">
            나루 시작하기
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "나루 가입하기",
    body: "naru.pub에서 원하는 주소를 정하면, 그 주소가 내 홈페이지가 돼요.",
    href: NARU_URL,
    linkLabel: "naru.pub",
  },
  {
    title: "커뮹 설치하기",
    body: "서포터 플랜에 가입한 뒤, 커뮹 앱 페이지에서 내 나루 계정에 설치해요.",
    href: COMMUNG_APP_URL,
    linkLabel: "commung.naru.pub",
  },
  {
    title: "커뮤 열고 꾸미기",
    body: "내 주소.naru.pub에서 커뮤가 열려요. 디자인과 구성을 원하는 대로 바꾸고, 링크를 공유해 멤버를 모아 보세요.",
    href: null,
    linkLabel: null,
  },
];

function InstallSteps() {
  return (
    <section className="rounded-3xl border border-border/70 bg-card shadow-marsh px-6 sm:px-10 py-8">
      <h2 className="font-display text-lg font-bold tracking-tight mb-5">
        나루에서 커뮹 시작하기
      </h2>
      <ol className="space-y-5">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-sm font-semibold text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                {step.body}
              </p>
              {step.href && (
                <a
                  href={step.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-sm text-primary hover:underline"
                >
                  {step.linkLabel}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const QUESTIONS = [
  {
    q: "무엇이 달라지나요?",
    a: "커뮹이 내 나루 계정에 설치하는 앱이 돼요. 커뮤 주소와 디자인, 화면 구성을 직접 정할 수 있어요.",
  },
  {
    q: "지금 운영 중인 커뮤는 어떻게 되나요?",
    a: "종료일까지 지금처럼 커뮹에서 운영할 수 있어요. 멤버 관리, 지원서 검토 등 기존 기능도 그대로예요.",
  },
  {
    q: "커뮹 계정으로 나루에 로그인할 수 있나요?",
    a: "나루는 별도 서비스라 새로 가입해야 해요. 가입은 원하는 주소를 정하는 것으로 끝나요.",
  },
  {
    q: "나루는 무료인가요?",
    a: "네, 나루는 무료 개인 홈페이지 호스팅이에요. 다만, 커뮹을 설치하려면 서포터 플랜에 가입하셔야 해요.",
  },
];

function MigrationFaq() {
  return (
    <section className="rounded-3xl border border-border/70 bg-card shadow-marsh px-6 sm:px-10 py-8">
      <h2 className="font-display text-lg font-bold tracking-tight mb-5">
        자주 묻는 질문
      </h2>
      <dl className="space-y-4">
        {QUESTIONS.map((item) => (
          <div key={item.q}>
            <dt className="font-semibold">{item.q}</dt>
            <dd className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {item.a}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ExistingUsers() {
  return (
    <p className="text-sm text-muted-foreground text-center">
      기존 커뮤를 운영 중이라면{" "}
      <Link to="/login" className="text-primary font-semibold hover:underline">
        로그인
      </Link>
      해서 계속 관리하세요.
    </p>
  );
}

export function CommungOnNaruLanding() {
  return (
    <div className="space-y-6">
      <CommungOnNaruIntro />
      <InstallSteps />
      <MigrationFaq />
      <ExistingUsers />
    </div>
  );
}
