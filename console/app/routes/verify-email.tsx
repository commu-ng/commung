import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/verify-email";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "이메일 인증" },
    { name: "description", content: "이메일 인증 페이지" },
  ];
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  const token = searchParams.get("token");

  const verifyEmail = useCallback(async () => {
    if (!token) {
      setVerificationStatus("error");
      setMessage("유효하지 않은 인증 링크입니다.");
      return;
    }

    setIsVerifying(true);

    try {
      const response = await api.console["verify-email"].$post({
        json: {
          token,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setVerificationStatus("success");
        setVerifiedEmail(data.data.email);
        setMessage("이메일이 성공적으로 인증되었습니다!");
      } else {
        const errorData = await response.json();
        setVerificationStatus("error");
        setMessage(getErrorMessage(errorData, "이메일 인증에 실패했습니다."));
      }
    } catch (_err) {
      setVerificationStatus("error");
      setMessage("이메일 인증 중 오류가 발생했습니다.");
    } finally {
      setIsVerifying(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && verificationStatus === "idle") {
      verifyEmail();
    }
  }, [token, verificationStatus, verifyEmail]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>이메일 인증</CardTitle>
          <CardDescription>이메일 주소를 인증하고 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isVerifying && (
            <div className="text-center py-8">
              <div className="text-lg font-medium">인증 중...</div>
            </div>
          )}

          {verificationStatus === "success" && (
            <div className="space-y-4">
              <div className="text-sm text-mint-ink bg-mint/40 p-4 rounded-lg">
                <div className="font-medium mb-1">{message}</div>
                {verifiedEmail && (
                  <div className="text-xs">인증된 이메일: {verifiedEmail}</div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate("/account")} className="w-full">
                  계정 설정으로 이동
                </Button>
                <Button
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="w-full"
                >
                  홈으로 이동
                </Button>
              </div>
            </div>
          )}

          {verificationStatus === "error" && (
            <div className="space-y-4">
              <div className="text-sm text-destructive bg-destructive/15 p-4 rounded-lg">
                {message}
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate("/account")} className="w-full">
                  계정 설정으로 이동
                </Button>
                <Button
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="w-full"
                >
                  홈으로 이동
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
