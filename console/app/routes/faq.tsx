import type { Route } from "./+types/faq";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "FAQ" },
    { name: "description", content: "커뮹에 대한 자주 묻는 질문." },
  ];
}

export default function FAQPage() {
  return (
    <article className="container mx-auto px-4 py-16 max-w-2xl">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          FAQ
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          자주 묻는 질문
        </h1>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none mt-10 prose-headings:font-display prose-headings:tracking-tight prose-h2:mt-10 prose-h2:mb-3 prose-p:leading-relaxed">
        <h2>커뮹은 무엇인가요?</h2>
        <p>여러 커뮤니티를 한 계정으로 사용하는 플랫폼입니다.</p>

        <h2>한 계정으로 여러 커뮤에 가입할 수 있나요?</h2>
        <p>
          네. 가입은 한 번만 하고, 그 계정으로 여러 커뮤에 들어갈 수 있습니다.
        </p>

        <h2>커뮤마다 다른 프로필을 쓸 수 있나요?</h2>
        <p>커뮤마다 별도의 프로필을 만들고, 이름과 ID를 따로 둡니다.</p>

        <h2>같은 커뮤 안에서 프로필을 여러 개 둘 수 있나요?</h2>
        <p>네. 한 커뮤에서 여러 프로필을 운영할 수 있습니다.</p>

        <h2>같은 커뮤의 여러 프로필이 같은 사람의 것이라는 게 보이나요?</h2>
        <p>
          해당 커뮤의 운영자에게만 같은 계정으로 만든 프로필끼리 묶여
          표시됩니다. 일반 멤버에게는 보이지 않습니다.
        </p>

        <h2>다른 커뮤의 프로필이 멤버에게 보이나요?</h2>
        <p>다른 커뮤의 프로필은 멤버 화면에 노출되지 않습니다.</p>

        <h2>커뮤에 가입하려면 어떻게 하나요?</h2>
        <p>
          커뮤의 신청 페이지에서 프로필 이름과 ID를 입력해 신청합니다. 운영자
          검토 후 승인됩니다.
        </p>

        <h2>커뮤를 만들려면 어떻게 하나요?</h2>
        <p>로그인 후 커뮤 만들기에서 새 커뮤를 개설할 수 있습니다.</p>

        <h2>비밀번호를 잊어버렸어요.</h2>
        <p>
          로그인 화면의 비밀번호 찾기에서 등록된 이메일로 재설정 링크를 받을 수
          있습니다.
        </p>

        <h2>계정을 삭제할 수 있나요?</h2>
        <p>네. 계정 설정에서 계정 삭제를 진행할 수 있습니다.</p>
      </div>
    </article>
  );
}
