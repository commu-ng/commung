import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const communityRoleEnum = pgEnum("community_role", [
  "owner",
  "moderator",
  "member",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "reply",
  "mention",
  "reaction",
]);

export const userNotificationTypeEnum = pgEnum("user_notification_type", [
  "board_reply",
]);

export const profileOwnershipRoleEnum = pgEnum("profile_ownership_role", [
  "owner",
  "admin",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
]);

export const moderationActionEnum = pgEnum("moderation_action", [
  "delete_post",
  "mute_profile",
  "unmute_profile",
]);

export const exportStatusEnum = pgEnum("export_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const deletionReasonEnum = pgEnum("deletion_reason", [
  "author",
  "cascade",
]);

export const devicePlatformEnum = pgEnum("device_platform", ["ios", "android"]);

export const shopTransactionKindEnum = pgEnum("shop_transaction_kind", [
  "currency_grant",
  "currency_charge",
  "currency_refund",
  "item_grant",
  "item_purchase",
  "item_consume",
]);

export const shopTransactionSourceEnum = pgEnum("shop_transaction_source", [
  "owner_grant",
  "bot_grant",
  "post_reward",
  "purchase",
  "consume",
  "refund",
]);

export const groupChat = pgTable(
  "group_chat",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    name: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    communityId: uuid("community_id").notNull(),
    createdById: uuid("created_by_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "group_chat_community_id_fkey",
    }),
    foreignKey({
      columns: [table.createdById],
      foreignColumns: [profile.id],
      name: "group_chat_created_by_id_fkey",
    }),
    sql`CONSTRAINT valid_group_chat_name CHECK (length(name) > 0 AND length(name) <= 100)`,
  ],
);

export const groupChatMembership = pgTable(
  "group_chat_membership",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    groupChatId: uuid("group_chat_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    addedById: uuid("added_by_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.groupChatId],
      foreignColumns: [groupChat.id],
      name: "group_chat_membership_group_chat_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "group_chat_membership_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.addedById],
      foreignColumns: [profile.id],
      name: "group_chat_membership_added_by_id_fkey",
    }),
    unique("unique_group_chat_membership").on(
      table.groupChatId,
      table.profileId,
    ),
  ],
);

export const groupChatMessage = pgTable(
  "group_chat_message",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    content: text().notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    groupChatId: uuid("group_chat_id").notNull(),
    senderId: uuid("sender_id").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.groupChatId],
      foreignColumns: [groupChat.id],
      name: "group_chat_message_group_chat_id_fkey",
    }),
    foreignKey({
      columns: [table.senderId],
      foreignColumns: [profile.id],
      name: "group_chat_message_sender_id_fkey",
    }),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [user.id],
      name: "group_chat_message_created_by_user_id_fkey",
    }),
    index("idx_group_chat_message_history").on(
      table.groupChatId,
      table.createdAt,
    ),
    sql`CONSTRAINT valid_group_chat_message_content CHECK (length(content) <= 10000)`,
  ],
);

export const groupChatMessageRead = pgTable(
  "group_chat_message_read",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    messageId: uuid("message_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    readAt: timestamp("read_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [groupChatMessage.id],
      name: "group_chat_message_read_message_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "group_chat_message_read_profile_id_fkey",
    }),
    unique("unique_message_read").on(table.messageId, table.profileId),
  ],
);

export const community = pgTable(
  "community",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    name: text().notNull(),
    slug: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    isRecruiting: boolean("is_recruiting").notNull(),
    recruitingStartsAt: timestamp("recruiting_starts_at", {
      withTimezone: true,
      mode: "string",
    }),
    recruitingEndsAt: timestamp("recruiting_ends_at", {
      withTimezone: true,
      mode: "string",
    }),
    minimumBirthYear: integer("minimum_birth_year"),
    customDomain: text("custom_domain"),
    domainVerifiedAt: timestamp("domain_verified_at", {
      withTimezone: true,
      mode: "string",
    }),
    description: text(),
    muteNewMembers: boolean("mute_new_members").notNull().default(false),
    showAllReplies: boolean("show_all_replies").notNull().default(false),
    bumpOnReply: boolean("bump_on_reply").notNull().default(false),
    themeKeyColor: text("theme_key_color"),
  },
  (table) => [
    unique("community_slug_key").on(table.slug),
    unique("community_custom_domain_key").on(table.customDomain),
    sql`CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')`,
    sql`CONSTRAINT valid_name CHECK (length(name) > 0)`,
    sql`CONSTRAINT valid_description CHECK (description IS NULL OR length(description) <= 10000)`,
    sql`CONSTRAINT valid_custom_domain CHECK (custom_domain IS NULL OR custom_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')`,
    sql`CONSTRAINT valid_theme_key_color CHECK (theme_key_color IS NULL OR theme_key_color ~ '^#[0-9a-fA-F]{6}$')`,
    sql`CONSTRAINT valid_dates CHECK (ends_at > starts_at)`,
    sql`CONSTRAINT valid_recruiting_dates CHECK (recruiting_ends_at IS NULL OR recruiting_starts_at IS NULL OR recruiting_ends_at > recruiting_starts_at)`,
    sql`CONSTRAINT valid_recruiting_window CHECK (is_recruiting = false OR (recruiting_starts_at IS NOT NULL AND recruiting_ends_at IS NOT NULL))`,
    sql`CONSTRAINT valid_minimum_birth_year CHECK (minimum_birth_year IS NULL OR minimum_birth_year >= 1900)`,
    sql`CONSTRAINT valid_community_timestamps CHECK (deleted_at IS NULL OR deleted_at >= created_at)`,
    sql`CONSTRAINT valid_domain_verified_at CHECK (domain_verified_at IS NULL OR domain_verified_at >= created_at)`,
  ],
);

export const user = pgTable(
  "user",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    loginName: text("login_name").notNull(),
    email: text(),
    emailVerifiedAt: timestamp("email_verified_at", {
      withTimezone: true,
      mode: "string",
    }),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    isAdmin: boolean("is_admin").default(false).notNull(),
  },
  (table) => [
    unique("user_login_name_key").on(table.loginName),
    unique("user_email_key").on(table.email),
    sql`CONSTRAINT valid_login_name CHECK (login_name ~ '^[a-z0-9_]+$')`,
    sql`CONSTRAINT valid_email CHECK (email IS NULL OR email ~ '^[^@]+@[^@]+\.[^@]+$')`,
  ],
);

export const userBlock = pgTable(
  "user_block",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    blockerId: uuid("blocker_id").notNull(),
    blockedId: uuid("blocked_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.blockerId],
      foreignColumns: [user.id],
      name: "user_block_blocker_id_fkey",
    }),
    foreignKey({
      columns: [table.blockedId],
      foreignColumns: [user.id],
      name: "user_block_blocked_id_fkey",
    }),
    unique("unique_user_block").on(table.blockerId, table.blockedId),
    index("idx_user_block_blocker_id").on(table.blockerId),
  ],
);

export const exchangeToken = pgTable(
  "exchange_token",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    token: uuid().notNull(),
    targetDomain: text("target_domain").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "exchange_token_user_id_fkey",
    }),
    unique("exchange_token_token_key").on(table.token),
    index("idx_exchange_token_expires_at").on(table.expiresAt),
  ],
);

export const emailVerificationToken = pgTable(
  "email_verification_token",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    token: uuid().notNull(),
    email: text().notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "email_verification_token_user_id_fkey",
    }),
    unique("email_verification_token_token_key").on(table.token),
  ],
);

export const accountDeletionToken = pgTable(
  "account_deletion_token",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    token: uuid().notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_deletion_token_user_id_fkey",
    }),
    unique("account_deletion_token_token_key").on(table.token),
  ],
);

export const passwordResetToken = pgTable(
  "password_reset_token",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    token: uuid().notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "password_reset_token_user_id_fkey",
    }),
    unique("password_reset_token_token_key").on(table.token),
    index("idx_password_reset_token_expires_at").on(table.expiresAt),
  ],
);

export const session = pgTable(
  "session",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    token: uuid().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    userId: uuid("user_id").notNull(),
    communityId: uuid("community_id"),
    originalUserId: uuid("original_user_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_user_id_fkey",
    }),
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "session_community_id_fkey",
    }),
    foreignKey({
      columns: [table.originalUserId],
      foreignColumns: [user.id],
      name: "session_original_user_id_fkey",
    }),
    unique("session_token_key").on(table.token),
    index("idx_session_expires_at").on(table.expiresAt),
  ],
);

export const device = pgTable(
  "device",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    pushToken: text("push_token").notNull(),
    platform: devicePlatformEnum().notNull(),
    userId: uuid("user_id").notNull(),
    deviceModel: text("device_model"),
    osVersion: text("os_version"),
    appVersion: text("app_version"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "device_user_id_fkey",
    }),
    unique("device_push_token_key").on(table.pushToken),
    index("idx_device_user_id").on(table.userId),
  ],
);

export const masqueradeAuditLog = pgTable(
  "masquerade_audit_log",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    adminUserId: uuid("admin_user_id").notNull(),
    targetUserId: uuid("target_user_id").notNull(),
    action: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
    sessionId: uuid("session_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.adminUserId],
      foreignColumns: [user.id],
      name: "masquerade_audit_log_admin_user_id_fkey",
    }),
    foreignKey({
      columns: [table.targetUserId],
      foreignColumns: [user.id],
      name: "masquerade_audit_log_target_user_id_fkey",
    }),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [session.id],
      name: "masquerade_audit_log_session_id_fkey",
    }),
    index("idx_masquerade_audit_log_admin_user").on(table.adminUserId),
    index("idx_masquerade_audit_log_target_user").on(table.targetUserId),
    index("idx_masquerade_audit_log_created_at").on(table.createdAt),
    sql`CONSTRAINT valid_masquerade_action CHECK (action IN ('start', 'end'))`,
  ],
);

export const communityBannerImage = pgTable(
  "community_banner_image",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    imageId: uuid("image_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "community_banner_image_community_id_fkey",
    }),
    foreignKey({
      columns: [table.imageId],
      foreignColumns: [image.id],
      name: "community_banner_image_image_id_fkey",
    }),
  ],
);

export const communityDescriptionImage = pgTable(
  "community_description_image",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    imageId: uuid("image_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "community_description_image_community_id_fkey",
    }),
    foreignKey({
      columns: [table.imageId],
      foreignColumns: [image.id],
      name: "community_description_image_image_id_fkey",
    }),
  ],
);

export const profile = pgTable(
  "profile",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    name: text().notNull(),
    username: text().notNull(),
    communityId: uuid("community_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    bio: text(),
    activatedAt: timestamp("activated_at", {
      withTimezone: true,
      mode: "string",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    mutedAt: timestamp("muted_at", { withTimezone: true, mode: "string" }),
    mutedById: uuid("muted_by_id"),
    lastActiveAt: timestamp("last_active_at", {
      withTimezone: true,
      mode: "string",
    }),
    onlineStatusVisible: boolean("online_status_visible")
      .default(true)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "profile_community_id_fkey",
    }),
    foreignKey({
      columns: [table.mutedById],
      foreignColumns: [table.id],
      name: "profile_muted_by_id_fkey",
    }),
    uniqueIndex("unique_username_community_active")
      .on(table.username, table.communityId)
      .where(sql`deleted_at IS NULL`),
    index("idx_profile_last_active_at").on(table.lastActiveAt),
    sql`CONSTRAINT valid_username CHECK (username ~ '^[a-zA-Z0-9_]+$' AND length(username) > 0 AND length(username) <= 50)`,
    sql`CONSTRAINT valid_name CHECK (length(name) > 0 AND length(name) <= 100)`,
  ],
);

export const profileOwnership = pgTable(
  "profile_ownership",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    profileId: uuid("profile_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: profileOwnershipRoleEnum().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "profile_ownership_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "profile_ownership_user_id_fkey",
    }),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [user.id],
      name: "profile_ownership_created_by_fkey",
    }),
    unique("unique_profile_user_ownership").on(table.profileId, table.userId),
    index("idx_profile_ownership_user_id").on(table.userId),
    index("idx_profile_ownership_profile_id").on(table.profileId),
  ],
);

export const image = pgTable(
  "image",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    width: integer().notNull(),
    height: integer().notNull(),
    filename: text().notNull(),
    key: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (_table) => [
    sql`CONSTRAINT valid_image_dimensions CHECK (width > 0 AND height > 0)`,
    sql`CONSTRAINT valid_image_filename CHECK (length(filename) > 0)`,
    sql`CONSTRAINT valid_image_key CHECK (length(key) > 0)`,
  ],
);

export const hashtag = pgTable(
  "hashtag",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    tag: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("hashtag_tag_key").on(table.tag),
    sql`CONSTRAINT valid_hashtag_tag CHECK (tag ~ '^[a-z0-9가-힣]+$' AND length(tag) > 0)`,
    // Case-insensitive index for efficient prefix search with LOWER()
    index("hashtag_tag_lower_idx").on(sql`LOWER(${table.tag})`),
  ],
);

export const communityApplication = pgTable(
  "community_application",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    message: text(),
    status: applicationStatusEnum().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
      mode: "string",
    }),
    userId: uuid("user_id").notNull(),
    communityId: uuid("community_id").notNull(),
    reviewedById: uuid("reviewed_by_id"),
    rejectionReason: text("rejection_reason"),
    profileName: text("profile_name").notNull(),
    profileUsername: text("profile_username").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "community_application_community_id_fkey",
    }),
    foreignKey({
      columns: [table.reviewedById],
      foreignColumns: [user.id],
      name: "community_application_reviewed_by_id_fkey",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "community_application_user_id_fkey",
    }),
    uniqueIndex("idx_unique_pending_application")
      .on(table.userId, table.communityId)
      .where(sql`${table.status} = 'pending'`),
    sql`CONSTRAINT valid_application_timestamps CHECK (reviewed_at IS NULL OR reviewed_at >= created_at)`,
    sql`CONSTRAINT valid_rejection_reason CHECK (status != 'rejected' OR rejection_reason IS NOT NULL)`,
    sql`CONSTRAINT valid_reviewed_by CHECK (status = 'pending' OR reviewed_by_id IS NOT NULL)`,
    sql`CONSTRAINT valid_reviewed_at CHECK (status = 'pending' OR reviewed_at IS NOT NULL)`,
  ],
);

export const applicationAttachment = pgTable(
  "application_attachment",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    applicationId: uuid("application_id").notNull(),
    imageId: uuid("image_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.applicationId],
      foreignColumns: [communityApplication.id],
      name: "application_attachment_application_id_fkey",
    }),
    foreignKey({
      columns: [table.imageId],
      foreignColumns: [image.id],
      name: "application_attachment_image_id_fkey",
    }),
  ],
);

export const communityLink = pgTable(
  "community_link",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    title: text().notNull(),
    url: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "community_link_community_id_fkey",
    }),
    sql`CONSTRAINT valid_link_title CHECK (length(title) > 0)`,
    sql`CONSTRAINT valid_link_url CHECK (url ~ '^https?://')`,
  ],
);

export const profilePicture = pgTable(
  "profile_picture",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    profileId: uuid("profile_id").notNull(),
    imageId: uuid("image_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "profile_picture_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.imageId],
      foreignColumns: [image.id],
      name: "profile_picture_image_id_fkey",
    }),
  ],
);

export const mention = pgTable(
  "mention",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    profileId: uuid("profile_id").notNull(),
    postId: uuid("post_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [post.id],
      name: "mention_post_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "mention_profile_id_fkey",
    }),
    unique("unique_mention").on(table.profileId, table.postId),
  ],
);

export const postImage = pgTable(
  "post_image",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    postId: uuid("post_id").notNull(),
    imageId: uuid("image_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.imageId],
      foreignColumns: [image.id],
      name: "post_image_image_id_fkey",
    }),
    foreignKey({
      columns: [table.postId],
      foreignColumns: [post.id],
      name: "post_image_post_id_fkey",
    }),
    unique("unique_post_image").on(table.postId, table.imageId),
  ],
);

export const postReaction = pgTable(
  "post_reaction",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    emoji: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    profileId: uuid("profile_id").notNull(),
    postId: uuid("post_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [post.id],
      name: "post_reaction_post_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "post_reaction_profile_id_fkey",
    }),
    sql`CONSTRAINT valid_emoji CHECK (length(emoji) > 0)`,
    unique("unique_post_reaction").on(
      table.postId,
      table.profileId,
      table.emoji,
    ),
  ],
);

export const groupChatMessageReaction = pgTable(
  "group_chat_message_reaction",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    emoji: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    profileId: uuid("profile_id").notNull(),
    messageId: uuid("message_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "group_chat_message_reaction_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [groupChatMessage.id],
      name: "group_chat_message_reaction_message_id_fkey",
    }),
    sql`CONSTRAINT valid_emoji CHECK (length(emoji) > 0)`,
    unique("unique_group_chat_message_reaction").on(
      table.messageId,
      table.profileId,
      table.emoji,
    ),
  ],
);

export const groupChatMessageImage = pgTable(
  "group_chat_message_image",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    messageId: uuid("message_id").notNull(),
    imageId: uuid("image_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.imageId],
      foreignColumns: [image.id],
      name: "group_chat_message_image_image_id_fkey",
    }),
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [groupChatMessage.id],
      name: "group_chat_message_image_message_id_fkey",
    }),
    unique("unique_group_chat_message_image").on(
      table.messageId,
      table.imageId,
    ),
  ],
);

export const directMessageReaction = pgTable(
  "direct_message_reaction",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    emoji: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    profileId: uuid("profile_id").notNull(),
    messageId: uuid("message_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "direct_message_reaction_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [directMessage.id],
      name: "direct_message_reaction_message_id_fkey",
    }),
    sql`CONSTRAINT valid_emoji CHECK (length(emoji) > 0)`,
    unique("unique_direct_message_reaction").on(
      table.messageId,
      table.profileId,
      table.emoji,
    ),
  ],
);

export const directMessageImage = pgTable(
  "direct_message_image",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    messageId: uuid("message_id").notNull(),
    imageId: uuid("image_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.imageId],
      foreignColumns: [image.id],
      name: "direct_message_image_image_id_fkey",
    }),
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [directMessage.id],
      name: "direct_message_image_message_id_fkey",
    }),
    unique("unique_direct_message_image").on(table.messageId, table.imageId),
  ],
);

export const directMessage = pgTable(
  "direct_message",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    content: text().notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    communityId: uuid("community_id").notNull(),
    senderId: uuid("sender_id").notNull(),
    receiverId: uuid("receiver_id").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "message_community_id_fkey",
    }),
    foreignKey({
      columns: [table.receiverId],
      foreignColumns: [profile.id],
      name: "message_receiver_id_fkey",
    }),
    foreignKey({
      columns: [table.senderId],
      foreignColumns: [profile.id],
      name: "message_sender_id_fkey",
    }),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [user.id],
      name: "direct_message_created_by_user_id_fkey",
    }),
    index("idx_direct_message_conversation").on(
      table.senderId,
      table.receiverId,
      table.createdAt,
    ),
    index("idx_direct_message_unread").on(table.receiverId, table.readAt),
    sql`CONSTRAINT valid_direct_message_content CHECK (length(content) <= 10000)`,
    sql`CONSTRAINT valid_sender_receiver CHECK (sender_id != receiver_id)`,
    sql`CONSTRAINT valid_direct_message_timestamps CHECK (deleted_at IS NULL OR deleted_at >= created_at)`,
    sql`CONSTRAINT valid_direct_message_read_at CHECK (read_at IS NULL OR read_at >= created_at)`,
  ],
);

export const directMessageDeletion = pgTable(
  "direct_message_deletion",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    messageId: uuid("message_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [directMessage.id],
      name: "direct_message_deletion_message_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "direct_message_deletion_profile_id_fkey",
    }),
    unique("unique_direct_message_deletion").on(
      table.messageId,
      table.profileId,
    ),
    index("idx_direct_message_deletion_profile").on(
      table.profileId,
      table.messageId,
    ),
  ],
);

export const groupChatMessageDeletion = pgTable(
  "group_chat_message_deletion",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    messageId: uuid("message_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [groupChatMessage.id],
      name: "group_chat_message_deletion_message_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "group_chat_message_deletion_profile_id_fkey",
    }),
    unique("unique_group_chat_message_deletion").on(
      table.messageId,
      table.profileId,
    ),
    index("idx_group_chat_message_deletion_profile").on(
      table.profileId,
      table.messageId,
    ),
  ],
);

export const post = pgTable(
  "post",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    content: text().notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    announcement: boolean().default(false).notNull(),
    authorId: uuid("author_id").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    communityId: uuid("community_id").notNull(),
    inReplyToId: uuid("in_reply_to_id"),
    depth: integer().default(0).notNull(),
    rootPostId: uuid("root_post_id"),
    contentWarning: text("content_warning"),
    scheduledAt: timestamp("scheduled_at", {
      withTimezone: true,
      mode: "string",
    }),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    pinnedAt: timestamp("pinned_at", {
      withTimezone: true,
      mode: "string",
    }),
    bumpedAt: timestamp("bumped_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    index("idx_post_depth").using(
      "btree",
      table.depth.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_post_in_reply_to_id_created").using(
      "btree",
      table.inReplyToId.asc().nullsLast().op("uuid_ops"),
      table.createdAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_post_root_post_id_created").using(
      "btree",
      table.rootPostId.asc().nullsLast().op("uuid_ops"),
      table.createdAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_post_community_id_created").using(
      "btree",
      table.communityId.asc().nullsLast().op("uuid_ops"),
      table.createdAt.desc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_post_community_id_bumped").using(
      "btree",
      table.communityId.asc().nullsLast().op("uuid_ops"),
      table.bumpedAt.desc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_post_scheduled_at").using(
      "btree",
      table.scheduledAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [profile.id],
      name: "post_author_id_fkey",
    }),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [user.id],
      name: "post_created_by_user_id_fkey",
    }),
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "post_community_id_fkey",
    }),
    foreignKey({
      columns: [table.inReplyToId],
      foreignColumns: [table.id],
      name: "post_in_reply_to_id_fkey",
    }),
    foreignKey({
      columns: [table.rootPostId],
      foreignColumns: [table.id],
      name: "fk_post_root_post_id",
    }),
    sql`CONSTRAINT valid_post_content CHECK (length(content) <= 10000)`,
    sql`CONSTRAINT valid_post_content_warning CHECK (content_warning IS NULL OR length(content_warning) <= 500)`,
    sql`CONSTRAINT valid_post_depth CHECK (depth >= 0)`,
    sql`CONSTRAINT valid_reply_depth CHECK (in_reply_to_id IS NULL OR depth > 0)`,
    sql`CONSTRAINT valid_root_post CHECK ((depth = 0 AND root_post_id IS NULL) OR (depth > 0 AND root_post_id IS NOT NULL))`,
    sql`CONSTRAINT valid_post_timestamps CHECK (deleted_at IS NULL OR deleted_at >= created_at)`,
  ],
);

export const postBookmark = pgTable(
  "post_bookmark",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    profileId: uuid("profile_id").notNull(),
    postId: uuid("post_id").notNull(),
  },
  (table) => [
    index("idx_post_bookmark_profile_id_created").using(
      "btree",
      table.profileId.asc().nullsLast().op("uuid_ops"),
      table.createdAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "post_bookmark_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.postId],
      foreignColumns: [post.id],
      name: "post_bookmark_post_id_fkey",
    }),
    unique("unique_profile_post_bookmark").on(table.profileId, table.postId),
  ],
);

export const postHistory = pgTable(
  "post_history",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    postId: uuid("post_id").notNull(),
    content: text().notNull(),
    contentWarning: text("content_warning"),
    editedAt: timestamp("edited_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    editedByProfileId: uuid("edited_by_profile_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [post.id],
      name: "post_history_post_id_fkey",
    }),
    foreignKey({
      columns: [table.editedByProfileId],
      foreignColumns: [profile.id],
      name: "post_history_edited_by_profile_id_fkey",
    }),
    index("idx_post_history_post_id_edited_at").on(
      table.postId,
      table.editedAt,
    ),
    sql`CONSTRAINT valid_post_history_content CHECK (length(content) <= 10000)`,
    sql`CONSTRAINT valid_post_history_content_warning CHECK (content_warning IS NULL OR length(content_warning) <= 500)`,
  ],
);

export const postHistoryImage = pgTable(
  "post_history_image",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    postHistoryId: uuid("post_history_id").notNull(),
    imageId: uuid("image_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.postHistoryId],
      foreignColumns: [postHistory.id],
      name: "post_history_image_post_history_id_fkey",
    }),
    foreignKey({
      columns: [table.imageId],
      foreignColumns: [image.id],
      name: "post_history_image_image_id_fkey",
    }),
    unique("unique_post_history_image").on(table.postHistoryId, table.imageId),
  ],
);

export const membership = pgTable(
  "membership",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    communityId: uuid("community_id").notNull(),
    role: communityRoleEnum().notNull(),
    activatedAt: timestamp("activated_at", {
      withTimezone: true,
      mode: "string",
    }),
    applicationId: uuid("application_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "membership_community_id_fkey",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "membership_user_id_fkey",
    }),
    foreignKey({
      columns: [table.applicationId],
      foreignColumns: [communityApplication.id],
      name: "membership_application_id_fkey",
    }),
    unique("unique_user_community_membership").on(
      table.userId,
      table.communityId,
    ),
    unique("unique_membership_application").on(table.applicationId),
    index("idx_membership_community_active").on(
      table.communityId,
      table.activatedAt,
    ),
    index("idx_membership_user_community_active").on(
      table.userId,
      table.communityId,
      table.activatedAt,
    ),
    uniqueIndex("idx_one_active_owner_per_community")
      .on(table.communityId)
      .where(sql`${table.role} = 'owner' AND ${table.activatedAt} IS NOT NULL`),
  ],
);

export const moderationLog = pgTable(
  "moderation_log",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    action: moderationActionEnum().notNull(),
    description: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    moderatorId: uuid("moderator_id").notNull(),
    targetUserId: uuid("target_user_id"),
    targetProfileId: uuid("target_profile_id"),
    targetPostId: uuid("target_post_id"),
    extraData: text("extra_data"),
  },
  (table) => [
    foreignKey({
      columns: [table.moderatorId],
      foreignColumns: [profile.id],
      name: "moderation_log_moderator_id_fkey",
    }),
    foreignKey({
      columns: [table.targetProfileId],
      foreignColumns: [profile.id],
      name: "moderation_log_target_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.targetPostId],
      foreignColumns: [post.id],
      name: "moderation_log_target_post_id_fkey",
    }),
    foreignKey({
      columns: [table.targetUserId],
      foreignColumns: [user.id],
      name: "moderation_log_target_user_id_fkey",
    }),
  ],
);

export const notification = pgTable(
  "notification",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    type: notificationTypeEnum().notNull(),
    title: text().notNull(),
    message: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    recipientId: uuid("recipient_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    postId: uuid("post_id"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
    directMessageId: uuid("direct_message_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "notification_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.postId],
      foreignColumns: [post.id],
      name: "notification_post_id_fkey",
    }),
    foreignKey({
      columns: [table.recipientId],
      foreignColumns: [profile.id],
      name: "notification_recipient_id_fkey",
    }),
    foreignKey({
      columns: [table.directMessageId],
      foreignColumns: [directMessage.id],
      name: "notification_direct_message_id_fkey",
    }),
    index("idx_notification_unread").on(table.recipientId, table.readAt),
    sql`CONSTRAINT valid_notification_read_at CHECK (read_at IS NULL OR read_at >= created_at)`,
  ],
);

export const userNotification = pgTable(
  "user_notification",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    type: userNotificationTypeEnum().notNull(),
    title: text().notNull(),
    message: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    recipientUserId: uuid("recipient_user_id").notNull(),
    actorUserId: uuid("actor_user_id"),
    boardPostId: uuid("board_post_id"),
    boardPostReplyId: uuid("board_post_reply_id"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.recipientUserId],
      foreignColumns: [user.id],
      name: "user_notification_recipient_user_id_fkey",
    }),
    foreignKey({
      columns: [table.actorUserId],
      foreignColumns: [user.id],
      name: "user_notification_actor_user_id_fkey",
    }),
    foreignKey({
      columns: [table.boardPostId],
      foreignColumns: [boardPost.id],
      name: "user_notification_board_post_id_fkey",
    }),
    foreignKey({
      columns: [table.boardPostReplyId],
      foreignColumns: [boardPostReply.id],
      name: "user_notification_board_post_reply_id_fkey",
    }),
    index("idx_user_notification_unread").on(
      table.recipientUserId,
      table.readAt,
    ),
    sql`CONSTRAINT valid_user_notification_read_at CHECK (read_at IS NULL OR read_at >= created_at)`,
  ],
);

export const communityHashtag = pgTable(
  "community_hashtag",
  {
    communityId: uuid("community_id").notNull(),
    hashtagId: uuid("hashtag_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "community_hashtag_community_id_fkey",
    }),
    foreignKey({
      columns: [table.hashtagId],
      foreignColumns: [hashtag.id],
      name: "community_hashtag_hashtag_id_fkey",
    }),
    primaryKey({
      columns: [table.communityId, table.hashtagId],
      name: "community_hashtag_pkey",
    }),
  ],
);

export const communityExport = pgTable(
  "community_export",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    userId: uuid("user_id").notNull(),
    status: exportStatusEnum().notNull().default("pending"),
    r2Key: text("r2_key"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "community_export_community_id_fkey",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "community_export_user_id_fkey",
    }),
    index("community_export_community_id_idx").on(table.communityId),
    index("community_export_user_id_idx").on(table.userId),
    index("community_export_status_idx").on(table.status),
  ],
);

export const board = pgTable(
  "board",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    name: text().notNull(),
    slug: text().notNull(),
    description: text(),
    allowComments: boolean("allow_comments").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    unique("board_slug_key").on(table.slug),
    sql`CONSTRAINT valid_board_name CHECK (length(name) > 0)`,
    sql`CONSTRAINT valid_board_slug CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')`,
    sql`CONSTRAINT valid_board_description CHECK (description IS NULL OR length(description) <= 1000)`,
  ],
);

export const boardPost = pgTable(
  "board_post",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    boardId: uuid("board_id").notNull(),
    authorId: uuid("author_id").notNull(),
    title: text().notNull(),
    content: text().notNull(),
    imageId: uuid("image_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    deletionReason: deletionReasonEnum("deletion_reason"),
  },
  (table) => [
    foreignKey({
      columns: [table.boardId],
      foreignColumns: [board.id],
      name: "board_post_board_id_fkey",
    }),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [user.id],
      name: "board_post_author_id_fkey",
    }),
    foreignKey({
      columns: [table.imageId],
      foreignColumns: [image.id],
      name: "board_post_image_id_fkey",
    }),
    index("idx_board_post_board_id_created").on(table.boardId, table.createdAt),
    sql`CONSTRAINT valid_board_post_title CHECK (length(title) > 0 AND length(title) <= 200)`,
    sql`CONSTRAINT valid_board_post_content CHECK (length(content) > 0 AND length(content) <= 50000)`,
  ],
);

export const boardHashtag = pgTable(
  "board_hashtag",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    tag: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("board_hashtag_tag_key").on(table.tag),
    sql`CONSTRAINT valid_board_hashtag_tag CHECK (tag ~ '^[a-z0-9가-힣]+$' AND length(tag) > 0)`,
    index("board_hashtag_tag_lower_idx").on(sql`LOWER(${table.tag})`),
  ],
);

export const boardPostHashtag = pgTable(
  "board_post_hashtag",
  {
    boardPostId: uuid("board_post_id").notNull(),
    hashtagId: uuid("hashtag_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.boardPostId],
      foreignColumns: [boardPost.id],
      name: "board_post_hashtag_board_post_id_fkey",
    }),
    foreignKey({
      columns: [table.hashtagId],
      foreignColumns: [boardHashtag.id],
      name: "board_post_hashtag_hashtag_id_fkey",
    }),
    primaryKey({
      columns: [table.boardPostId, table.hashtagId],
      name: "board_post_hashtag_pkey",
    }),
  ],
);

export const boardPostReply = pgTable(
  "board_post_reply",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    boardPostId: uuid("board_post_id").notNull(),
    authorId: uuid("author_id").notNull(),
    content: text().notNull(),
    inReplyToId: uuid("in_reply_to_id"),
    depth: integer().notNull().default(0),
    rootReplyId: uuid("root_reply_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    deletionReason: deletionReasonEnum("deletion_reason"),
  },
  (table) => [
    foreignKey({
      columns: [table.boardPostId],
      foreignColumns: [boardPost.id],
      name: "board_post_reply_board_post_id_fkey",
    }),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [user.id],
      name: "board_post_reply_author_id_fkey",
    }),
    foreignKey({
      columns: [table.inReplyToId],
      foreignColumns: [table.id],
      name: "board_post_reply_in_reply_to_id_fkey",
    }),
    foreignKey({
      columns: [table.rootReplyId],
      foreignColumns: [table.id],
      name: "board_post_reply_root_reply_id_fkey",
    }),
    index("idx_board_post_reply_board_post_id_created").on(
      table.boardPostId,
      table.createdAt,
    ),
    index("idx_board_post_reply_in_reply_to_id_created").on(
      table.inReplyToId,
      table.createdAt,
    ),
    index("idx_board_post_reply_root_reply_id_created").on(
      table.rootReplyId,
      table.createdAt,
    ),
    sql`CONSTRAINT valid_board_post_reply_content CHECK (length(content) > 0 AND length(content) <= 10000)`,
    sql`CONSTRAINT valid_board_reply_depth CHECK ((in_reply_to_id IS NULL AND depth = 0) OR (in_reply_to_id IS NOT NULL AND depth > 0))`,
    sql`CONSTRAINT valid_board_root_reply CHECK ((depth = 0 AND root_reply_id IS NULL) OR (depth > 0 AND root_reply_id IS NOT NULL))`,
  ],
);

export const bot = pgTable(
  "bot",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    name: text().notNull(),
    description: text(),
    profileId: uuid("profile_id").notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "bot_community_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "bot_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.createdById],
      foreignColumns: [user.id],
      name: "bot_created_by_id_fkey",
    }),
    index("idx_bot_community_id").on(table.communityId),
    sql`CONSTRAINT valid_bot_name CHECK (length(name) > 0 AND length(name) <= 100)`,
    sql`CONSTRAINT valid_bot_description CHECK (description IS NULL OR length(description) <= 1000)`,
  ],
);

export const botToken = pgTable(
  "bot_token",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    token: uuid().notNull().default(sql`uuidv7()`),
    botId: uuid("bot_id").notNull(),
    name: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.botId],
      foreignColumns: [bot.id],
      name: "bot_token_bot_id_fkey",
    }),
    unique("bot_token_token_key").on(table.token),
    index("idx_bot_token_bot_id").on(table.botId),
    sql`CONSTRAINT valid_bot_token_name CHECK (name IS NULL OR length(name) <= 100)`,
  ],
);

export const installedApp = pgTable(
  "installed_app",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    builtinId: text("builtin_id").notNull(),
    version: text().notNull(),
    config: jsonb().notNull().default(sql`'{}'::jsonb`),
    installedById: uuid("installed_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "installed_app_community_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "installed_app_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.installedById],
      foreignColumns: [user.id],
      name: "installed_app_installed_by_id_fkey",
    }),
    uniqueIndex("unique_installed_app_per_community")
      .on(table.communityId, table.builtinId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_installed_app_community_id").on(table.communityId),
    sql`CONSTRAINT valid_installed_app_builtin_id CHECK (builtin_id ~ '^[a-z][a-z0-9_.-]*$')`,
    sql`CONSTRAINT valid_installed_app_version CHECK (length(version) > 0 AND length(version) <= 50)`,
  ],
);

export const botCommand = pgTable(
  "bot_command",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    installedAppId: uuid("installed_app_id").notNull(),
    name: text().notNull(),
    description: text(),
    handlerBuiltinId: text("handler_builtin_id").notNull(),
    enabled: boolean().notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "bot_command_community_id_fkey",
    }),
    foreignKey({
      columns: [table.installedAppId],
      foreignColumns: [installedApp.id],
      name: "bot_command_installed_app_id_fkey",
    }),
    uniqueIndex("unique_bot_command_name_per_community")
      .on(table.communityId, sql`LOWER(${table.name})`)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_bot_command_installed_app_id").on(table.installedAppId),
    sql`CONSTRAINT valid_bot_command_name CHECK (name ~ '^[a-z][a-z0-9_-]{0,30}$')`,
    sql`CONSTRAINT valid_bot_command_description CHECK (description IS NULL OR length(description) <= 1000)`,
    sql`CONSTRAINT valid_bot_command_handler_builtin_id CHECK (handler_builtin_id ~ '^[a-z][a-z0-9_.-]*$')`,
  ],
);

export const shopCurrency = pgTable(
  "shop_currency",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    name: text().notNull(),
    description: text(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "shop_currency_community_id_fkey",
    }),
    uniqueIndex("unique_shop_currency_name_per_community")
      .on(table.communityId, sql`LOWER(${table.name})`)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_shop_currency_community_id").on(table.communityId),
    sql`CONSTRAINT valid_shop_currency_name CHECK (length(name) > 0 AND length(name) <= 50)`,
    sql`CONSTRAINT valid_shop_currency_description CHECK (description IS NULL OR length(description) <= 500)`,
  ],
);

export const shopBalance = pgTable(
  "shop_balance",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    currencyId: uuid("currency_id").notNull(),
    amount: integer().notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "shop_balance_community_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "shop_balance_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.currencyId],
      foreignColumns: [shopCurrency.id],
      name: "shop_balance_currency_id_fkey",
    }),
    uniqueIndex("unique_shop_balance_per_holder").on(
      table.communityId,
      table.profileId,
      table.currencyId,
    ),
    index("idx_shop_balance_profile").on(table.communityId, table.profileId),
    sql`CONSTRAINT valid_shop_balance_amount CHECK (amount >= 0)`,
  ],
);

export const shopItem = pgTable(
  "shop_item",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    name: text().notNull(),
    description: text(),
    priceAmount: integer("price_amount").notNull(),
    currencyId: uuid("currency_id").notNull(),
    consumable: boolean().notNull().default(false),
    isUnique: boolean("is_unique").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "shop_item_community_id_fkey",
    }),
    foreignKey({
      columns: [table.currencyId],
      foreignColumns: [shopCurrency.id],
      name: "shop_item_currency_id_fkey",
    }),
    uniqueIndex("unique_shop_item_name_per_community")
      .on(table.communityId, sql`LOWER(${table.name})`)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_shop_item_community_id").on(table.communityId),
    sql`CONSTRAINT valid_shop_item_name CHECK (length(name) > 0 AND length(name) <= 100)`,
    sql`CONSTRAINT valid_shop_item_description CHECK (description IS NULL OR length(description) <= 1000)`,
    sql`CONSTRAINT valid_shop_item_price CHECK (price_amount > 0)`,
  ],
);

export const shopInventory = pgTable(
  "shop_inventory",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    itemId: uuid("item_id").notNull(),
    qty: integer().notNull().default(0),
    grantedAt: timestamp("granted_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "shop_inventory_community_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "shop_inventory_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [shopItem.id],
      name: "shop_inventory_item_id_fkey",
    }),
    uniqueIndex("unique_shop_inventory_per_holder").on(
      table.communityId,
      table.profileId,
      table.itemId,
    ),
    index("idx_shop_inventory_profile").on(table.communityId, table.profileId),
    sql`CONSTRAINT valid_shop_inventory_qty CHECK (qty >= 0)`,
  ],
);

export const shopTransaction = pgTable(
  "shop_transaction",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    kind: shopTransactionKindEnum().notNull(),
    source: shopTransactionSourceEnum().notNull(),
    currencyId: uuid("currency_id"),
    currencyDelta: integer("currency_delta"),
    itemId: uuid("item_id"),
    itemQtyDelta: integer("item_qty_delta"),
    reason: text(),
    actorUserId: uuid("actor_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "shop_transaction_community_id_fkey",
    }),
    foreignKey({
      columns: [table.profileId],
      foreignColumns: [profile.id],
      name: "shop_transaction_profile_id_fkey",
    }),
    foreignKey({
      columns: [table.currencyId],
      foreignColumns: [shopCurrency.id],
      name: "shop_transaction_currency_id_fkey",
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [shopItem.id],
      name: "shop_transaction_item_id_fkey",
    }),
    foreignKey({
      columns: [table.actorUserId],
      foreignColumns: [user.id],
      name: "shop_transaction_actor_user_id_fkey",
    }),
    index("idx_shop_transaction_community_created").on(
      table.communityId,
      table.createdAt,
    ),
    index("idx_shop_transaction_profile_created").on(
      table.communityId,
      table.profileId,
      table.createdAt,
    ),
    sql`CONSTRAINT valid_shop_transaction_reason CHECK (reason IS NULL OR length(reason) <= 500)`,
  ],
);

export const communityBoard = pgTable(
  "community_board",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    communityId: uuid("community_id").notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    description: text(),
    allowComments: boolean("allow_comments").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.communityId],
      foreignColumns: [community.id],
      name: "community_board_community_id_fkey",
    }),
    uniqueIndex("unique_community_board_slug")
      .on(table.communityId, table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_community_board_community_id").on(table.communityId),
    sql`CONSTRAINT valid_community_board_name CHECK (length(name) > 0)`,
    sql`CONSTRAINT valid_community_board_slug CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')`,
    sql`CONSTRAINT valid_community_board_description CHECK (description IS NULL OR length(description) <= 1000)`,
  ],
);

export const communityBoardPost = pgTable(
  "community_board_post",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    boardId: uuid("board_id").notNull(),
    authorId: uuid("author_id").notNull(),
    title: text().notNull(),
    content: text().notNull(),
    imageId: uuid("image_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.boardId],
      foreignColumns: [communityBoard.id],
      name: "community_board_post_board_id_fkey",
    }),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [profile.id],
      name: "community_board_post_author_id_fkey",
    }),
    foreignKey({
      columns: [table.imageId],
      foreignColumns: [image.id],
      name: "community_board_post_image_id_fkey",
    }),
    index("idx_community_board_post_board_id_created").on(
      table.boardId,
      table.createdAt,
    ),
    sql`CONSTRAINT valid_community_board_post_title CHECK (length(title) > 0 AND length(title) <= 200)`,
    sql`CONSTRAINT valid_community_board_post_content CHECK (length(content) > 0 AND length(content) <= 50000)`,
  ],
);

export const communityBoardPostReply = pgTable(
  "community_board_post_reply",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    postId: uuid("post_id").notNull(),
    authorId: uuid("author_id").notNull(),
    content: text().notNull(),
    inReplyToId: uuid("in_reply_to_id"),
    depth: integer().notNull().default(0),
    rootReplyId: uuid("root_reply_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.postId],
      foreignColumns: [communityBoardPost.id],
      name: "community_board_post_reply_post_id_fkey",
    }),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [profile.id],
      name: "community_board_post_reply_author_id_fkey",
    }),
    foreignKey({
      columns: [table.inReplyToId],
      foreignColumns: [table.id],
      name: "community_board_post_reply_in_reply_to_id_fkey",
    }),
    foreignKey({
      columns: [table.rootReplyId],
      foreignColumns: [table.id],
      name: "community_board_post_reply_root_reply_id_fkey",
    }),
    index("idx_community_board_post_reply_post_id_created").on(
      table.postId,
      table.createdAt,
    ),
    index("idx_community_board_post_reply_in_reply_to_id").on(
      table.inReplyToId,
    ),
    sql`CONSTRAINT valid_community_board_post_reply_content CHECK (length(content) > 0 AND length(content) <= 10000)`,
    sql`CONSTRAINT valid_community_board_reply_depth CHECK ((in_reply_to_id IS NULL AND depth = 0) OR (in_reply_to_id IS NOT NULL AND depth > 0))`,
    sql`CONSTRAINT valid_community_board_root_reply CHECK ((depth = 0 AND root_reply_id IS NULL) OR (depth > 0 AND root_reply_id IS NOT NULL))`,
  ],
);
