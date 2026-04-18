import { CheckIcon, ClockIcon, XIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";

type ApplicationStatus = "pending" | "approved" | "rejected";
type CommunityStatus = "active" | "upcoming" | "ended" | "recruiting";

interface StatusBadgeProps {
  /**
   * Type of status to display
   */
  type: "application" | "community";
  /**
   * Status value
   */
  status: ApplicationStatus | CommunityStatus | string;
  /**
   * Optional className
   */
  className?: string;
}

const APPLICATION_STATUS_CONFIG = {
  pending: {
    label: "대기 중",
    variant: "secondary" as const,
    icon: ClockIcon,
    className: "bg-butter/40 text-butter-ink dark:bg-butter/25",
  },
  approved: {
    label: "승인됨",
    variant: "default" as const,
    icon: CheckIcon,
    className: "bg-mint/40 text-mint-ink dark:bg-mint/25",
  },
  rejected: {
    label: "거절됨",
    variant: "destructive" as const,
    icon: XIcon,
    className: "bg-destructive/15 text-destructive",
  },
};

const COMMUNITY_STATUS_CONFIG = {
  active: {
    label: "진행 중",
    className: "bg-mint/40 text-mint-ink dark:bg-mint/25",
  },
  upcoming: {
    label: "시작 예정",
    className: "bg-primary/15 text-primary",
  },
  ended: {
    label: "종료됨",
    className: "bg-muted text-muted-foreground",
  },
  recruiting: {
    label: "모집 중",
    className: "bg-lilac/40 text-lilac-ink dark:bg-lilac/25",
  },
};

/**
 * Reusable status badge component for applications and communities
 */
export function StatusBadge({
  type,
  status,
  className = "",
}: StatusBadgeProps) {
  if (type === "application") {
    if (status in APPLICATION_STATUS_CONFIG) {
      const config =
        APPLICATION_STATUS_CONFIG[
          status as keyof typeof APPLICATION_STATUS_CONFIG
        ];
      const Icon = config.icon;

      return (
        <Badge
          variant={config.variant}
          className={`${config.className} ${className}`}
        >
          <Icon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      );
    }
    return null;
  }

  if (type === "community") {
    if (status in COMMUNITY_STATUS_CONFIG) {
      const config =
        COMMUNITY_STATUS_CONFIG[status as keyof typeof COMMUNITY_STATUS_CONFIG];

      return (
        <Badge className={`${config.className} ${className}`}>
          {config.label}
        </Badge>
      );
    }
    return null;
  }

  return null;
}

/**
 * Get status badge configuration for custom rendering
 */
export function getApplicationStatusConfig(status: ApplicationStatus) {
  return APPLICATION_STATUS_CONFIG[status];
}

export function getCommunityStatusConfig(status: CommunityStatus) {
  return COMMUNITY_STATUS_CONFIG[status];
}
