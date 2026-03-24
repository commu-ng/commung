import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { appAuthMiddleware } from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import { membershipMiddleware } from "../../middleware/membership";
import {
  conversationsQuerySchema,
  groupChatCreateRequestSchema,
  groupChatIdParamSchema,
  groupChatUpdateRequestSchema,
  groupChatMessageCreateRequestSchema,
  groupChatMessageReactionCreateSchema,
  groupChatMessageReactionDeleteSchema,
  messageCreateSchema,
  messageDeleteQuerySchema,
  messageIdParamSchema,
  messageReactionCreateSchema,
  messageReactionDeleteSchema,
  otherProfileIdParamSchema,
  profileIdQuerySchema,
  profileIdWithLimitQuerySchema,
  unreadCountQuerySchema,
} from "../../schemas";
import * as messageService from "../../services/message.service";
import * as profileService from "../../services/profile.service";
import type { AuthVariables } from "../../types";
import { GeneralErrorCode } from "../../types/api-responses";

export const messagesRouter = new Hono<{ Variables: AuthVariables }>()
  .post(
    "/messages",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("query", profileIdQuerySchema),
    zValidator("json", messageCreateSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { content, receiver_id, image_ids } = c.req.valid("json");
      const { profile_id: senderProfileId } = c.req.valid("query");

      // Get and validate sender profile
      const senderProfile = await profileService.validateAndGetProfile(
        user.id,
        senderProfileId,
        community.id,
        true,
      );

      if (!senderProfile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "송신자 프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      const result = await messageService.sendDirectMessage(
        user.id,
        senderProfile.id,
        receiver_id,
        community.id,
        content,
        image_ids,
      );

      return c.json({ data: result }, 201);
    },
  )
  .delete(
    "/messages/:message_id",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", messageIdParamSchema),
    zValidator("query", messageDeleteQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { message_id: messageId } = c.req.valid("param");
      const { profile_id: profileId, mode } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      await messageService.deleteDirectMessage(
        profile.id,
        messageId,
        community.id,
        mode,
      );

      return c.json({ data: { id: messageId, deleted: true } });
    },
  )
  .get(
    "/messages/unread-count",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("query", unreadCountQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      const count = await messageService.getUnreadCount(
        profile.id,
        community.id,
      );

      return c.json({ data: { count } });
    },
  )
  .get(
    "/conversations/:other_profile_id",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("param", otherProfileIdParamSchema),
    zValidator("query", conversationsQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { other_profile_id: otherProfileId } = c.req.valid("param");
      const {
        profile_id: profileId,
        limit = 50,
        cursor,
      } = c.req.valid("query");

      // Validate user has access to this profile
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.FORBIDDEN,
              message: "프로필에 접근할 권한이 없습니다",
            },
          },
          403,
        );
      }

      const result = await messageService.getConversationThread(
        profileId,
        otherProfileId,
        community.id,
        limit,
        cursor,
      );
      return c.json({
        data: result.messages,
        pagination: result.pagination,
      });
    },
  )

  .post(
    "/conversations/:other_profile_id/mark-read",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", otherProfileIdParamSchema),
    zValidator("query", z.object({ profile_id: z.uuid() })),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { other_profile_id: otherProfileId } = c.req.valid("param");
      const { profile_id: profileId } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      await messageService.markConversationAsRead(
        profileId,
        otherProfileId,
        community.id,
      );
      return c.json({
        data: {
          conversation_with: otherProfileId,
          is_read: true,
          read_at: new Date().toISOString(),
        },
      });
    },
  )

  .post(
    "/conversations/mark-all-read",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("query", z.object({ profile_id: z.uuid() })),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      await messageService.markAllDirectMessagesAsRead(profileId, community.id);
      return c.json({
        data: {
          all_read: true,
          read_at: new Date().toISOString(),
        },
      });
    },
  )

  .get(
    "/conversations",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("query", profileIdWithLimitQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId, limit = 20 } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      const result = await messageService.getConversations(
        profile.id,
        community.id,
        limit,
      );

      return c.json({
        data: result,
        pagination: {
          has_more: false,
          next_cursor: null,
        },
      });
    },
  )

  .post(
    "/messages/:message_id/reactions",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", messageIdParamSchema),
    zValidator("json", messageReactionCreateSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { message_id: messageId } = c.req.valid("param");
      const { profile_id: profileId, emoji } = c.req.valid("json");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      const result = await messageService.createDirectMessageReaction(
        profile.id,
        messageId,
        community.id,
        emoji,
      );

      return c.json({ data: result }, 201);
    },
  )

  .delete(
    "/messages/:message_id/reactions",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", messageIdParamSchema),
    zValidator("query", messageReactionDeleteSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { message_id: messageId } = c.req.valid("param");
      const { profile_id: profileId, emoji } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      await messageService.deleteDirectMessageReaction(
        profile.id,
        messageId,
        community.id,
        emoji,
      );

      return c.json({
        data: { message_id: messageId, emoji, deleted: true },
      });
    },
  )

  .get(
    "/group-chats",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("query", conversationsQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId, limit = 20 } = c.req.valid("query");

      // Get and validate the profile belongs to the user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profileId,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      const result = await messageService.listGroupChats(
        profileId,
        community.id,
        limit,
        0, // TODO: Implement cursor-based pagination
      );
      return c.json({ data: result });
    },
  )

  .post(
    "/group-chats",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("json", groupChatCreateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { name, member_profile_ids, creator_profile_id } =
        c.req.valid("json");

      // Verify creator profile belongs to the user
      const creatorProfile = await profileService.validateAndGetProfile(
        user.id,
        creator_profile_id,
        community.id,
        false,
      );

      if (!creatorProfile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.FORBIDDEN,
              message: "생성자 프로필을 찾을 수 없거나 권한이 없습니다",
            },
          },
          403,
        );
      }

      const result = await messageService.createGroupChat(
        name,
        member_profile_ids,
        creator_profile_id,
        community.id,
      );
      return c.json({ data: result }, 201);
    },
  )

  .get(
    "/group-chats/:group_chat_id",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("param", groupChatIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id } = c.req.valid("param");
      const { profile_id } = c.req.valid("query");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.FORBIDDEN,
              message: "프로필을 찾을 수 없거나 권한이 없습니다",
            },
          },
          403,
        );
      }

      const result = await messageService.getGroupChatDetails(
        group_chat_id,
        profile_id,
        community.id,
      );
      return c.json({ data: result });
    },
  )

  .patch(
    "/group-chats/:group_chat_id",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", groupChatIdParamSchema),
    zValidator("json", groupChatUpdateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id } = c.req.valid("param");
      const { profile_id, name } = c.req.valid("json");

      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.FORBIDDEN,
              message: "프로필에 접근할 권한이 없습니다",
            },
          },
          403,
        );
      }

      const result = await messageService.renameGroupChat(
        group_chat_id,
        profile.id,
        community.id,
        name,
      );
      return c.json({ data: result });
    },
  )

  .get(
    "/group-chats/:group_chat_id/messages",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("param", groupChatIdParamSchema),
    zValidator(
      "query",
      z.object({
        profile_id: z.uuid(),
        limit: z.coerce.number().min(1).max(100).optional(),
        cursor: z.uuid().optional(),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id } = c.req.valid("param");
      const { profile_id, limit, cursor } = c.req.valid("query");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.FORBIDDEN,
              message: "프로필을 찾을 수 없거나 권한이 없습니다",
            },
          },
          403,
        );
      }

      const result = await messageService.getGroupChatMessages(
        group_chat_id,
        profile_id,
        community.id,
        limit,
        cursor,
      );
      return c.json({ data: result.messages, pagination: result.pagination });
    },
  )

  .post(
    "/group-chats/:group_chat_id/messages",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", groupChatIdParamSchema),
    zValidator("json", groupChatMessageCreateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id } = c.req.valid("param");
      const { content, profile_id, image_ids } = c.req.valid("json");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.FORBIDDEN,
              message: "프로필에 접근할 권한이 없습니다",
            },
          },
          403,
        );
      }

      const result = await messageService.sendGroupChatMessage(
        user.id,
        group_chat_id,
        profile_id,
        content,
        community.id,
        image_ids,
      );
      return c.json({ data: result }, 201);
    },
  )

  .post(
    "/group-chats/:group_chat_id/messages/:message_id/reactions",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator(
      "param",
      z.object({ group_chat_id: z.uuid(), message_id: z.uuid() }),
    ),
    zValidator("json", groupChatMessageReactionCreateSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id, message_id } = c.req.valid("param");
      const { profile_id, emoji } = c.req.valid("json");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.FORBIDDEN,
              message: "프로필에 접근할 권한이 없습니다",
            },
          },
          403,
        );
      }

      const result = await messageService.createGroupChatMessageReaction(
        profile_id,
        message_id,
        group_chat_id,
        community.id,
        emoji,
      );
      return c.json({ data: result }, 201);
    },
  )

  .delete(
    "/group-chats/:group_chat_id/messages/:message_id/reactions",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator(
      "param",
      z.object({ group_chat_id: z.uuid(), message_id: z.uuid() }),
    ),
    zValidator("query", groupChatMessageReactionDeleteSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id, message_id } = c.req.valid("param");
      const { profile_id, emoji } = c.req.valid("query");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.FORBIDDEN,
              message: "프로필에 접근할 권한이 없습니다",
            },
          },
          403,
        );
      }

      await messageService.deleteGroupChatMessageReaction(
        profile_id,
        message_id,
        group_chat_id,
        community.id,
        emoji,
      );
      return c.json({
        data: { message_id, emoji, deleted: true },
      });
    },
  )

  .delete(
    "/group-chats/:group_chat_id/messages/:message_id",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator(
      "param",
      z.object({ group_chat_id: z.uuid(), message_id: z.uuid() }),
    ),
    zValidator("query", messageDeleteQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id, message_id } = c.req.valid("param");
      const { profile_id, mode } = c.req.valid("query");

      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.FORBIDDEN,
              message: "프로필에 접근할 권한이 없습니다",
            },
          },
          403,
        );
      }

      await messageService.deleteGroupChatMessage(
        profile.id,
        message_id,
        group_chat_id,
        community.id,
        mode,
      );

      return c.json({ data: { id: message_id, deleted: true } });
    },
  )

  .post(
    "/group-chats/:group_chat_id/mark-read",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", groupChatIdParamSchema),
    zValidator("query", profileIdQuerySchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { group_chat_id } = c.req.valid("param");
      const { profile_id } = c.req.valid("query");

      // Verify profile belongs to user
      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        false,
      );

      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.FORBIDDEN,
              message: "프로필에 접근할 권한이 없습니다",
            },
          },
          403,
        );
      }

      await messageService.markGroupChatMessagesAsRead(
        group_chat_id,
        profile_id,
        community.id,
      );
      return c.json({
        data: {
          group_chat_id,
          is_read: true,
          read_at: new Date().toISOString(),
        },
      });
    },
  );
