import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm";
import { db } from "../db";
import {
  board as boardTable,
  boardHashtag as boardHashtagTable,
  boardPost as boardPostTable,
  boardPostHashtag as boardPostHashtagTable,
  boardPostReply as boardPostReplyTable,
  image as imageTable,
  user as userTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { BoardErrorCode } from "../types/api-responses";
import { addImageUrl } from "../utils/r2";
import { pushNotificationService } from "./push-notification.service";

/**
 * Get all boards
 */
export async function getBoards() {
  const boards = await db.query.board.findMany({
    where: isNull(boardTable.deletedAt),
    orderBy: [asc(boardTable.createdAt)],
  });

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    slug: board.slug,
    description: board.description,
    allow_comments: board.allowComments,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  }));
}

/**
 * Get the latest N posts for each board in a single round trip.
 * Boards are returned in canonical order; each entry carries up to perBoardLimit posts.
 */
export async function getRecentPostsAcrossBoards(
  perBoardLimit: number = 5,
  blockedUserIds?: string[],
) {
  const boards = await getBoards();

  const postsPerBoard = await Promise.all(
    boards.map((board) =>
      getBoardPosts(
        board.id,
        perBoardLimit,
        undefined,
        undefined,
        blockedUserIds,
      ),
    ),
  );

  return boards.map((board, i) => ({
    board,
    posts: postsPerBoard[i]?.data ?? [],
  }));
}

/**
 * Get a single board by ID
 */
export async function getBoard(boardId: string) {
  const board = await db.query.board.findFirst({
    where: and(eq(boardTable.id, boardId), isNull(boardTable.deletedAt)),
  });

  if (!board) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  return {
    id: board.id,
    name: board.name,
    slug: board.slug,
    description: board.description,
    allow_comments: board.allowComments,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  };
}

/**
 * Get a single board by slug
 */
export async function getBoardBySlug(slug: string) {
  const board = await db.query.board.findFirst({
    where: and(eq(boardTable.slug, slug), isNull(boardTable.deletedAt)),
  });

  if (!board) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  return {
    id: board.id,
    name: board.name,
    slug: board.slug,
    description: board.description,
    allow_comments: board.allowComments,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  };
}

/**
 * Create a new board
 */
export async function createBoard(
  name: string,
  slug: string,
  description: string | null | undefined,
  allowComments: boolean = true,
) {
  // Check if slug already exists
  const existingBoard = await db.query.board.findFirst({
    where: eq(boardTable.slug, slug),
  });

  if (existingBoard) {
    throw new AppException(
      409,
      BoardErrorCode.DUPLICATE_BOARD_SLUG,
      "Board slug already exists",
    );
  }

  const newBoardResult = await db
    .insert(boardTable)
    .values({
      name,
      slug,
      description: description || null,
      allowComments,
    })
    .returning();

  const newBoard = newBoardResult[0];
  if (!newBoard) {
    throw new Error("Failed to create board");
  }

  return {
    id: newBoard.id,
    name: newBoard.name,
    slug: newBoard.slug,
    description: newBoard.description,
    allow_comments: newBoard.allowComments,
    created_at: newBoard.createdAt,
    updated_at: newBoard.updatedAt,
  };
}

/**
 * Update a board
 */
export async function updateBoard(
  boardId: string,
  name: string,
  slug: string,
  description: string | null | undefined,
  allowComments?: boolean,
) {
  // Check if board exists
  const board = await db.query.board.findFirst({
    where: and(eq(boardTable.id, boardId), isNull(boardTable.deletedAt)),
  });

  if (!board) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  // Check if slug is taken by another board
  if (slug !== board.slug) {
    const existingBoard = await db.query.board.findFirst({
      where: eq(boardTable.slug, slug),
    });

    if (existingBoard && existingBoard.id !== boardId) {
      throw new AppException(
        409,
        BoardErrorCode.DUPLICATE_BOARD_SLUG,
        "Board slug already exists",
      );
    }
  }

  const updateData: Record<string, unknown> = {
    name,
    slug,
    description: description || null,
    updatedAt: sql`NOW()`,
  };

  if (allowComments !== undefined) {
    updateData.allowComments = allowComments;
  }

  const updatedBoardResult = await db
    .update(boardTable)
    .set(updateData)
    .where(eq(boardTable.id, boardId))
    .returning();

  const updatedBoard = updatedBoardResult[0];
  if (!updatedBoard) {
    throw new Error("Failed to update board");
  }

  return {
    id: updatedBoard.id,
    name: updatedBoard.name,
    slug: updatedBoard.slug,
    description: updatedBoard.description,
    allow_comments: updatedBoard.allowComments,
    created_at: updatedBoard.createdAt,
    updated_at: updatedBoard.updatedAt,
  };
}

/**
 * Delete a board
 */
export async function deleteBoard(boardId: string) {
  const board = await db.query.board.findFirst({
    where: and(eq(boardTable.id, boardId), isNull(boardTable.deletedAt)),
  });

  if (!board) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  await db
    .update(boardTable)
    .set({
      deletedAt: sql`NOW()`,
    })
    .where(eq(boardTable.id, boardId));
}

/**
 * Get board posts with pagination
 */
export async function getBoardPosts(
  boardId: string | undefined,
  limit: number = 20,
  cursor?: string,
  hashtags?: string[],
  blockedUserIds?: string[],
) {
  // Build base conditions (without cursor) for count query
  const baseConditions = [isNull(boardPostTable.deletedAt)];

  if (boardId) {
    baseConditions.push(eq(boardPostTable.boardId, boardId));
  }

  // Filter out posts from blocked users
  if (blockedUserIds && blockedUserIds.length > 0) {
    baseConditions.push(notInArray(boardPostTable.authorId, blockedUserIds));
  }

  // If hashtags filter is provided, filter posts that have ALL of the hashtags (AND logic)
  if (hashtags && hashtags.length > 0) {
    const normalizedHashtags = hashtags.map((tag) => tag.toLowerCase().trim());
    const postIdsWithAllHashtags = db
      .select({ postId: boardPostHashtagTable.boardPostId })
      .from(boardPostHashtagTable)
      .innerJoin(
        boardHashtagTable,
        eq(boardPostHashtagTable.hashtagId, boardHashtagTable.id),
      )
      .where(inArray(boardHashtagTable.tag, normalizedHashtags))
      .groupBy(boardPostHashtagTable.boardPostId)
      .having(
        sql`COUNT(DISTINCT ${boardHashtagTable.id}) = ${normalizedHashtags.length}`,
      );

    baseConditions.push(inArray(boardPostTable.id, postIdsWithAllHashtags));
  }

  // Build query conditions (with cursor)
  const queryConditions = [...baseConditions];
  if (cursor) {
    queryConditions.push(sql`${boardPostTable.id} < ${cursor}`);
  }

  // Run count and data queries in parallel
  const [posts, totalCountResult] = await Promise.all([
    db
      .select()
      .from(boardPostTable)
      .leftJoin(userTable, eq(boardPostTable.authorId, userTable.id))
      .leftJoin(boardTable, eq(boardPostTable.boardId, boardTable.id))
      .where(and(...queryConditions))
      .orderBy(desc(boardPostTable.id))
      .limit(limit + 1),
    db
      .select({ count: count() })
      .from(boardPostTable)
      .where(and(...baseConditions)),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;

  // Check if there are more results
  const hasMore = posts.length > limit;
  const postsToReturn = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor =
    hasMore && postsToReturn.length > 0
      ? postsToReturn[postsToReturn.length - 1]?.board_post?.id || null
      : null;

  // Collect all post IDs for batch loading hashtags and images
  const postIds = postsToReturn
    .map((row) => row.board_post?.id)
    .filter((id): id is string => id !== undefined && id !== null);

  const imageIds = postsToReturn
    .map((row) => row.board_post?.imageId)
    .filter((id): id is string => id !== undefined && id !== null);

  // Batch load hashtags and images
  const allHashtags =
    postIds.length > 0
      ? await db.query.boardPostHashtag.findMany({
          where: inArray(boardPostHashtagTable.boardPostId, postIds),
          with: {
            hashtag: true,
          },
        })
      : [];

  const allImages =
    imageIds.length > 0
      ? await db.query.image.findMany({
          where: inArray(imageTable.id, imageIds),
        })
      : [];

  // Batch load reply counts grouped by post
  const replyCountRows =
    postIds.length > 0
      ? await db
          .select({
            postId: boardPostReplyTable.boardPostId,
            count: count(),
          })
          .from(boardPostReplyTable)
          .where(
            and(
              inArray(boardPostReplyTable.boardPostId, postIds),
              isNull(boardPostReplyTable.deletedAt),
            ),
          )
          .groupBy(boardPostReplyTable.boardPostId)
      : [];
  const replyCountByPostId = new Map(
    replyCountRows.map((r) => [r.postId, Number(r.count)]),
  );

  // Group hashtags by post ID
  const hashtagsByPostId = new Map<string, typeof allHashtags>();
  allHashtags.forEach((h) => {
    if (!hashtagsByPostId.has(h.boardPostId)) {
      hashtagsByPostId.set(h.boardPostId, []);
    }
    hashtagsByPostId.get(h.boardPostId)?.push(h);
  });

  // Create image map
  const imageMap = new Map(allImages.map((img) => [img.id, img]));

  // Build result
  const result = postsToReturn
    .map((row) => {
      const post = row.board_post;
      const author = row.user;
      const board = row.board;

      if (!post || !author || !board) return null;

      const hashtags = hashtagsByPostId.get(post.id) || [];
      const image = post.imageId ? imageMap.get(post.imageId) : null;

      return {
        id: post.id,
        board: {
          id: board.id,
          name: board.name,
          slug: board.slug,
          allow_comments: board.allowComments,
        },
        title: post.title,
        content: post.content,
        image: image
          ? {
              id: image.id,
              url: addImageUrl(image).url,
              width: image.width,
              height: image.height,
              filename: image.filename,
            }
          : null,
        hashtags: hashtags.map((h) => ({
          id: h.hashtag.id,
          tag: h.hashtag.tag,
        })),
        author: {
          id: author.id,
          login_name: author.loginName,
        },
        reply_count: replyCountByPostId.get(post.id) ?? 0,
        created_at: post.createdAt,
        updated_at: post.updatedAt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    data: result,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: totalCount,
    },
  };
}

/**
 * Get a single board post
 */
export async function getBoardPost(postId: string) {
  const post = await db.query.boardPost.findFirst({
    where: and(eq(boardPostTable.id, postId), isNull(boardPostTable.deletedAt)),
    with: {
      user: true,
      image: true,
    },
  });

  if (!post) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_POST_NOT_FOUND,
      "Board post not found",
    );
  }

  // Get hashtags
  const hashtags = await db.query.boardPostHashtag.findMany({
    where: eq(boardPostHashtagTable.boardPostId, postId),
    with: {
      hashtag: true,
    },
  });

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    image: post.image
      ? {
          id: post.image.id,
          url: addImageUrl(post.image).url,
          width: post.image.width,
          height: post.image.height,
          filename: post.image.filename,
        }
      : null,
    hashtags: hashtags.map((h) => ({
      id: h.hashtag.id,
      tag: h.hashtag.tag,
    })),
    author: {
      id: post.user.id,
      login_name: post.user.loginName,
    },
    created_at: post.createdAt,
    updated_at: post.updatedAt,
  };
}

/**
 * Create a board post
 */
export async function createBoardPost(
  boardId: string,
  authorId: string,
  title: string,
  content: string,
  imageId: string | null | undefined,
  hashtags: string[] | undefined,
) {
  // Validate board exists
  const board = await db.query.board.findFirst({
    where: and(eq(boardTable.id, boardId), isNull(boardTable.deletedAt)),
  });

  if (!board) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_NOT_FOUND,
      "Board not found",
    );
  }

  // Validate user exists
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, authorId),
  });

  if (!user) {
    throw new AppException(404, BoardErrorCode.UNAUTHORIZED, "User not found");
  }

  // Validate image if provided
  if (imageId) {
    const image = await db.query.image.findFirst({
      where: and(eq(imageTable.id, imageId), isNull(imageTable.deletedAt)),
    });

    if (!image) {
      throw new AppException(
        400,
        BoardErrorCode.INVALID_IMAGE,
        "Invalid image",
      );
    }
  }

  // Create post in a transaction
  const result = await db.transaction(async (tx) => {
    // Create the post
    const newPostResult = await tx
      .insert(boardPostTable)
      .values({
        boardId,
        authorId,
        title,
        content,
        imageId: imageId || null,
      })
      .returning();

    const newPost = newPostResult[0];
    if (!newPost) {
      throw new Error("Failed to create board post");
    }

    // Handle hashtags
    if (hashtags && hashtags.length > 0) {
      // Get or create hashtags
      const hashtagRecords = await Promise.all(
        hashtags.map(async (tag) => {
          const normalizedTag = tag.toLowerCase().trim();

          // Try to find existing hashtag
          const existing = await tx.query.boardHashtag.findFirst({
            where: eq(boardHashtagTable.tag, normalizedTag),
          });

          if (existing) {
            return existing;
          }

          // Create new hashtag
          const newHashtagResult = await tx
            .insert(boardHashtagTable)
            .values({ tag: normalizedTag })
            .returning();

          return newHashtagResult[0];
        }),
      );

      // Link hashtags to post
      const hashtagLinks = hashtagRecords
        .filter(
          (h): h is NonNullable<typeof h> => h !== null && h !== undefined,
        )
        .map((hashtag) => ({
          boardPostId: newPost.id,
          hashtagId: hashtag.id,
        }));

      if (hashtagLinks.length > 0) {
        await tx.insert(boardPostHashtagTable).values(hashtagLinks);
      }
    }

    return newPost;
  });

  // Get the created post with all relations
  return getBoardPost(result.id);
}

/**
 * Update a board post
 */
export async function updateBoardPost(
  postId: string,
  authorId: string,
  title: string,
  content: string,
  imageId: string | null | undefined,
  hashtags: string[] | undefined,
) {
  // Check if post exists
  const post = await db.query.boardPost.findFirst({
    where: and(eq(boardPostTable.id, postId), isNull(boardPostTable.deletedAt)),
  });

  if (!post) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_POST_NOT_FOUND,
      "Board post not found",
    );
  }

  // Check if user is the author
  if (post.authorId !== authorId) {
    throw new AppException(
      403,
      BoardErrorCode.NOT_POST_AUTHOR,
      "Only the author can modify this post",
    );
  }

  // Validate image if provided
  if (imageId) {
    const image = await db.query.image.findFirst({
      where: and(eq(imageTable.id, imageId), isNull(imageTable.deletedAt)),
    });

    if (!image) {
      throw new AppException(
        400,
        BoardErrorCode.INVALID_IMAGE,
        "Invalid image",
      );
    }
  }

  // Update post in a transaction
  await db.transaction(async (tx) => {
    // Update the post
    await tx
      .update(boardPostTable)
      .set({
        title,
        content,
        imageId: imageId || null,
        updatedAt: sql`NOW()`,
      })
      .where(eq(boardPostTable.id, postId));

    // Delete existing hashtags
    await tx
      .delete(boardPostHashtagTable)
      .where(eq(boardPostHashtagTable.boardPostId, postId));

    // Handle new hashtags
    if (hashtags && hashtags.length > 0) {
      // Get or create hashtags
      const hashtagRecords = await Promise.all(
        hashtags.map(async (tag) => {
          const normalizedTag = tag.toLowerCase().trim();

          // Try to find existing hashtag
          const existing = await tx.query.boardHashtag.findFirst({
            where: eq(boardHashtagTable.tag, normalizedTag),
          });

          if (existing) {
            return existing;
          }

          // Create new hashtag
          const newHashtagResult = await tx
            .insert(boardHashtagTable)
            .values({ tag: normalizedTag })
            .returning();

          return newHashtagResult[0];
        }),
      );

      // Link hashtags to post
      const hashtagLinks = hashtagRecords
        .filter(
          (h): h is NonNullable<typeof h> => h !== null && h !== undefined,
        )
        .map((hashtag) => ({
          boardPostId: postId,
          hashtagId: hashtag.id,
        }));

      if (hashtagLinks.length > 0) {
        await tx.insert(boardPostHashtagTable).values(hashtagLinks);
      }
    }
  });

  // Get the updated post
  return getBoardPost(postId);
}

/**
 * Delete a board post
 */
export async function deleteBoardPost(postId: string, userId: string) {
  const post = await db.query.boardPost.findFirst({
    where: and(eq(boardPostTable.id, postId), isNull(boardPostTable.deletedAt)),
  });

  if (!post) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_POST_NOT_FOUND,
      "Board post not found",
    );
  }

  // Check if user is the author or admin
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
  });

  if (!user) {
    throw new AppException(404, BoardErrorCode.UNAUTHORIZED, "User not found");
  }

  // Only author or admin can delete
  if (post.authorId !== userId && !user.isAdmin) {
    throw new AppException(
      403,
      BoardErrorCode.FORBIDDEN,
      "Only the author or admin can delete this post",
    );
  }

  // Soft-delete the post with deletion reason
  await db
    .update(boardPostTable)
    .set({
      deletedAt: sql`NOW()`,
      deletionReason: "author",
    })
    .where(eq(boardPostTable.id, postId));

  // Cascade delete all replies for this post
  await db
    .update(boardPostReplyTable)
    .set({
      deletedAt: sql`NOW()`,
      deletionReason: "cascade",
    })
    .where(
      and(
        eq(boardPostReplyTable.boardPostId, postId),
        isNull(boardPostReplyTable.deletedAt),
      ),
    );
}

/**
 * Get top hashtags for a board
 */
export async function getBoardHashtags(boardId: string, limit: number = 30) {
  // Get all hashtags used in non-deleted posts for this board
  const hashtags = await db
    .select({
      tag: boardHashtagTable.tag,
      count:
        sql<number>`count(distinct ${boardPostHashtagTable.boardPostId})`.as(
          "count",
        ),
    })
    .from(boardHashtagTable)
    .innerJoin(
      boardPostHashtagTable,
      eq(boardHashtagTable.id, boardPostHashtagTable.hashtagId),
    )
    .innerJoin(
      boardPostTable,
      and(
        eq(boardPostHashtagTable.boardPostId, boardPostTable.id),
        eq(boardPostTable.boardId, boardId),
        isNull(boardPostTable.deletedAt),
      ),
    )
    .groupBy(boardHashtagTable.id, boardHashtagTable.tag)
    .orderBy(desc(sql`count`))
    .limit(limit);

  return hashtags.map((h) => h.tag);
}

/**
 * Helper to build nested reply tree
 */
function buildReplyTree(
  replies: {
    id: string;
    content: string;
    inReplyToId: string | null;
    depth: number;
    authorId: string;
    authorLoginName: string;
    created_at: string;
    updated_at: string;
  }[],
) {
  const replyMap = new Map<string, unknown>();
  const rootReplies: unknown[] = [];

  // First pass: create all reply objects
  replies.forEach((reply) => {
    const replyObj = {
      id: reply.id,
      content: reply.content,
      depth: reply.depth,
      author: {
        id: reply.authorId,
        login_name: reply.authorLoginName,
      },
      created_at: reply.created_at,
      updated_at: reply.updated_at,
      replies: [] as unknown[],
    };
    replyMap.set(reply.id, replyObj);
  });

  // Second pass: build tree structure
  replies.forEach((reply) => {
    const replyObj = replyMap.get(reply.id);
    if (reply.inReplyToId) {
      const parent = replyMap.get(reply.inReplyToId);
      if (parent && typeof parent === "object" && "replies" in parent) {
        (parent.replies as unknown[]).push(replyObj);
      }
    } else {
      rootReplies.push(replyObj);
    }
  });

  return rootReplies;
}

/**
 * Get replies for a board post with nested structure
 */
export async function getBoardPostReplies(
  boardPostId: string,
  limit: number = 20,
  cursor?: string,
  blockedUserIds?: string[],
) {
  // Validate post exists
  const post = await db.query.boardPost.findFirst({
    where: and(
      eq(boardPostTable.id, boardPostId),
      isNull(boardPostTable.deletedAt),
    ),
    with: {
      board: true,
    },
  });

  if (!post) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_POST_NOT_FOUND,
      "Board post not found",
    );
  }

  // Check if comments are allowed on this board
  if (!post.board.allowComments) {
    throw new AppException(
      403,
      BoardErrorCode.FORBIDDEN,
      "Comments are disabled for this board",
    );
  }

  // Get top-level replies (depth 0) with pagination
  // Build base conditions (without cursor) for count query
  const baseConditions = [
    eq(boardPostReplyTable.boardPostId, boardPostId),
    eq(boardPostReplyTable.depth, 0),
    isNull(boardPostReplyTable.deletedAt),
  ];

  // Filter out replies from blocked users
  if (blockedUserIds && blockedUserIds.length > 0) {
    baseConditions.push(
      notInArray(boardPostReplyTable.authorId, blockedUserIds),
    );
  }

  // Build query conditions (with cursor)
  const queryConditions = [...baseConditions];
  if (cursor) {
    queryConditions.push(gt(boardPostReplyTable.id, cursor));
  }

  // Run count and data queries in parallel
  const [topLevelReplies, totalCountResult] = await Promise.all([
    db
      .select()
      .from(boardPostReplyTable)
      .leftJoin(userTable, eq(boardPostReplyTable.authorId, userTable.id))
      .where(and(...queryConditions))
      .orderBy(asc(boardPostReplyTable.id))
      .limit(limit + 1),
    db
      .select({ count: count() })
      .from(boardPostReplyTable)
      .where(and(...baseConditions)),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;
  const hasMore = topLevelReplies.length > limit;
  const repliesToReturn = hasMore
    ? topLevelReplies.slice(0, limit)
    : topLevelReplies;
  const nextCursor =
    hasMore && repliesToReturn.length > 0
      ? repliesToReturn[repliesToReturn.length - 1]?.board_post_reply?.id ||
        null
      : null;

  // Get all nested replies for these top-level replies
  const topLevelIds = repliesToReturn
    .map((r) => r.board_post_reply?.id)
    .filter((id): id is string => id !== undefined && id !== null);

  if (topLevelIds.length === 0) {
    return {
      data: [],
      pagination: {
        next_cursor: null,
        has_more: false,
        total_count: totalCount,
      },
    };
  }

  // Get all nested replies (depth > 0) for these top-level replies
  const nestedRepliesConditions = [
    inArray(boardPostReplyTable.rootReplyId, topLevelIds),
    isNull(boardPostReplyTable.deletedAt),
  ];

  // Filter out nested replies from blocked users
  if (blockedUserIds && blockedUserIds.length > 0) {
    nestedRepliesConditions.push(
      notInArray(boardPostReplyTable.authorId, blockedUserIds),
    );
  }

  const nestedReplies = await db
    .select()
    .from(boardPostReplyTable)
    .leftJoin(userTable, eq(boardPostReplyTable.authorId, userTable.id))
    .where(and(...nestedRepliesConditions))
    .orderBy(boardPostReplyTable.createdAt);

  // Combine all replies
  const allReplies = [
    ...repliesToReturn.map((r) => ({
      id: r.board_post_reply?.id || "",
      content: r.board_post_reply?.content || "",
      inReplyToId: r.board_post_reply?.inReplyToId,
      depth: r.board_post_reply?.depth || 0,
      authorId: r.user?.id || "",
      authorLoginName: r.user?.loginName || "",
      created_at: r.board_post_reply?.createdAt || "",
      updated_at: r.board_post_reply?.updatedAt || "",
    })),
    ...nestedReplies.map((r) => ({
      id: r.board_post_reply?.id || "",
      content: r.board_post_reply?.content || "",
      inReplyToId: r.board_post_reply?.inReplyToId,
      depth: r.board_post_reply?.depth || 0,
      authorId: r.user?.id || "",
      authorLoginName: r.user?.loginName || "",
      created_at: r.board_post_reply?.createdAt || "",
      updated_at: r.board_post_reply?.updatedAt || "",
    })),
  ];

  const tree = buildReplyTree(allReplies);

  return {
    data: tree,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: totalCount,
    },
  };
}

/**
 * Create a reply to a board post
 */
export async function createBoardPostReply(
  boardPostId: string,
  authorId: string,
  content: string,
  inReplyToId?: string,
) {
  // Validate post exists and get board info
  const post = await db.query.boardPost.findFirst({
    where: and(
      eq(boardPostTable.id, boardPostId),
      isNull(boardPostTable.deletedAt),
    ),
    with: {
      board: true,
    },
  });

  if (!post) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_POST_NOT_FOUND,
      "Board post not found",
    );
  }

  // Check if comments are allowed
  if (!post.board.allowComments) {
    throw new AppException(
      403,
      BoardErrorCode.FORBIDDEN,
      "Comments are disabled for this board",
    );
  }

  // Validate user exists
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, authorId),
  });

  if (!user) {
    throw new AppException(404, BoardErrorCode.UNAUTHORIZED, "User not found");
  }

  let depth = 0;
  let rootReplyId: string | null = null;

  // If replying to another reply, calculate depth and rootReplyId
  if (inReplyToId) {
    const parentReply = await db.query.boardPostReply.findFirst({
      where: and(
        eq(boardPostReplyTable.id, inReplyToId),
        isNull(boardPostReplyTable.deletedAt),
      ),
    });

    if (!parentReply) {
      throw new AppException(
        404,
        BoardErrorCode.BOARD_POST_NOT_FOUND,
        "Parent reply not found",
      );
    }

    // Validate parent belongs to same post
    if (parentReply.boardPostId !== boardPostId) {
      throw new AppException(
        400,
        BoardErrorCode.INVALID_REQUEST,
        "Parent reply does not belong to this post",
      );
    }

    depth = parentReply.depth + 1;
    rootReplyId =
      parentReply.depth === 0 ? parentReply.id : parentReply.rootReplyId;
  }

  // Create the reply
  const newReplyResult = await db
    .insert(boardPostReplyTable)
    .values({
      boardPostId,
      authorId,
      content,
      inReplyToId: inReplyToId || null,
      depth,
      rootReplyId,
    })
    .returning();

  const newReply = newReplyResult[0];
  if (!newReply) {
    throw new Error("Failed to create reply");
  }

  // Send push notification for direct comments on post (depth 0 only)
  if (!inReplyToId && depth === 0 && post.authorId !== authorId) {
    await pushNotificationService.sendPushNotification(post.authorId, {
      title: "새로운 댓글",
      body: `${user.loginName}님이 회원님의 게시글에 댓글을 작성했습니다`,
      data: {
        type: "board_post_comment",
        board_post_id: boardPostId,
        reply_id: newReply.id,
        board_slug: post.board.slug || post.board.id,
        url: `https://${process.env.BASE_DOMAIN || "commu.ng"}/boards/${post.board.slug || post.board.id}/posts/${boardPostId}`,
      },
    });
  }

  // Send push notification for direct replies (any depth)
  if (inReplyToId) {
    const parentReply = await db.query.boardPostReply.findFirst({
      where: eq(boardPostReplyTable.id, inReplyToId),
      columns: {
        authorId: true,
      },
    });

    // Only send if not replying to own comment
    if (parentReply && parentReply.authorId !== authorId) {
      await pushNotificationService.sendPushNotification(parentReply.authorId, {
        title: "새로운 답글",
        body: `${user.loginName}님이 회원님의 댓글에 답글을 작성했습니다`,
        data: {
          type: "board_post_reply",
          board_post_id: boardPostId,
          reply_id: newReply.id,
          board_slug: post.board.slug || post.board.id,
          url: `https://${process.env.BASE_DOMAIN || "commu.ng"}/boards/${post.board.slug || post.board.id}/posts/${boardPostId}`,
        },
      });
    }
  }

  return {
    id: newReply.id,
    content: newReply.content,
    depth: newReply.depth,
    in_reply_to_id: newReply.inReplyToId,
    author: {
      id: user.id,
      login_name: user.loginName,
    },
    created_at: newReply.createdAt,
    updated_at: newReply.updatedAt,
  };
}

/**
 * Update a board post reply
 */
export async function updateBoardPostReply(
  replyId: string,
  authorId: string,
  content: string,
) {
  // Check if reply exists
  const reply = await db.query.boardPostReply.findFirst({
    where: and(
      eq(boardPostReplyTable.id, replyId),
      isNull(boardPostReplyTable.deletedAt),
    ),
  });

  if (!reply) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_POST_NOT_FOUND,
      "Reply not found",
    );
  }

  // Check if user is the author
  if (reply.authorId !== authorId) {
    throw new AppException(
      403,
      BoardErrorCode.NOT_POST_AUTHOR,
      "Only the author can modify this reply",
    );
  }

  // Update the reply
  const updatedReplyResult = await db
    .update(boardPostReplyTable)
    .set({
      content,
      updatedAt: sql`NOW()`,
    })
    .where(eq(boardPostReplyTable.id, replyId))
    .returning();

  const updatedReply = updatedReplyResult[0];
  if (!updatedReply) {
    throw new Error("Failed to update reply");
  }

  // Get author info
  const author = await db.query.user.findFirst({
    where: eq(userTable.id, reply.authorId),
  });

  if (!author) {
    throw new Error("Reply author not found");
  }

  return {
    id: updatedReply.id,
    content: updatedReply.content,
    depth: updatedReply.depth,
    in_reply_to_id: updatedReply.inReplyToId,
    author: {
      id: author.id,
      login_name: author.loginName,
    },
    created_at: updatedReply.createdAt,
    updated_at: updatedReply.updatedAt,
  };
}

/**
 * Delete a board post reply
 */
export async function deleteBoardPostReply(replyId: string, userId: string) {
  const reply = await db.query.boardPostReply.findFirst({
    where: and(
      eq(boardPostReplyTable.id, replyId),
      isNull(boardPostReplyTable.deletedAt),
    ),
  });

  if (!reply) {
    throw new AppException(
      404,
      BoardErrorCode.BOARD_POST_NOT_FOUND,
      "Reply not found",
    );
  }

  // Check if user is the author or admin
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
  });

  if (!user) {
    throw new AppException(404, BoardErrorCode.UNAUTHORIZED, "User not found");
  }

  // Only author or admin can delete
  if (reply.authorId !== userId && !user.isAdmin) {
    throw new AppException(
      403,
      BoardErrorCode.FORBIDDEN,
      "Only the author or admin can delete this reply",
    );
  }

  // Soft-delete the reply with deletion reason
  await db
    .update(boardPostReplyTable)
    .set({
      deletedAt: sql`NOW()`,
      deletionReason: "author",
    })
    .where(eq(boardPostReplyTable.id, replyId));

  // Cascade delete all descendant replies
  // For depth 0 replies: delete all with matching root_reply_id
  // For depth > 0 replies: recursively find and delete descendants
  if (reply.depth === 0) {
    // This is a top-level reply, delete all descendants using root_reply_id
    await db
      .update(boardPostReplyTable)
      .set({
        deletedAt: sql`NOW()`,
        deletionReason: "cascade",
      })
      .where(
        and(
          eq(boardPostReplyTable.rootReplyId, replyId),
          isNull(boardPostReplyTable.deletedAt),
        ),
      );
  } else {
    // This is a nested reply, use recursive CTE to find all descendants
    await db.execute(sql`
      WITH RECURSIVE descendants AS (
        -- Base case: direct children
        SELECT id FROM board_post_reply
        WHERE in_reply_to_id = ${replyId} AND deleted_at IS NULL

        UNION ALL

        -- Recursive case: children of children
        SELECT bpr.id FROM board_post_reply bpr
        INNER JOIN descendants d ON bpr.in_reply_to_id = d.id
        WHERE bpr.deleted_at IS NULL
      )
      UPDATE board_post_reply
      SET deleted_at = NOW(), deletion_reason = 'cascade'
      WHERE id IN (SELECT id FROM descendants)
    `);
  }
}
