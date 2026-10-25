import { ArrowRight, ExternalLink, Megaphone } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";

// 커뮹 now runs on Naru; commung.naru.pub explains it and how to install it.
export const COMMUNG_APP_URL = "https://commung.naru.pub";

export function CommungOnNaruNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm">
      <Megaphone className="h-5 w-5 shrink-0 text-primary mt-0.5" />
      <p className="leading-relaxed">
        <span className="font-semibold text-primary">
          새 커뮤는 나루에서 열어요.
        </span>{" "}
        <span className="text-muted-foreground">
          지금 운영 중인 커뮤는 종료일까지 그대로 이용할 수 있어요.
        </span>{" "}
        <a
          href={COMMUNG_APP_URL}
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          commung.naru.pub
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </p>
    </div>
  );
}

export function CommungOnNaruLanding() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/70 bg-card shadow-marsh px-6 sm:px-10 py-10 text-center">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
          커뮹은 이제 나루에서 열어요
        </h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          새 커뮤를 여는 방법은 commung.naru.pub에서 안내해요.
        </p>
        <Button asChild size="lg" className="rounded-full mt-6">
          <a href={COMMUNG_APP_URL}>
            commung.naru.pub으로 가기
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </section>
      <p className="text-sm text-muted-foreground text-center">
        기존 커뮤를 운영 중이라면{" "}
        <Link
          to="/login"
          className="text-primary font-semibold hover:underline"
        >
          로그인
        </Link>
        해서 계속 관리하세요.
      </p>
    </div>
  );
}
