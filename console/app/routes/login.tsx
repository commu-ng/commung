import { useEffect, useId, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
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
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/login";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "로그인" },
    { name: "description", content: "계정에 로그인하세요" },
  ];
}

export default function Login() {
  const loginNameId = useId();
  const passwordId = useId();

  const [formData, setFormData] = useState({
    login_name: "",
    password: "",
  });
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

    try {
      const response = await api.console.login.$post({
        json: {
          login_name: formData.login_name,
          password: formData.password,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = getErrorMessage(
          errorData,
          "로그인에 실패했습니다",
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
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoadingState message="인증 정보를 확인하는 중..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <AuthShell
      eyebrow="다시 만나서 반가워요"
      title="로그인"
      description="아이디와 비밀번호로 계정에 접속해요."
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
                  onChange={handleInputChange}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={passwordId}>비밀번호</FieldLabel>
                <Input
                  id={passwordId}
                  name="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </Field>
              <FieldError>{error}</FieldError>
              <Field orientation="horizontal">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Spinner />}
                  {isLoading ? "로그인 중..." : "로그인"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
          <div className="text-center text-sm space-y-2">
            <div>
              <Link
                to="/forgot-password"
                className="text-primary hover:underline"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
