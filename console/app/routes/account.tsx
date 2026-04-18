import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { UserMinus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/account";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "계정 설정" },
    { name: "description", content: "계정 정보 및 설정" },
  ];
}

export default function Account() {
  const { user, logout, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Generate unique IDs for form elements
  const emailId = useId();
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const deleteConfirmId = useId();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteEmailSent, setDeleteEmailSent] = useState(false);
  const [email, setEmail] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent("/account")}`);
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setEmailMessage("");

    if (!email || !email.includes("@")) {
      setEmailError("유효한 이메일 주소를 입력하세요.");
      return;
    }

    setIsUpdatingEmail(true);

    try {
      const response = await api.console.email.$post({
        json: {
          email,
        },
      });

      if (response.ok) {
        setEmailMessage("인증 이메일이 전송되었습니다. 이메일을 확인해주세요.");
        setEmail("");
      } else {
        const errorData = await response.json();
        setEmailError(
          getErrorMessage(errorData, "이메일 전송에 실패했습니다."),
        );
      }
    } catch (_err) {
      setEmailError("이메일 전송 중 오류가 발생했습니다.");
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await api.console["change-password"].$post({
        json: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });

      if (response.ok) {
        setMessage("비밀번호가 성공적으로 변경되었습니다.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const errorData = await response.json();
        setError(getErrorMessage(errorData, "비밀번호 변경에 실패했습니다."));
      }
    } catch (_err) {
      setError("비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      setDeleteError("'DELETE'를 정확히 입력해주세요.");
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError("");

    try {
      const response = await api.console.users.me.$delete();

      if (response.ok) {
        const data = await response.json();

        // Check if email confirmation is required
        if (
          "requiresEmailConfirmation" in data &&
          data.requiresEmailConfirmation
        ) {
          setDeleteEmailSent(true);
          setDeleteError("");
        } else {
          // Account deleted successfully, redirect to home
          await logout();
          navigate("/");
        }
      } else {
        const errorData = await response.json();
        setDeleteError(getErrorMessage(errorData, "계정 삭제에 실패했습니다."));
      }
    } catch (_err) {
      setDeleteError("계정 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <LoadingState message="계정 정보를 불러오는 중..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">계정 설정</h1>

        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle>계정 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>아이디</Label>
              <div className="text-sm text-muted-foreground mt-1">
                {user.login_name}
              </div>
            </div>
            <div>
              <Label>이메일</Label>
              <div className="text-sm text-muted-foreground mt-1">
                {user.email ? (
                  <div className="flex items-center gap-2">
                    <span>{user.email}</span>
                    {user.email_verified ? (
                      <span className="text-xs bg-mint/40 text-mint-ink px-2 py-0.5 rounded">
                        인증됨
                      </span>
                    ) : (
                      <span className="text-xs bg-butter/40 text-butter-ink px-2 py-0.5 rounded">
                        미인증
                      </span>
                    )}
                  </div>
                ) : (
                  "등록된 이메일 없음"
                )}
              </div>
            </div>
            <div>
              <Label>가입일</Label>
              <div className="text-sm text-muted-foreground mt-1">
                {user.created_at &&
                !Number.isNaN(new Date(user.created_at).getTime())
                  ? format(new Date(user.created_at), "yyyy년 MM월 dd일", {
                      locale: ko,
                    })
                  : "알 수 없음"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Verification */}
        <Card>
          <CardHeader>
            <CardTitle>이메일 {user.email ? "변경" : "등록"}</CardTitle>
            <CardDescription>
              이메일을 {user.email ? "변경" : "등록"}하면 인증 메일이
              발송됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailUpdate}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={emailId}>이메일 주소</FieldLabel>
                  <Input
                    id={emailId}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@example.com"
                    required
                  />
                </Field>
                {emailError && <FieldError>{emailError}</FieldError>}
              </FieldGroup>

              {emailMessage && (
                <div className="text-sm text-mint-ink bg-mint/40 p-3 rounded mt-4">
                  {emailMessage}
                </div>
              )}

              <Button type="submit" disabled={isUpdatingEmail} className="mt-4">
                {isUpdatingEmail && <Spinner />}
                {isUpdatingEmail ? "전송 중..." : "인증 메일 발송"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle>비밀번호 변경</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={currentPasswordId}>
                    현재 비밀번호
                  </FieldLabel>
                  <Input
                    id={currentPasswordId}
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={newPasswordId}>새 비밀번호</FieldLabel>
                  <Input
                    id={newPasswordId}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={confirmPasswordId}>
                    새 비밀번호 확인
                  </FieldLabel>
                  <Input
                    id={confirmPasswordId}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </Field>
                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>

              {message && (
                <div className="text-sm text-mint-ink bg-mint/40 p-3 rounded mt-4">
                  {message}
                </div>
              )}

              <Button
                type="submit"
                disabled={isChangingPassword}
                className="mt-4"
              >
                {isChangingPassword && <Spinner />}
                {isChangingPassword ? "변경 중..." : "비밀번호 변경"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Blocked Users */}
        <Card>
          <CardHeader>
            <CardTitle>차단한 사용자</CardTitle>
            <CardDescription>
              차단한 사용자의 게시글과 댓글은 게시판에서 보이지 않습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/account/blocked-users">
                <UserMinus className="h-4 w-4 mr-2" />
                차단 목록 관리
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Card>
          <CardHeader>
            <CardTitle>로그아웃</CardTitle>
            <CardDescription>계정에서 로그아웃합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleLogout}>
              로그아웃
            </Button>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">계정 삭제</CardTitle>
            <CardDescription>
              계정을 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              <br />
              <span className="font-medium text-destructive">
                주의: 커뮤를 소유하고 있다면 먼저 커뮤를 삭제하거나 양도해야
                합니다.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog
              open={isDeleteDialogOpen}
              onOpenChange={setIsDeleteDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteError("");
                    setDeleteConfirmText("");
                    setDeleteEmailSent(false);
                  }}
                >
                  계정 삭제
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-destructive">
                    계정 삭제 확인
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="space-y-2">
                      <p>정말로 계정을 삭제하시겠습니까?</p>
                      <p className="font-medium text-destructive">
                        이 작업은 되돌릴 수 없으며, 다음과 같은 결과가
                        발생합니다:
                      </p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li>계정이 영구적으로 비활성화됩니다</li>
                        <li>모든 활성 세션이 종료됩니다</li>
                        <li>커뮤에서의 참여가 중단됩니다</li>
                      </ul>
                      <p className="font-medium">
                        계속하려면 아래에 'DELETE'를 정확히 입력해주세요:
                      </p>
                    </div>
                  </DialogDescription>
                </DialogHeader>

                {deleteEmailSent ? (
                  <div className="text-sm text-mint-ink bg-mint/40 p-4 rounded">
                    <p className="font-medium mb-2">
                      계정 삭제 확인 이메일이 전송되었습니다!
                    </p>
                    <p>
                      {user?.email}(으)로 전송된 이메일의 링크를 클릭하여 계정
                      삭제를 완료해주세요.
                    </p>
                  </div>
                ) : (
                  <>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor={deleteConfirmId}>
                          확인 입력
                        </FieldLabel>
                        <Input
                          id={deleteConfirmId}
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="DELETE"
                          className="font-mono"
                        />
                      </Field>
                      {deleteError && <FieldError>{deleteError}</FieldError>}
                    </FieldGroup>

                    {user?.email_verified && user?.email && (
                      <div className="text-sm text-muted-foreground bg-primary/15 p-3 rounded">
                        <p>
                          인증된 이메일 주소로 확인 링크가 전송됩니다:{" "}
                          <strong>{user.email}</strong>
                        </p>
                      </div>
                    )}
                  </>
                )}

                <DialogFooter>
                  {deleteEmailSent ? (
                    <Button onClick={() => setIsDeleteDialogOpen(false)}>
                      닫기
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setIsDeleteDialogOpen(false)}
                        disabled={isDeletingAccount}
                      >
                        취소
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={
                          isDeletingAccount || deleteConfirmText !== "DELETE"
                        }
                      >
                        {isDeletingAccount && <Spinner />}
                        {isDeletingAccount
                          ? user?.email_verified
                            ? "이메일 전송 중..."
                            : "삭제 중..."
                          : user?.email_verified
                            ? "확인 이메일 전송"
                            : "계정 삭제"}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
