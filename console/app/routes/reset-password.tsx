import { useEffect, useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AuthShell } from "~/components/shared/AuthShell";
import { LoadingState } from "~/components/shared/LoadingState";
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
import type { Route } from "./+types/reset-password";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "비밀번호 재설정" },
    { name: "description", content: "새 비밀번호를 설정하세요" },
  ];
}

export default function ResetPassword() {
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [tokenError, setTokenError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenError("유효하지 않은 재설정 링크입니다");
        setIsValidatingToken(false);
        return;
      }

      try {
        const response = await api.console["verify-reset-token"][":token"].$get(
          {
            param: { token },
          },
        );

        if (response.ok) {
          setIsValidToken(true);
        } else {
          const errorData = await response.json();
          setTokenError(
            getErrorMessage(errorData, "유효하지 않은 재설정 링크입니다"),
          );
        }
      } catch (_err) {
        setTokenError("토큰 확인 중 오류가 발생했습니다");
      } finally {
        setIsValidatingToken(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    if (newPassword.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다");
      return;
    }

    if (!token) {
      setError("유효하지 않은 토큰입니다");
      return;
    }

    setIsResetting(true);

    try {
      const response = await api.console["reset-password"].$post({
        json: {
          token,
          new_password: newPassword,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = getErrorMessage(
          errorData,
          "비밀번호 재설정에 실패했습니다",
        );
        setError(errorMessage);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "비밀번호 재설정에 실패했습니다",
      );
    } finally {
      setIsResetting(false);
    }
  };

  if (isValidatingToken) {
    return (
      <div className="flex items-center justify-center bg-background">
        <LoadingState message="토큰을 확인하는 중..." />
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <AuthShell
        eyebrow="비밀번호 재설정"
        title="유효하지 않은 링크"
        description="링크가 만료되었거나 사용할 수 없어요."
      >
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="text-sm text-destructive bg-destructive/15 p-4 rounded">
              <p className="font-medium mb-2">{tokenError}</p>
              <p>
                재설정 링크가 만료되었거나 유효하지 않습니다. 비밀번호 찾기를
                다시 시도해주세요.
              </p>
            </div>
            <Button asChild className="w-full">
              <a href="/forgot-password">비밀번호 찾기</a>
            </Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="비밀번호 재설정"
      title="새 비밀번호를 만들어요"
      description="안전한 비밀번호로 다시 시작해요."
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          {success ? (
            <div className="text-sm text-mint-ink bg-mint/40 p-4 rounded">
              <p className="font-medium mb-2">
                비밀번호가 성공적으로 재설정되었습니다!
              </p>
              <p>잠시 후 로그인 페이지로 이동합니다...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={newPasswordId}>새 비밀번호</FieldLabel>
                  <Input
                    id={newPasswordId}
                    type="password"
                    placeholder="새 비밀번호를 입력하세요"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={confirmPasswordId}>
                    비밀번호 확인
                  </FieldLabel>
                  <Input
                    id={confirmPasswordId}
                    type="password"
                    placeholder="비밀번호를 다시 입력하세요"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </Field>
                <FieldError>{error}</FieldError>
                <Field orientation="horizontal">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isResetting}
                  >
                    {isResetting && <Spinner />}
                    {isResetting ? "재설정 중..." : "비밀번호 재설정"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
