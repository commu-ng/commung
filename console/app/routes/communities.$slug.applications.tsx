import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckIcon,
  FileText,
  ImageIcon,
  Lock,
  RotateCcw,
  Search,
  XIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { LoadingState } from "~/components/shared/LoadingState";
import { StatusBadge } from "~/components/shared/StatusBadge";
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
} from "~/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Spinner } from "~/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Application } from "~/types/application";
import type { Route } from "./+types/communities.$slug.applications";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "지원서 관리" },
    {
      name: "description",
      content: "내 커뮤에 지원한 사용자들을 관리하세요",
    },
  ];
}

async function fetchAllApplications(communityId: string) {
  const res = await api.console.communities[":id"].applications.$get({
    param: { id: communityId },
  });
  const json = await res.json();

  // Handle error response
  if ("error" in json) {
    throw new Error(getErrorMessage(json, "Failed to fetch applications"));
  }

  return json.data;
}

const formatDate = (dateString: string) => {
  if (!dateString) return "알 수 없음";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "알 수 없음";

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function ApplicationsTable({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient();
  const rejectionReasonId = useId();
  const [sortBy, setSortBy] = useState<keyof Application | "">("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] =
    useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingApplicationId, setProcessingApplicationId] =
    useState<string>("");

  const {
    data: allApplications = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["applications", communityId],
    queryFn: () => fetchAllApplications(communityId),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      applicationId,
      status,
      rejection_reason,
    }: {
      applicationId: string;
      status: "approved" | "rejected";
      rejection_reason?: string;
    }) => {
      const res = await api.console.communities[":id"].applications[
        ":application_id"
      ].review.$put({
        param: { id: communityId, application_id: applicationId },
        json: { status, rejection_reason },
      });
      return await res.json();
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.status === "approved"
          ? "지원서를 승인했습니다!"
          : "지원서를 거절했습니다.",
      );
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["communities", "mine"] });
      setRejectDialogOpen(false);
      setSelectedApplicationId("");
      setRejectionReason("");
      setProcessingApplicationId("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await api.console.communities[":id"].applications[
        ":application_id"
      ].revoke.$delete({
        param: { id: communityId, application_id: applicationId },
      });
      return await res.json();
    },
    onSuccess: () => {
      toast.success("지원서 처리를 취소했습니다!");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["communities", "mine"] });
      setProcessingApplicationId("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleReview = (
    applicationId: string,
    status: "approved" | "rejected",
  ) => {
    if (status === "rejected") {
      setSelectedApplicationId(applicationId);
      setRejectDialogOpen(true);
    } else {
      setProcessingApplicationId(applicationId);
      reviewMutation.mutate({ applicationId, status });
    }
  };

  const handleRejectConfirm = () => {
    if (!selectedApplicationId) return;
    setProcessingApplicationId(selectedApplicationId);
    reviewMutation.mutate({
      applicationId: selectedApplicationId,
      status: "rejected",
      rejection_reason: rejectionReason.trim() || undefined,
    });
  };

  const handleRevoke = (applicationId: string) => {
    setProcessingApplicationId(applicationId);
    revokeMutation.mutate(applicationId);
  };

  // Sort applications
  const sortedApplications = [...allApplications].sort((a, b) => {
    if (!sortBy) return 0;

    // Handle profile name sorting
    if (sortBy === "profile_name") {
      const aValue = a.profile_name;
      const bValue = b.profile_name;
      return sortOrder === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Handle status sorting
    if (sortBy === "status") {
      const aValue = a.status;
      const bValue = b.status;
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    }

    // Handle date sorting
    if (sortBy === "created_at") {
      const aValue = new Date(a.created_at).toISOString();
      const bValue = new Date(b.created_at).toISOString();
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    }

    if (sortBy === "reviewed_at") {
      const aValue = a.reviewed_at ? new Date(a.reviewed_at).toISOString() : "";
      const bValue = b.reviewed_at ? new Date(b.reviewed_at).toISOString() : "";
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    }

    return 0;
  });

  const handleSort = (column: keyof Application) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  if (isLoading) {
    return <LoadingState message="지원서를 불러오는 중..." asCard={false} />;
  }

  if (error) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircle />
          </EmptyMedia>
          <EmptyTitle>오류 발생</EmptyTitle>
          <EmptyDescription>지원서를 불러올 수 없습니다</EmptyDescription>
        </EmptyHeader>
        <Button onClick={() => refetch()}>다시 시도</Button>
      </Empty>
    );
  }

  if (sortedApplications.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>지원서가 없습니다</EmptyTitle>
          <EmptyDescription>아직 지원한 사용자가 없습니다</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>지원서 목록</CardTitle>
          <CardDescription>
            총 {sortedApplications.length}개의 지원서가 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("profile_name")}
                >
                  지원자{" "}
                  {sortBy === "profile_name" &&
                    (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("status")}
                >
                  상태{" "}
                  {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("created_at")}
                >
                  지원일{" "}
                  {sortBy === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("reviewed_at")}
                >
                  처리일{" "}
                  {sortBy === "reviewed_at" &&
                    (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="w-40">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedApplications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>
                    <Link
                      to={`/communities/${communityId}/applications/${application.id}`}
                      className="text-left hover:underline block"
                    >
                      <div className="font-medium">
                        {application.profile_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{application.profile_username}
                      </div>
                      {application.attachments &&
                        application.attachments.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <ImageIcon className="w-3 h-3" />
                            <span>{application.attachments.length}개 첨부</span>
                          </div>
                        )}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      type="application"
                      status={application.status}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(application.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {application.reviewed_at
                        ? formatDate(application.reviewed_at)
                        : "-"}
                    </div>
                  </TableCell>
                  <TableCell className="w-40">
                    <div className="flex gap-2 min-w-max">
                      {application.status === "pending" ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleReview(application.id, "approved")
                            }
                            disabled={
                              processingApplicationId === application.id
                            }
                            className="text-mint-ink border-mint/60 hover:bg-mint/40 flex-1"
                          >
                            {processingApplicationId === application.id ? (
                              <Spinner />
                            ) : (
                              <CheckIcon className="w-4 h-4" />
                            )}
                            승인
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleReview(application.id, "rejected")
                            }
                            disabled={
                              processingApplicationId === application.id
                            }
                            className="text-destructive border-destructive/30 hover:bg-destructive/10 flex-1"
                          >
                            {processingApplicationId === application.id ? (
                              <Spinner />
                            ) : (
                              <XIcon className="w-4 h-4" />
                            )}
                            거절
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevoke(application.id)}
                          disabled={processingApplicationId === application.id}
                          className="w-full"
                        >
                          {processingApplicationId === application.id ? (
                            <Spinner />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          {application.status === "approved"
                            ? "승인 취소"
                            : "거절 취소"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>지원 거절</DialogTitle>
            <DialogDescription>
              이 지원을 거절하시겠습니까? 거절 사유를 입력할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={rejectionReasonId}>
                  거절 사유 (선택사항)
                </FieldLabel>
                <Textarea
                  id={rejectionReasonId}
                  placeholder="신청을 거절하는 사유를 입력하세요..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setSelectedApplicationId("");
                setRejectionReason("");
              }}
              disabled={reviewMutation.isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending && <Spinner />}
              {reviewMutation.isPending ? "거절 중..." : "거절"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ApplicationsPage() {
  const { user, isLoading } = useAuth();
  const { slug } = useParams();

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <LoadingState message="인증 확인 중..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Lock />
            </EmptyMedia>
            <EmptyTitle>로그인이 필요합니다</EmptyTitle>
            <EmptyDescription>
              지원서를 관리하려면 로그인해주세요
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>커뮤를 찾을 수 없습니다</EmptyTitle>
            <EmptyDescription>올바른 커뮤 URL을 확인해주세요</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to={`/communities/${slug}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              커뮤로 돌아가기
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">지원서 관리</h1>
            <p className="text-muted-foreground mt-2">
              내 커뮤에 지원한 사용자들을 관리하세요
            </p>
          </div>
        </div>
      </div>

      <ApplicationsTable communityId={slug} />
    </div>
  );
}
