import { z } from "zod";

// Reusable username schema - alphanumeric and underscore only, normalized to lowercase
export const usernameSchema = z
  .string()
  .min(1, "Username cannot be empty")
  .max(50, "Username must be 50 characters or less")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username must contain only alphanumeric characters and underscores",
  )
  .transform((val) => val.toLowerCase());

// Login name schema - alphanumeric and underscore only, normalized to lowercase
export const loginNameSchema = z
  .string()
  .min(1, "Login name cannot be empty")
  .max(100, "Login name must be 100 characters or less")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Login name must contain only alphanumeric characters and underscores",
  )
  .transform((val) => val.toLowerCase());

export const profileInfoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  username: z.string(),
  bio: z.string().nullable(),
  is_primary: z.boolean(),
  is_active: z.boolean(),
});

export const communityApplicationInfoSchema = z.object({
  id: z.uuid(),
  profile_name: z.string(),
  profile_username: z.string(),
  message: z.string().nullable(),
  status: z.string(),
  created_at: z.date(),
});

export const communityMemberListResponseSchema = z.object({
  id: z.uuid(),
  role: z.string(),
  is_active: z.boolean(),
  created_at: z.date(),
  profiles: z.array(profileInfoSchema),
  application: communityApplicationInfoSchema.nullable(),
});

export const communityRoleUpdateRequestSchema = z.object({
  membership_id: z.uuid(),
  role: z.string(),
});

export const userLoginSchema = z.object({
  login_name: z.string().min(1, "Login name cannot be empty"),
  password: z.string().min(1, "Password cannot be empty"),
});

export const passwordChangeSchema = z.object({
  current_password: z.string().min(1, "Current password cannot be empty"),
  new_password: z
    .string()
    .min(8, "New password must be at least 8 characters long"),
});

export const emailUpdateSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const emailVerificationSchema = z.object({
  token: z.string().uuid("Invalid verification token"),
});

export const accountDeletionConfirmSchema = z.object({
  token: z.string().uuid("Invalid deletion confirmation token"),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const passwordResetSchema = z.object({
  token: z.string().uuid("Invalid reset token"),
  new_password: z
    .string()
    .min(8, "New password must be at least 8 characters long"),
});

export const tokenExchangeSchema = z.object({
  token: z.uuid(),
  domain: z.string().min(1, "Domain cannot be empty"),
});

export const communityCreateRequestSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  slug: z
    .string()
    .min(1, "Slug cannot be empty")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and single hyphens (no consecutive hyphens)",
    ),
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime(),
  is_recruiting: z.boolean().default(false),
  recruiting_starts_at: z.iso.datetime().nullable().optional(),
  recruiting_ends_at: z.iso.datetime().nullable().optional(),
  minimum_birth_year: z.number().int().nullable().optional(),
  image_id: z.uuid().nullable().optional(),
  hashtags: z.array(z.string()).optional(),
  profile_username: usernameSchema,
  profile_name: z.string().min(1, "Profile name cannot be empty"),
  description: z.string().nullable().optional(),
  mute_new_members: z.boolean().optional(),
  show_all_replies: z.boolean().optional(),
  bump_on_reply: z.boolean().optional(),
});

export const communityUpdateRequestSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  slug: z
    .string()
    .min(1, "Slug cannot be empty")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and single hyphens (no consecutive hyphens)",
    ),
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime(),
  is_recruiting: z.boolean().default(false),
  recruiting_starts_at: z.iso.datetime().nullable().optional(),
  recruiting_ends_at: z.iso.datetime().nullable().optional(),
  minimum_birth_year: z.number().int().nullable().optional(),
  image_id: z.uuid().nullable().optional(),
  hashtags: z.array(z.string()).optional(),
  profile_username: usernameSchema.optional(),
  profile_name: z.string().optional(),
  description: z.string().nullable().optional(),
  description_image_ids: z.array(z.uuid()).optional(),
  mute_new_members: z.boolean().optional(),
  show_all_replies: z.boolean().optional(),
  bump_on_reply: z.boolean().optional(),
});

export const themeKeyColorUpdateRequestSchema = z.object({
  theme_key_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Theme key color must be a #RRGGBB hex string")
    .nullable(),
});

export const imageCreateRequestSchema = z.object({
  key: z.string().min(1, "Key cannot be empty"),
  filename: z.string().min(1, "Filename cannot be empty"),
  width: z.number().int().positive("Width must be positive"),
  height: z.number().int().positive("Height must be positive"),
});

export const groupChatCreateRequestSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  member_profile_ids: z
    .array(z.uuid())
    .min(2, "At least 3 members are required (including creator)"),
  creator_profile_id: z.uuid(),
});

export const groupChatUpdateRequestSchema = z.object({
  profile_id: z.uuid(),
  name: z.string().min(1, "Name cannot be empty").max(100),
});

export const groupChatMessageCreateRequestSchema = z.object({
  content: z.string(),
  profile_id: z.uuid(),
  image_ids: z.array(z.uuid()).optional(),
});

export const groupChatMessageReactionCreateSchema = z.object({
  profile_id: z.uuid(),
  emoji: z.string().min(1, "Emoji cannot be empty").max(10, "Emoji too long"),
});

export const groupChatMessageReactionDeleteSchema = z.object({
  profile_id: z.uuid(),
  emoji: z.string().min(1, "Emoji cannot be empty").max(10, "Emoji too long"),
});

export const groupChatIdParamSchema = z.object({
  group_chat_id: z.uuid(),
});

export const memberProfileIdParamSchema = z.object({
  member_profile_id: z.uuid(),
});

export const profileUpdateRequestSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  username: usernameSchema,
  bio: z.string().nullable().optional(),
  profile_picture_id: z.uuid().nullable().optional(),
});

export const profileCreateSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  username: usernameSchema,
  bio: z.string().nullable().optional(),
  is_primary: z.boolean().default(false),
  profile_picture_id: z.uuid().nullable().optional(),
});
// Direct Messages
export const messageCreateSchema = z.object({
  content: z.string(),
  receiver_id: z.uuid(),
  image_ids: z.array(z.uuid()).optional(),
});

export const messageReactionCreateSchema = z.object({
  profile_id: z.uuid(),
  emoji: z.string().min(1, "Emoji cannot be empty").max(10, "Emoji too long"),
});

export const messageReactionDeleteSchema = z.object({
  profile_id: z.uuid(),
  emoji: z.string().min(1, "Emoji cannot be empty").max(10, "Emoji too long"),
});

export const postReactionCreateSchema = z.object({
  profile_id: z.uuid(),
  emoji: z.string().min(1, "Emoji cannot be empty").max(10, "Emoji too long"),
});

export const postReactionDeleteSchema = z.object({
  profile_id: z.uuid(),
  emoji: z.string().min(1, "Emoji cannot be empty").max(10, "Emoji too long"),
});

export const messageDeleteQuerySchema = z.object({
  profile_id: z.uuid(),
  mode: z.enum(["for_me", "for_all"]),
});

export const messageIdParamSchema = z.object({
  message_id: z.uuid(),
});

export const postCreateRequestSchema = z.object({
  content: z.string(),
  profile_id: z.uuid(),
  in_reply_to_id: z.uuid().nullable().optional(),
  image_ids: z.array(z.uuid()).optional(),
  announcement: z.boolean().default(false),
  content_warning: z.string().nullable().optional(),
  scheduled_at: z.iso.datetime().nullable().optional(),
});

export const postUpdateRequestSchema = z.object({
  content: z.string(),
  image_ids: z.array(z.uuid()).optional(),
  content_warning: z.string().nullable().optional(),
  announcement: z.boolean().optional(),
});

// Query parameter schemas
export const profileIdQuerySchema = z.object({
  profile_id: z.uuid(),
});

export const optionalProfileIdQuerySchema = z.object({
  profile_id: z.uuid().optional(),
});

export const paginationQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional(),
});

export const postQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional(),
  profile_id: z.uuid().optional(),
});

export const postRepliesQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional(),
  profile_id: z.uuid().optional(),
});

export const postSearchQuerySchema = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional(),
  profile_id: z.uuid().optional(),
});

export const scheduledPostsQuerySchema = z.object({
  profile_id: z.uuid(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional(),
});

export const conversationsQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional(),
  profile_id: z.uuid(),
});

export const profileIdWithLimitQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  profile_id: z.uuid(),
});

// Profile sharing schemas
export const profileShareRequestSchema = z.object({
  username: z.string().min(1),
  role: z.literal("admin"),
});

export const profileIdParamSchema = z.object({
  profile_id: z.uuid(),
});

export const userIdParamSchema = z.object({
  user_id: z.uuid(),
});

// Path parameter schemas
export const postIdParamSchema = z.object({
  post_id: z.uuid(),
});

export const usernameParamSchema = z.object({
  username: z.string().min(1),
});

export const notificationIdParamSchema = z.object({
  notification_id: z.uuid(),
});

export const otherProfileIdParamSchema = z.object({
  other_profile_id: z.uuid(),
});

// SSO and Auth query schemas
export const ssoQuerySchema = z.object({
  return_to: z.string().url("Invalid return URL"),
});

// Unread count query schema
export const unreadCountQuerySchema = z.object({
  profile_id: z.uuid(),
});

// Profile update query schema
export const profileUpdateQuerySchema = z.object({
  profile_id: z.uuid(),
});

// Community path parameter schemas
export const communityIdParamSchema = z.object({
  id: z.uuid(),
});

export const applicationIdParamSchema = z.object({
  application_id: z.uuid(),
});

export const communityApplicationParamSchema = z.object({
  id: z.uuid(),
  application_id: z.uuid(),
});

// Online status schemas
export const onlineStatusQuerySchema = z.object({
  profile_ids: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .pipe(z.array(z.uuid()).min(1, "At least one profile ID is required")),
});

export const onlineStatusVisibilitySchema = z.object({
  profile_id: z.uuid(),
  visible: z.boolean(),
});

// Board schemas
export const boardCreateRequestSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  slug: z
    .string()
    .min(1, "Slug cannot be empty")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and single hyphens",
    ),
  description: z.string().max(1000).nullable().optional(),
  allow_comments: z.boolean().optional(),
});

export const boardUpdateRequestSchema = z.object({
  name: z.string().min(1, "Name cannot be empty"),
  slug: z
    .string()
    .min(1, "Slug cannot be empty")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and single hyphens",
    ),
  description: z.string().max(1000).nullable().optional(),
  allow_comments: z.boolean().optional(),
});

export const boardIdParamSchema = z.object({
  board_id: z.uuid(),
});

export const boardSlugParamSchema = z.object({
  board_slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});

export const boardPostCreateRequestSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(200),
  content: z.string().min(1, "Content cannot be empty").max(50000),
  image_id: z.uuid().nullable().optional(),
  hashtags: z.array(z.string()).optional(),
});

export const boardPostUpdateRequestSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(200),
  content: z.string().min(1, "Content cannot be empty").max(50000),
  image_id: z.uuid().nullable().optional(),
  hashtags: z.array(z.string()).optional(),
});

export const boardPostIdParamSchema = z.object({
  board_post_id: z.uuid(),
});

export const boardPostQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional(),
  hashtags: z.string().optional(), // Comma-separated hashtags
});

export const boardPostReplyCreateRequestSchema = z.object({
  content: z.string().min(1, "Content cannot be empty").max(10000),
  in_reply_to_id: z.uuid().optional(),
});

export const boardPostReplyUpdateRequestSchema = z.object({
  content: z.string().min(1, "Content cannot be empty").max(10000),
});

export const boardPostReplyIdParamSchema = z.object({
  reply_id: z.uuid(),
});

export const boardPostReplyQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional(),
});

// Masquerade schemas
export const masqueradeStartRequestSchema = z.object({
  target_user_id: z.uuid(),
});

export const masqueradeUserListQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().optional(),
});

export const masqueradeAuditLogQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// Report schemas
export const postReportRequestSchema = z.object({
  reason: z.string().min(1, "Report reason is required").max(2000),
  profile_id: z.uuid(),
});

export const boardPostReportRequestSchema = z.object({
  reason: z.string().min(1, "Report reason is required").max(2000),
});
