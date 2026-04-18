import { BookOpen } from "lucide-react";
import { PageHeader } from "~/components/shared/PageHeader";
import type { Route } from "./+types/policy";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮤니티 가이드라인 - Community Guidelines" },
    {
      name: "description",
      content: "커뮹! 커뮤니티 가이드라인",
    },
  ];
}

export default function Policy() {
  return (
    <div className="flex flex-col gap-12 px-4 py-8 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="정책"
        icon={BookOpen}
        title="커뮤니티 가이드라인"
        description="함께 안전한 공간을 만들기 위한 약속"
        tone="mint"
      />
      <section className="space-y-6">
        <p className="text-lg">
          커뮹!은 모든 사용자에게 안전하고 환영받는 존중의 환경을 제공하기 위해
          노력합니다. 우리는 불쾌한 콘텐츠와 학대적 행동에 대해 무관용 원칙을
          적용합니다.
        </p>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">
              금지된 콘텐츠 및 행동:
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>다른 사용자에 대한 괴롭힘, 위협 또는 따돌림</li>
              <li>
                인종, 민족, 종교, 성별, 성적 지향, 장애 또는 기타 보호 대상
                특성에 기반한 혐오 발언이나 차별
              </li>
              <li>
                아동 성착취 및 학대(CSAE) 콘텐츠를 포함한 미성년자가 관련된 성적
                콘텐츠 또는 비동의 성적 콘텐츠
              </li>
              <li>
                폭력 조장, 규제 물질 유통, 저작권 침해 등을 포함한 불법 콘텐츠
                또는 활동
              </li>
              <li>스팸, 악성코드 또는 피싱 시도</li>
              <li>사칭 또는 신원 사기</li>
              <li>다른 사람의 동의 없이 개인정보를 공개하는 행위</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">아동 안전 정책:</h2>
            <p className="mb-2">
              커뮹!은 아동의 안전을 최우선으로 합니다. 우리는 아동 성착취 및
              학대(CSAE)에 대해 무관용 원칙을 적용합니다.
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                아동을 성적으로 묘사하거나 착취하는 모든 콘텐츠는 엄격히
                금지됩니다
              </li>
              <li>
                아동 그루밍, 성적 유인, 또는 아동을 대상으로 한 모든 형태의
                착취적 행동은 금지됩니다
              </li>
              <li>
                CSAE 콘텐츠가 발견되면 즉시 삭제되고, 해당 계정은 영구 정지되며,
                관련 당국에 신고됩니다
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">집행:</h2>
            <p>
              이러한 가이드라인 위반 시 경고 없이 즉시 영구적으로 계정이 정지될
              수 있습니다. 우리는 불법 활동을 법 집행 기관에 신고할 권리를
              보유합니다.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">신고:</h2>
            <p>
              이러한 가이드라인을 위반하는 콘텐츠나 행동을 발견하면 즉시 신고해
              주세요. 우리는 모든 신고를 심각하게 받아들이고 신속하게
              조사합니다.
            </p>
          </div>

          <p>
            커뮹!을 사용함으로써 귀하는 이러한 커뮤니티 가이드라인을 준수하는 데
            동의합니다. 우리는 언제든지 이러한 가이드라인을 업데이트할 권리를
            보유합니다.
          </p>
        </div>
      </section>

      <section className="space-y-6 border-t pt-12">
        <h1 className="text-3xl font-bold">Community Guidelines</h1>

        <p className="text-lg">
          Commung! is committed to providing a safe, welcoming, and respectful
          environment for all users. We have zero tolerance for objectionable
          content and abusive behavior.
        </p>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">
              Prohibited Content and Behavior:
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Harassment, threats, or bullying of other users</li>
              <li>
                Hate speech or discrimination based on race, ethnicity,
                religion, gender, sexual orientation, disability, or any other
                protected characteristic
              </li>
              <li>
                Child Sexual Abuse and Exploitation (CSAE) content, including
                any sexual content involving minors or non-consensual sexual
                content
              </li>
              <li>
                Illegal content or activities, including but not limited to:
                promotion of violence, distribution of controlled substances,
                copyright infringement
              </li>
              <li>Spam, malware, or phishing attempts</li>
              <li>Impersonation or identity fraud</li>
              <li>
                Doxxing or sharing others' private information without consent
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">
              Child Safety Standards:
            </h2>
            <p className="mb-2">
              Commung! (커뮹!) prioritizes child safety above all else. We have
              zero tolerance for Child Sexual Abuse and Exploitation (CSAE).
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                All content that sexually depicts or exploits children is
                strictly prohibited
              </li>
              <li>
                Child grooming, sexual solicitation, or any form of exploitative
                behavior targeting minors is prohibited
              </li>
              <li>
                Any CSAE content discovered will be immediately removed, the
                associated account will be permanently banned, and the incident
                will be reported to the appropriate authorities
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Enforcement:</h2>
            <p>
              Violations of these guidelines may result in immediate and
              permanent account termination without warning. We reserve the
              right to report illegal activities to law enforcement authorities.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Reporting:</h2>
            <p>
              If you encounter content or behavior that violates these
              guidelines, please report it immediately. We take all reports
              seriously and will investigate promptly.
            </p>
          </div>

          <p>
            By using Commung!, you agree to abide by these community guidelines.
            We reserve the right to update these guidelines at any time.
          </p>
        </div>
      </section>
    </div>
  );
}
