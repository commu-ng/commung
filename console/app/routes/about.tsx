import type { Route } from "./+types/about";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮹에 대해서" },
    {
      name: "description",
      content:
        "커뮤마다 페르소나가 따로 살고, 커뮤마다 도구가 따로 있는 — 작은 차이가 모인 플랫폼.",
    },
  ];
}

export default function AboutPage() {
  return (
    <article className="container mx-auto px-4 py-16 max-w-2xl">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          About
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          커뮹에 대해서
        </h1>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none mt-10 prose-headings:font-display prose-headings:tracking-tight prose-h2:mt-12 prose-h2:mb-3 prose-p:leading-relaxed">
        <p>
          인터넷에서 오래 살다 보면 한 사람이 여러 모습으로 살게 됩니다. 평소엔
          어떤 이름으로 글을 쓰고, 게임 커뮤에서는 다른 닉으로 활동하고,
          좋아하는 아이돌을 응원할 때는 또 다른 이름이 됩니다. 이상한 일이
          아닙니다. 한 사람의 모습이 하나일 리 없습니다.
        </p>

        <p>
          문제는 그 모습들을 갈라놓기가 너무 번거롭다는 점입니다. 사이트마다 새
          계정을 만들고, 비밀번호가 쌓이고, 어디까지가 누구의 활동인지 본인도
          헷갈립니다. 더 곤란한 건 그렇게 갈라놓은 정체성이 얼마든지 새어나갈 수
          있다는 점입니다. 같은 이메일, 같은 글쓰기 습관, 같은 친구들. 누군가
          마음먹으면 추적할 수 있는 흔적이 곳곳에 남습니다.
        </p>

        <p>커뮹은 이 문제에 다르게 답해보려는 시도입니다.</p>

        <h2>한 계정, 커뮤마다 다른 페르소나</h2>

        <p>
          커뮹에서는 가입을 한 번만 합니다. 그 하나의 계정으로 여러 커뮤에
          들어갈 수 있고, 들어간 커뮤마다 새 페르소나를 만듭니다 — 새 이름, 새
          프로필, 새 자기소개. 게이머일 때는 한 닉으로, 글쓰기 모임에서는 또
          다른 필명으로, 덕질 모임에서는 또 다른 이름으로. 다른 커뮤의
          멤버에게는 두 페르소나가 같은 사람이라는 게 보이지 않습니다.
        </p>

        <p>
          같은 커뮤 안에서도 페르소나를 여럿 둘 수 있습니다. 주캐와 부캐, 또는
          시점이 다른 캐릭터들. 어떻게 쓸지는 사용자가 정하지, 플랫폼이 강제하지
          않습니다.
        </p>

        <p>여러 모습으로 사는 일이 조금은 자연스럽기를 바라며 만들었습니다.</p>
      </div>
    </article>
  );
}
