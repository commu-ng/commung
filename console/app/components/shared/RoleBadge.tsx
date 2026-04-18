import { Crown, Shield, User } from "lucide-react";
import { Badge } from "~/components/ui/badge";

export type Role = "owner" | "moderator" | "member";

interface RoleBadgeProps {
  /**
   * Role to display
   */
  role: Role;
  /**
   * Whether to show the icon
   * @default true
   */
  showIcon?: boolean;
  /**
   * Optional className
   */
  className?: string;
}

const ROLE_CONFIG = {
  owner: {
    label: "소유자",
    icon: Crown,
    className: "bg-destructive/15 text-destructive",
  },
  moderator: {
    label: "모더레이터",
    icon: Shield,
    className: "bg-primary/15 text-primary",
  },
  member: {
    label: "멤버",
    icon: User,
    className: "bg-muted text-muted-foreground",
  },
};

/**
 * Reusable role badge component for displaying member roles
 */
export function RoleBadge({
  role,
  showIcon = true,
  className = "",
}: RoleBadgeProps) {
  const config = ROLE_CONFIG[role];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge className={`${config.className} ${className}`}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

/**
 * Get role configuration for custom rendering
 */
export function getRoleConfig(role: Role) {
  return ROLE_CONFIG[role];
}

/**
 * Get role label text
 */
export function getRoleLabel(role: Role): string {
  return ROLE_CONFIG[role]?.label || role;
}

/**
 * Get role icon component
 */
export function getRoleIcon(role: Role) {
  return ROLE_CONFIG[role]?.icon;
}

/**
 * Get role color classes
 */
export function getRoleColor(role: Role): string {
  return ROLE_CONFIG[role]?.className || "";
}
