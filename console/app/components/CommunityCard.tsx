import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Activity,
  CalendarIcon,
  CheckCircle,
  Clock,
  Crown,
  ExternalLink,
  Hash,
  ImageIcon,
  Sparkles,
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
  const communityHref = `/communities/${community.slug}`;
  const communityAppUrl = `https://${communityUrl}`;

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
    <div className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-marsh transition-all duration-300 hover:-translate-y-1 hover:shadow-marsh-lg">
      <Link
        to={communityHref}
        aria-label={community.name}
        className="absolute inset-0 z-10"
      />
      {/* Banner */}
      <div className="relative aspect-[16/9] bg-gradient-to-br from-blossom/40 via-lilac/30 to-mint/30 overflow-hidden">
        {community.banner_image_url ? (
          <img
            src={community.banner_image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-foreground/30" />
          </div>
        )}

        {/* Status pill (top-left) */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {isUpcoming && (
            <Badge className="bg-card/85 backdrop-blur-md text-primary border border-primary/20 shadow-marsh">
              <Clock className="h-3 w-3 mr-1" />
              예정
            </Badge>
          )}
          {isActive && (
            <Badge className="bg-card/85 backdrop-blur-md text-mint-ink border border-mint/40 shadow-marsh">
              <Activity className="h-3 w-3 mr-1" />
              진행 중
            </Badge>
          )}
          {isEnded && (
            <Badge className="bg-card/85 backdrop-blur-md text-muted-foreground border border-border shadow-marsh">
              <CheckCircle className="h-3 w-3 mr-1" />
              종료
            </Badge>
          )}
          {community.is_recruiting && (
            <Badge className="bg-card/85 backdrop-blur-md text-mint-ink border border-mint/40 shadow-marsh">
              <Sparkles className="h-3 w-3 mr-1" />
              모집 중
            </Badge>
          )}
        </div>

        {/* Role pill (top-right) */}
        {community.role && (
          <div className="absolute top-3 right-3">
            <Badge
              className={
                community.role === "owner"
                  ? "bg-blossom/30 dark:bg-blossom/20 backdrop-blur-md text-blossom-ink border border-blossom/50 shadow-marsh"
                  : community.role === "moderator"
                    ? "bg-lilac/40 dark:bg-lilac/25 text-lilac-ink border border-lilac/60 shadow-marsh"
                    : "bg-card/85 backdrop-blur-md text-primary border border-primary/30 shadow-marsh"
              }
            >
              {community.role === "owner" ? (
                <Crown className="h-3 w-3 mr-1" />
              ) : null}
              {community.role === "owner"
                ? "내가 만든"
                : community.role === "moderator"
                  ? "모더레이터"
                  : "참여 중"}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-display text-xl font-bold text-foreground truncate">
            {community.name}
          </h3>
          {(community.role === "owner" || community.role === "moderator") &&
            community.pending_application_count !== undefined &&
            community.pending_application_count > 0 && (
              <Badge className="bg-butter/40 text-butter-ink dark:bg-butter/25 flex-shrink-0">
                지원 {community.pending_application_count}
              </Badge>
            )}
        </div>

        <div className="flex items-center text-xs text-muted-foreground mb-3">
          <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
          {isValidStartDate
            ? format(startDate, "yyyy.MM.dd", { locale: ko })
            : "?"}{" "}
          —{" "}
          {isValidEndDate ? format(endDate, "yyyy.MM.dd", { locale: ko }) : "?"}
        </div>

        {/* Footer row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {!community.role && community.has_applied && (
            <Badge
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

          {community.minimum_birth_year && (
            <Badge variant="outline" className="text-muted-foreground">
              {community.minimum_birth_year}년생+
            </Badge>
          )}

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

          {community.banner_image_url && community.hashtags?.length === 0 && (
            <UsersIcon className="h-3 w-3 text-muted-foreground/60" />
          )}
        </div>

        {/* Subtle URL */}
        <div className="mt-3 pt-3 border-t border-border/70">
          <a
            href={communityAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-20 inline-flex items-center text-[11px] text-muted-foreground/80 font-mono hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3 mr-1.5" />
            {communityUrl}
          </a>
        </div>
      </div>
    </div>
  );
}
