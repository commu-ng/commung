import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  notification as notificationTable,
  profile as profileTable,
  profileOwnership as profileOwnershipTable,
  userNotification as userNotificationTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";
import type { ProfilePicture } from "../types";
import { canUseProfile } from "../utils/profile-ownership";
import { addImageUrl } from "../utils/r2";

/**
 * Get notifications for an profile
 */
export async function getNotificationsForProfile(
  userId: string,
  communityId: string,
  profileId: string,
  limit: number = 20,
  cursor?: string,
) {
  // Validate user has access to this profile
  const hasAccess = await canUseProfile(userId, profileId);
  if (!hasAccess) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "프로필에 접근할 권한이 없습니다",
    );
  }

  // Get the profile details
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
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

  // Build base condition for count query
  const baseCondition = eq(notificationTable.recipientId, profile.id);

  // Build query conditions (with cursor)
  const queryConditions = [baseCondition];
  if (cursor) {
    queryConditions.push(sql`${notificationTable.id} < ${cursor}`);
  }

  // Run count and data queries in parallel
  const [notificationTableList, totalCountResult] = await Promise.all([
    // Get notifications for this profile (fetch limit + 1)
    db.query.notification.findMany({
      where: and(...queryConditions),
      orderBy: [desc(notificationTable.id)],
      limit: limit + 1,
      with: {
        profile_profileId: {
          with: {
            profilePictures: {
              with: {
                image: true,
              },
            },
          },
        },
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
          },
        },
      },
    }),
    // Count total notifications
    db
      .select({ count: count() })
      .from(notificationTable)
      .where(baseCondition),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;

  // Check if there are more results
  const hasMore = notificationTableList.length > limit;
  const notificationsToReturn = hasMore
    ? notificationTableList.slice(0, limit)
    : notificationTableList;
  const nextCursor =
    hasMore && notificationsToReturn.length > 0
      ? notificationsToReturn[notificationsToReturn.length - 1]?.id
      : null;

  // Filter out notifications where related content doesn't belong to this community
  const filteredNotifications = notificationsToReturn.filter((notification) => {
    // If notification has a sender profile, ensure it's in the same community and not deleted
    if (
      notification.profile_profileId &&
      (notification.profile_profileId.communityId !== communityId ||
        notification.profile_profileId.deletedAt !== null)
    ) {
      return false;
    }
    // If notification has a related post, ensure it's in the same community and not deleted
    if (
      notification.post &&
      (notification.post.communityId !== communityId ||
        notification.post.deletedAt !== null)
    ) {
      return false;
    }
    return true;
  });

  const data = filteredNotifications.map((notification) => {
    const sender = notification.profile_profileId;
    const senderProfilePicture = sender?.profilePictures.find(
      (pp: ProfilePicture) => pp.deletedAt === null,
    )?.image;
    const sender_profile_picture_url = senderProfilePicture
      ? addImageUrl(senderProfilePicture).url
      : null;

    let relatedPost = null;
    if (notification.post) {
      const post = notification.post;
      const author = post.profile;

      // Only include relatedPost if the author profile exists
      if (author) {
        const authorProfilePicture = author.profilePictures?.find(
          (pp: ProfilePicture) => pp.deletedAt === null,
        )?.image;
        const author_profile_picture_url = authorProfilePicture
          ? addImageUrl(authorProfilePicture).url
          : null;

        relatedPost = {
          id: post.id,
          content: post.content,
          author: {
            id: author.id,
            name: author.name,
            username: author.username,
            profile_picture_url: author_profile_picture_url,
          },
        };
      }
    }

    return {
      id: notification.id,
      type: notification.type,
      content: notification.message,
      read_at: notification.readAt
        ? new Date(notification.readAt).toISOString()
        : null,
      created_at: new Date(notification.createdAt).toISOString(),
      sender: sender
        ? {
            id: sender.id,
            name: sender.name,
            username: sender.username,
            profile_picture_url: sender_profile_picture_url,
          }
        : null,
      related_post: relatedPost,
    };
  });

  return {
    data,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: totalCount,
    },
  };
}

interface ConsoleNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  sender: {
    name: string;
    profile_picture_url: string | null;
  } | null;
  link: string;
  group: {
    kind: "community" | "board";
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Get recent unread notifications across every profile the user owns
 * AND every user-level notification they've received (board replies, etc.).
 * Powers the console home dashboard.
 */
export async function getRecentNotificationsForUser(
  userId: string,
  limit: number = 10,
) {
  const baseDomain = process.env.BASE_DOMAIN || "commu.ng";

  const ownerships = await db.query.profileOwnership.findMany({
    where: eq(profileOwnershipTable.userId, userId),
    columns: { profileId: true },
  });
  const profileIds = ownerships.map((o) => o.profileId);

  const profileUnreadCond =
    profileIds.length > 0
      ? and(
          inArray(notificationTable.recipientId, profileIds),
          isNull(notificationTable.readAt),
        )
      : null;
  const userUnreadCond = and(
    eq(userNotificationTable.recipientUserId, userId),
    isNull(userNotificationTable.readAt),
  );

  const [profileUnreadResult, userUnreadResult, profileRows, userRows] =
    await Promise.all([
      profileUnreadCond
        ? db
            .select({ count: count() })
            .from(notificationTable)
            .where(profileUnreadCond)
        : Promise.resolve([{ count: 0 }]),
      db
        .select({ count: count() })
        .from(userNotificationTable)
        .where(userUnreadCond),
      profileUnreadCond
        ? db.query.notification.findMany({
            where: profileUnreadCond,
            orderBy: [desc(notificationTable.id)],
            limit,
            with: {
              profile_profileId: {
                with: { profilePictures: { with: { image: true } } },
              },
              profile_recipientId: { with: { community: true } },
              post: { with: { profile: true } },
            },
          })
        : Promise.resolve([]),
      db.query.userNotification.findMany({
        where: userUnreadCond,
        orderBy: [desc(userNotificationTable.id)],
        limit,
        with: {
          actorUser: true,
          boardPost: { with: { board: true } },
        },
      }),
    ]);

  const profileItems: ConsoleNotification[] = profileRows
    .filter(
      (n) =>
        n.profile_recipientId &&
        n.profile_recipientId.deletedAt === null &&
        n.profile_recipientId.community &&
        n.profile_recipientId.community.deletedAt === null,
    )
    .map((n) => {
      const sender = n.profile_profileId;
      const senderPicture = sender?.profilePictures.find(
        (pp: ProfilePicture) => pp.deletedAt === null,
      )?.image;
      const senderProfilePictureUrl = senderPicture
        ? addImageUrl(senderPicture).url
        : null;

      // biome-ignore lint/style/noNonNullAssertion: filter above guarantees community exists
      const community = n.profile_recipientId!.community!;
      const customHost =
        community.customDomain && community.domainVerifiedAt
          ? community.customDomain
          : `${community.slug}.${baseDomain}`;
      const link = n.post?.profile
        ? `https://${customHost}/@${n.post.profile.username}/${n.post.id}`
        : `https://${customHost}/`;

      return {
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        created_at: new Date(n.createdAt).toISOString(),
        read_at: n.readAt ? new Date(n.readAt).toISOString() : null,
        sender: sender
          ? {
              name: sender.name,
              profile_picture_url: senderProfilePictureUrl,
            }
          : null,
        link,
        group: {
          kind: "community" as const,
          id: community.id,
          name: community.name,
          slug: community.slug,
        },
      };
    });

  const userItems: ConsoleNotification[] = userRows
    .filter((n) => n.boardPost)
    .map((n) => {
      // biome-ignore lint/style/noNonNullAssertion: filter above guarantees boardPost exists
      const boardPost = n.boardPost!;
      const board = boardPost.board;
      const actor = n.actorUser;

      return {
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        created_at: new Date(n.createdAt).toISOString(),
        read_at: n.readAt ? new Date(n.readAt).toISOString() : null,
        sender: actor
          ? {
              name: actor.loginName,
              profile_picture_url: null,
            }
          : null,
        link: `/boards/${board.slug}/posts/${boardPost.id}`,
        group: {
          kind: "board" as const,
          id: board.id,
          name: board.name,
          slug: board.slug,
        },
      };
    });

  const data = [...profileItems, ...userItems]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit);

  const totalUnread =
    Number(profileUnreadResult[0]?.count ?? 0) +
    Number(userUnreadResult[0]?.count ?? 0);

  return { data, total_unread: totalUnread };
}

/**
 * Get unread notification count for an profile
 */
export async function getUnreadCount(
  userId: string,
  communityId: string,
  profileId: string,
) {
  // Validate user has access to this profile
  const hasAccess = await canUseProfile(userId, profileId);
  if (!hasAccess) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "프로필에 접근할 권한이 없습니다",
    );
  }

  // Get the profile details
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
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

  // Get unread notification count
  const unreadCount = await db
    .select({ count: sql<string>`count(*)` })
    .from(notificationTable)
    .where(
      and(
        eq(notificationTable.recipientId, profile.id),
        isNull(notificationTable.readAt),
      ),
    );

  return Number(unreadCount[0]?.count ?? 0);
}

/**
 * Mark all notifications as read for an profile
 */
export async function markAllAsRead(
  userId: string,
  communityId: string,
  profileId: string,
) {
  // Validate user has access to this profile
  const hasAccess = await canUseProfile(userId, profileId);
  if (!hasAccess) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "프로필에 접근할 권한이 없습니다",
    );
  }

  // Get the profile details
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
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

  // Mark all notifications as read
  await db
    .update(notificationTable)
    .set({ readAt: sql`NOW()` })
    .where(
      and(
        eq(notificationTable.recipientId, profile.id),
        isNull(notificationTable.readAt),
      ),
    );
}

/**
 * Mark a specific notification as read
 */
export async function markAsRead(
  userId: string,
  communityId: string,
  profileId: string,
  notificationId: string,
) {
  // Validate user has access to this profile
  const hasAccess = await canUseProfile(userId, profileId);
  if (!hasAccess) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "프로필에 접근할 권한이 없습니다",
    );
  }

  // Get the profile details
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
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

  // Mark the specific notification as read
  const result = await db
    .update(notificationTable)
    .set({ readAt: sql`NOW()` })
    .where(
      and(
        eq(notificationTable.id, notificationId),
        eq(notificationTable.recipientId, profile.id),
      ),
    )
    .returning();

  if (result.length === 0) {
    throw new AppException(404, GENERAL_ERROR_CODE, "알림을 찾을 수 없습니다");
  }
}

/**
 * Mark a specific notification as unread
 */
export async function markAsUnread(
  userId: string,
  communityId: string,
  profileId: string,
  notificationId: string,
) {
  // Validate user has access to this profile
  const hasAccess = await canUseProfile(userId, profileId);
  if (!hasAccess) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "프로필에 접근할 권한이 없습니다",
    );
  }

  // Get the profile details
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
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

  // Mark the specific notification as unread
  const result = await db
    .update(notificationTable)
    .set({ readAt: null })
    .where(
      and(
        eq(notificationTable.id, notificationId),
        eq(notificationTable.recipientId, profile.id),
      ),
    )
    .returning();

  if (result.length === 0) {
    throw new AppException(404, GENERAL_ERROR_CODE, "알림을 찾을 수 없습니다");
  }
}
