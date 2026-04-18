import { useEffect, useId, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { AuthShell } from "~/components/shared/AuthShell";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Spinner } from "~/components/ui/spinner";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/signup";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "회원가입" },
    { name: "description", content: "계정을 생성하세요" },
  ];
}

export default function Signup() {
  const loginNameId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const policyAgreementId = useId();

  const [formData, setFormData] = useState({
    login_name: "",
    password: "",
    confirmPassword: "",
  });
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refetch, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!policyAgreed) {
      setError("개인정보 처리방침 및 커뮤니티 가이드라인에 동의해주세요");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("비밀번호가 일치하지 않습니다");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다");
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.console.signup.$post({
        json: {
          login_name: formData.login_name,
          password: formData.password,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = getErrorMessage(
          errorData,
          "회원가입에 실패했습니다",
        );
        toast.error(errorMessage);
        return;
      }

      // Refetch auth state to update navigation
      refetch();

      // Redirect to next URL if provided, otherwise go to home
      const nextUrl = searchParams.get("next");
      if (nextUrl) {
        // If next URL is provided, redirect to it (could be external)
        window.location.href = nextUrl;
      } else {
        // Otherwise navigate to home within the console
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center bg-background">
        <LoadingState message="인증 정보를 확인하는 중..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <AuthShell
      eyebrow="환영해요"
      title="처음 오셨군요!"
      description="짧은 정보만 입력하면 바로 시작할 수 있어요."
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={loginNameId}>아이디</FieldLabel>
                <Input
                  id={loginNameId}
                  name="login_name"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={formData.login_name}
                  onChange={(e) => {
                    const filteredValue = e.target.value
                      .replace(/[^a-zA-Z0-9_]/g, "")
                      .toLowerCase();
                    setFormData((prev) => ({
                      ...prev,
                      login_name: filteredValue,
                    }));
                    setError("");
                  }}
                  required
                />
                <FieldDescription>
                  영문 소문자, 숫자, 언더스코어만 사용 가능합니다.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={passwordId}>비밀번호</FieldLabel>
                <Input
                  id={passwordId}
                  name="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요 (최소 8자)"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={confirmPasswordId}>
                  비밀번호 확인
                </FieldLabel>
                <Input
                  id={confirmPasswordId}
                  name="confirmPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                />
              </Field>
              <Field>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={policyAgreementId}
                    checked={policyAgreed}
                    onCheckedChange={setPolicyAgreed}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={policyAgreementId}
                    className="text-sm leading-relaxed"
                  >
                    <a
                      href="https://commu.ng/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      개인정보 처리방침
                    </a>
                    {" 및 "}
                    <a
                      href="https://commu.ng/policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      커뮤니티 가이드라인
                    </a>
                    에 동의합니다
                  </label>
                </div>
              </Field>
              <FieldError>{error}</FieldError>
              <Field orientation="horizontal">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Spinner />}
                  {isLoading ? "회원가입 중..." : "회원가입"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
          <div className="text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link
              to={`/login${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next") || "")}` : ""}`}
              className="text-primary hover:underline font-medium"
            >
              로그인
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
