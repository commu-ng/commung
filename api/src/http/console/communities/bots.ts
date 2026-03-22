import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth";
import * as botService from "../../../services/bot.service";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import * as profileService from "../../../services/profile.service";
import { GeneralErrorCode } from "../../../types/api-responses";

const communityIdParamSchema = z.object({
  id: z.string().min(1),
});

const botIdParamSchema = z.object({
  id: z.string().min(1),
  botId: z.uuid(),
});

const botTokenIdParamSchema = z.object({
  id: z.string().min(1),
  botId: z.uuid(),
  tokenId: z.uuid(),
});

const botCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  profile_name: z.string().min(1).max(100),
  profile_username: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/),
});

const botUpdateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
});

const botTokenCreateSchema = z.object({
  name: z.string().max(100).nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export const botsRouter = new Hono()
  // List bots for a community
  .get(
    "/:id/bots",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user has permission (must be owner or moderator)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);

      const bots = await botService.getBotsByCommunity(community.id);

      return c.json({ data: bots });
    },
  )

  // Create a new bot
  .post(
    "/:id/bots",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", botCreateSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const { name, description, profile_name, profile_username } =
        c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user has permission (must be owner)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      // Create a profile for the bot
      const botProfile = await profileService.createBotProfile(
        community.id,
        profile_name,
        profile_username,
        user.id,
      );

      // Create the bot
      const bot = await botService.createBot(
        community.id,
        name,
        description || null,
        botProfile.id,
        user.id,
      );

      return c.json(
        {
          data: {
            ...bot,
            profile: botProfile,
          },
        },
        201,
      );
    },
  )

  // Get a specific bot
  .get(
    "/:id/bots/:botId",
    authMiddleware,
    zValidator("param", botIdParamSchema),
    async (c) => {
      const { id: slug, botId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user has permission (must be owner or moderator)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);

      const bot = await botService.getBot(botId, community.id);

      if (!bot) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.NOT_FOUND,
              message: "봇을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      // Get tokens for this bot
      const tokens = await botService.getBotTokens(botId);

      return c.json({
        data: {
          ...bot,
          tokens,
        },
      });
    },
  )

  // Update a bot
  .patch(
    "/:id/bots/:botId",
    authMiddleware,
    zValidator("param", botIdParamSchema),
    zValidator("json", botUpdateSchema),
    async (c) => {
      const { id: slug, botId } = c.req.valid("param");
      const user = c.get("user");
      const { name, description } = c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user has permission (must be owner)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      const updatedBot = await botService.updateBot(
        botId,
        community.id,
        name,
        description || null,
      );

      if (!updatedBot) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.NOT_FOUND,
              message: "봇을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      return c.json({ data: updatedBot });
    },
  )

  // Delete a bot
  .delete(
    "/:id/bots/:botId",
    authMiddleware,
    zValidator("param", botIdParamSchema),
    async (c) => {
      const { id: slug, botId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user has permission (must be owner)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      await botService.deleteBot(botId, community.id);

      return c.body(null, 204);
    },
  )

  // Create a new bot token
  .post(
    "/:id/bots/:botId/tokens",
    authMiddleware,
    zValidator("param", botIdParamSchema),
    zValidator("json", botTokenCreateSchema),
    async (c) => {
      const { id: slug, botId } = c.req.valid("param");
      const user = c.get("user");
      const { name, expires_at } = c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user has permission (must be owner)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      // Verify bot exists and belongs to this community
      const bot = await botService.getBot(botId, community.id);
      if (!bot) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.NOT_FOUND,
              message: "봇을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      const token = await botService.createBotToken(
        botId,
        name || null,
        expires_at || null,
      );

      if (!token) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.INTERNAL_SERVER_ERROR,
              message: "토큰 생성에 실패했습니다",
            },
          },
          500,
        );
      }

      // Return the full token (only shown once)
      return c.json(
        {
          data: {
            id: token.id,
            token: token.token, // This is the secret - only returned once!
            name: token.name,
            created_at: token.createdAt,
            expires_at: token.expiresAt,
          },
        },
        201,
      );
    },
  )

  // List bot tokens
  .get(
    "/:id/bots/:botId/tokens",
    authMiddleware,
    zValidator("param", botIdParamSchema),
    async (c) => {
      const { id: slug, botId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user has permission (must be owner or moderator)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);

      // Verify bot exists and belongs to this community
      const bot = await botService.getBot(botId, community.id);
      if (!bot) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.NOT_FOUND,
              message: "봇을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      const tokens = await botService.getBotTokens(botId);

      return c.json({ data: tokens });
    },
  )

  // Revoke a bot token
  .delete(
    "/:id/bots/:botId/tokens/:tokenId",
    authMiddleware,
    zValidator("param", botTokenIdParamSchema),
    async (c) => {
      const { id: slug, botId, tokenId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Check if user has permission (must be owner)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      // Verify bot exists and belongs to this community
      const bot = await botService.getBot(botId, community.id);
      if (!bot) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.NOT_FOUND,
              message: "봇을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      await botService.revokeBotToken(tokenId, botId);

      return c.body(null, 204);
    },
  );
