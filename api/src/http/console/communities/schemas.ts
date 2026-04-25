import { z } from "zod";
import { usernameSchema } from "../../../schemas";

export const communityLinkCreateSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
  url: z.url("Must be a valid URL"),
});

export const communityLinkUpdateSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
  url: z.url("Must be a valid URL"),
});

export const paginationQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const memberListQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
  q: z.string().max(100).optional(),
  role: z.enum(["owner", "moderator", "member"]).optional(),
});

export const memberRoleUpdateSchema = z.object({
  membership_id: z.uuid(),
  role: z.enum(["owner", "moderator", "member"]),
});

export const communityBannerImageParamSchema = z.object({
  id: z.string().min(1),
  bannerImageId: z.uuid(),
});

export const communityLinkParamSchema = z.object({
  id: z.string().min(1),
  linkId: z.uuid(),
});

export const communityMemberParamSchema = z.object({
  id: z.string().min(1),
  membership_id: z.uuid(),
});

export const communityIdParamSchema = z.object({
  id: z.string().min(1),
});

export const applicationIdParamSchema = z.object({
  application_id: z.uuid(),
});

export const communityApplicationParamSchema = z.object({
  id: z.string().min(1),
  application_id: z.uuid(),
});

export const communityApplicationSchema = z.object({
  message: z.string().nullable().optional(),
  profile_name: z.string().min(1, "Profile name cannot be empty"),
  profile_username: usernameSchema,
  attachment_ids: z.array(z.uuid()).optional(),
});

export const communityApplicationUpdateSchema = z.object({
  message: z.string().nullable().optional(),
  profile_name: z.string().min(1, "Profile name cannot be empty"),
  profile_username: usernameSchema,
  attachment_ids: z.array(z.uuid()).optional(),
});

export const applicationReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejection_reason: z.string().optional(),
});
