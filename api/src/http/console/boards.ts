import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { authMiddleware, optionalAuthMiddleware } from "../../middleware/auth";
import {
  boardCreateRequestSchema,
  boardIdParamSchema,
  boardPostCreateRequestSchema,
  boardPostIdParamSchema,
  boardPostQuerySchema,
  boardPostReplyCreateRequestSchema,
  boardPostReplyIdParamSchema,
  boardPostReplyQuerySchema,
  boardPostReplyUpdateRequestSchema,
  boardPostReportRequestSchema,
  boardPostUpdateRequestSchema,
  boardSlugParamSchema,
  boardUpdateRequestSchema,
} from "../../schemas";
import * as blockService from "../../services/block.service";
import * as boardPostService from "../../services/board-post.service";
import * as emailService from "../../services/email.service";
import type { AuthVariables } from "../../types";
import { BoardErrorCode } from "../../types/api-responses";

export const consoleBoardsRouter = new Hono<{ Variables: AuthVariables }>()
  // Get all boards (public)
  .get("/boards", async (c) => {
    const boards = await boardPostService.getBoards();
    return c.json({ data: boards });
  })

  // Get the latest posts across all boards in one batched call.
  // Replaces the client-side N+1 fan-out from the home page.
  .get("/boards/recent-posts", optionalAuthMiddleware, async (c) => {
    const user = c.get("user");
    const blockedUserIds = user
      ? await blockService.getBlockedUserIds(user.id)
      : undefined;

    const data = await boardPostService.getRecentPostsAcrossBoards(
      5,
      blockedUserIds,
    );
    return c.json({ data });
  })

  // Create a new board (admin only)
  .post(
    "/boards",
    authMiddleware,
    zValidator("json", boardCreateRequestSchema),
    async (c) => {
      const user = c.get("user");

      // Check if user is admin
      if (!user.isAdmin) {
        return c.json(
          {
            error: {
              code: BoardErrorCode.ADMIN_ONLY,
              message: "Only admins can create boards",
            },
          },
          403,
        );
      }

      const {
        name,
        slug,
        description,
        allow_comments: allowComments,
      } = c.req.valid("json");

      const board = await boardPostService.createBoard(
        name,
        slug,
        description,
        allowComments,
      );
      return c.json({ data: board }, 201);
    },
  )

  // Get a single board by ID
  .get(
    "/boards/:board_id",
    authMiddleware,
    zValidator("param", boardIdParamSchema),
    async (c) => {
      const { board_id: boardId } = c.req.valid("param");

      const board = await boardPostService.getBoard(boardId);
      return c.json({ data: board });
    },
  )

  // Get a single board by slug (public)
  .get(
    "/board/:board_slug",
    zValidator("param", boardSlugParamSchema),
    async (c) => {
      const { board_slug: boardSlug } = c.req.valid("param");

      const board = await boardPostService.getBoardBySlug(boardSlug);
      return c.json({ data: board });
    },
  )

  // Get hashtags for a board (public)
  .get(
    "/board/:board_slug/hashtags",
    zValidator("param", boardSlugParamSchema),
    async (c) => {
      const { board_slug: boardSlug } = c.req.valid("param");

      const board = await boardPostService.getBoardBySlug(boardSlug);
      const hashtags = await boardPostService.getBoardHashtags(board.id);
      return c.json({ data: hashtags });
    },
  )

  // Update a board (admin only)
  .patch(
    "/boards/:board_id",
    authMiddleware,
    zValidator("param", boardIdParamSchema),
    zValidator("json", boardUpdateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { board_id: boardId } = c.req.valid("param");
      const {
        name,
        slug,
        description,
        allow_comments: allowComments,
      } = c.req.valid("json");

      // Check if user is admin
      if (!user.isAdmin) {
        return c.json(
          {
            error: {
              code: BoardErrorCode.ADMIN_ONLY,
              message: "Only admins can update boards",
            },
          },
          403,
        );
      }

      const board = await boardPostService.updateBoard(
        boardId,
        name,
        slug,
        description,
        allowComments,
      );
      return c.json({ data: board });
    },
  )

  // Delete a board (admin only)
  .delete(
    "/boards/:board_id",
    authMiddleware,
    zValidator("param", boardIdParamSchema),
    async (c) => {
      const user = c.get("user");
      const { board_id: boardId } = c.req.valid("param");

      // Check if user is admin
      if (!user.isAdmin) {
        return c.json(
          {
            error: {
              code: BoardErrorCode.ADMIN_ONLY,
              message: "Only admins can delete boards",
            },
          },
          403,
        );
      }

      await boardPostService.deleteBoard(boardId);
      return c.body(null, 204);
    },
  )

  // Get board posts (public, with optional auth for blocked user filtering)
  .get(
    "/board/:board_slug/posts",
    optionalAuthMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("query", boardPostQuerySchema),
    async (c) => {
      const { board_slug: boardSlug } = c.req.valid("param");
      const { limit = 20, cursor, hashtags } = c.req.valid("query");

      // Get blocked user IDs if user is authenticated
      const user = c.get("user");
      const blockedUserIds = user
        ? await blockService.getBlockedUserIds(user.id)
        : undefined;

      const board = await boardPostService.getBoardBySlug(boardSlug);
      const hashtagsArray = hashtags
        ? hashtags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
        : undefined;
      const result = await boardPostService.getBoardPosts(
        board.id,
        limit,
        cursor,
        hashtagsArray,
        blockedUserIds,
      );
      return c.json({
        data: result.data,
        pagination: {
          next_cursor: result.pagination.next_cursor,
          has_more: result.pagination.has_more,
          total_count: result.pagination.total_count,
        },
      });
    },
  )

  // Create a board post
  .post(
    "/board/:board_slug/posts",
    authMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("json", boardPostCreateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { board_slug: boardSlug } = c.req.valid("param");
      const {
        title,
        content,
        image_id: imageId,
        hashtags,
      } = c.req.valid("json");

      const board = await boardPostService.getBoardBySlug(boardSlug);
      const post = await boardPostService.createBoardPost(
        board.id,
        user.id,
        title,
        content,
        imageId,
        hashtags,
      );
      return c.json({ data: post }, 201);
    },
  )

  // Get a single board post (public)
  .get(
    "/board/:board_slug/posts/:board_post_id",
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    async (c) => {
      const { board_post_id: postId } = c.req.valid("param");

      const post = await boardPostService.getBoardPost(postId);
      return c.json({ data: post });
    },
  )

  // Update a board post
  .patch(
    "/board/:board_slug/posts/:board_post_id",
    authMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    zValidator("json", boardPostUpdateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { board_post_id: postId } = c.req.valid("param");
      const {
        title,
        content,
        image_id: imageId,
        hashtags,
      } = c.req.valid("json");

      const post = await boardPostService.updateBoardPost(
        postId,
        user.id,
        title,
        content,
        imageId,
        hashtags,
      );
      return c.json({ data: post });
    },
  )

  // Delete a board post
  .delete(
    "/board/:board_slug/posts/:board_post_id",
    authMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    async (c) => {
      const user = c.get("user");
      const { board_post_id: postId } = c.req.valid("param");

      await boardPostService.deleteBoardPost(postId, user.id);
      return c.body(null, 204);
    },
  )

  // Get replies for a board post (public, with optional auth for blocked user filtering)
  .get(
    "/board/:board_slug/posts/:board_post_id/replies",
    optionalAuthMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    zValidator("query", boardPostReplyQuerySchema),
    async (c) => {
      const { board_post_id: postId } = c.req.valid("param");
      const { limit = 20, cursor } = c.req.valid("query");

      // Get blocked user IDs if user is authenticated
      const user = c.get("user");
      const blockedUserIds = user
        ? await blockService.getBlockedUserIds(user.id)
        : undefined;

      const result = await boardPostService.getBoardPostReplies(
        postId,
        limit,
        cursor,
        blockedUserIds,
      );
      return c.json({
        data: result.data,
        pagination: {
          next_cursor: result.pagination.next_cursor,
          has_more: result.pagination.has_more,
          total_count: result.pagination.total_count,
        },
      });
    },
  )

  // Create a reply to a board post
  .post(
    "/board/:board_slug/posts/:board_post_id/replies",
    authMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    zValidator("json", boardPostReplyCreateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { board_post_id: postId } = c.req.valid("param");
      const { content, in_reply_to_id: inReplyToId } = c.req.valid("json");

      const reply = await boardPostService.createBoardPostReply(
        postId,
        user.id,
        content,
        inReplyToId,
      );
      return c.json({ data: reply }, 201);
    },
  )

  // Update a reply
  .patch(
    "/board/:board_slug/posts/:board_post_id/replies/:reply_id",
    authMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    zValidator("param", boardPostReplyIdParamSchema),
    zValidator("json", boardPostReplyUpdateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { reply_id: replyId } = c.req.valid("param");
      const { content } = c.req.valid("json");

      const reply = await boardPostService.updateBoardPostReply(
        replyId,
        user.id,
        content,
      );
      return c.json({ data: reply });
    },
  )

  // Delete a reply
  .delete(
    "/board/:board_slug/posts/:board_post_id/replies/:reply_id",
    authMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    zValidator("param", boardPostReplyIdParamSchema),
    async (c) => {
      const user = c.get("user");
      const { reply_id: replyId } = c.req.valid("param");

      await boardPostService.deleteBoardPostReply(replyId, user.id);
      return c.body(null, 204);
    },
  )

  // Report a board post
  .post(
    "/board/:board_slug/posts/:board_post_id/report",
    authMiddleware,
    zValidator("param", boardSlugParamSchema),
    zValidator("param", boardPostIdParamSchema),
    zValidator("json", boardPostReportRequestSchema),
    async (c) => {
      const user = c.get("user");
      const { board_slug: boardSlug, board_post_id: postId } = c.req.valid(
        "param",
      ) as { board_slug: string; board_post_id: string };
      const { reason } = c.req.valid("json");

      // Get the board post to report
      const post = await boardPostService.getBoardPost(postId);

      // Send abuse report email
      await emailService.sendAbuseReportEmail({
        reporterUserId: user.id,
        reporterEmail: user.email ?? undefined,
        postId: postId,
        postContent: `${post.title}\n\n${post.content}`,
        postAuthorId: post.author.id,
        postAuthorUsername: post.author.login_name,
        reason: reason,
        reportType: "board_post",
        boardSlug: boardSlug,
      });

      return c.json({ success: true });
    },
  );
