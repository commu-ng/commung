import { ChevronLeft, LogOut } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";

export default function AccountSettings() {
  const { user, isLoading: authLoading, logout } = useAuth();

  const handleSignOut = async () => {
    try {
      await logout();
      // Navigate to home page after logout
      window.location.href = "/";
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("로그아웃에 실패했습니다");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-64">
            <div className="flex items-center gap-3">
              <Spinner className="h-6 w-6" />
              <span className="text-muted-foreground">로딩 중...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-3">
              로그인 필요
            </h1>
            <p className="text-muted-foreground">
              설정에 접근하려면 로그인하세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>설정으로 돌아가기</span>
          </Link>

          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            {/* Header */}
            <div className="bg-muted px-6 py-8">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">계정</h2>
                  <p className="text-muted-foreground">계정 관리</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Sign Out Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  로그아웃
                </h4>
                <p className="text-sm text-muted-foreground">
                  현재 세션에서 로그아웃합니다.
                </p>
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full h-12 text-base font-medium border-destructive text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  로그아웃
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
