import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../db";
import {
  community as communityTable,
  directMessageReaction as directMessageReactionTable,
  directMessage as directMessageTable,
  directMessageImage as directMessageImageTable,
  groupChatMembership as groupChatMembershipTable,
  groupChatMessageImage as groupChatMessageImageTable,
  groupChatMessageReaction as groupChatMessageReactionTable,
  groupChatMessageRead as groupChatMessageReadTable,
  groupChatMessage as groupChatMessageTable,
  groupChat as groupChatTable,
  image as imageTable,
  profileOwnership as profileOwnershipTable,
  profilePicture as profilePictureTable,
  profile as profileTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";
import {
  batchLoadProfilePictures,
  getProfilePictureUrl,
} from "../utils/profile-picture-helper";
import { addImageUrl } from "../utils/r2";
import { pushNotificationService } from "./push-notification.service";

/**
 * Get unread message count for an profile
 */
export async function getUnreadCount(profileId: string, communityId: string) {
  const unreadCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(directMessageTable)
    .where(
      and(
        eq(directMessageTable.receiverId, profileId),
        eq(directMessageTable.communityId, communityId),
        isNull(directMessageTable.readAt),
        isNull(directMessageTable.deletedAt),
      ),
    );

  return unreadCount[0]?.count ?? 0;
}

/**
 * Send a direct message
 */
export async function sendDirectMessage(
  userId: string,
  senderProfileId: string,
  receiverProfileId: string,
  communityId: string,
  content: string,
  imageIds?: string[],
) {
  // Validate sender profile exists in this community
  const senderProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, senderProfileId),
      eq(profileTable.communityId, communityId),
      isNotNull(profileTable.activatedAt),
      isNull(profileTable.deletedAt),
    ),
    with: {
      profilePictures: {
        with: {
          image: true,
        },
      },
    },
  });

  if (!senderProfile) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "발신자 프로필을 찾을 수 없거나 권한이 없습니다",
    );
  }

  // Validate receiver profile exists in the SAME community
  const receiverProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, receiverProfileId),
      eq(profileTable.communityId, communityId),
      isNotNull(profileTable.activatedAt),
      isNull(profileTable.deletedAt),
    ),
  });

  if (!receiverProfile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "수신자 프로필을 찾을 수 없습니다",
    );
  }

  // Can't send message to yourself
  if (senderProfileId === receiverProfile.id) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "자신에게 메시지를 보낼 수 없습니다",
    );
  }

  // Validate that at least content or images are provided
  if (!content.trim() && (!imageIds || imageIds.length === 0)) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "메시지 내용 또는 이미지를 제공해야 합니다",
    );
  }

  // Validate images if provided
  if (imageIds && imageIds.length > 0) {
    const images = await db.query.image.findMany({
      where: inArray(imageTable.id, imageIds),
    });

    if (images.length !== imageIds.length) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "일부 이미지를 찾을 수 없습니다",
      );
    }
  }

  const messageResult = await db
    .insert(directMessageTable)
    .values({
      senderId: senderProfileId,
      receiverId: receiverProfile.id,
      communityId: communityId,
      createdByUserId: userId,
      content,
    })
    .returning();

  const message = messageResult[0];
  if (!message) {
    throw new Error("Failed to send message");
  }

  // Insert image associations if images were provided
  if (imageIds && imageIds.length > 0) {
    await db.insert(directMessageImageTable).values(
      imageIds.map((imageId) => ({
        messageId: message.id,
        imageId,
      })),
    );
  }

  const senderProfilePicture = senderProfile.profilePictures.find(
    (pp) => pp.deletedAt === null,
  )?.image;
  const sender_profile_picture_url = senderProfilePicture
    ? addImageUrl(senderProfilePicture).url
    : null;

  // Fetch images for the message
  const messageImages =
    imageIds && imageIds.length > 0
      ? await db.query.image.findMany({
          where: inArray(imageTable.id, imageIds),
        })
      : [];

  // Send push notification to receiver (skip if sender and receiver are the same user)
  const receiverOwnership = await db.query.profileOwnership.findFirst({
    where: eq(profileOwnershipTable.profileId, receiverProfile.id),
    columns: {
      userId: true,
    },
  });

  if (receiverOwnership && receiverOwnership.userId !== userId) {
    // Get community for URL
    const community = await db.query.community.findFirst({
      where: eq(communityTable.id, communityId),
    });

    if (community) {
      const baseDomain = process.env.BASE_DOMAIN || "commu.ng";
      const communityUrl = `https://${community.slug}.${baseDomain}`;

      await pushNotificationService.sendPushNotification(
        receiverOwnership.userId,
        {
          title: senderProfile.name,
          body: content.trim() || "사진을 보냈습니다",
          data: {
            type: "direct_message",
            message_id: message.id,
            sender_id: senderProfileId,
            community_url: communityUrl,
            url: `${communityUrl}/messages/${senderProfile.username}`,
          },
        },
      );
    }
  }

  return {
    id: message.id,
    content: message.content,
    created_at: message.createdAt,
    read_at: message.readAt,
    is_sender: true,
    sender: {
      id: senderProfile.id,
      username: senderProfile.username,
      name: senderProfile.name,
      profile_picture_url: sender_profile_picture_url,
    },
    reactions: [],
    images: messageImages.map((img) => addImageUrl(img)),
  };
}

/**
 * Delete a direct message (soft delete)
 */
export async function deleteDirectMessage(
  profileId: string,
  messageId: string,
  communityId: string,
) {
  // Find the message and verify it belongs to the profile (as sender)
  const message = await db.query.directMessage.findFirst({
    where: and(
      eq(directMessageTable.id, messageId),
      eq(directMessageTable.senderId, profileId),
      eq(directMessageTable.communityId, communityId),
      isNull(directMessageTable.deletedAt),
    ),
  });

  if (!message) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "메시지를 찾을 수 없거나 삭제 권한이 없습니다",
    );
  }

  // Soft delete the message by setting the deleted timestamp
  await db
    .update(directMessageTable)
    .set({
      deletedAt: sql`NOW()`,
    })
    .where(eq(directMessageTable.id, messageId));
}

/**
 * Create a reaction on a direct message
 */
export async function createDirectMessageReaction(
  profileId: string,
  messageId: string,
  communityId: string,
  emoji: string,
) {
  // Validate the message exists and profile has access to it
  const message = await db.query.directMessage.findFirst({
    where: and(
      eq(directMessageTable.id, messageId),
      eq(directMessageTable.communityId, communityId),
      isNull(directMessageTable.deletedAt),
    ),
  });

  if (!message) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "메시지를 찾을 수 없습니다",
    );
  }

  // Check if profile is part of the conversation
  if (message.senderId !== profileId && message.receiverId !== profileId) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 메시지에 접근할 권한이 없습니다",
    );
  }

  // Check if reaction already exists
  const existingReaction = await db.query.directMessageReaction.findFirst({
    where: and(
      eq(directMessageReactionTable.messageId, messageId),
      eq(directMessageReactionTable.profileId, profileId),
      eq(directMessageReactionTable.emoji, emoji),
    ),
  });

  if (existingReaction) {
    throw new AppException(400, GENERAL_ERROR_CODE, "반응이 이미 존재합니다");
  }

  // Create the reaction
  const reactionResult = await db
    .insert(directMessageReactionTable)
    .values({
      messageId,
      profileId: profileId,
      emoji: emoji,
    })
    .returning();

  const reaction = reactionResult[0];
  if (!reaction) {
    throw new Error("Failed to create reaction");
  }

  return {
    id: reaction.id,
    message: "반응이 성공적으로 추가되었습니다",
    emoji: reaction.emoji,
  };
}

/**
 * Delete a reaction from a direct message
 */
export async function deleteDirectMessageReaction(
  profileId: string,
  messageId: string,
  communityId: string,
  emoji: string,
) {
  // Validate the message exists
  const message = await db.query.directMessage.findFirst({
    where: and(
      eq(directMessageTable.id, messageId),
      eq(directMessageTable.communityId, communityId),
      isNull(directMessageTable.deletedAt),
    ),
  });

  if (!message) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "메시지를 찾을 수 없습니다",
    );
  }

  // Check if profile is part of the conversation
  if (message.senderId !== profileId && message.receiverId !== profileId) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 메시지에 접근할 권한이 없습니다",
    );
  }

  // Find the reaction to delete
  const existingReaction = await db.query.directMessageReaction.findFirst({
    where: and(
      eq(directMessageReactionTable.messageId, messageId),
      eq(directMessageReactionTable.profileId, profileId),
      eq(directMessageReactionTable.emoji, emoji),
    ),
  });

  if (!existingReaction) {
    throw new AppException(404, GENERAL_ERROR_CODE, "반응을 찾을 수 없습니다");
  }

  // Delete the reaction
  await db
    .delete(directMessageReactionTable)
    .where(eq(directMessageReactionTable.id, existingReaction.id));
}

/**
 * Get list of conversations for an profile
 */
export async function getConversations(
  profileId: string,
  communityId: string,
  limit: number,
) {
  // Get recent messages involving this profile
  const messages = await db.query.directMessage.findMany({
    where: and(
      or(
        eq(directMessageTable.senderId, profileId),
        eq(directMessageTable.receiverId, profileId),
      ),
      eq(directMessageTable.communityId, communityId),
      isNull(directMessageTable.deletedAt),
    ),
    orderBy: [desc(directMessageTable.createdAt)],
    limit: 100, // Get more to extract unique conversations
  });

  if (messages.length === 0) {
    return [];
  }

  // Extract unique other profile IDs
  const otherProfileIds = new Set<string>();
  const conversationOrder: string[] = [];

  for (const message of messages) {
    const otherProfileId =
      message.senderId === profileId ? message.receiverId : message.senderId;

    if (!otherProfileIds.has(otherProfileId)) {
      otherProfileIds.add(otherProfileId);
      conversationOrder.push(otherProfileId);
    }
  }

  // Batch load all other profiles
  const otherProfiles = await db.query.profile.findMany({
    where: inArray(profileTable.id, Array.from(otherProfileIds)),
  });

  // Batch load profile pictures
  const profilePictureMap = await batchLoadProfilePictures(
    Array.from(otherProfileIds),
  );

  // Create profile map
  const profileMap = new Map(otherProfiles.map((p) => [p.id, p]));

  // Batch load unread counts for all conversations
  const unreadCounts = await db
    .select({
      senderId: directMessageTable.senderId,
      count: sql<number>`count(*)`,
    })
    .from(directMessageTable)
    .where(
      and(
        eq(directMessageTable.receiverId, profileId),
        inArray(directMessageTable.senderId, Array.from(otherProfileIds)),
        eq(directMessageTable.communityId, communityId),
        isNull(directMessageTable.readAt),
        isNull(directMessageTable.deletedAt),
      ),
    )
    .groupBy(directMessageTable.senderId);

  const unreadCountMap = new Map(
    unreadCounts.map((uc) => [uc.senderId, uc.count]),
  );

  // Find last message for each conversation
  const lastMessageMap = new Map<string, (typeof messages)[0]>();
  for (const message of messages) {
    const otherProfileId =
      message.senderId === profileId ? message.receiverId : message.senderId;

    if (!lastMessageMap.has(otherProfileId)) {
      lastMessageMap.set(otherProfileId, message);
    }
  }

  // Build result using pre-loaded data
  const result = [];
  for (const otherProfileId of conversationOrder.slice(0, limit)) {
    const otherProfile = profileMap.get(otherProfileId);
    const lastMessage = lastMessageMap.get(otherProfileId);

    if (!otherProfile || !lastMessage) continue;

    result.push({
      other_profile: {
        id: otherProfile.id,
        username: otherProfile.username,
        name: otherProfile.name,
        profile_picture_url: profilePictureMap.get(otherProfile.id) || null,
      },
      last_message: {
        id: lastMessage.id,
        content: lastMessage.content,
        created_at: lastMessage.createdAt,
        is_sender: lastMessage.senderId === profileId,
      },
      unread_count: String(unreadCountMap.get(otherProfileId) || 0),
    });
  }

  return result;
}

/**
 * Get conversation thread between two profiles
 */
export async function getConversationThread(
  profileId: string,
  otherProfileId: string,
  communityId: string,
  limit: number,
  cursor?: string,
) {
  // Get the profile with profile pictures
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
    with: {
      profilePictures: {
        with: {
          image: true,
        },
      },
    },
  });

  if (!profile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없습니다",
    );
  }

  // Validate other profile exists in the same community
  const otherProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, otherProfileId),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
    with: {
      profilePictures: {
        with: {
          image: true,
        },
      },
    },
  });

  if (!otherProfile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "다른 프로필을 찾을 수 없습니다",
    );
  }

  // Build base condition for the conversation
  const baseConditions = [
    or(
      and(
        eq(directMessageTable.senderId, profile.id),
        eq(directMessageTable.receiverId, otherProfile.id),
      ),
      and(
        eq(directMessageTable.senderId, otherProfile.id),
        eq(directMessageTable.receiverId, profile.id),
      ),
    ),
    eq(directMessageTable.communityId, communityId),
    isNull(directMessageTable.deletedAt),
  ];

  // Add cursor condition if provided
  const queryConditions = [...baseConditions];
  if (cursor) {
    queryConditions.push(sql`${directMessageTable.id} < ${cursor}`);
  }

  // Get conversation messages and count in parallel
  const [messages, totalCountResult] = await Promise.all([
    db.query.directMessage.findMany({
      where: and(...queryConditions),
      orderBy: [desc(directMessageTable.id)],
      limit: limit + 1, // Fetch one extra to check for more
      with: {
        directMessageReactions: {
          with: {
            profile: true,
          },
        },
        directMessageImages: {
          with: {
            image: true,
          },
        },
      },
    }),
    db
      .select({ count: count() })
      .from(directMessageTable)
      .where(and(...baseConditions)),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;
  const hasMore = messages.length > limit;
  const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

  const result = messagesToReturn.map((message) => {
    const sender = message.senderId === profile.id ? profile : otherProfile;
    const receiver = message.receiverId === profile.id ? profile : otherProfile;
    const senderProfilePicture = sender?.profilePictures.find(
      (pp) => pp.deletedAt === null,
    )?.image;
    const receiverProfilePicture = receiver?.profilePictures.find(
      (pp) => pp.deletedAt === null,
    )?.image;
    const sender_profile_picture_url = senderProfilePicture
      ? addImageUrl(senderProfilePicture).url
      : null;
    const receiver_profile_picture_url = receiverProfilePicture
      ? addImageUrl(receiverProfilePicture).url
      : null;

    return {
      id: message.id,
      content: message.content,
      created_at: message.createdAt,
      read_at: message.readAt,
      sender: {
        id: sender.id,
        name: sender.name,
        username: sender.username,
        profile_picture_url: sender_profile_picture_url,
      },
      receiver: {
        id: receiver.id,
        name: receiver.name,
        username: receiver.username,
        profile_picture_url: receiver_profile_picture_url,
      },
      is_sender: sender.id === profile.id,
      reactions:
        message.directMessageReactions?.map((reaction) => ({
          emoji: reaction.emoji,
          user: {
            id: reaction.profile.id,
            username: reaction.profile.username,
            name: reaction.profile.name,
          },
        })) || [],
      images:
        message.directMessageImages?.map((dmi) => addImageUrl(dmi.image)) || [],
    };
  });

  const nextCursor =
    hasMore && messagesToReturn.length > 0
      ? messagesToReturn[messagesToReturn.length - 1]?.id || null
      : null;

  return {
    messages: result.reverse(), // Reverse to get chronological order
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: totalCount,
    },
  };
}

/**
 * Mark conversation as read
 */
export async function markConversationAsRead(
  profileId: string,
  otherProfileId: string,
  communityId: string,
) {
  // Validate profile exists
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

  // Validate other profile exists in the same community
  const otherProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, otherProfileId),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
  });

  if (!otherProfile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "다른 프로필을 찾을 수 없습니다",
    );
  }

  // Mark all unread messages from other profile to this profile as read
  await db
    .update(directMessageTable)
    .set({ readAt: sql`NOW()` })
    .where(
      and(
        eq(directMessageTable.receiverId, profile.id),
        eq(directMessageTable.senderId, otherProfile.id),
        eq(directMessageTable.communityId, communityId),
        isNull(directMessageTable.readAt),
        isNull(directMessageTable.deletedAt),
      ),
    );
}

/**
 * Mark all direct messages as read for a profile
 */
export async function markAllDirectMessagesAsRead(
  profileId: string,
  communityId: string,
) {
  // Validate profile exists
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

  // Mark all unread messages received by this profile as read
  await db
    .update(directMessageTable)
    .set({ readAt: sql`NOW()` })
    .where(
      and(
        eq(directMessageTable.receiverId, profile.id),
        eq(directMessageTable.communityId, communityId),
        isNull(directMessageTable.readAt),
        isNull(directMessageTable.deletedAt),
      ),
    );
}

/**
 * List group chats for an profile
 */
export async function listGroupChats(
  profileId: string,
  _communityId: string,
  limit: number,
  offset: number,
) {
  // Get group chats where profile is a member, ordered by latest message time
  const membershipTableList = await db.query.groupChatMembership.findMany({
    where: eq(groupChatMembershipTable.profileId, profileId),
    with: {
      groupChat: {
        with: {
          groupChatMessages: {
            orderBy: [desc(groupChatMessageTable.createdAt)],
            limit: 1,
            with: {
              profile: true,
            },
          },
          groupChatMemberships: {
            with: {
              profile_profileId: true,
            },
          },
        },
      },
    },
    orderBy: [
      sql`(
        SELECT MAX(gcm.created_at)
        FROM group_chat_message gcm
        WHERE gcm.group_chat_id = ${groupChatMembershipTable.groupChatId}
        AND gcm.deleted_at IS NULL
      ) DESC NULLS LAST`,
    ],
    limit,
    offset,
  });

  // Collect all profile IDs and group chat IDs
  const profileIds = new Set<string>();
  const groupChatIds: string[] = [];

  membershipTableList.forEach((membership) => {
    if (membership.groupChat?.groupChatMessages?.[0]?.profile?.id) {
      profileIds.add(membership.groupChat.groupChatMessages[0].profile.id);
    }
    membership.groupChat?.groupChatMemberships?.forEach((member) => {
      if (member.profile_profileId?.id) {
        profileIds.add(member.profile_profileId.id);
      }
    });
    if (membership.groupChat?.id) {
      groupChatIds.push(membership.groupChat.id);
    }
  });

  // Batch load profile pictures and unread counts
  const [profilePicturesMap, unreadCounts] = await Promise.all([
    batchLoadProfilePictures(Array.from(profileIds)),
    // Batch load unread counts for all group chats
    groupChatIds.length > 0
      ? db
          .select({
            groupChatId: groupChatMessageTable.groupChatId,
            count: sql<number>`count(*)`,
          })
          .from(groupChatMessageTable)
          .leftJoin(
            groupChatMessageReadTable,
            and(
              eq(groupChatMessageReadTable.messageId, groupChatMessageTable.id),
              eq(groupChatMessageReadTable.profileId, profileId),
            ),
          )
          .where(
            and(
              inArray(groupChatMessageTable.groupChatId, groupChatIds),
              isNull(groupChatMessageTable.deletedAt),
              isNull(groupChatMessageReadTable.id), // Message not read by this profile
              sql`${groupChatMessageTable.senderId} != ${profileId}`, // Exclude own messages
            ),
          )
          .groupBy(groupChatMessageTable.groupChatId)
      : Promise.resolve([]),
  ]);

  // Create unread count map for O(1) lookup
  const unreadCountMap = new Map(
    unreadCounts.map((uc) => [uc.groupChatId, uc.count]),
  );

  const result = [];
  const filteredMemberships = membershipTableList.filter(
    (membership) => membership.groupChat,
  );

  for (const membership of filteredMemberships) {
    const groupChat = membership.groupChat;
    const lastMessage = groupChat?.groupChatMessages?.[0];

    let lastMessageData = null;
    if (lastMessage?.profile) {
      const sender = lastMessage.profile;

      lastMessageData = {
        id: lastMessage.id,
        content: lastMessage.content,
        created_at: lastMessage.createdAt,
        sender: {
          id: sender.id,
          name: sender.name,
          username: sender.username,
          profile_picture_url: profilePicturesMap.get(sender.id) || null,
        },
        is_sender: sender.id === profileId,
      };
    }

    const members =
      groupChat?.groupChatMemberships?.map((member) => {
        const memberProfile = member.profile_profileId;

        return {
          id: memberProfile.id,
          name: memberProfile.name,
          username: memberProfile.username,
          profile_picture_url: profilePicturesMap.get(memberProfile.id) || null,
        };
      }) || [];

    // Get unread count from pre-loaded data
    const unreadCount = unreadCountMap.get(groupChat?.id || "") || 0;

    result.push({
      id: groupChat?.id,
      name: groupChat?.name,
      created_at: groupChat?.createdAt,
      updated_at: groupChat?.updatedAt,
      created_by_id: groupChat?.createdById,
      last_message: lastMessageData,
      members,
      member_count: members.length,
      unread_count: unreadCount,
    });
  }

  return result;
}

/**
 * Create a group chat
 */
export async function createGroupChat(
  name: string,
  memberProfileIds: string[],
  creatorProfileId: string,
  communityId: string,
) {
  // Verify all member profiles exist in the community
  const memberProfiles = await db.query.profile.findMany({
    where: and(
      inArray(profileTable.id, memberProfileIds),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
  });

  if (memberProfiles.length !== memberProfileIds.length) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "한 명 이상의 멤버 프로필을 찾을 수 없습니다",
    );
  }

  // Create the group chat and memberships in a transaction
  const newGroupChat = await db.transaction(async (tx) => {
    // Create the group chat
    const groupChatResult = await tx
      .insert(groupChatTable)
      .values({
        name,
        communityId: communityId,
        createdById: creatorProfileId,
      })
      .returning();

    const groupChat = groupChatResult[0];
    if (!groupChat) {
      throw new Error("Failed to create group chat");
    }

    // Add creator to membership
    await tx.insert(groupChatMembershipTable).values({
      groupChatId: groupChat.id,
      profileId: creatorProfileId,
      addedById: creatorProfileId,
    });

    // Add all members to membership
    const membershipValues = memberProfileIds
      .filter((id) => id !== creatorProfileId) // Don't add creator twice
      .map((profileId) => ({
        groupChatId: groupChat.id,
        profileId,
        addedById: creatorProfileId,
      }));

    if (membershipValues.length > 0) {
      await tx.insert(groupChatMembershipTable).values(membershipValues);
    }

    return groupChat;
  });

  return {
    id: newGroupChat.id,
    name: newGroupChat.name,
    created_at: newGroupChat.createdAt,
    updated_at: newGroupChat.updatedAt,
    created_by_id: newGroupChat.createdById,
    member_count: memberProfileIds.length,
    unread_count: 0, // New group chat has no messages yet
  };
}

/**
 * Get group chat details with members
 */
export async function getGroupChatDetails(
  groupChatId: string,
  profileId: string,
  communityId: string,
) {
  // Verify user is a member of the group chat
  const membership = await db.query.groupChatMembership.findFirst({
    where: and(
      eq(groupChatMembershipTable.groupChatId, groupChatId),
      eq(groupChatMembershipTable.profileId, profileId),
    ),
  });

  if (!membership) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 그룹 채팅에 대한 접근이 거부되었습니다",
    );
  }

  // Get group chat details with members
  const groupChat = await db.query.groupChat.findFirst({
    where: and(
      eq(groupChatTable.id, groupChatId),
      eq(groupChatTable.communityId, communityId),
      isNull(groupChatTable.deletedAt),
    ),
    with: {
      groupChatMemberships: {
        with: {
          profile_profileId: true,
        },
      },
    },
  });

  if (!groupChat) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "그룹 채팅을 찾을 수 없습니다",
    );
  }

  // Collect member profile IDs
  const memberProfileIds = groupChat.groupChatMemberships.map(
    (m) => m.profile_profileId.id,
  );

  // Batch load profile pictures for all members
  const memberProfilePicturesMap =
    await batchLoadProfilePictures(memberProfileIds);

  // Format member data
  const members = groupChat.groupChatMemberships.map((membership) => {
    return {
      id: membership.profile_profileId.id,
      name: membership.profile_profileId.name,
      username: membership.profile_profileId.username,
      profile_picture_url:
        memberProfilePicturesMap.get(membership.profile_profileId.id) || null,
    };
  });

  return {
    id: groupChat.id,
    name: groupChat.name,
    created_at: groupChat.createdAt,
    updated_at: groupChat.updatedAt,
    created_by_id: groupChat.createdById,
    members,
    member_count: members.length,
  };
}

/**
 * Get messages for a group chat
 */
export async function getGroupChatMessages(
  groupChatId: string,
  profileId: string,
  communityId: string,
) {
  // Verify the group chat exists and belongs to this community
  const groupChat = await db.query.groupChat.findFirst({
    where: and(
      eq(groupChatTable.id, groupChatId),
      eq(groupChatTable.communityId, communityId),
      isNull(groupChatTable.deletedAt),
    ),
  });

  if (!groupChat) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "그룹 채팅을 찾을 수 없습니다",
    );
  }

  // Verify user is a member of the group chat
  const membership = await db.query.groupChatMembership.findFirst({
    where: and(
      eq(groupChatMembershipTable.groupChatId, groupChatId),
      eq(groupChatMembershipTable.profileId, profileId),
    ),
  });

  if (!membership) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 그룹 채팅에 대한 접근이 거부되었습니다",
    );
  }

  // Get messages for the group chat
  const messages = await db.query.groupChatMessage.findMany({
    where: and(
      eq(groupChatMessageTable.groupChatId, groupChatId),
      isNull(groupChatMessageTable.deletedAt),
    ),
    with: {
      profile: {
        with: {
          profilePictures: {
            where: isNull(profilePictureTable.deletedAt),
            with: {
              image: true,
            },
          },
        },
      },
      groupChatMessageReactions: {
        with: {
          profile: true,
        },
      },
      groupChatMessageImages: {
        with: {
          image: true,
        },
      },
    },
    orderBy: [asc(groupChatMessageTable.createdAt)],
    limit: 100,
  });

  // Collect unique profile IDs from reactions
  const reactionProfileIds = new Set<string>();
  messages.forEach((message) => {
    message.groupChatMessageReactions.forEach((reaction) => {
      reactionProfileIds.add(reaction.profile.id);
    });
  });

  // Batch load profile pictures for reaction profiles
  const reactionProfilePicturesMap = await batchLoadProfilePictures(
    Array.from(reactionProfileIds),
  );

  // Format message data with aggregated reactions
  const formattedMessages = messages.map((message) => {
    const profilePicture = message.profile.profilePictures[0]?.image;
    const profile_picture_url = profilePicture
      ? addImageUrl(profilePicture).url
      : null;

    // Aggregate reactions by emoji
    const reactionsByEmoji = new Map<
      string,
      {
        emoji: string;
        count: number;
        profiles: Array<{
          id: string;
          name: string;
          username: string;
          profile_picture_url: string | null;
        }>;
      }
    >();

    message.groupChatMessageReactions.forEach((reaction) => {
      const existing = reactionsByEmoji.get(reaction.emoji);
      const profileData = {
        id: reaction.profile.id,
        name: reaction.profile.name,
        username: reaction.profile.username,
        profile_picture_url:
          reactionProfilePicturesMap.get(reaction.profile.id) || null,
      };

      if (existing) {
        existing.count++;
        existing.profiles.push(profileData);
      } else {
        reactionsByEmoji.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          profiles: [profileData],
        });
      }
    });

    const reactions = Array.from(reactionsByEmoji.values());

    return {
      id: message.id,
      content: message.content,
      created_at: message.createdAt,
      sender: {
        id: message.profile.id,
        name: message.profile.name,
        username: message.profile.username,
        profile_picture_url,
      },
      is_sender: message.senderId === profileId,
      reactions,
      images:
        message.groupChatMessageImages?.map((mi) => addImageUrl(mi.image)) ||
        [],
    };
  });

  return formattedMessages;
}

/**
 * Send a message to a group chat
 */
export async function sendGroupChatMessage(
  userId: string,
  groupChatId: string,
  profileId: string,
  content: string,
  communityId: string,
  imageIds?: string[],
) {
  // Verify the group chat exists and belongs to this community
  const groupChat = await db.query.groupChat.findFirst({
    where: and(
      eq(groupChatTable.id, groupChatId),
      eq(groupChatTable.communityId, communityId),
      isNull(groupChatTable.deletedAt),
    ),
  });

  if (!groupChat) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "그룹 채팅을 찾을 수 없습니다",
    );
  }

  // Verify user is a member of the group chat
  const membership = await db.query.groupChatMembership.findFirst({
    where: and(
      eq(groupChatMembershipTable.groupChatId, groupChatId),
      eq(groupChatMembershipTable.profileId, profileId),
    ),
  });

  if (!membership) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 그룹 채팅에 대한 접근이 거부되었습니다",
    );
  }

  // Get profile with profile picture
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.id, profileId),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
    with: {
      profilePictures: {
        where: isNull(profilePictureTable.deletedAt),
        with: {
          image: true,
        },
      },
    },
  });

  if (!profile) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없거나 권한이 없습니다",
    );
  }

  // Validate that at least content or images are provided
  if (!content.trim() && (!imageIds || imageIds.length === 0)) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "메시지 내용 또는 이미지를 제공해야 합니다",
    );
  }

  // Validate images if provided
  if (imageIds && imageIds.length > 0) {
    const images = await db.query.image.findMany({
      where: inArray(imageTable.id, imageIds),
    });

    if (images.length !== imageIds.length) {
      throw new AppException(
        404,
        GENERAL_ERROR_CODE,
        "하나 이상의 이미지를 찾을 수 없습니다",
      );
    }
  }

  // Create the message
  const messageResult = await db
    .insert(groupChatMessageTable)
    .values({
      content,
      groupChatId: groupChatId,
      senderId: profileId,
      createdByUserId: userId,
    })
    .returning();

  const newMessage = messageResult[0];
  if (!newMessage) {
    throw new Error("Failed to create message");
  }

  // Associate images with the message
  if (imageIds && imageIds.length > 0) {
    await db.insert(groupChatMessageImageTable).values(
      imageIds.map((imageId) => ({
        messageId: newMessage.id,
        imageId,
      })),
    );
  }

  // Get images for response
  const messageImages = imageIds
    ? await db.query.groupChatMessageImage.findMany({
        where: eq(groupChatMessageImageTable.messageId, newMessage.id),
        with: {
          image: true,
        },
      })
    : [];

  // Get sender info for response
  const profilePicture = profile.profilePictures[0]?.image;
  const profile_picture_url = profilePicture
    ? addImageUrl(profilePicture).url
    : null;

  // Send push notifications to all group members except sender
  const allMemberships = await db.query.groupChatMembership.findMany({
    where: eq(groupChatMembershipTable.groupChatId, groupChatId),
    columns: {
      profileId: true,
    },
  });

  const recipientProfileIds = allMemberships
    .map((m) => m.profileId)
    .filter((id) => id !== profileId);

  if (recipientProfileIds.length > 0) {
    // Get user IDs for all recipient profiles
    const recipientOwnerships = await db.query.profileOwnership.findMany({
      where: inArray(profileOwnershipTable.profileId, recipientProfileIds),
      columns: {
        profileId: true,
        userId: true,
      },
    });

    // Filter out recipients whose user account matches the sender's user account
    const recipientUserIds = [
      ...new Set(
        recipientOwnerships
          .filter((o) => o.userId !== userId)
          .map((o) => o.userId),
      ),
    ];

    if (recipientUserIds.length > 0) {
      // Get community for URL
      const community = await db.query.community.findFirst({
        where: eq(communityTable.id, communityId),
      });

      if (community) {
        const baseDomain = process.env.BASE_DOMAIN || "commu.ng";
        const communityUrl = `https://${community.slug}.${baseDomain}`;

        // Send push notification to each recipient
        for (const recipientUserId of recipientUserIds) {
          await pushNotificationService.sendPushNotification(recipientUserId, {
            title: `${profile.name} - ${groupChat.name || "그룹 채팅"}`,
            body: content.trim() || "사진을 보냈습니다",
            data: {
              type: "group_message",
              message_id: newMessage.id,
              group_chat_id: groupChatId,
              sender_id: profileId,
              community_url: communityUrl,
              url: `${communityUrl}/group-chats/${groupChatId}`,
            },
          });
        }
      }
    }
  }

  return {
    id: newMessage.id,
    content: newMessage.content,
    created_at: newMessage.createdAt,
    sender: {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      profile_picture_url,
    },
    is_sender: true,
    images: messageImages.map((mi) => addImageUrl(mi.image)),
  };
}

/**
 * Create a reaction on a group chat message
 */
export async function createGroupChatMessageReaction(
  profileId: string,
  messageId: string,
  groupChatId: string,
  communityId: string,
  emoji: string,
) {
  // Verify the group chat exists and belongs to this community
  const groupChat = await db.query.groupChat.findFirst({
    where: and(
      eq(groupChatTable.id, groupChatId),
      eq(groupChatTable.communityId, communityId),
      isNull(groupChatTable.deletedAt),
    ),
  });

  if (!groupChat) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "그룹 채팅을 찾을 수 없습니다",
    );
  }

  // Verify user is a member of the group chat
  const membership = await db.query.groupChatMembership.findFirst({
    where: and(
      eq(groupChatMembershipTable.groupChatId, groupChatId),
      eq(groupChatMembershipTable.profileId, profileId),
    ),
  });

  if (!membership) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 그룹 채팅에 대한 접근이 거부되었습니다",
    );
  }

  // Validate the message exists in the group chat
  const message = await db.query.groupChatMessage.findFirst({
    where: and(
      eq(groupChatMessageTable.id, messageId),
      eq(groupChatMessageTable.groupChatId, groupChatId),
      isNull(groupChatMessageTable.deletedAt),
    ),
  });

  if (!message) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "메시지를 찾을 수 없습니다",
    );
  }

  // Check if reaction already exists
  const existingReaction = await db.query.groupChatMessageReaction.findFirst({
    where: and(
      eq(groupChatMessageReactionTable.messageId, messageId),
      eq(groupChatMessageReactionTable.profileId, profileId),
      eq(groupChatMessageReactionTable.emoji, emoji),
    ),
  });

  if (existingReaction) {
    throw new AppException(400, GENERAL_ERROR_CODE, "반응이 이미 존재합니다");
  }

  // Create the reaction
  const reactionResult = await db
    .insert(groupChatMessageReactionTable)
    .values({
      messageId,
      profileId,
      emoji,
    })
    .returning();

  const reaction = reactionResult[0];
  if (!reaction) {
    throw new Error("Failed to create reaction");
  }

  return {
    id: reaction.id,
    message: "반응이 성공적으로 추가되었습니다",
    emoji: reaction.emoji,
  };
}

/**
 * Delete a reaction from a group chat message
 */
export async function deleteGroupChatMessageReaction(
  profileId: string,
  messageId: string,
  groupChatId: string,
  communityId: string,
  emoji: string,
) {
  // Verify the group chat exists and belongs to this community
  const groupChat = await db.query.groupChat.findFirst({
    where: and(
      eq(groupChatTable.id, groupChatId),
      eq(groupChatTable.communityId, communityId),
      isNull(groupChatTable.deletedAt),
    ),
  });

  if (!groupChat) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "그룹 채팅을 찾을 수 없습니다",
    );
  }

  // Verify user is a member of the group chat
  const membership = await db.query.groupChatMembership.findFirst({
    where: and(
      eq(groupChatMembershipTable.groupChatId, groupChatId),
      eq(groupChatMembershipTable.profileId, profileId),
    ),
  });

  if (!membership) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 그룹 채팅에 대한 접근이 거부되었습니다",
    );
  }

  // Validate the message exists in the group chat
  const message = await db.query.groupChatMessage.findFirst({
    where: and(
      eq(groupChatMessageTable.id, messageId),
      eq(groupChatMessageTable.groupChatId, groupChatId),
      isNull(groupChatMessageTable.deletedAt),
    ),
  });

  if (!message) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "메시지를 찾을 수 없습니다",
    );
  }

  // Find the reaction to delete
  const existingReaction = await db.query.groupChatMessageReaction.findFirst({
    where: and(
      eq(groupChatMessageReactionTable.messageId, messageId),
      eq(groupChatMessageReactionTable.profileId, profileId),
      eq(groupChatMessageReactionTable.emoji, emoji),
    ),
  });

  if (!existingReaction) {
    throw new AppException(404, GENERAL_ERROR_CODE, "반응을 찾을 수 없습니다");
  }

  // Delete the reaction
  await db
    .delete(groupChatMessageReactionTable)
    .where(eq(groupChatMessageReactionTable.id, existingReaction.id));
}

/**
 * Mark all unread messages in a group chat as read for a profile
 */
export async function markGroupChatMessagesAsRead(
  groupChatId: string,
  profileId: string,
  communityId: string,
) {
  // Verify the group chat exists and belongs to this community
  const groupChat = await db.query.groupChat.findFirst({
    where: and(
      eq(groupChatTable.id, groupChatId),
      eq(groupChatTable.communityId, communityId),
      isNull(groupChatTable.deletedAt),
    ),
  });

  if (!groupChat) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "그룹 채팅을 찾을 수 없습니다",
    );
  }

  // Verify user is a member of the group chat
  const membership = await db.query.groupChatMembership.findFirst({
    where: and(
      eq(groupChatMembershipTable.groupChatId, groupChatId),
      eq(groupChatMembershipTable.profileId, profileId),
    ),
  });

  if (!membership) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 그룹 채팅에 대한 접근이 거부되었습니다",
    );
  }

  // Get all unread messages for this profile in this group chat
  const unreadMessages = await db
    .select({ messageId: groupChatMessageTable.id })
    .from(groupChatMessageTable)
    .leftJoin(
      groupChatMessageReadTable,
      and(
        eq(groupChatMessageReadTable.messageId, groupChatMessageTable.id),
        eq(groupChatMessageReadTable.profileId, profileId),
      ),
    )
    .where(
      and(
        eq(groupChatMessageTable.groupChatId, groupChatId),
        isNull(groupChatMessageTable.deletedAt),
        isNull(groupChatMessageReadTable.id), // Message not read by this profile
      ),
    );

  // Insert read records for all unread messages
  if (unreadMessages.length > 0) {
    const readRecords = unreadMessages.map((msg) => ({
      messageId: msg.messageId,
      profileId: profileId,
      readAt: sql`NOW()`,
    }));

    await db.insert(groupChatMessageReadTable).values(readRecords);
  }
}

/**
 * Get all conversations for export (no limits)
 * Returns Map of conversationKey -> messages
 */
export async function getAllConversationsForExport(
  communityId: string,
  userProfileIds: string[],
) {
  if (userProfileIds.length === 0) {
    return new Map<string, unknown[]>();
  }

  // Get all messages where user is sender or receiver
  const messages = await db.query.directMessage.findMany({
    where: and(
      eq(directMessageTable.communityId, communityId),
      isNull(directMessageTable.deletedAt),
      or(
        inArray(directMessageTable.senderId, userProfileIds),
        inArray(directMessageTable.receiverId, userProfileIds),
      ),
    ),
    orderBy: [asc(directMessageTable.createdAt)],
    with: {
      directMessageReactions: {
        with: {
          profile: true,
        },
      },
    },
  });

  if (messages.length === 0) {
    return new Map();
  }

  // Get all unique profile IDs (senders and receivers)
  const allProfileIds = new Set<string>();
  for (const msg of messages) {
    allProfileIds.add(msg.senderId);
    allProfileIds.add(msg.receiverId);
  }

  // Batch load all profiles with profile pictures
  const profiles = await db.query.profile.findMany({
    where: inArray(profileTable.id, Array.from(allProfileIds)),
    with: {
      profilePictures: {
        where: isNull(profilePictureTable.deletedAt),
        with: {
          image: true,
        },
      },
    },
  });

  // Build profile map with profile picture URLs
  const profileMap = new Map(
    profiles.map((p) => [
      p.id,
      {
        ...p,
        profilePictureUrl: getProfilePictureUrl(p.profilePictures),
      },
    ]),
  );

  // Group by conversation
  const conversationMap = new Map<string, unknown[]>();
  for (const message of messages) {
    const sender = profileMap.get(message.senderId);
    const receiver = profileMap.get(message.receiverId);

    if (!sender || !receiver) continue;

    const conversationKey = [message.senderId, message.receiverId]
      .sort()
      .join(":");

    if (!conversationMap.has(conversationKey)) {
      conversationMap.set(conversationKey, []);
    }

    conversationMap.get(conversationKey)?.push({
      id: message.id,
      content: message.content,
      created_at: message.createdAt,
      sender: {
        id: sender.id,
        name: sender.name,
        username: sender.username,
        profilePictureUrl: sender.profilePictureUrl || null,
      },
      receiver: {
        id: receiver.id,
        name: receiver.name,
        username: receiver.username,
        profilePictureUrl: receiver.profilePictureUrl || null,
      },
      reactions:
        message.directMessageReactions?.map((r) => ({
          emoji: r.emoji,
          user: {
            id: r.profile.id,
            username: r.profile.username,
            name: r.profile.name,
          },
        })) || [],
    });
  }

  return conversationMap;
}

/**
 * Get all group chats with all messages for export (no limits)
 */
export async function getAllGroupChatsForExport(
  communityId: string,
  userProfileIds: string[],
) {
  if (userProfileIds.length === 0) {
    return [];
  }

  // Get user's group chat memberships
  const memberships = await db.query.groupChatMembership.findMany({
    where: inArray(groupChatMembershipTable.profileId, userProfileIds),
  });

  const groupChatIds = [...new Set(memberships.map((m) => m.groupChatId))];

  if (groupChatIds.length === 0) {
    return [];
  }

  // Get group chats
  const groupChats = await db.query.groupChat.findMany({
    where: and(
      eq(groupChatTable.communityId, communityId),
      isNull(groupChatTable.deletedAt),
      inArray(groupChatTable.id, groupChatIds),
    ),
    orderBy: [asc(groupChatTable.createdAt)],
  });

  const exportGroupChats = [];

  for (const chat of groupChats) {
    // Get ALL messages for this chat (no limit)
    const messagesWithSender = await db.query.groupChatMessage.findMany({
      where: and(
        eq(groupChatMessageTable.groupChatId, chat.id),
        isNull(groupChatMessageTable.deletedAt),
      ),
      orderBy: [asc(groupChatMessageTable.createdAt)],
      with: {
        profile: {
          with: {
            profilePictures: {
              where: isNull(profilePictureTable.deletedAt),
              with: {
                image: true,
              },
            },
          },
        },
        groupChatMessageImages: {
          with: {
            image: true,
          },
        },
        groupChatMessageReactions: {
          with: {
            profile: true,
          },
        },
      },
    });

    exportGroupChats.push({
      id: chat.id,
      name: chat.name,
      created_at: chat.createdAt,
      messages: messagesWithSender
        .filter((m) => m.profile !== null)
        .map((m) => {
          if (!m.profile)
            throw new Error("Sender should not be null after filtering");
          return {
            id: m.id,
            content: m.content,
            created_at: m.createdAt,
            sender: {
              id: m.profile.id,
              name: m.profile.name,
              username: m.profile.username,
              profilePictureUrl:
                getProfilePictureUrl(m.profile.profilePictures) || null,
            },
            images:
              m.groupChatMessageImages?.map((img) => ({
                id: img.image.id,
                url: addImageUrl(img.image).url,
                width: img.image.width,
                height: img.image.height,
                filename: img.image.filename,
              })) || [],
            reactions:
              m.groupChatMessageReactions?.map((r) => ({
                emoji: r.emoji,
                user: {
                  id: r.profile.id,
                  username: r.profile.username,
                  name: r.profile.name,
                },
              })) || [],
          };
        }),
    });
  }

  return exportGroupChats;
}
