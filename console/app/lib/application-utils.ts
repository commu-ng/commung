/**
 * Application status utilities
 */

export type ApplicationStatus = "pending" | "approved" | "rejected";

/**
 * Check if a user can reapply after rejection
 * @param status - Current application status
 * @param rejectionDate - Date when the application was rejected
 * @param waitPeriodDays - Number of days to wait before reapplying (default: 7)
 * @returns true if user can reapply
 */
export function canReapply(
  status: ApplicationStatus,
  rejectionDate?: string | null,
  waitPeriodDays: number = 7,
): boolean {
  if (status !== "rejected") {
    return false;
  }

  if (!rejectionDate) {
    return true; // If no rejection date, allow reapplication
  }

  const rejectedAt = new Date(rejectionDate);
  const now = new Date();
  const daysSinceRejection = Math.floor(
    (now.getTime() - rejectedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  return daysSinceRejection >= waitPeriodDays;
}

/**
 * Get human-readable status text
 * @param status - Application status
 * @returns Status text in Korean
 */
export function getStatusText(status: ApplicationStatus): string {
  const statusMap: Record<ApplicationStatus, string> = {
    pending: "대기 중",
    approved: "승인됨",
    rejected: "거절됨",
  };

  return statusMap[status] || status;
}

/**
 * Get status color for UI display
 * @param status - Application status
 * @returns Tailwind color classes
 */
export function getStatusColor(status: ApplicationStatus): string {
  const colorMap: Record<ApplicationStatus, string> = {
    pending: "text-butter-ink bg-butter/40 border-butter/60",
    approved: "text-mint-ink bg-mint/40 border-mint/60",
    rejected: "text-destructive bg-destructive/15 border-destructive/30",
  };

  return colorMap[status] || "text-muted-foreground bg-muted border-border";
}

/**
 * Check if recruiting is currently open
 * @param isRecruiting - Whether recruiting is enabled
 * @param recruitingStartsAt - Recruiting start date
 * @param recruitingEndsAt - Recruiting end date
 * @returns true if recruiting is open
 */
export function isRecruitingOpen(
  isRecruiting: boolean,
  recruitingStartsAt?: string | null,
  recruitingEndsAt?: string | null,
): boolean {
  if (!isRecruiting) {
    return false;
  }

  const now = new Date();

  if (recruitingStartsAt) {
    const startDate = new Date(recruitingStartsAt);
    if (now < startDate) {
      return false; // Recruiting hasn't started yet
    }
  }

  if (recruitingEndsAt) {
    const endDate = new Date(recruitingEndsAt);
    if (now > endDate) {
      return false; // Recruiting has ended
    }
  }

  return true;
}

/**
 * Get recruiting status message
 * @param isRecruiting - Whether recruiting is enabled
 * @param recruitingStartsAt - Recruiting start date
 * @param recruitingEndsAt - Recruiting end date
 * @returns Status message
 */
export function getRecruitingStatusMessage(
  isRecruiting: boolean,
  recruitingStartsAt?: string | null,
  recruitingEndsAt?: string | null,
): string {
  if (!isRecruiting) {
    return "현재 모집하지 않습니다";
  }

  const now = new Date();

  if (recruitingStartsAt) {
    const startDate = new Date(recruitingStartsAt);
    if (now < startDate) {
      return `모집 시작: ${startDate.toLocaleDateString("ko-KR")}`;
    }
  }

  if (recruitingEndsAt) {
    const endDate = new Date(recruitingEndsAt);
    if (now > endDate) {
      return "모집이 종료되었습니다";
    }
    return `모집 마감: ${endDate.toLocaleDateString("ko-KR")}`;
  }

  return "모집 중";
}

/**
 * Validate if birth year meets minimum requirement
 * @param birthYear - User's birth year
 * @param minimumBirthYear - Minimum birth year required
 * @returns true if user meets requirement
 */
export function meetsAgeRequirement(
  birthYear: number,
  minimumBirthYear?: number | null,
): boolean {
  if (!minimumBirthYear) {
    return true; // No age requirement
  }

  return birthYear >= minimumBirthYear;
}
