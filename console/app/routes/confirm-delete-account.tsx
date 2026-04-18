import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/confirm-delete-account";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "계정 삭제 확인" },
    { name: "description", content: "계정 삭제 확인 페이지" },
  ];
}

export default function ConfirmDeleteAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [userInfo, setUserInfo] = useState<{
    login_name: string | null;
    email: string | null;
  } | null>(null);
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(true);

  const token = searchParams.get("token");

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!token) {
        setConfirmationStatus("error");
        setMessage("유효하지 않은 확인 링크입니다.");
        setIsLoadingUserInfo(false);
        return;
      }

      try {
        const response = await api.console["verify-delete-token"][
          ":token"
        ].$get({
          param: { token },
        });

        if (response.ok) {
          const result = await response.json();
          setUserInfo(result.data);
        } else {
          const errorData = await response.json();
          setConfirmationStatus("error");
          setMessage(getErrorMessage(errorData, "토큰 확인에 실패했습니다."));
        }
      } catch (_err) {
        setConfirmationStatus("error");
        setMessage("토큰 확인 중 오류가 발생했습니다.");
      } finally {
        setIsLoadingUserInfo(false);
      }
    };

    fetchUserInfo();
  }, [token]);

  const confirmDeleteAccount = async () => {
    if (!token) {
      setConfirmationStatus("error");
      setMessage("유효하지 않은 확인 링크입니다.");
      return;
    }

    setIsConfirming(true);

    try {
      const response = await api.console["confirm-delete-account"].$post({
        json: {
          token,
        },
      });

      if (response.ok) {
        setConfirmationStatus("success");
        setMessage("계정이 성공적으로 삭제되었습니다.");

        // Logout and redirect after a short delay
        setTimeout(async () => {
          await logout();
          navigate("/");
        }, 2000);
      } else {
        const errorData = await response.json();
        setConfirmationStatus("error");
        setMessage(getErrorMessage(errorData, "계정 삭제에 실패했습니다."));
      }
    } catch (_err) {
      setConfirmationStatus("error");
      setMessage("계정 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>계정 삭제 확인</CardTitle>
          <CardDescription>계정 삭제를 확인하고 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingUserInfo && confirmationStatus === "idle" && (
            <div className="text-sm text-muted-foreground text-center py-4">
              계정 정보를 불러오는 중...
            </div>
          )}

          {!isLoadingUserInfo && confirmationStatus === "idle" && (
            <div className="space-y-4">
              <div className="text-sm bg-butter/40 p-4 rounded-lg border border-butter/60">
                <p className="font-medium text-butter-ink mb-2">
                  ⚠️ 계정을 정말로 삭제하시겠습니까?
                </p>
                {userInfo && (
                  <div className="text-butter-ink text-xs mb-2 space-y-1">
                    <p>
                      <strong>아이디:</strong> {userInfo.login_name}
                    </p>
                    <p>
                      <strong>이메일:</strong> {userInfo.email}
                    </p>
                  </div>
                )}
                <p className="text-butter-ink text-xs">
                  이 작업은 되돌릴 수 없으며, 모든 데이터가 영구적으로
                  삭제됩니다.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  onClick={confirmDeleteAccount}
                  disabled={isConfirming || !token}
                  className="w-full"
                >
                  {isConfirming ? "처리 중..." : "계정 삭제 확인"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/account")}
                  disabled={isConfirming}
                  className="w-full"
                >
                  취소
                </Button>
              </div>
            </div>
          )}

          {confirmationStatus === "success" && (
            <div className="space-y-4">
              <div className="text-sm text-mint-ink bg-mint/40 p-4 rounded-lg">
                <div className="font-medium mb-1">{message}</div>
                <div className="text-xs">잠시 후 홈으로 이동합니다...</div>
              </div>
            </div>
          )}

          {confirmationStatus === "error" && (
            <div className="space-y-4">
              <div className="text-sm text-destructive bg-destructive/15 p-4 rounded-lg">
                {message}
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate("/")} className="w-full">
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
