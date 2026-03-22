import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { api, getErrorMessage } from "~/lib/api-client";

interface MasqueradeStatus {
  isMasquerading: boolean;
  adminUser?: {
    id: string;
    login_name: string;
  };
  targetUser?: {
    id: string;
    login_name: string;
  };
}

async function fetchMasqueradeStatus(): Promise<MasqueradeStatus> {
  const res = await api.console.admin.masquerade.status.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch masquerade status");
  }
  const result = await res.json();
  return result.data;
}

export function MasqueradeBanner() {
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["masquerade", "status"],
    queryFn: fetchMasqueradeStatus,
    staleTime: 5000,
    refetchInterval: 5000, // Refetch every 5 seconds to stay updated
  });

  const endMasqueradeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.console.admin.masquerade.end.$post();

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "전환 종료에 실패했습니다"));
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success("전환이 종료되었습니다");
      // Invalidate auth and masquerade queries
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["masquerade"] });
      // Reload the page to refresh all data
      window.location.reload();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEndMasquerade = () => {
    if (window.confirm("전환을 종료하고 관리자 계정으로 돌아가시겠습니까?")) {
      endMasqueradeMutation.mutate();
    }
  };

  if (!status?.isMasquerading) {
    return null;
  }

  return (
    <>
      {/* Spacer div to prevent content from being covered by the fixed banner */}
      <div className="h-[52px]" />

      {/* Fixed banner at the top */}
      <div className="bg-amber-500 dark:bg-amber-600 text-white px-4 py-3 shadow-lg fixed top-0 left-0 right-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div className="text-sm font-medium">
              <span className="font-bold">전환 모드: </span>
              <span>
                {status.targetUser?.login_name} 사용자로 전환 중입니다
              </span>
              {status.adminUser && (
                <span className="ml-2 text-amber-100 dark:text-amber-200">
                  (관리자: {status.adminUser.login_name})
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEndMasquerade}
            disabled={endMasqueradeMutation.isPending}
            className="text-white hover:bg-amber-600 dark:hover:bg-amber-700 hover:text-white flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            전환 종료
          </Button>
        </div>
      </div>
    </>
  );
}
