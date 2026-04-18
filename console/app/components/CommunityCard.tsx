import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Activity,
  CalendarIcon,
  CheckCircle,
  Clock,
  ExternalLink,
  Hash,
  ImageIcon,
  UsersIcon,
} from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { env } from "~/lib/env";

interface Community {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  role?: string | null;
  custom_domain?: string | null;
  domain_verified?: string | null;
  banner_image_url?: string | null;
  banner_image_width?: number | null;
  banner_image_height?: number | null;
  is_recruiting?: boolean;
  owner_profile_id?: string | null;
  has_applied?: boolean;
  application_id?: string | null;
  application_status?: string | null;
  is_member?: boolean;
  minimum_birth_year?: number | null;
  hashtags?: { id: string; tag: string }[];
  pending_application_count?: number;
}

interface CommunityCardProps {
  community: Community;
}

export function CommunityCard({ community }: CommunityCardProps) {
  const communityUrl =
    community.custom_domain && community.domain_verified
      ? community.custom_domain
      : `${community.slug}.${env.domain}`;

  const startDate = new Date(community.starts_at);
  const endDate = new Date(community.ends_at);
  const now = new Date();

  const isValidStartDate = !Number.isNaN(startDate.getTime());
  const isValidEndDate = !Number.isNaN(endDate.getTime());

  const isActive =
    isValidStartDate && isValidEndDate && now >= startDate && now <= endDate;
  const isUpcoming = isValidStartDate && now < startDate;
  const isEnded = isValidEndDate && now > endDate;

  return (
    <Link
      to={`/communities/${community.slug}`}
      className="block border border-border bg-card hover:bg-accent/50 transition-colors"
    >
      <div className="flex">
        {/* Banner Image Thumbnail */}
        <div className="w-28 sm:w-36 flex-shrink-0 bg-muted">
          {community.banner_image_url ? (
            <img
              src={community.banner_image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-4">
          {/* Title and Status */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-foreground truncate">
              {community.name}
            </h3>
            <div className="flex-shrink-0">
              {isUpcoming && (
                <Badge
                  variant="secondary"
                  className="bg-primary/15 text-primary"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  예정
                </Badge>
              )}
              {isActive && (
                <Badge variant="secondary" className="bg-mint/40 text-mint-ink">
                  <Activity className="h-3 w-3 mr-1" />
                  진행 중
                </Badge>
              )}
              {isEnded && (
                <Badge
                  variant="secondary"
                  className="bg-muted text-muted-foreground"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  종료
                </Badge>
              )}
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center text-sm text-muted-foreground mb-3">
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            {isValidStartDate
              ? format(startDate, "yy.MM.dd", { locale: ko })
              : "?"}{" "}
            —{" "}
            {isValidEndDate ? format(endDate, "yy.MM.dd", { locale: ko }) : "?"}
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Role Badge */}
            {community.role && (
              <Badge
                variant="secondary"
                className={
                  community.role === "owner"
                    ? "bg-blossom/40 text-blossom-ink"
                    : community.role === "moderator"
                      ? "bg-lilac/40 text-lilac-ink"
                      : "bg-primary/15 text-primary"
                }
              >
                {community.role === "owner"
                  ? "내가 만든"
                  : community.role === "moderator"
                    ? "모더레이터"
                    : "참여 중"}
              </Badge>
            )}

            {/* Recruiting Badge */}
            {community.is_recruiting && (
              <Badge variant="secondary" className="bg-mint/40 text-mint-ink">
                <UsersIcon className="h-3 w-3 mr-1" />
                모집 중
              </Badge>
            )}

            {/* Application Status */}
            {!community.role && community.has_applied && (
              <Badge
                variant="secondary"
                className={
                  community.application_status === "rejected"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
                }
              >
                {community.application_status === "rejected"
                  ? "거부됨"
                  : "신청 완료"}
              </Badge>
            )}

            {/* Pending Applications */}
            {(community.role === "owner" || community.role === "moderator") &&
              community.pending_application_count !== undefined &&
              community.pending_application_count > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-butter/40 text-butter-ink"
                >
                  신청 {community.pending_application_count}
                </Badge>
              )}

            {/* Birth Year Requirement */}
            {community.minimum_birth_year && (
              <Badge variant="outline" className="text-muted-foreground">
                {community.minimum_birth_year}년생+
              </Badge>
            )}

            {/* Hashtags */}
            {community.hashtags?.slice(0, 3).map((hashtag) => (
              <Badge
                key={hashtag.id}
                variant="outline"
                className="text-muted-foreground"
              >
                <Hash className="h-2.5 w-2.5 mr-0.5" />
                {hashtag.tag}
              </Badge>
            ))}
            {community.hashtags && community.hashtags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{community.hashtags.length - 3}
              </span>
            )}
          </div>

          {/* Community URL */}
          <div className="mt-3 pt-3 border-t border-border">
            <a
              href={`https://${communityUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center text-xs text-muted-foreground font-mono hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              {communityUrl}
            </a>
          </div>
        </div>
      </div>
    </Link>
  );
}
