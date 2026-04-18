import { BookOpen } from "lucide-react";
import { PageHeader } from "~/components/shared/PageHeader";
import type { Route } from "./+types/privacy";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "개인정보 처리방침 - Privacy Policy" },
    {
      name: "description",
      content: "커뮹! 개인정보 처리방침",
    },
  ];
}

export default function Privacy() {
  return (
    <div className="flex flex-col gap-12 px-4 py-8 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="정책"
        icon={BookOpen}
        title="개인정보 처리방침"
        description="여러분의 정보를 어떻게 다루는지 알려드려요"
        tone="mint"
      />
      <section className="space-y-6">
        <p className="text-lg">
          커뮹!은 회원님의 개인정보를 소중히 다룹니다. 기본적으로 커뮹! 이용 시
          개인정보를 수집하지 않습니다.
        </p>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">이메일 주소</h2>
            <p>
              회원가입 시 또는 프로필 업데이트 시 자발적으로 제공하는 경우에만
              이메일 주소를 수집합니다. 이메일은 비밀번호 복구, 계정 인증 등
              계정 관련 목적으로만 사용됩니다.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">데이터 사용</h2>
            <p>
              회원님이 제공한 정보는 오직 커뮹! 서비스 운영 및 개선을 위해서만
              사용됩니다. 개인정보를 제3자에게 판매, 임대 또는 공유하지
              않습니다.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">데이터 보안</h2>
            <p>
              회원님의 정보를 무단 접근이나 유출로부터 보호하기 위해 합리적인
              조치를 취하고 있습니다.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">회원님의 권리</h2>
            <p>
              계정 설정을 통해 언제든지 본인의 계정 및 관련 데이터를 열람, 수정
              또는 삭제할 수 있습니다.
            </p>
          </div>

          <p>개인정보 처리방침에 대해 궁금한 점이 있으시면 문의해 주세요.</p>
        </div>
      </section>

      <section className="space-y-6 border-t pt-12">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>

        <p className="text-lg">
          We respect your privacy. By default, we do not collect any personal
          information from users of Commung!.
        </p>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Email Address</h2>
            <p>
              We only collect your email address if you voluntarily provide it
              when creating an account or updating your profile. Your email is
              used solely for account-related purposes, such as password
              recovery and account verification.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Data Usage</h2>
            <p>
              Any information you provide is used exclusively to operate and
              improve the Commung! service. We do not sell, rent, or share your
              personal information with third parties.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Data Security</h2>
            <p>
              We take reasonable measures to protect your information from
              unauthorized access or disclosure.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Your Rights</h2>
            <p>
              You have the right to access, modify, or delete your account and
              associated data at any time through your account settings.
            </p>
          </div>

          <p>
            If you have any questions about this privacy policy, please contact
            us.
          </p>
        </div>
      </section>
    </div>
  );
}
