import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import sharp from "sharp";
import { db } from "../db";
import {
  community as communityTable,
  image as imageTable,
  membership as membershipTable,
  mention as mentionTable,
  moderationLog as moderationLogTable,
  notification as notificationTable,
  postBookmark as postBookmarkTable,
  postHistory as postHistoryTable,
  postHistoryImage as postHistoryImageTable,
  postImage as postImageTable,
  postReaction as postReactionTable,
  post as postTable,
  profileOwnership as profileOwnershipTable,
  profile as profileTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";
import { validateCommunityActive } from "../utils/community-validation";
import { formatISODate } from "../utils/datetime";
import { batchLoadProfilePictures } from "../utils/profile-picture-helper";
import { addImageUrl, uploadFileDirect, validateImageFile } from "../utils/r2";
import * as membershipService from "./membership.service";
import { pushNotificationService } from "./push-notification.service";

/** Maximum number of replies loaded inline per post in the timeline */
export const TIMELINE_REPLY_LIMIT = 5;

/**
 * Validate that a post belongs to a specific community
 * This ensures posts from other communities are never accessed
 */
async function validatePostCommunityAccess(
  postId: string,
  communityId: string,
): Promise<boolean> {
  const post = await db.query.post.findFirst({
    where: and(eq(postTable.id, postId), isNull(postTable.deletedAt)),
  });

  if (!post) {
    return false;
  }

  // Direct community check on post table
  if (post.communityId !== communityId) {
    return false;
  }

  // Additional validation: verify author's profile also belongs to this community
  const profile = await db.query.profile.findFirst({
    where: eq(profileTable.id, post.authorId),
  });

  if (!profile || profile.communityId !== communityId) {
    return false;
  }

  return true;
}

/**
 * Helper function to get user IDs from profile IDs
 */
async function getUserIdsFromProfiles(
  profileIds: string[],
): Promise<Map<string, string>> {
  if (profileIds.length === 0) {
    return new Map();
  }

  const ownerships = await db.query.profileOwnership.findMany({
    where: inArray(profileOwnershipTable.profileId, profileIds),
    columns: {
      profileId: true,
      userId: true,
    },
  });

  return new Map(ownerships.map((o) => [o.profileId, o.userId]));
}

/**
 * Publish scheduled posts that are due
 * This function is called by the scheduler to publish posts whose scheduled time has arrived
 */
export async function publishScheduledPosts(): Promise<number> {
  try {
    // Find all posts that are scheduled to be published now or earlier, but haven't been published yet
    const duePostsResult = await db
      .update(postTable)
      .set({
        publishedAt: sql`NOW()`,
        bumpedAt: sql`NOW()`,
      })
      .where(
        and(
          isNotNull(postTable.scheduledAt),
          isNull(postTable.publishedAt),
          sql`${postTable.scheduledAt} <= NOW()`,
          isNull(postTable.deletedAt),
        ),
      )
      .returning({
        id: postTable.id,
        content: postTable.content,
        communityId: postTable.communityId,
        authorId: postTable.authorId,
        rootPostId: postTable.rootPostId,
      });

    if (duePostsResult.length > 0) {
      // Lazy import avoids cycle: dispatch.ts -> post.service.ts -> dispatch.ts
      const { maybeDispatchCommand } = await import(
        "./builtin-commands/dispatch"
      );
      for (const due of duePostsResult) {
        const community = await db.query.community.findFirst({
          where: eq(communityTable.id, due.communityId),
        });
        if (!community) continue;
        maybeDispatchCommand(
          {
            id: due.id,
            content: due.content,
            communityId: due.communityId,
            authorProfileId: due.authorId,
            rootPostId: due.rootPostId,
          },
          {
            startsAt: community.startsAt,
            endsAt: community.endsAt,
          },
        ).catch((err) => {
          console.error("[bot-command] scheduled dispatch failed", err);
        });
      }
    }

    return duePostsResult.length;
  } catch (error) {
    console.error("Error publishing scheduled posts:", error);
    throw error;
  }
}

/**
 * Get scheduled posts for a specific profile
 * Returns posts that are scheduled but not yet published
 */
export async function getScheduledPosts(
  profileId: string,
  communityId: string,
  limit: number = 20,
  cursor?: string,
) {
  // Build where conditions for count (without cursor)
  const baseConditions = [
    eq(postTable.authorId, profileId),
    eq(postTable.communityId, communityId),
    isNotNull(postTable.scheduledAt),
    isNull(postTable.publishedAt),
    isNull(postTable.deletedAt),
  ];

  // Build where conditions for query (with cursor)
  const queryConditions = [
    ...baseConditions,
    eq(profileTable.communityId, communityId),
  ];

  if (cursor) {
    queryConditions.push(sql`${postTable.id} < ${cursor}`);
  }

  // Run count and data queries in parallel
  const [scheduledPosts, totalCountResult] = await Promise.all([
    db
      .select()
      .from(postTable)
      .leftJoin(profileTable, eq(postTable.authorId, profileTable.id))
      .where(and(...queryConditions))
      .orderBy(desc(postTable.id))
      .limit(limit + 1),
    db
      .select({ count: count() })
      .from(postTable)
      .where(and(...baseConditions)),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;

  // Early return if no scheduled posts
  if (scheduledPosts.length === 0) {
    return {
      data: [],
      pagination: {
        next_cursor: null,
        has_more: false,
        total_count: totalCount,
      },
    };
  }

  // Check if there are more results
  const hasMore = scheduledPosts.length > limit;
  const postsToReturn = hasMore
    ? scheduledPosts.slice(0, limit)
    : scheduledPosts;
  const nextCursor =
    hasMore && postsToReturn.length > 0
      ? postsToReturn[postsToReturn.length - 1]?.post?.id || null
      : null;

  // Collect all profile IDs and post IDs for batch loading
  const profileIds = new Set<string>();
  const postIds: string[] = [];

  for (const row of postsToReturn) {
    if (row.post && row.profile) {
      profileIds.add(row.profile.id);
      postIds.push(row.post.id);
    }
  }

  // Batch load profile pictures and post images
  const [profilePictureMap, allPostImages, allReactions] = await Promise.all([
    batchLoadProfilePictures(Array.from(profileIds)),
    db.query.postImage.findMany({
      where: inArray(postImageTable.postId, postIds),
      with: { image: true },
    }),
    db.query.postReaction.findMany({
      where: inArray(postReactionTable.postId, postIds),
      with: { profile: true },
    }),
  ]);

  // Group images and reactions by post ID
  const imagesByPostId = new Map<string, typeof allPostImages>();
  const reactionsByPostId = new Map<string, typeof allReactions>();

  allPostImages.forEach((pi) => {
    if (!imagesByPostId.has(pi.postId)) {
      imagesByPostId.set(pi.postId, []);
    }
    imagesByPostId.get(pi.postId)?.push(pi);
  });

  allReactions.forEach((reaction) => {
    if (!reactionsByPostId.has(reaction.postId)) {
      reactionsByPostId.set(reaction.postId, []);
    }
    reactionsByPostId.get(reaction.postId)?.push(reaction);
  });

  // Build result using pre-loaded data
  const result = [];
  for (const row of postsToReturn) {
    const post = row.post;
    const profile = row.profile;

    if (!post || !profile) continue;

    const postImages = imagesByPostId.get(post.id) || [];
    const images = postImages
      .filter((pi) => pi.image && !pi.image.deletedAt)
      .map((pi) => ({
        id: pi.image.id,
        url: addImageUrl(pi.image).url,
        width: pi.image.width,
        height: pi.image.height,
        filename: pi.image.filename,
      }));

    const reactions = reactionsByPostId.get(post.id) || [];

    result.push({
      id: post.id,
      content: post.content,
      created_at: formatISODate(post.createdAt),
      updated_at: formatISODate(post.updatedAt),
      announcement: post.announcement,
      content_warning: post.contentWarning,
      pinned_at: post.pinnedAt ? formatISODate(post.pinnedAt) : null,
      scheduled_at: formatISODate(post.scheduledAt),
      published_at: formatISODate(post.publishedAt),
      author: {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        profile_picture_url: profilePictureMap.get(profile.id) || null,
      },
      images,
      in_reply_to_id: post.inReplyToId,
      depth: post.depth,
      root_post_id: post.rootPostId,
      is_bookmarked: false, // Scheduled posts can't be bookmarked yet
      replies: [],
      reply_count: 0,
      has_more_replies: false,
      reactions: reactions.map((reaction) => ({
        emoji: reaction.emoji,
        user: {
          id: reaction.profile.id,
          username: reaction.profile.username,
          name: reaction.profile.name,
        },
      })),
    });
  }

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
 * Upload an image file
 */
export async function uploadImage(
  fileBuffer: ArrayBuffer,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  const [isValid, errorMessage] = validateImageFile(
    contentType,
    fileSize,
    fileName,
  );
  if (!isValid) {
    throw new AppException(400, GENERAL_ERROR_CODE, errorMessage);
  }

  const uniqueKey = await uploadFileDirect(fileBuffer, fileName, contentType);

  // Use sharp to get image dimensions
  let width = 0;
  let height = 0;
  try {
    const image = sharp(Buffer.from(fileBuffer));
    const metadata = await image.metadata();
    width = metadata.width ?? 0;
    height = metadata.height ?? 0;
  } catch (_err) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "이미지 크기 가져오기에 실패했습니다",
    );
  }

  const newImageResult = await db
    .insert(imageTable)
    .values({
      key: uniqueKey,
      filename: fileName,
      width,
      height,
    })
    .returning();

  const newImage = newImageResult[0];
  if (!newImage) {
    throw new Error("Failed to create image record");
  }

  return {
    id: newImage.id,
    filename: newImage.filename,
    width: newImage.width,
    height: newImage.height,
    url: addImageUrl(newImage).url,
    key: uniqueKey,
    created_at: formatISODate(newImage.createdAt),
  };
}

/**
 * Get announcements for a community
 */
export async function getAnnouncements(
  communityId: string,
  profileId?: string,
) {
  const announcementsList = await db
    .select()
    .from(postTable)
    .leftJoin(profileTable, eq(postTable.authorId, profileTable.id))
    .where(
      and(
        eq(postTable.announcement, true),
        eq(postTable.communityId, communityId),
        isNull(postTable.deletedAt),
        isNotNull(postTable.publishedAt),
        eq(profileTable.communityId, communityId),
      ),
    )
    .orderBy(desc(postTable.createdAt));

  // Early return if no announcements
  if (announcementsList.length === 0) {
    return [];
  }

  // Collect all profile IDs and post IDs for batch loading
  const profileIds = new Set<string>();
  const postIds: string[] = [];

  for (const row of announcementsList) {
    if (row.post && row.profile) {
      profileIds.add(row.profile.id);
      postIds.push(row.post.id);
    }
  }

  // Batch load all related data
  const [profilePictureMap, allPostImages, allBookmarks, allReactions] =
    await Promise.all([
      // Batch load profile pictures
      batchLoadProfilePictures(Array.from(profileIds)),
      // Batch load post images for all posts
      db.query.postImage.findMany({
        where: inArray(postImageTable.postId, postIds),
        with: {
          image: true,
        },
      }),
      // Batch load bookmarks if profileId provided
      profileId
        ? db.query.postBookmark.findMany({
            where: and(
              eq(postBookmarkTable.profileId, profileId),
              inArray(postBookmarkTable.postId, postIds),
            ),
          })
        : Promise.resolve([]),
      // Batch load reactions for all posts
      db.query.postReaction.findMany({
        where: inArray(postReactionTable.postId, postIds),
        with: {
          profile: true,
        },
      }),
    ]);

  // Group images and reactions by post ID
  const imagesByPostId = new Map<string, typeof allPostImages>();
  const reactionsByPostId = new Map<string, typeof allReactions>();
  const bookmarkedPostIds = new Set(allBookmarks.map((b) => b.postId));

  allPostImages.forEach((pi) => {
    if (!imagesByPostId.has(pi.postId)) {
      imagesByPostId.set(pi.postId, []);
    }
    imagesByPostId.get(pi.postId)?.push(pi);
  });

  allReactions.forEach((reaction) => {
    if (!reactionsByPostId.has(reaction.postId)) {
      reactionsByPostId.set(reaction.postId, []);
    }
    reactionsByPostId.get(reaction.postId)?.push(reaction);
  });

  // Batch load threaded replies for all announcements
  const repliesMap = await buildThreadedRepliesForMultiplePosts(
    postIds,
    communityId,
    10,
    profileId,
  );

  // Build result using pre-loaded data
  const result = [];
  for (const row of announcementsList) {
    const post = row.post;
    const profile = row.profile;

    if (!post || !profile) continue;

    const postImages = imagesByPostId.get(post.id) || [];
    const images = postImages
      .filter((pi) => pi.image && !pi.image.deletedAt)
      .map((pi) => ({
        id: pi.image.id,
        url: addImageUrl(pi.image).url,
        width: pi.image.width,
        height: pi.image.height,
        filename: pi.image.filename,
      }));

    const reactions = reactionsByPostId.get(post.id) || [];
    const replyResult = repliesMap.get(post.id) || {
      replies: [],
      totalCount: 0,
      loadedCount: 0,
    };
    const is_bookmarked = bookmarkedPostIds.has(post.id);

    result.push({
      id: post.id,
      content: post.content,
      created_at: formatISODate(post.createdAt),
      updated_at: formatISODate(post.updatedAt),
      announcement: true,
      content_warning: post.contentWarning,
      pinned_at: post.pinnedAt ? formatISODate(post.pinnedAt) : null,
      in_reply_to_id: null,
      depth: 0,
      root_post_id: null,
      is_bookmarked,
      images,
      author: {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        profile_picture_url: profilePictureMap.get(profile.id) || null,
      },
      reactions: reactions.map((reaction) => ({
        emoji: reaction.emoji,
        user: {
          id: reaction.profile.id,
          username: reaction.profile.username,
          name: reaction.profile.name,
        },
      })),
      replies: replyResult.replies,
      reply_count: replyResult.totalCount,
      has_more_replies: replyResult.totalCount > replyResult.loadedCount,
    });
  }

  return result;
}

/**
 * Get bookmarked posts for an profile
 */
export async function getBookmarks(
  profileId: string,
  communityId: string,
  limit: number = 20,
  cursor?: string,
) {
  // Build where conditions
  const conditions = [eq(postBookmarkTable.profileId, profileId)];
  if (cursor) {
    conditions.push(sql`${postBookmarkTable.id} < ${cursor}`);
  }

  const bookmarks = await db.query.postBookmark.findMany({
    where: and(...conditions),
    orderBy: [desc(postBookmarkTable.id)],
    limit: limit + 1,
    with: {
      post: {
        with: {
          profile: {
            with: {
              profilePictures: {
                with: {
                  image: true,
                },
              },
            },
          },
          postImages: {
            with: {
              image: true,
            },
          },
          postReactions: {
            with: {
              profile: true,
            },
          },
        },
      },
    },
  });

  // Check if there are more results
  const hasMore = bookmarks.length > limit;
  const bookmarksToReturn = hasMore ? bookmarks.slice(0, limit) : bookmarks;
  const nextCursor =
    hasMore && bookmarksToReturn.length > 0
      ? bookmarksToReturn[bookmarksToReturn.length - 1]?.id
      : null;

  const data = bookmarksToReturn
    .filter((bookmark) => {
      // Filter: ensure post exists, belongs to the community, and is not deleted
      return (
        bookmark.post &&
        bookmark.post.communityId === communityId &&
        bookmark.post.deletedAt === null
      );
    })
    .map((bookmark) => {
      const post = bookmark.post;
      const author = post.profile;
      const profilePicture = author?.profilePictures.find(
        (pp) => pp.deletedAt === null,
      )?.image;
      const profile_picture_url = profilePicture
        ? addImageUrl(profilePicture).url
        : null;

      const imageTableData = post.postImages.map((pi) => ({
        id: pi.image.id,
        url: addImageUrl(pi.image).url,
        width: pi.image.width,
        height: pi.image.height,
        filename: pi.image.filename,
      }));

      return {
        id: post.id,
        content: post.content,
        created_at: formatISODate(post.createdAt),
        updated_at: formatISODate(post.updatedAt),
        announcement: post.announcement,
        content_warning: post.contentWarning,
        pinned_at: post.pinnedAt ? formatISODate(post.pinnedAt) : null,
        author: {
          id: author.id,
          name: author.name,
          username: author.username,
          profile_picture_url: profile_picture_url,
        },
        images: imageTableData,
        in_reply_to_id: post.inReplyToId,
        depth: post.depth,
        root_post_id: post.rootPostId,
        is_bookmarked: true,
        bookmarked_at: formatISODate(bookmark.createdAt),
        replies: [],
        reply_count: 0,
        has_more_replies: false,
        reactions:
          post.postReactions?.map((reaction) => ({
            emoji: reaction.emoji,
            user: {
              id: reaction.profile.id,
              username: reaction.profile.username,
              name: reaction.profile.name,
            },
          })) || [],
      };
    });

  return {
    data,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}

/**
 * Create a bookmark
 */
export async function createBookmark(
  profileId: string,
  postId: string,
  communityId: string,
) {
  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Find the post
  const post = await db.query.post.findFirst({
    where: and(
      eq(postTable.id, postId),
      eq(postTable.communityId, communityId),
      isNull(postTable.deletedAt),
      isNotNull(postTable.publishedAt),
    ),
    with: {
      profile: true,
    },
  });

  if (!post) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Check if bookmark already exists
  const existingBookmark = await db.query.postBookmark.findFirst({
    where: and(
      eq(postBookmarkTable.profileId, profileId),
      eq(postBookmarkTable.postId, post.id),
    ),
  });

  if (existingBookmark) {
    throw new AppException(
      409,
      GENERAL_ERROR_CODE,
      "게시물이 이미 북마크되었습니다",
    );
  }

  // Create the bookmark
  const newBookmarkResult = await db
    .insert(postBookmarkTable)
    .values({
      profileId: profileId,
      postId: post.id,
    })
    .returning();

  const newBookmark = newBookmarkResult[0];
  if (!newBookmark) {
    throw new Error("Failed to create bookmark");
  }

  return {
    message: "게시물이 성공적으로 북마크되었습니다",
    bookmark_id: newBookmark.id,
  };
}

/**
 * Delete a bookmark
 */
export async function deleteBookmark(
  profileId: string,
  postId: string,
  communityId: string,
) {
  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Find the bookmark
  const bookmark = await db.query.postBookmark.findFirst({
    where: and(
      eq(postBookmarkTable.profileId, profileId),
      eq(postBookmarkTable.postId, postId),
    ),
  });

  if (!bookmark) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "북마크를 찾을 수 없습니다",
    );
  }

  // Delete the bookmark
  await db
    .delete(postBookmarkTable)
    .where(eq(postBookmarkTable.id, bookmark.id));
}

/**
 * Create a post reaction
 */
export async function createReaction(
  profileId: string,
  postId: string,
  communityId: string,
  emoji: string,
  profileName: string,
) {
  // Check if community exists and is active
  const community = await db.query.community.findFirst({
    where: eq(communityTable.id, communityId),
  });

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  validateCommunityActive(community.startsAt, community.endsAt, "반응을 추가");

  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없거나 접근이 거부되었습니다",
    );
  }

  // Validate the post exists and profile has access to it
  const post = await db.query.post.findFirst({
    where: and(
      eq(postTable.id, postId),
      eq(postTable.communityId, communityId),
      isNull(postTable.deletedAt),
      isNotNull(postTable.publishedAt),
    ),
    with: {
      profile: true,
    },
  });

  if (!post) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없거나 접근이 거부되었습니다",
    );
  }

  // Check if reaction already exists from this user
  const existingReaction = await db.query.postReaction.findFirst({
    where: and(
      eq(postReactionTable.postId, postId),
      eq(postReactionTable.profileId, profileId),
      eq(postReactionTable.emoji, emoji),
    ),
  });

  if (existingReaction) {
    throw new AppException(400, GENERAL_ERROR_CODE, "반응이 이미 존재합니다");
  }

  // Create the reaction and notification in a transaction
  const reaction = await db.transaction(async (tx) => {
    // Create the reaction
    const reactionResult = await tx
      .insert(postReactionTable)
      .values({
        postId,
        profileId: profileId,
        emoji: emoji,
      })
      .returning();

    const r = reactionResult[0];
    if (!r) {
      throw new Error("Failed to create reaction");
    }

    // Send notification to post author if it's not the same person
    if (post.authorId !== profileId) {
      await tx.insert(notificationTable).values({
        recipientId: post.authorId,
        profileId: profileId,
        type: "reaction",
        title: "새로운 반응",
        message: `${profileName}님이 게시물에 ${emoji} 반응을 남겼습니다`,
        postId: post.id,
      });
    }

    return r;
  });

  // Send push notification after transaction commits
  if (post.authorId !== profileId) {
    const userIdMap = await getUserIdsFromProfiles([post.authorId]);
    const recipientUserId = userIdMap.get(post.authorId);
    if (recipientUserId) {
      const baseDomain = process.env.BASE_DOMAIN || "commu.ng";
      const communityUrl = `https://${community.slug}.${baseDomain}/notifications`;

      await pushNotificationService.sendPushNotification(recipientUserId, {
        title: "새로운 반응",
        body: `${profileName}님이 게시물에 ${emoji} 반응을 남겼습니다`,
        data: {
          type: "reaction",
          post_id: post.id,
          community_url: communityUrl,
          url: `https://${community.slug}.${baseDomain}/${post.profile.username}/${post.id}`,
        },
      });
    }
  }

  return {
    id: reaction.id,
    message: "반응이 성공적으로 추가되었습니다",
    emoji: reaction.emoji,
  };
}

/**
 * Delete a post reaction
 */
export async function deleteReaction(
  profileId: string,
  postId: string,
  communityId: string,
  emoji: string,
) {
  // Check if community exists and is active
  const community = await db.query.community.findFirst({
    where: eq(communityTable.id, communityId),
  });

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  validateCommunityActive(community.startsAt, community.endsAt, "반응을 제거");

  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없거나 접근이 거부되었습니다",
    );
  }

  // Validate the post exists and profile has access to it
  const post = await db.query.post.findFirst({
    where: and(
      eq(postTable.id, postId),
      eq(postTable.communityId, communityId),
      isNull(postTable.deletedAt),
      isNotNull(postTable.publishedAt),
    ),
    with: {
      profile: true,
    },
  });

  if (!post) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없거나 접근이 거부되었습니다",
    );
  }

  // Find the reaction to delete
  const existingReaction = await db.query.postReaction.findFirst({
    where: and(
      eq(postReactionTable.postId, postId),
      eq(postReactionTable.profileId, profileId),
      eq(postReactionTable.emoji, emoji),
    ),
  });

  if (!existingReaction) {
    throw new AppException(404, GENERAL_ERROR_CODE, "반응을 찾을 수 없습니다");
  }

  // Delete the reaction
  await db
    .delete(postReactionTable)
    .where(eq(postReactionTable.id, existingReaction.id));
}

/**
 * Get posts for a community feed with threaded replies
 */
export async function getPosts(
  communityId: string,
  limit: number = 20,
  cursor?: string,
  profileId?: string,
  showAllReplies?: boolean,
  bumpOnReply?: boolean,
) {
  // Build base conditions (without cursor) for count query
  const baseConditions = [
    isNull(postTable.deletedAt),
    isNotNull(postTable.publishedAt),
    eq(postTable.depth, 0), // Only root posts
    eq(postTable.communityId, communityId), // Direct community filter on post
  ];

  // Build query conditions (with cursor)
  const queryConditions = [...baseConditions];
  if (cursor) {
    if (bumpOnReply) {
      // Cursor format: "bumpedAt|id" for composite cursor
      const [cursorBumpedAt, cursorId] = cursor.split("|");
      if (cursorBumpedAt && cursorId) {
        queryConditions.push(
          sql`(${postTable.bumpedAt}, ${postTable.id}) < (${cursorBumpedAt}, ${cursorId})`,
        );
      }
    } else {
      queryConditions.push(sql`${postTable.id} < ${cursor}`);
    }
  }

  // Run count and data queries in parallel
  const [posts, totalCountResult] = await Promise.all([
    // Only get root posts (depth = 0) for the main feed from this community
    // Fetch limit + 1 to determine if there are more pages
    db
      .select()
      .from(postTable)
      .leftJoin(profileTable, eq(postTable.authorId, profileTable.id))
      .where(and(...queryConditions, eq(profileTable.communityId, communityId)))
      .orderBy(
        ...(bumpOnReply
          ? [desc(postTable.bumpedAt), desc(postTable.id)]
          : [desc(postTable.id)]),
      )
      .limit(limit + 1),
    // Count total posts
    db
      .select({ count: count() })
      .from(postTable)
      .where(and(...baseConditions)),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;

  // Early return if no posts
  if (posts.length === 0) {
    return {
      data: [],
      pagination: {
        next_cursor: null,
        has_more: false,
        total_count: totalCount,
      },
    };
  }

  // Check if there are more posts beyond the limit
  const hasMore = posts.length > limit;
  // Remove the extra item if we have more
  const postsToReturn = hasMore ? posts.slice(0, limit) : posts;
  // Get the next cursor based on ordering mode
  const lastPost = postsToReturn[postsToReturn.length - 1]?.post;
  const nextCursor =
    hasMore && lastPost
      ? bumpOnReply
        ? `${lastPost.bumpedAt}|${lastPost.id}`
        : lastPost.id
      : null;

  // Collect all profile IDs and post IDs for batch loading
  const profileIds = new Set<string>();
  const postIds: string[] = [];

  for (const row of postsToReturn) {
    if (row.post && row.profile) {
      profileIds.add(row.profile.id);
      postIds.push(row.post.id);
    }
  }

  // Batch load all related data
  const [
    profilePictureMap,
    allPostImages,
    allBookmarks,
    allReactions,
    profiles,
  ] = await Promise.all([
    // Batch load profile pictures
    batchLoadProfilePictures(Array.from(profileIds)),
    // Batch load post images for all posts
    db.query.postImage.findMany({
      where: inArray(postImageTable.postId, postIds),
      with: {
        image: true,
      },
    }),
    // Batch load bookmarks if profileId provided
    profileId
      ? db.query.postBookmark.findMany({
          where: and(
            eq(postBookmarkTable.profileId, profileId),
            inArray(postBookmarkTable.postId, postIds),
          ),
        })
      : Promise.resolve([]),
    // Batch load reactions for all posts
    db.query.postReaction.findMany({
      where: inArray(postReactionTable.postId, postIds),
      with: {
        profile: true,
      },
    }),
    // Batch load all profiles
    db.query.profile.findMany({
      where: inArray(profileTable.id, Array.from(profileIds)),
    }),
  ]);

  // Group data by post ID for O(1) lookup
  const imagesByPostId = new Map<string, typeof allPostImages>();
  const reactionsByPostId = new Map<string, typeof allReactions>();
  const bookmarkedPostIds = new Set(allBookmarks.map((b) => b.postId));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  allPostImages.forEach((pi) => {
    if (!imagesByPostId.has(pi.postId)) {
      imagesByPostId.set(pi.postId, []);
    }
    imagesByPostId.get(pi.postId)?.push(pi);
  });

  allReactions.forEach((reaction) => {
    if (!reactionsByPostId.has(reaction.postId)) {
      reactionsByPostId.set(reaction.postId, []);
    }
    reactionsByPostId.get(reaction.postId)?.push(reaction);
  });

  // Batch load threaded replies for all posts in a single query (fixes N+1)
  const repliesMap = await buildThreadedRepliesForMultiplePosts(
    postIds,
    communityId,
    10,
    profileId,
    showAllReplies ? undefined : TIMELINE_REPLY_LIMIT,
  );

  // Build result using pre-loaded data
  const result = [];
  for (const row of postsToReturn) {
    const post = row.post;
    if (!post) continue;

    const profile = profileMap.get(post.authorId);
    if (!profile) continue;

    const profile_picture_url = profilePictureMap.get(profile.id) || null;

    // Get post images from pre-loaded data
    const postImages = imagesByPostId.get(post.id) || [];
    const images = postImages
      .filter((pi) => pi.image && !pi.image.deletedAt)
      .map((pi) => ({
        id: pi.image.id,
        url: addImageUrl(pi.image).url,
        width: pi.image.width,
        height: pi.image.height,
        filename: pi.image.filename,
      }));

    // Get threaded replies from batched data (no additional query!)
    const replyResult = repliesMap.get(post.id) || {
      replies: [],
      totalCount: 0,
      loadedCount: 0,
    };

    // Check if post is bookmarked using pre-loaded data
    const is_bookmarked = bookmarkedPostIds.has(post.id);

    // Get reactions from pre-loaded data
    const reactions = reactionsByPostId.get(post.id) || [];

    result.push({
      id: post.id,
      content: post.content,
      created_at: formatISODate(post.createdAt),
      updated_at: formatISODate(post.updatedAt),
      announcement: post.announcement,
      content_warning: post.contentWarning,
      pinned_at: post.pinnedAt ? formatISODate(post.pinnedAt) : null,
      author: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        profile_picture_url,
      },
      images,
      in_reply_to_id: null, // Root posts don't reply to anything
      depth: 0, // Root posts have depth 0
      root_post_id: null, // Root posts are the root
      is_bookmarked,
      replies: replyResult.replies,
      reply_count: replyResult.totalCount,
      has_more_replies: replyResult.totalCount > replyResult.loadedCount,
      reactions: reactions.map((reaction) => ({
        emoji: reaction.emoji,
        user: {
          id: reaction.profile.id,
          username: reaction.profile.username,
          name: reaction.profile.name,
        },
      })),
    });
  }

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
 * Search posts by content using substring matching (ILIKE)
 * Returns posts matching the search query, ordered by creation date
 */
export async function searchPosts(
  searchQuery: string,
  communityId: string,
  limit: number = 20,
  cursor?: string,
  profileId?: string,
) {
  const trimmedQuery = searchQuery.trim();

  if (!trimmedQuery || trimmedQuery.length < 2) {
    return {
      data: [],
      pagination: { next_cursor: null, has_more: false, total_count: 0 },
    };
  }

  // Build base conditions (without cursor) for count query
  const baseConditions = [
    isNull(postTable.deletedAt),
    isNotNull(postTable.publishedAt),
    eq(postTable.depth, 0), // Only root posts
    eq(postTable.communityId, communityId),
    sql`${postTable.content} ILIKE ${`%${trimmedQuery}%`}`,
  ];

  // Build query conditions (with cursor)
  const queryConditions = [...baseConditions];
  if (cursor) {
    queryConditions.push(sql`${postTable.id} < ${cursor}`);
  }

  // Run count and data queries in parallel
  const [posts, totalCountResult] = await Promise.all([
    // Search posts
    db
      .select({
        post: postTable,
        profile: profileTable,
      })
      .from(postTable)
      .leftJoin(profileTable, eq(postTable.authorId, profileTable.id))
      .where(and(...queryConditions, eq(profileTable.communityId, communityId)))
      .orderBy(desc(postTable.id))
      .limit(limit + 1),
    // Count total matching posts
    db
      .select({ count: count() })
      .from(postTable)
      .where(and(...baseConditions)),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;

  // Early return if no posts
  if (posts.length === 0) {
    return {
      data: [],
      pagination: {
        next_cursor: null,
        has_more: false,
        total_count: totalCount,
      },
    };
  }

  // Check if there are more posts beyond the limit
  const hasMore = posts.length > limit;
  const postsToReturn = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor =
    hasMore && postsToReturn.length > 0
      ? postsToReturn[postsToReturn.length - 1]?.post?.id || null
      : null;

  // Collect all profile IDs and post IDs for batch loading
  const profileIds = new Set<string>();
  const postIds: string[] = [];

  for (const row of postsToReturn) {
    if (row.post && row.profile) {
      profileIds.add(row.profile.id);
      postIds.push(row.post.id);
    }
  }

  // Batch load all related data
  const [
    profilePictureMap,
    allPostImages,
    allBookmarks,
    allReactions,
    profiles,
  ] = await Promise.all([
    batchLoadProfilePictures(Array.from(profileIds)),
    db.query.postImage.findMany({
      where: inArray(postImageTable.postId, postIds),
      with: {
        image: true,
      },
    }),
    profileId
      ? db.query.postBookmark.findMany({
          where: and(
            eq(postBookmarkTable.profileId, profileId),
            inArray(postBookmarkTable.postId, postIds),
          ),
        })
      : Promise.resolve([]),
    db.query.postReaction.findMany({
      where: inArray(postReactionTable.postId, postIds),
      with: {
        profile: true,
      },
    }),
    db.query.profile.findMany({
      where: inArray(profileTable.id, Array.from(profileIds)),
    }),
  ]);

  // Group data by post ID for O(1) lookup
  const imagesByPostId = new Map<string, typeof allPostImages>();
  const reactionsByPostId = new Map<string, typeof allReactions>();
  const bookmarkedPostIds = new Set(allBookmarks.map((b) => b.postId));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  allPostImages.forEach((pi) => {
    if (!imagesByPostId.has(pi.postId)) {
      imagesByPostId.set(pi.postId, []);
    }
    imagesByPostId.get(pi.postId)?.push(pi);
  });

  allReactions.forEach((reaction) => {
    if (!reactionsByPostId.has(reaction.postId)) {
      reactionsByPostId.set(reaction.postId, []);
    }
    reactionsByPostId.get(reaction.postId)?.push(reaction);
  });

  // Batch load threaded replies for all posts
  const repliesMap = await buildThreadedRepliesForMultiplePosts(
    postIds,
    communityId,
    10,
    profileId,
  );

  // Build result using pre-loaded data
  const result = [];
  for (const row of postsToReturn) {
    const post = row.post;
    if (!post) continue;

    const profile = profileMap.get(post.authorId);
    if (!profile) continue;

    const profile_picture_url = profilePictureMap.get(profile.id) || null;

    const postImages = imagesByPostId.get(post.id) || [];
    const images = postImages
      .filter((pi) => pi.image && !pi.image.deletedAt)
      .map((pi) => ({
        id: pi.image.id,
        url: addImageUrl(pi.image).url,
        width: pi.image.width,
        height: pi.image.height,
        filename: pi.image.filename,
      }));

    const replyResult = repliesMap.get(post.id) || {
      replies: [],
      totalCount: 0,
      loadedCount: 0,
    };
    const is_bookmarked = bookmarkedPostIds.has(post.id);
    const reactions = reactionsByPostId.get(post.id) || [];

    result.push({
      id: post.id,
      content: post.content,
      created_at: formatISODate(post.createdAt),
      updated_at: formatISODate(post.updatedAt),
      announcement: post.announcement,
      content_warning: post.contentWarning,
      pinned_at: post.pinnedAt ? formatISODate(post.pinnedAt) : null,
      author: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        profile_picture_url,
      },
      images,
      in_reply_to_id: null,
      depth: 0,
      root_post_id: null,
      is_bookmarked,
      replies: replyResult.replies,
      reply_count: replyResult.totalCount,
      has_more_replies: replyResult.totalCount > replyResult.loadedCount,
      reactions: reactions.map((reaction) => ({
        emoji: reaction.emoji,
        user: {
          id: reaction.profile.id,
          username: reaction.profile.username,
          name: reaction.profile.name,
        },
      })),
    });
  }

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
 * Reply data type for threaded replies
 */
type ReplyData = {
  id: string;
  content: string;
  created_at: string | null;
  updated_at: string | null;
  announcement: boolean;
  content_warning: string | null;
  pinned_at: string | null;
  author: {
    id: string;
    name: string;
    username: string;
    profile_picture_url: string | null;
  };
  images: {
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  }[];
  in_reply_to_id: string | null;
  depth: number;
  root_post_id: string | null;
  is_bookmarked: boolean;
  replies: ReplyData[];
  reply_count: number;
  has_more_replies: boolean;
  reactions: {
    emoji: string;
    user: {
      id: string;
      username: string;
      name: string;
    };
  }[];
};

/**
 * Batch version: Build threaded replies for multiple root posts in a single query
 */
async function buildThreadedRepliesForMultiplePosts(
  rootPostIds: string[],
  communityId: string,
  depthLimit: number = 10,
  profileId?: string,
  replyLimit?: number,
): Promise<
  Map<string, { replies: ReplyData[]; totalCount: number; loadedCount: number }>
> {
  if (rootPostIds.length === 0) {
    return new Map();
  }

  // Use PostgreSQL's recursive CTE to get all replies for multiple root posts
  const rootIdsArray = sql.raw(
    `ARRAY[${rootPostIds.map((id) => `'${id}'`).join(",")}]::uuid[]`,
  );

  const replyLimitClause = replyLimit
    ? sql`SELECT *, ROW_NUMBER() OVER (PARTITION BY original_root_id ORDER BY sort_path) as rn FROM thread_replies`
    : sql`SELECT * FROM thread_replies`;

  const outerWhereClause = replyLimit ? sql`WHERE rn <= ${replyLimit}` : sql``;

  // When replyLimit is provided, run a separate count query without depth limit
  const countQueryPromise = replyLimit
    ? db.execute(sql`
        WITH RECURSIVE all_replies AS (
            SELECT p.id, p.in_reply_to_id as original_root_id
            FROM post p
            JOIN profile a ON p.author_id = a.id
            WHERE p.in_reply_to_id = ANY(${rootIdsArray})
            AND p.deleted_at IS NULL
            AND p.published_at IS NOT NULL
            AND p.community_id = ${communityId}
            AND a.community_id = ${communityId}

            UNION ALL

            SELECT p.id, ar.original_root_id
            FROM post p
            JOIN profile a ON p.author_id = a.id
            JOIN all_replies ar ON p.in_reply_to_id = ar.id
            WHERE p.deleted_at IS NULL
            AND p.published_at IS NOT NULL
            AND p.community_id = ${communityId}
            AND a.community_id = ${communityId}
        )
        SELECT original_root_id, COUNT(*) as total_count
        FROM all_replies
        GROUP BY original_root_id
      `)
    : null;

  const [result, countResult] = await Promise.all([
    db.execute(sql`
      WITH RECURSIVE thread_replies AS (
          -- Base case: direct replies to any of the root posts
          SELECT
              p.id, p.content, p.created_at, p.updated_at, p.deleted_at, p.announcement, p.content_warning,
              p.author_id, p.in_reply_to_id, p.depth, p.root_post_id,
              ARRAY[p.created_at] as sort_path,
              p.in_reply_to_id as original_root_id
          FROM post p
          JOIN profile a ON p.author_id = a.id
          WHERE p.in_reply_to_id = ANY(${rootIdsArray})
          AND p.deleted_at IS NULL
          AND p.published_at IS NOT NULL
          AND p.community_id = ${communityId}
          AND a.community_id = ${communityId}

          UNION ALL

          -- Recursive case: replies to replies
          SELECT
              p.id, p.content, p.created_at, p.updated_at, p.deleted_at, p.announcement, p.content_warning,
              p.author_id, p.in_reply_to_id, p.depth, p.root_post_id,
              tr.sort_path || p.created_at,
              tr.original_root_id
          FROM post p
          JOIN profile a ON p.author_id = a.id
          JOIN thread_replies tr ON p.in_reply_to_id = tr.id
          WHERE p.deleted_at IS NULL
          AND p.published_at IS NOT NULL
          AND p.community_id = ${communityId}
          AND a.community_id = ${communityId}
          AND p.depth <= ${depthLimit}
      ), numbered AS (
          ${replyLimitClause}
      )
      SELECT * FROM numbered
      ${outerWhereClause}
      ORDER BY original_root_id, sort_path
    `),
    countQueryPromise,
  ]);

  // Build total count map from the separate count query
  const totalCountByRoot = new Map<string, number>();
  if (countResult) {
    const countRows = countResult.rows as {
      original_root_id: string;
      total_count: string;
    }[];
    for (const row of countRows) {
      totalCountByRoot.set(row.original_root_id, Number(row.total_count));
    }
  }

  const rows = result.rows as {
    id: string;
    content: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    announcement: boolean;
    content_warning: string | null;
    author_id: string;
    in_reply_to_id: string | null;
    depth: number;
    root_post_id: string | null;
    sort_path: string[];
    original_root_id: string;
  }[];

  if (rows.length === 0) {
    // Return empty map with all root post IDs as keys
    const emptyMap = new Map<
      string,
      { replies: ReplyData[]; totalCount: number; loadedCount: number }
    >();
    for (const rootId of rootPostIds) {
      emptyMap.set(rootId, {
        replies: [],
        totalCount: totalCountByRoot.get(rootId) ?? 0,
        loadedCount: 0,
      });
    }
    return emptyMap;
  }

  // Collect all IDs for batch loading
  const profileIds = new Set<string>();
  const postIds: string[] = [];

  rows.forEach((row) => {
    profileIds.add(row.author_id);
    postIds.push(row.id);
  });

  // Batch load all data
  const [
    profiles,
    profilePictureMap,
    allPostImages,
    allBookmarks,
    allReactions,
  ] = await Promise.all([
    // Load all profiles
    db.query.profile.findMany({
      where: inArray(profileTable.id, Array.from(profileIds)),
    }),
    // Load all profile pictures
    batchLoadProfilePictures(Array.from(profileIds)),
    // Load all post images
    db.query.postImage.findMany({
      where: inArray(postImageTable.postId, postIds),
      with: { image: true },
    }),
    // Load bookmarks if profileId provided
    profileId
      ? db.query.postBookmark.findMany({
          where: and(
            eq(postBookmarkTable.profileId, profileId),
            inArray(postBookmarkTable.postId, postIds),
          ),
        })
      : Promise.resolve([]),
    // Load all reactions
    db.query.postReaction.findMany({
      where: inArray(postReactionTable.postId, postIds),
      with: { profile: true },
    }),
  ]);

  // Create lookup maps
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const imagesByPostId = new Map<string, typeof allPostImages>();
  const bookmarkedPostIds = new Set(allBookmarks.map((b) => b.postId));
  const reactionsByPostId = new Map<string, typeof allReactions>();

  allPostImages.forEach((pi) => {
    if (!imagesByPostId.has(pi.postId)) {
      imagesByPostId.set(pi.postId, []);
    }
    imagesByPostId.get(pi.postId)?.push(pi);
  });

  allReactions.forEach((reaction) => {
    if (!reactionsByPostId.has(reaction.postId)) {
      reactionsByPostId.set(reaction.postId, []);
    }
    reactionsByPostId.get(reaction.postId)?.push(reaction);
  });

  // Group replies by original root post ID
  const repliesByRootPost = new Map<string, ReplyData[]>();

  // Initialize empty arrays for all root posts
  for (const rootId of rootPostIds) {
    repliesByRootPost.set(rootId, []);
  }

  // Build reply data using pre-loaded data
  for (const row of rows) {
    const profile = profileMap.get(row.author_id);
    if (!profile) continue;

    const postImages = imagesByPostId.get(row.id) || [];
    const replyImages = postImages
      .filter((pi) => pi.image && !pi.image.deletedAt)
      .map((pi) => ({
        id: pi.image.id,
        url: addImageUrl(pi.image).url,
        width: pi.image.width,
        height: pi.image.height,
        filename: pi.image.filename,
      }));

    const reactions = reactionsByPostId.get(row.id) || [];

    const reply: ReplyData = {
      id: row.id,
      content: row.content,
      created_at: formatISODate(row.created_at),
      updated_at: formatISODate(row.updated_at),
      announcement: row.announcement,
      content_warning: row.content_warning,
      pinned_at: null,
      author: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        profile_picture_url: profilePictureMap.get(profile.id) || null,
      },
      images: replyImages,
      in_reply_to_id: row.in_reply_to_id,
      depth: row.depth,
      root_post_id: row.root_post_id,
      is_bookmarked: bookmarkedPostIds.has(row.id),
      replies: [],
      reply_count: 0,
      has_more_replies: false,
      reactions: reactions.map((reaction) => ({
        emoji: reaction.emoji,
        user: {
          id: reaction.profile.id,
          username: reaction.profile.username,
          name: reaction.profile.name,
        },
      })),
    };

    // Add to the appropriate root post's reply array
    const rootReplies = repliesByRootPost.get(row.original_root_id);
    if (rootReplies) {
      rootReplies.push(reply);
    }
  }

  // Build nested tree structure for each root post
  const nestedRepliesMap = new Map<
    string,
    { replies: ReplyData[]; totalCount: number; loadedCount: number }
  >();

  for (const [rootId, flatReplies] of repliesByRootPost) {
    // Create a map of all replies by ID for quick lookup
    const replyById = new Map<string, ReplyData>();
    for (const reply of flatReplies) {
      replyById.set(reply.id, reply);
    }

    // Build tree: add each reply to its parent's replies array
    const topLevelReplies: ReplyData[] = [];
    for (const reply of flatReplies) {
      if (reply.in_reply_to_id === rootId) {
        // Direct reply to root post
        topLevelReplies.push(reply);
      } else if (reply.in_reply_to_id) {
        // Reply to another reply
        const parent = replyById.get(reply.in_reply_to_id);
        if (parent) {
          parent.replies.push(reply);
        }
      }
    }

    const totalCount = totalCountByRoot.get(rootId) ?? flatReplies.length;
    nestedRepliesMap.set(rootId, {
      replies: topLevelReplies,
      totalCount,
      loadedCount: flatReplies.length,
    });
  }

  return nestedRepliesMap;
}

type FlatReplyData = Omit<ReplyData, "replies"> & { replies: never[] };

/**
 * Get paginated flat replies for a single post using sort_path cursor
 */
export async function getPostReplies(
  postId: string,
  communityId: string,
  limit: number = 20,
  cursor?: string,
  profileId?: string,
) {
  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Get the post's depth for the CTE depth limit
  const targetPost = await db.query.post.findFirst({
    where: and(eq(postTable.id, postId), isNull(postTable.deletedAt)),
    columns: { depth: true },
  });

  const depthLimit = (targetPost?.depth ?? 0) + 100;

  // Decode cursor (Base64-encoded JSON of sort_path array)
  let decodedCursor: string[] | null = null;
  if (cursor) {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, "base64url").toString("utf-8"),
      );
      if (Array.isArray(parsed)) {
        decodedCursor = parsed;
      }
    } catch {
      decodedCursor = null;
    }
  }

  // Build cursor condition
  const cursorCondition = decodedCursor
    ? sql`AND sort_path > ${sql.raw(`ARRAY[${decodedCursor.map((v) => `'${v}'::timestamptz`).join(",")}]`)}`
    : sql``;

  // Run count and data queries in parallel
  const [dataResult, countResult] = await Promise.all([
    db.execute(sql`
      WITH RECURSIVE thread_replies AS (
          SELECT
              p.id, p.content, p.created_at, p.updated_at, p.deleted_at, p.announcement, p.content_warning,
              p.author_id, p.in_reply_to_id, p.depth, p.root_post_id,
              ARRAY[p.created_at] as sort_path
          FROM post p
          JOIN profile a ON p.author_id = a.id
          WHERE p.in_reply_to_id = ${postId}
          AND p.deleted_at IS NULL
          AND p.published_at IS NOT NULL
          AND p.community_id = ${communityId}
          AND a.community_id = ${communityId}

          UNION ALL

          SELECT
              p.id, p.content, p.created_at, p.updated_at, p.deleted_at, p.announcement, p.content_warning,
              p.author_id, p.in_reply_to_id, p.depth, p.root_post_id,
              tr.sort_path || p.created_at
          FROM post p
          JOIN profile a ON p.author_id = a.id
          JOIN thread_replies tr ON p.in_reply_to_id = tr.id
          WHERE p.deleted_at IS NULL
          AND p.published_at IS NOT NULL
          AND p.community_id = ${communityId}
          AND a.community_id = ${communityId}
          AND p.depth <= ${depthLimit}
      )
      SELECT *, array_to_json(sort_path)::text as sort_path_json FROM thread_replies
      WHERE 1=1 ${cursorCondition}
      ORDER BY sort_path
      LIMIT ${limit + 1}
    `),
    db.execute(sql`
      WITH RECURSIVE thread_replies AS (
          SELECT p.id, p.in_reply_to_id
          FROM post p
          JOIN profile a ON p.author_id = a.id
          WHERE p.in_reply_to_id = ${postId}
          AND p.deleted_at IS NULL
          AND p.published_at IS NOT NULL
          AND p.community_id = ${communityId}
          AND a.community_id = ${communityId}

          UNION ALL

          SELECT p.id, p.in_reply_to_id
          FROM post p
          JOIN profile a ON p.author_id = a.id
          JOIN thread_replies tr ON p.in_reply_to_id = tr.id
          WHERE p.deleted_at IS NULL
          AND p.published_at IS NOT NULL
          AND p.community_id = ${communityId}
          AND a.community_id = ${communityId}
      )
      SELECT COUNT(*) as total_count FROM thread_replies
    `),
  ]);

  const totalCount = Number(
    (countResult.rows[0] as { total_count: string })?.total_count ?? 0,
  );

  const rows = dataResult.rows as {
    id: string;
    content: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    announcement: boolean;
    content_warning: string | null;
    author_id: string;
    in_reply_to_id: string | null;
    depth: number;
    root_post_id: string | null;
    sort_path: string[];
    sort_path_json: string;
  }[];

  if (rows.length === 0) {
    return {
      data: [] as FlatReplyData[],
      pagination: {
        next_cursor: null,
        has_more: false,
        total_count: totalCount,
      },
    };
  }

  const hasMore = rows.length > limit;
  const rowsToReturn = hasMore ? rows.slice(0, limit) : rows;

  // Encode next cursor from the last row's sort_path (already JSON from array_to_json)
  const nextCursor =
    hasMore && rowsToReturn.length > 0
      ? Buffer.from(
          String(rowsToReturn[rowsToReturn.length - 1]?.sort_path_json),
        ).toString("base64url")
      : null;

  // Collect IDs for batch loading
  const profileIds = new Set<string>();
  const postIds: string[] = [];

  for (const row of rowsToReturn) {
    profileIds.add(row.author_id);
    postIds.push(row.id);
  }

  // Batch load all related data
  const [
    profiles,
    profilePictureMap,
    allPostImages,
    allBookmarks,
    allReactions,
  ] = await Promise.all([
    db.query.profile.findMany({
      where: inArray(profileTable.id, Array.from(profileIds)),
    }),
    batchLoadProfilePictures(Array.from(profileIds)),
    db.query.postImage.findMany({
      where: inArray(postImageTable.postId, postIds),
      with: { image: true },
    }),
    profileId
      ? db.query.postBookmark.findMany({
          where: and(
            eq(postBookmarkTable.profileId, profileId),
            inArray(postBookmarkTable.postId, postIds),
          ),
        })
      : Promise.resolve([]),
    db.query.postReaction.findMany({
      where: inArray(postReactionTable.postId, postIds),
      with: { profile: true },
    }),
  ]);

  // Create lookup maps
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const imagesByPostId = new Map<string, typeof allPostImages>();
  const bookmarkedPostIds = new Set(allBookmarks.map((b) => b.postId));
  const reactionsByPostId = new Map<string, typeof allReactions>();

  for (const pi of allPostImages) {
    if (!imagesByPostId.has(pi.postId)) {
      imagesByPostId.set(pi.postId, []);
    }
    imagesByPostId.get(pi.postId)?.push(pi);
  }

  for (const reaction of allReactions) {
    if (!reactionsByPostId.has(reaction.postId)) {
      reactionsByPostId.set(reaction.postId, []);
    }
    reactionsByPostId.get(reaction.postId)?.push(reaction);
  }

  // Build flat reply data
  const data: FlatReplyData[] = [];
  for (const row of rowsToReturn) {
    const profile = profileMap.get(row.author_id);
    if (!profile) continue;

    const postImages = imagesByPostId.get(row.id) || [];
    const replyImages = postImages
      .filter((pi) => pi.image && !pi.image.deletedAt)
      .map((pi) => ({
        id: pi.image.id,
        url: addImageUrl(pi.image).url,
        width: pi.image.width,
        height: pi.image.height,
        filename: pi.image.filename,
      }));

    const reactions = reactionsByPostId.get(row.id) || [];

    data.push({
      id: row.id,
      content: row.content,
      created_at: formatISODate(row.created_at),
      updated_at: formatISODate(row.updated_at),
      announcement: row.announcement,
      content_warning: row.content_warning,
      pinned_at: null,
      author: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        profile_picture_url: profilePictureMap.get(profile.id) || null,
      },
      images: replyImages,
      in_reply_to_id: row.in_reply_to_id,
      depth: row.depth,
      root_post_id: row.root_post_id,
      is_bookmarked: bookmarkedPostIds.has(row.id),
      replies: [],
      reply_count: 0,
      has_more_replies: false,
      reactions: reactions.map((reaction) => ({
        emoji: reaction.emoji,
        user: {
          id: reaction.profile.id,
          username: reaction.profile.username,
          name: reaction.profile.name,
        },
      })),
    });
  }

  return {
    data,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: totalCount,
    },
  };
}

/**
 * Get parent thread (all ancestor posts) for a given post
 * Returns posts ordered from root to immediate parent
 */
async function getParentThread(
  postId: string,
  communityId: string,
  profileId?: string,
): Promise<ReplyData[]> {
  // Use PostgreSQL's recursive CTE to get all parent posts
  const result = await db.execute(sql`
    WITH RECURSIVE parent_thread AS (
      -- Base case: get the immediate parent
      SELECT
        p.id, p.content, p.created_at, p.updated_at, p.deleted_at, p.announcement, p.content_warning,
        p.author_id, p.in_reply_to_id, p.depth, p.root_post_id,
        1 as level
      FROM post p
      JOIN profile a ON p.author_id = a.id
      WHERE p.id = (SELECT in_reply_to_id FROM post WHERE id = ${postId})
        AND p.deleted_at IS NULL
        AND p.published_at IS NOT NULL
        AND p.community_id = ${communityId}
        AND a.community_id = ${communityId}

      UNION ALL

      -- Recursive case: get parent of parent
      SELECT
        p.id, p.content, p.created_at, p.updated_at, p.deleted_at, p.announcement, p.content_warning,
        p.author_id, p.in_reply_to_id, p.depth, p.root_post_id,
        pt.level + 1
      FROM post p
      JOIN profile a ON p.author_id = a.id
      JOIN parent_thread pt ON p.id = pt.in_reply_to_id
      WHERE p.deleted_at IS NULL
        AND p.published_at IS NOT NULL
        AND p.community_id = ${communityId}
        AND a.community_id = ${communityId}
    )
    SELECT * FROM parent_thread
    ORDER BY depth ASC
  `);

  const rows = result.rows as {
    id: string;
    content: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    announcement: boolean;
    content_warning: string | null;
    author_id: string;
    in_reply_to_id: string | null;
    depth: number;
    root_post_id: string | null;
    level: number;
  }[];

  if (rows.length === 0) {
    return [];
  }

  // Collect all IDs for batch loading
  const profileIds = new Set<string>();
  const postIds: string[] = [];

  rows.forEach((row) => {
    profileIds.add(row.author_id);
    postIds.push(row.id);
  });

  // Batch load all data
  const [
    profiles,
    profilePictureMap,
    allPostImages,
    allBookmarks,
    allReactions,
  ] = await Promise.all([
    db.query.profile.findMany({
      where: inArray(profileTable.id, Array.from(profileIds)),
    }),
    batchLoadProfilePictures(Array.from(profileIds)),
    db.query.postImage.findMany({
      where: inArray(postImageTable.postId, postIds),
      with: { image: true },
    }),
    profileId
      ? db.query.postBookmark.findMany({
          where: and(
            eq(postBookmarkTable.profileId, profileId),
            inArray(postBookmarkTable.postId, postIds),
          ),
        })
      : Promise.resolve([]),
    db.query.postReaction.findMany({
      where: inArray(postReactionTable.postId, postIds),
      with: { profile: true },
    }),
  ]);

  // Create lookup maps
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const imagesByPostId = new Map<string, typeof allPostImages>();
  const bookmarkedPostIds = new Set(allBookmarks.map((b) => b.postId));
  const reactionsByPostId = new Map<string, typeof allReactions>();

  allPostImages.forEach((pi) => {
    if (!imagesByPostId.has(pi.postId)) {
      imagesByPostId.set(pi.postId, []);
    }
    imagesByPostId.get(pi.postId)?.push(pi);
  });

  allReactions.forEach((reaction) => {
    if (!reactionsByPostId.has(reaction.postId)) {
      reactionsByPostId.set(reaction.postId, []);
    }
    reactionsByPostId.get(reaction.postId)?.push(reaction);
  });

  // Build thread data
  const parentThread: ReplyData[] = [];
  for (const row of rows) {
    const profile = profileMap.get(row.author_id);
    if (!profile) continue;

    const postImages = imagesByPostId.get(row.id) || [];
    const images = postImages
      .filter((pi) => pi.image && !pi.image.deletedAt)
      .map((pi) => ({
        id: pi.image.id,
        url: addImageUrl(pi.image).url,
        width: pi.image.width,
        height: pi.image.height,
        filename: pi.image.filename,
      }));

    const reactions = reactionsByPostId.get(row.id) || [];

    parentThread.push({
      id: row.id,
      content: row.content,
      created_at: formatISODate(row.created_at),
      updated_at: formatISODate(row.updated_at),
      announcement: row.announcement,
      content_warning: row.content_warning,
      pinned_at: null,
      author: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        profile_picture_url: profilePictureMap.get(profile.id) || null,
      },
      images,
      in_reply_to_id: row.in_reply_to_id,
      depth: row.depth,
      root_post_id: row.root_post_id,
      is_bookmarked: bookmarkedPostIds.has(row.id),
      replies: [],
      reply_count: 0,
      has_more_replies: false,
      reactions: reactions.map((reaction) => ({
        emoji: reaction.emoji,
        user: {
          id: reaction.profile.id,
          username: reaction.profile.username,
          name: reaction.profile.name,
        },
      })),
    });
  }

  return parentThread;
}

/**
 * Get a single post with its replies
 */
export async function getPost(
  postId: string,
  communityId: string,
  profileId?: string,
) {
  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Find the post in the same community (exclude deleted posts and unpublished scheduled posts)
  const post = await db.query.post.findFirst({
    where: and(
      eq(postTable.id, postId),
      eq(postTable.communityId, communityId),
      isNull(postTable.deletedAt),
      isNotNull(postTable.publishedAt),
    ),
    with: {
      profile: {
        with: {
          profilePictures: {
            with: {
              image: true,
            },
          },
        },
      },
      postImages: {
        with: {
          image: true,
        },
      },
      postReactions: {
        with: {
          profile: true,
        },
      },
    },
  });

  if (!post) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Get author's profile picture
  const authorProfilePicture = post.profile?.profilePictures.find(
    (pp) => pp.deletedAt === null,
  )?.image;
  const profile_picture_url = authorProfilePicture
    ? addImageUrl(authorProfilePicture).url
    : null;

  // Get post images
  const images = post.postImages.map((pi) => ({
    id: pi.image.id,
    url: addImageUrl(pi.image).url,
    width: pi.image.width,
    height: pi.image.height,
    filename: pi.image.filename,
  }));

  // Check if post is bookmarked by the given profile
  let is_bookmarked = false;
  if (profileId) {
    const bookmark = await db.query.postBookmark.findFirst({
      where: and(
        eq(postBookmarkTable.profileId, profileId),
        eq(postBookmarkTable.postId, post.id),
      ),
    });
    is_bookmarked = bookmark !== undefined;
  }

  // Get threaded replies starting from this specific post
  const repliesMap = await buildThreadedRepliesForMultiplePosts(
    [post.id],
    communityId,
    post.depth + 100,
    profileId,
  );
  const replyResult = repliesMap.get(post.id) || {
    replies: [],
    totalCount: 0,
    loadedCount: 0,
  };
  const replies = replyResult.replies;

  // Get parent thread if this is a reply
  const parent_thread = post.inReplyToId
    ? await getParentThread(post.id, communityId, profileId)
    : [];

  return {
    id: post.id,
    content: post.content,
    created_at: formatISODate(post.createdAt),
    updated_at: formatISODate(post.updatedAt),
    announcement: post.announcement,
    content_warning: post.contentWarning,
    pinned_at: post.pinnedAt ? formatISODate(post.pinnedAt) : null,
    author: {
      id: post.profile.id,
      name: post.profile.name,
      username: post.profile.username,
      profile_picture_url,
    },
    images,
    in_reply_to_id: post.inReplyToId,
    depth: post.depth,
    root_post_id: post.rootPostId,
    replies,
    reply_count: replyResult.totalCount,
    has_more_replies: replyResult.totalCount > replyResult.loadedCount,
    parent_thread,
    is_bookmarked,
    reactions:
      post.postReactions?.map((reaction) => ({
        emoji: reaction.emoji,
        user: {
          id: reaction.profile.id,
          username: reaction.profile.username,
          name: reaction.profile.name,
        },
      })) || [],
  };
}

/**
 * Create a new post with validations, notifications, and mentions
 */
export async function createPost(
  userId: string,
  profileId: string,
  communityId: string,
  content: string,
  inReplyToId: string | null,
  imageIds: string[] | undefined,
  announcement: boolean | undefined,
  contentWarning: string | null | undefined,
  scheduledAt: string | null | undefined,
  startsAt: string,
  endsAt: string,
) {
  // Validate reply target if provided
  let parentPost = null;
  let depth = 0;
  let rootPostId = null;

  if (inReplyToId) {
    // Validate parent post belongs to this community
    const hasAccess = await validatePostCommunityAccess(
      inReplyToId,
      communityId,
    );
    if (!hasAccess) {
      throw new AppException(
        404,
        GENERAL_ERROR_CODE,
        "상위 게시물을 찾을 수 없습니다",
      );
    }

    parentPost = await db.query.post.findFirst({
      where: and(
        eq(postTable.id, inReplyToId),
        eq(postTable.communityId, communityId),
        isNull(postTable.deletedAt),
      ),
      with: {
        profile: true,
      },
    });

    if (!parentPost) {
      throw new AppException(
        404,
        GENERAL_ERROR_CODE,
        "상위 게시물을 찾을 수 없습니다",
      );
    }

    depth = parentPost.depth + 1;
    rootPostId = parentPost.rootPostId || parentPost.id;
  }

  // Check if profile is muted
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
      isNotNull(profileTable.activatedAt),
      isNull(profileTable.deletedAt),
    ),
  });

  if (!profile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없습니다",
    );
  }

  if (profile.mutedAt) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 프로필은 음소거되어 게시할 수 없습니다",
    );
  }

  // Validate that at least content or images are provided
  if (!content.trim() && (!imageIds || imageIds.length === 0)) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "게시물 내용 또는 이미지를 제공해야 합니다",
    );
  }

  // Validate images if provided
  if (imageIds && imageIds.length > 0) {
    const validImages = await db.query.image.findMany({
      where: and(
        inArray(imageTable.id, imageIds),
        isNull(imageTable.deletedAt),
      ),
    });

    if (validImages.length !== imageIds.length) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "일부 이미지가 유효하지 않습니다",
      );
    }
  }

  // Check if community has ended or not started
  const now = new Date();
  const communityStartsAt = new Date(startsAt);
  const communityEndsAt = new Date(endsAt);

  if (now > communityEndsAt) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "커뮤가 종료되어 게시할 수 없습니다",
    );
  }

  // Get user's membership to check role
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  const userRole = membership?.role;

  // Check if community hasn't started yet (only owners and moderators can post)
  if (now < communityStartsAt) {
    if (userRole !== "owner" && userRole !== "moderator") {
      throw new AppException(
        403,
        GENERAL_ERROR_CODE,
        "커뮤가 아직 시작되지 않았습니다",
      );
    }
  }

  // Validate scheduled post
  if (scheduledAt) {
    // Only owners and moderators can schedule posts
    if (userRole !== "owner" && userRole !== "moderator") {
      throw new AppException(
        403,
        GENERAL_ERROR_CODE,
        "게시물 예약은 관리자만 가능합니다",
      );
    }

    // Cannot schedule replies
    if (inReplyToId) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "답글은 예약할 수 없습니다",
      );
    }

    // Validate scheduled time is in the future
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= now) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "예약 시간은 현재 시간 이후여야 합니다",
      );
    }

    // Validate scheduled time is before community ends
    if (scheduledDate > communityEndsAt) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "커뮤 종료 시간 이전으로 예약해야 합니다",
      );
    }
  }

  // Validate announcement post
  if (announcement) {
    // Only owners can create announcements
    if (userRole !== "owner") {
      throw new AppException(
        403,
        GENERAL_ERROR_CODE,
        "공지사항은 소유자만 작성할 수 있습니다",
      );
    }

    // Cannot make replies announcements
    if (inReplyToId) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "답글은 공지사항으로 작성할 수 없습니다",
      );
    }
  }

  // Create the post
  const newPostResult = await db
    .insert(postTable)
    .values({
      content,
      authorId: profileId,
      createdByUserId: userId,
      communityId: communityId,
      inReplyToId: inReplyToId || null,
      depth,
      rootPostId,
      announcement: announcement || false,
      contentWarning: contentWarning || null,
      scheduledAt: scheduledAt || null,
      publishedAt: scheduledAt ? null : sql`NOW()`,
      bumpedAt: inReplyToId ? null : sql`NOW()`,
    })
    .returning();

  const newPost = newPostResult[0];
  if (!newPost) {
    throw new Error("Failed to create post");
  }

  // Associate images with the post
  if (imageIds && imageIds.length > 0) {
    const postImageInserts = imageIds.map((imageId) => ({
      postId: newPost.id,
      imageId: imageId,
    }));

    await db.insert(postImageTable).values(postImageInserts);
  }

  // Bump root post's bumpedAt when a reply is created
  if (rootPostId) {
    await db
      .update(postTable)
      .set({ bumpedAt: sql`NOW()` })
      .where(eq(postTable.id, rootPostId));
  }

  // Keep track of who already received a reply notification
  let replyNotificationRecipientId = null;

  // Create notification for reply
  if (parentPost && parentPost.authorId !== profileId) {
    replyNotificationRecipientId = parentPost.authorId;

    // Get profile for notification message
    const profile = await db.query.profile.findFirst({
      where: eq(profileTable.id, profileId),
    });

    await db.insert(notificationTable).values({
      recipientId: parentPost.authorId,
      profileId: profileId,
      type: "reply",
      title: "새로운 답글",
      message: `${profile?.name}님이 답글을 작성했습니다`,
      postId: newPost.id,
    });

    // Send push notification for reply
    const userIdMap = await getUserIdsFromProfiles([parentPost.authorId]);
    const recipientUserId = userIdMap.get(parentPost.authorId);
    if (recipientUserId) {
      // Get community for URL
      const community = await db.query.community.findFirst({
        where: eq(communityTable.id, communityId),
      });

      if (community) {
        const baseDomain = process.env.BASE_DOMAIN || "commu.ng";
        const communityUrl = `https://${community.slug}.${baseDomain}/notifications`;

        await pushNotificationService.sendPushNotification(recipientUserId, {
          title: "새로운 답글",
          body: `${profile?.name}님이 답글을 작성했습니다`,
          data: {
            type: "reply",
            post_id: newPost.id,
            community_url: communityUrl,
            url: `https://${community.slug}.${baseDomain}/${profile?.username}/${newPost.id}`,
          },
        });
      }
    }
  }

  // Create mention notifications
  const mentions = content.match(/@([a-zA-Z0-9_]+)/g) || [];
  const uniqueMentions = [...new Set(mentions.map((m) => m.substring(1)))]; // Remove @ and deduplicate

  // Batch load all mentioned profiles
  const mentionedProfiles =
    uniqueMentions.length > 0
      ? await db.query.profile.findMany({
          where: and(
            inArray(profileTable.username, uniqueMentions),
            eq(profileTable.communityId, communityId),
            isNotNull(profileTable.activatedAt),
            isNull(profileTable.deletedAt),
          ),
        })
      : [];

  // Filter valid mentions for notifications and mention records
  const validMentionedProfiles = mentionedProfiles.filter(
    (mentionedProfile) => mentionedProfile.id !== profileId,
  );

  // Prepare mention records for the mention table
  const mentionRecords = validMentionedProfiles.map((mentionedProfile) => ({
    profileId: mentionedProfile.id,
    postId: newPost.id,
  }));

  // Batch insert mention records
  if (mentionRecords.length > 0) {
    await db.insert(mentionTable).values(mentionRecords);
  }

  // Prepare notification records (excluding reply notification recipient)
  const mentionNotifications = validMentionedProfiles
    .filter(
      (mentionedProfile) =>
        mentionedProfile.id !== replyNotificationRecipientId,
    )
    .map((mentionedProfile) => ({
      recipientId: mentionedProfile.id,
      profileId: profileId,
      type: "mention" as const,
      title: `${profile?.name}님이 회원님을 언급했습니다`,
      message:
        content.length > 100 ? `${content.substring(0, 100)}...` : content,
      postId: newPost.id,
    }));

  // Batch insert all mention notifications
  if (mentionNotifications.length > 0) {
    await db.insert(notificationTable).values(mentionNotifications);

    // Send push notifications for mentions
    const mentionedProfileIds = mentionNotifications.map((n) => n.recipientId);
    const userIdMap = await getUserIdsFromProfiles(mentionedProfileIds);

    // Get community for URL
    const community = await db.query.community.findFirst({
      where: eq(communityTable.id, communityId),
    });

    if (community) {
      const baseDomain = process.env.BASE_DOMAIN || "commu.ng";
      const communityUrl = `https://${community.slug}.${baseDomain}/notifications`;

      for (const notification of mentionNotifications) {
        const recipientUserId = userIdMap.get(notification.recipientId);
        if (recipientUserId) {
          await pushNotificationService.sendPushNotification(recipientUserId, {
            title: notification.title,
            body: notification.message,
            data: {
              type: "mention",
              post_id: newPost.id,
              community_url: communityUrl,
              url: communityUrl,
            },
          });
        }
      }
    }
  }

  // Get the post with author and images for response
  const createdPost = await db.query.post.findFirst({
    where: eq(postTable.id, newPost.id),
    with: {
      profile: {
        with: {
          profilePictures: {
            with: {
              image: true,
            },
          },
        },
      },
      postImages: {
        with: {
          image: true,
        },
      },
    },
  });

  const authorProfilePicture = createdPost?.profile?.profilePictures.find(
    (pp) => pp.deletedAt === null,
  )?.image;
  const profile_picture_url = authorProfilePicture
    ? addImageUrl(authorProfilePicture).url
    : null;

  const images =
    createdPost?.postImages.map((pi) => ({
      id: pi.image.id,
      url: addImageUrl(pi.image).url,
      width: pi.image.width,
      height: pi.image.height,
      filename: pi.image.filename,
    })) || [];

  return {
    id: createdPost?.id,
    content: createdPost?.content,
    created_at: formatISODate(createdPost?.createdAt),
    updated_at: formatISODate(createdPost?.updatedAt),
    announcement: createdPost?.announcement,
    content_warning: createdPost?.contentWarning,
    pinned_at: createdPost?.pinnedAt
      ? formatISODate(createdPost.pinnedAt)
      : null,
    in_reply_to_id: createdPost?.inReplyToId,
    depth: createdPost?.depth,
    root_post_id: createdPost?.rootPostId ?? null,
    author: {
      id: createdPost?.profile?.id,
      name: createdPost?.profile?.name,
      username: createdPost?.profile?.username,
      profile_picture_url,
    },
    images,
    is_bookmarked: false,
    replies: [],
    reply_count: 0,
    has_more_replies: false,
    reactions: [],
  };
}

/**
 * Pin a post to a profile
 */
export async function pinPost(
  _userId: string,
  profileId: string,
  postId: string,
  communityId: string,
) {
  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Find the post
  const post = await db.query.post.findFirst({
    where: and(
      eq(postTable.id, postId),
      eq(postTable.communityId, communityId),
      isNull(postTable.deletedAt),
    ),
  });

  if (!post) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Validate that the post belongs to the user's profile
  if (post.authorId !== profileId) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "본인의 게시물만 고정할 수 있습니다",
    );
  }

  // Check if already pinned
  if (post.pinnedAt) {
    throw new AppException(409, GENERAL_ERROR_CODE, "이미 고정된 게시물입니다");
  }

  // Optional: Limit number of pinned posts (e.g., max 3 per profile)
  const pinnedPosts = await db.query.post.findMany({
    where: and(
      eq(postTable.authorId, profileId),
      isNotNull(postTable.pinnedAt),
      isNull(postTable.deletedAt),
    ),
  });

  if (pinnedPosts.length >= 3) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "최대 3개의 게시물만 고정할 수 있습니다. 다른 게시물을 고정 해제하세요.",
    );
  }

  // Pin the post
  await db
    .update(postTable)
    .set({
      pinnedAt: sql`NOW()`,
    })
    .where(eq(postTable.id, postId));
}

/**
 * Unpin a post from a profile
 */
export async function unpinPost(
  _userId: string,
  profileId: string,
  postId: string,
  communityId: string,
) {
  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Find the post
  const post = await db.query.post.findFirst({
    where: and(
      eq(postTable.id, postId),
      eq(postTable.communityId, communityId),
      isNull(postTable.deletedAt),
    ),
  });

  if (!post) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Validate that the post belongs to the user's profile
  if (post.authorId !== profileId) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "본인의 게시물만 고정 해제할 수 있습니다",
    );
  }

  // Check if not pinned
  if (!post.pinnedAt) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "고정되지 않은 게시물입니다",
    );
  }

  // Unpin the post
  await db
    .update(postTable)
    .set({
      pinnedAt: null,
    })
    .where(eq(postTable.id, postId));
}

/**
 * Update a post
 */
export async function updatePost(
  _userId: string,
  profileId: string,
  postId: string,
  communityId: string,
  content: string,
  imageIds: string[] | undefined,
  contentWarning: string | null | undefined,
  announcement: boolean | undefined,
  userRole: string,
) {
  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Find the post (exclude deleted posts)
  const post = await db.query.post.findFirst({
    where: and(
      eq(postTable.id, postId),
      eq(postTable.communityId, communityId),
      isNull(postTable.deletedAt),
      isNotNull(postTable.publishedAt),
    ),
    with: {
      profile: true,
    },
  });

  // Check if post exists
  if (!post || post.profile?.communityId !== communityId) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Only the post author can edit the post
  if (post.authorId !== profileId) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "본인의 게시물만 수정할 수 있습니다",
    );
  }

  // Cannot edit scheduled posts
  if (post.scheduledAt) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "예약된 게시물은 수정할 수 없습니다",
    );
  }

  // Only owners can set announcement flag
  if (announcement !== undefined && announcement !== post.announcement) {
    if (userRole !== "owner") {
      throw new AppException(
        403,
        GENERAL_ERROR_CODE,
        "공지사항 설정은 소유자만 할 수 있습니다",
      );
    }
    // Only root posts (not replies) can be announcements
    if (announcement && post.depth !== 0) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "답글은 공지사항으로 설정할 수 없습니다",
      );
    }
  }

  // Validate that at least content or images are provided
  if (!content.trim() && (!imageIds || imageIds.length === 0)) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "게시물 내용 또는 이미지를 제공해야 합니다",
    );
  }

  // Validate images if provided
  if (imageIds && imageIds.length > 0) {
    const validImages = await db.query.image.findMany({
      where: and(
        inArray(imageTable.id, imageIds),
        isNull(imageTable.deletedAt),
      ),
    });

    if (validImages.length !== imageIds.length) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "일부 이미지가 유효하지 않습니다",
      );
    }
  }

  // Get current post images before updating
  const currentImages = await db.query.postImage.findMany({
    where: eq(postImageTable.postId, postId),
  });

  // Update the post in a transaction
  await db.transaction(async (tx) => {
    // Save current state to history before updating
    const historyResult = await tx
      .insert(postHistoryTable)
      .values({
        postId: postId,
        content: post.content,
        contentWarning: post.contentWarning,
        editedByProfileId: profileId,
      })
      .returning();

    const historyEntry = historyResult[0];
    if (!historyEntry) {
      throw new Error("Failed to create history entry");
    }

    // Save history images
    if (currentImages.length > 0) {
      const historyImageInserts = currentImages.map((pi) => ({
        postHistoryId: historyEntry.id,
        imageId: pi.imageId,
      }));
      await tx.insert(postHistoryImageTable).values(historyImageInserts);
    }

    // Update the post
    await tx
      .update(postTable)
      .set({
        content,
        contentWarning: contentWarning || null,
        ...(announcement !== undefined && { announcement }),
        updatedAt: sql`NOW()`,
      })
      .where(eq(postTable.id, postId));

    // Delete existing post images
    await tx.delete(postImageTable).where(eq(postImageTable.postId, postId));

    // Associate new images with the post
    if (imageIds && imageIds.length > 0) {
      const postImageInserts = imageIds.map((imageId) => ({
        postId: postId,
        imageId: imageId,
      }));

      await tx.insert(postImageTable).values(postImageInserts);
    }
  });

  // Get the updated post with author and images for response
  const updatedPost = await db.query.post.findFirst({
    where: eq(postTable.id, postId),
    with: {
      profile: {
        with: {
          profilePictures: {
            with: {
              image: true,
            },
          },
        },
      },
      postImages: {
        with: {
          image: true,
        },
      },
      postReactions: {
        with: {
          profile: true,
        },
      },
    },
  });

  const authorProfilePicture = updatedPost?.profile?.profilePictures.find(
    (pp) => pp.deletedAt === null,
  )?.image;
  const profile_picture_url = authorProfilePicture
    ? addImageUrl(authorProfilePicture).url
    : null;

  const images =
    updatedPost?.postImages.map((pi) => ({
      id: pi.image.id,
      url: addImageUrl(pi.image).url,
      width: pi.image.width,
      height: pi.image.height,
      filename: pi.image.filename,
    })) || [];

  return {
    id: updatedPost?.id,
    content: updatedPost?.content,
    created_at: formatISODate(updatedPost?.createdAt),
    updated_at: formatISODate(updatedPost?.updatedAt),
    announcement: updatedPost?.announcement,
    content_warning: updatedPost?.contentWarning,
    pinned_at: updatedPost?.pinnedAt
      ? formatISODate(updatedPost.pinnedAt)
      : null,
    in_reply_to_id: updatedPost?.inReplyToId,
    depth: updatedPost?.depth,
    root_post_id: updatedPost?.rootPostId ?? null,
    author: {
      id: updatedPost?.profile?.id,
      name: updatedPost?.profile?.name,
      username: updatedPost?.profile?.username,
      profile_picture_url,
    },
    images,
    is_bookmarked: false,
    replies: [],
    reply_count: 0,
    has_more_replies: false,
    reactions:
      updatedPost?.postReactions?.map((reaction) => ({
        emoji: reaction.emoji,
        user: {
          id: reaction.profile.id,
          username: reaction.profile.username,
          name: reaction.profile.name,
        },
      })) || [],
  };
}

/**
 * Get edit history for a post
 */
export async function getPostHistory(postId: string, communityId: string) {
  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Get all history entries for this post, ordered by most recent first
  const historyEntries = await db.query.postHistory.findMany({
    where: eq(postHistoryTable.postId, postId),
    orderBy: [desc(postHistoryTable.editedAt)],
    with: {
      postHistoryImages: {
        with: {
          image: true,
        },
      },
      profile: true,
    },
  });

  // Collect all editor profile IDs for batch loading profile pictures
  const editorProfileIds = new Set(
    historyEntries.map((entry) => entry.editedByProfileId),
  );

  // Batch load profile pictures for all editors
  const profilePictureMap = await batchLoadProfilePictures(
    Array.from(editorProfileIds),
  );

  // Format the history data
  const history = historyEntries.map((entry) => ({
    id: entry.id,
    content: entry.content,
    content_warning: entry.contentWarning,
    edited_at: formatISODate(entry.editedAt),
    edited_by: {
      id: entry.profile.id,
      name: entry.profile.name,
      username: entry.profile.username,
      profile_picture_url: profilePictureMap.get(entry.profile.id) || null,
    },
    images: entry.postHistoryImages.map((phi) => ({
      id: phi.image.id,
      url: addImageUrl(phi.image).url,
      width: phi.image.width,
      height: phi.image.height,
      filename: phi.image.filename,
    })),
  }));

  return history;
}

/**
 * Delete a post
 */
export async function deletePost(
  userId: string,
  profileId: string,
  postId: string,
  communityId: string,
) {
  // Validate post belongs to this community
  const hasAccess = await validatePostCommunityAccess(postId, communityId);
  if (!hasAccess) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Find the post (exclude already deleted posts)
  const post = await db.query.post.findFirst({
    where: and(
      eq(postTable.id, postId),
      eq(postTable.communityId, communityId),
      isNull(postTable.deletedAt),
    ),
    with: {
      profile: true,
    },
  });

  // Check if post exists and author is in the same community
  if (!post || post.profile?.communityId !== communityId) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "게시물을 찾을 수 없습니다",
    );
  }

  // Check if user has permission to delete this post
  const isPostAuthor = post.authorId === profileId;

  // Check if user is community owner or moderator
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  const isOwner = await membershipService.isUserCommunityOwner(
    userId,
    communityId,
  );
  const isModerator = membership?.role === "moderator";
  const canDeleteAnyPost = isOwner || isModerator;

  if (!(isPostAuthor || canDeleteAnyPost)) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "Only the post author, community owner, or moderator can delete posts",
    );
  }

  // Soft delete and log moderation in a transaction
  await db.transaction(async (tx) => {
    // Soft delete by setting the deleted timestamp
    await tx
      .update(postTable)
      .set({
        deletedAt: sql`NOW()`,
      })
      .where(eq(postTable.id, postId));

    // Log the moderation action if it wasn't the post author who deleted it
    if (!isPostAuthor) {
      const description = `@${
        post.profile?.username
      }의 게시물을 삭제했습니다: "${post.content.substring(0, 50)}${
        post.content.length > 50 ? "..." : ""
      }"`;
      await tx.insert(moderationLogTable).values({
        action: "delete_post",
        description: description,
        moderatorId: profileId,
        targetProfileId: post.authorId,
        targetPostId: post.id,
      });
    }
  });
}
