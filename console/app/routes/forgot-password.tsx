import { useId, useState } from "react";
import { Link } from "react-router";
import { AuthShell } from "~/components/shared/AuthShell";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/forgot-password";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "비밀번호 찾기" },
    { name: "description", content: "비밀번호를 재설정하세요" },
  ];
}

export default function ForgotPassword() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await api.console["request-password-reset"].$post({
        json: {
          email,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = getErrorMessage(
          errorData,
          "이메일 전송에 실패했습니다",
        );
        setError(errorMessage);
        return;
      }

      setSuccess(true);
      setEmail("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "이메일 전송에 실패했습니다",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="괜찮아요, 다시 만들어요"
      title="비밀번호 찾기"
      description="가입 시 등록한 이메일로 재설정 링크를 보내드려요."
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          {success ? (
            <div className="text-sm text-mint-ink bg-mint/40 p-4 rounded">
              <p className="font-medium mb-2">
                비밀번호 재설정 이메일이 전송되었습니다!
              </p>
              <p>
                이메일을 확인하고 링크를 클릭하여 비밀번호를 재설정하세요.
                이메일이 보이지 않으면 스팸함을 확인해주세요.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={emailId}>이메일 주소</FieldLabel>
                  <Input
                    id={emailId}
                    name="email"
                    type="email"
                    placeholder="example@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <FieldError>{error}</FieldError>
                <Field orientation="horizontal">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Spinner />}
                    {isLoading ? "전송 중..." : "재설정 링크 전송"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
          <div className="text-center text-sm space-y-2">
            <div>
              <Link to="/login" className="text-primary hover:underline">
                로그인으로 돌아가기
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
