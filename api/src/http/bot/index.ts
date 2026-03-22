import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import * as postService from "../../services/post.service";

// Schema definitions
const ErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

const AuthorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  username: z.string(),
  profile_picture_url: z.string().nullable(),
});

const ImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  filename: z.string(),
});

const ReactionUserSchema = z.object({
  emoji: z.string(),
  user: z.object({
    id: z.string().uuid(),
    username: z.string(),
    name: z.string(),
  }),
});

const PostSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  author: AuthorSchema,
  images: z.array(ImageSchema),
  reactions: z.array(ReactionUserSchema),
  reply_count: z.number(),
  depth: z.number(),
  in_reply_to_id: z.string().uuid().nullable(),
  root_post_id: z.string().uuid().nullable(),
  announcement: z.boolean(),
  content_warning: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  is_bookmarked: z.boolean(),
  replies: z.array(z.unknown()),
  has_more_replies: z.boolean(),
});

const PostsResponseSchema = z.object({
  data: z.array(PostSchema),
  pagination: z.object({
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
    total_count: z.number(),
  }),
});

const SinglePostSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  author: AuthorSchema,
  images: z.array(ImageSchema),
  reactions: z.array(ReactionUserSchema),
  depth: z.number(),
  in_reply_to_id: z.string().uuid().nullable(),
  root_post_id: z.string().uuid().nullable(),
  announcement: z.boolean(),
  content_warning: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  is_bookmarked: z.boolean(),
  replies: z.array(z.unknown()),
  parent_thread: z.array(z.unknown()),
});

const SinglePostResponseSchema = z.object({
  data: SinglePostSchema,
});

const PostCreateSchema = z.object({
  content: z
    .string()
    .max(10000)
    .openapi({ description: "The content of the post" }),
  in_reply_to_id: z
    .string()
    .uuid()
    .optional()
    .openapi({ description: "ID of the post this is a reply to" }),
  content_warning: z
    .string()
    .max(500)
    .optional()
    .openapi({ description: "Content warning text" }),
});

const PostMutationResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid().optional(),
    content: z.string().optional(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    announcement: z.boolean().optional(),
    content_warning: z.string().nullable().optional(),
    in_reply_to_id: z.string().uuid().nullable().optional(),
    depth: z.number().optional(),
    author: AuthorSchema.extend({
      id: z.string().uuid().optional(),
      name: z.string().optional(),
      username: z.string().optional(),
    }),
    images: z.array(ImageSchema),
    reactions: z.array(ReactionUserSchema),
  }),
});

const ReactionCreateSchema = z.object({
  emoji: z
    .string()
    .min(1)
    .max(32)
    .openapi({ description: "Emoji to react with" }),
});

const ReactionResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    emoji: z.string(),
    message: z.string(),
  }),
});

const PostUpdateSchema = z.object({
  content: z
    .string()
    .max(10000)
    .openapi({ description: "The new content of the post" }),
  content_warning: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .openapi({ description: "Content warning text" }),
});

const MessageResponseSchema = z.object({
  message: z.string(),
});

// Route definitions
const getPostsRoute = createRoute({
  method: "get",
  path: "/communities/{communityId}/posts",
  tags: ["Posts"],
  summary: "List posts",
  description:
    "Get a list of posts in the community. Supports cursor-based pagination.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      communityId: z.string().uuid().openapi({ description: "Community ID" }),
    }),
    query: z.object({
      limit: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .optional()
        .openapi({ description: "Number of posts to return (default: 20)" }),
      cursor: z
        .string()
        .optional()
        .openapi({ description: "Cursor for pagination" }),
    }),
  },
  responses: {
    200: {
      description: "List of posts",
      content: {
        "application/json": {
          schema: PostsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Community not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const getPostRoute = createRoute({
  method: "get",
  path: "/communities/{communityId}/posts/{postId}",
  tags: ["Posts"],
  summary: "Get a post",
  description: "Get a single post by ID.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      communityId: z.string().uuid().openapi({ description: "Community ID" }),
      postId: z.string().uuid().openapi({ description: "Post ID" }),
    }),
  },
  responses: {
    200: {
      description: "Post details",
      content: {
        "application/json": {
          schema: SinglePostResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Post not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const createPostRoute = createRoute({
  method: "post",
  path: "/communities/{communityId}/posts",
  tags: ["Posts"],
  summary: "Create a post",
  description:
    "Create a new post in the community using the bot's associated profile.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      communityId: z.string().uuid().openapi({ description: "Community ID" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: PostCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Post created successfully",
      content: {
        "application/json": {
          schema: PostMutationResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Community not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

// Add reaction route
const addReactionRoute = createRoute({
  method: "post",
  path: "/communities/{communityId}/posts/{postId}/reactions",
  tags: ["Reactions"],
  summary: "Add a reaction",
  description: "Add a reaction to a post.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      communityId: z.string().uuid().openapi({ description: "Community ID" }),
      postId: z.string().uuid().openapi({ description: "Post ID" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: ReactionCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Reaction added successfully",
      content: {
        "application/json": {
          schema: ReactionResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid request or reaction already exists",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Post not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

// Remove reaction route
const removeReactionRoute = createRoute({
  method: "delete",
  path: "/communities/{communityId}/posts/{postId}/reactions/{emoji}",
  tags: ["Reactions"],
  summary: "Remove a reaction",
  description: "Remove a reaction from a post.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      communityId: z.string().uuid().openapi({ description: "Community ID" }),
      postId: z.string().uuid().openapi({ description: "Post ID" }),
      emoji: z.string().openapi({ description: "Emoji to remove" }),
    }),
  },
  responses: {
    200: {
      description: "Reaction removed successfully",
      content: {
        "application/json": {
          schema: MessageResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Post or reaction not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

// Update post route
const updatePostRoute = createRoute({
  method: "put",
  path: "/communities/{communityId}/posts/{postId}",
  tags: ["Posts"],
  summary: "Update a post",
  description:
    "Update a post created by the bot. Only the bot's own posts can be updated.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      communityId: z.string().uuid().openapi({ description: "Community ID" }),
      postId: z.string().uuid().openapi({ description: "Post ID" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: PostUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Post updated successfully",
      content: {
        "application/json": {
          schema: PostMutationResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    403: {
      description: "Cannot update posts created by others",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Post not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

// Delete post route
const deletePostRoute = createRoute({
  method: "delete",
  path: "/communities/{communityId}/posts/{postId}",
  tags: ["Posts"],
  summary: "Delete a post",
  description:
    "Delete a post created by the bot. Only the bot's own posts can be deleted.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      communityId: z.string().uuid().openapi({ description: "Community ID" }),
      postId: z.string().uuid().openapi({ description: "Post ID" }),
    }),
  },
  responses: {
    200: {
      description: "Post deleted successfully",
      content: {
        "application/json": {
          schema: MessageResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    403: {
      description: "Cannot delete posts created by others",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Post not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

// Create the OpenAPI Hono app
export const botApiRouter = new OpenAPIHono();

// Register security scheme
botApiRouter.openAPIRegistry.registerComponent(
  "securitySchemes",
  "bearerAuth",
  {
    type: "http",
    scheme: "bearer",
    description: "Bot API token",
  },
);

botApiRouter
  // Get posts
  .openapi(getPostsRoute, async (c) => {
    // Apply bot auth middleware manually since OpenAPIHono doesn't chain well with middleware
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid Authorization header",
          },
        },
        401,
      );
    }

    const token = authHeader.substring(7);
    const { validateBotToken, getCommunityById } = await import(
      "../../services/bot.service"
    );
    const botResult = await validateBotToken(token);

    if (!botResult) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired bot token",
          },
        },
        401,
      );
    }

    const { communityId } = c.req.valid("param");
    if (communityId !== botResult.communityId) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Bot does not have access to this community",
          },
        },
        403,
      );
    }

    const community = await getCommunityById(communityId);
    if (!community) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Community not found" } },
        404,
      );
    }

    const { limit = 20, cursor } = c.req.valid("query");

    const result = await postService.getPosts(
      communityId,
      limit,
      cursor,
      botResult.profileId,
    );

    return c.json(result, 200);
  })

  // Get single post
  .openapi(getPostRoute, async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid Authorization header",
          },
        },
        401,
      );
    }

    const token = authHeader.substring(7);
    const { validateBotToken, getCommunityById } = await import(
      "../../services/bot.service"
    );
    const botResult = await validateBotToken(token);

    if (!botResult) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired bot token",
          },
        },
        401,
      );
    }

    const { communityId, postId } = c.req.valid("param");
    if (communityId !== botResult.communityId) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Bot does not have access to this community",
          },
        },
        403,
      );
    }

    const community = await getCommunityById(communityId);
    if (!community) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Community not found" } },
        404,
      );
    }

    try {
      const post = await postService.getPost(
        postId,
        communityId,
        botResult.profileId,
      );
      return c.json({ data: post }, 200);
    } catch {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Post not found" } },
        404,
      );
    }
  })

  // Create post
  .openapi(createPostRoute, async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid Authorization header",
          },
        },
        401,
      );
    }

    const token = authHeader.substring(7);
    const { validateBotToken, getCommunityById } = await import(
      "../../services/bot.service"
    );
    const botResult = await validateBotToken(token);

    if (!botResult) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired bot token",
          },
        },
        401,
      );
    }

    const { communityId } = c.req.valid("param");
    if (communityId !== botResult.communityId) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Bot does not have access to this community",
          },
        },
        403,
      );
    }

    const community = await getCommunityById(communityId);
    if (!community) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Community not found" } },
        404,
      );
    }

    const { content, in_reply_to_id, content_warning } = c.req.valid("json");

    const result = await postService.createPost(
      botResult.createdByUserId,
      botResult.profileId,
      communityId,
      content,
      in_reply_to_id || null,
      [], // No image support for bots initially
      false, // Bots cannot create announcements
      content_warning || null,
      null, // No scheduled posts for bots
      community.startsAt,
      community.endsAt,
    );

    return c.json({ data: result }, 201);
  })

  // Add reaction
  .openapi(addReactionRoute, async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid Authorization header",
          },
        },
        401,
      );
    }

    const token = authHeader.substring(7);
    const { validateBotToken, getCommunityById } = await import(
      "../../services/bot.service"
    );
    const botResult = await validateBotToken(token);

    if (!botResult) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired bot token",
          },
        },
        401,
      );
    }

    const { communityId, postId } = c.req.valid("param");
    if (communityId !== botResult.communityId) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Bot does not have access to this community",
          },
        },
        403,
      );
    }

    const community = await getCommunityById(communityId);
    if (!community) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Community not found" } },
        404,
      );
    }

    const { emoji } = c.req.valid("json");

    try {
      const result = await postService.createReaction(
        botResult.profileId,
        postId,
        communityId,
        emoji,
        botResult.profileName,
      );
      return c.json({ data: result }, 201);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("이미 존재")) {
          return c.json(
            { error: { code: "BAD_REQUEST", message: error.message } },
            400,
          );
        }
        if (error.message.includes("찾을 수 없")) {
          return c.json(
            { error: { code: "NOT_FOUND", message: error.message } },
            404,
          );
        }
      }
      throw error;
    }
  })

  // Remove reaction
  .openapi(removeReactionRoute, async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid Authorization header",
          },
        },
        401,
      );
    }

    const token = authHeader.substring(7);
    const { validateBotToken, getCommunityById } = await import(
      "../../services/bot.service"
    );
    const botResult = await validateBotToken(token);

    if (!botResult) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired bot token",
          },
        },
        401,
      );
    }

    const { communityId, postId, emoji } = c.req.valid("param");
    if (communityId !== botResult.communityId) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Bot does not have access to this community",
          },
        },
        403,
      );
    }

    const community = await getCommunityById(communityId);
    if (!community) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Community not found" } },
        404,
      );
    }

    try {
      await postService.deleteReaction(
        botResult.profileId,
        postId,
        communityId,
        decodeURIComponent(emoji),
      );
      return c.json({ message: "Reaction removed successfully" }, 200);
    } catch (error) {
      if (error instanceof Error && error.message.includes("찾을 수 없")) {
        return c.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          404,
        );
      }
      throw error;
    }
  })

  // Update post
  .openapi(updatePostRoute, async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid Authorization header",
          },
        },
        401,
      );
    }

    const token = authHeader.substring(7);
    const { validateBotToken, getCommunityById } = await import(
      "../../services/bot.service"
    );
    const botResult = await validateBotToken(token);

    if (!botResult) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired bot token",
          },
        },
        401,
      );
    }

    const { communityId, postId } = c.req.valid("param");
    if (communityId !== botResult.communityId) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Bot does not have access to this community",
          },
        },
        403,
      );
    }

    const community = await getCommunityById(communityId);
    if (!community) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Community not found" } },
        404,
      );
    }

    const { content, content_warning } = c.req.valid("json");

    try {
      const result = await postService.updatePost(
        botResult.createdByUserId,
        botResult.profileId,
        postId,
        communityId,
        content,
        undefined, // No image updates for bots
        content_warning,
        undefined, // Bots cannot change announcement status
        "member", // Bot has member role (cannot set announcements)
      );
      return c.json({ data: result }, 200);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("본인의 게시물만")) {
          return c.json(
            { error: { code: "FORBIDDEN", message: error.message } },
            403,
          );
        }
        if (error.message.includes("찾을 수 없")) {
          return c.json(
            { error: { code: "NOT_FOUND", message: error.message } },
            404,
          );
        }
      }
      throw error;
    }
  })

  // Delete post
  .openapi(deletePostRoute, async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid Authorization header",
          },
        },
        401,
      );
    }

    const token = authHeader.substring(7);
    const { validateBotToken, getCommunityById } = await import(
      "../../services/bot.service"
    );
    const botResult = await validateBotToken(token);

    if (!botResult) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired bot token",
          },
        },
        401,
      );
    }

    const { communityId, postId } = c.req.valid("param");
    if (communityId !== botResult.communityId) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Bot does not have access to this community",
          },
        },
        403,
      );
    }

    const community = await getCommunityById(communityId);
    if (!community) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Community not found" } },
        404,
      );
    }

    try {
      await postService.deletePost(
        botResult.createdByUserId,
        botResult.profileId,
        postId,
        communityId,
      );
      return c.json({ message: "Post deleted successfully" }, 200);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only the post author")) {
          return c.json(
            {
              error: {
                code: "FORBIDDEN",
                message: "Cannot delete posts created by others",
              },
            },
            403,
          );
        }
        if (error.message.includes("찾을 수 없")) {
          return c.json(
            { error: { code: "NOT_FOUND", message: error.message } },
            404,
          );
        }
      }
      throw error;
    }
  });

// OpenAPI documentation endpoint - registered separately
botApiRouter.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "커뮹! 봇 API",
    version: "1.0.0",
    description:
      "API for bots to interact with Commu communities. Bots can read and create posts.",
  },
  servers: [
    {
      url: "/bot",
      description: "봇 API",
    },
  ],
});

// Swagger UI for human-readable documentation
botApiRouter.get("/docs", swaggerUI({ url: "/bot/openapi.json" }));
