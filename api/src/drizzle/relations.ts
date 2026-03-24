import { relations } from "drizzle-orm/relations";
import {
  applicationAttachment,
  board,
  boardHashtag,
  boardPost,
  boardPostHashtag,
  community,
  communityApplication,
  communityBannerImage,
  communityBoard,
  communityBoardPost,
  communityBoardPostReply,
  communityDescriptionImage,
  communityHashtag,
  communityLink,
  directMessage,
  directMessageDeletion,
  directMessageImage,
  directMessageReaction,
  exchangeToken,
  groupChat,
  groupChatMembership,
  groupChatMessage,
  groupChatMessageDeletion,
  groupChatMessageImage,
  groupChatMessageReaction,
  groupChatMessageRead,
  hashtag,
  image,
  membership,
  mention,
  moderationLog,
  notification,
  post,
  postBookmark,
  postHistory,
  postHistoryImage,
  postImage,
  postReaction,
  profile,
  profileOwnership,
  profilePicture,
  session,
  user,
  userBlock,
} from "./schema";

export const groupChatRelations = relations(groupChat, ({ one, many }) => ({
  community: one(community, {
    fields: [groupChat.communityId],
    references: [community.id],
  }),
  profile: one(profile, {
    fields: [groupChat.createdById],
    references: [profile.id],
  }),
  groupChatMemberships: many(groupChatMembership),
  groupChatMessages: many(groupChatMessage),
}));

export const communityRelations = relations(community, ({ many }) => ({
  groupChats: many(groupChat),
  communityBannerImages: many(communityBannerImage),
  communityDescriptionImages: many(communityDescriptionImage),
  profiles: many(profile),
  communityApplications: many(communityApplication),
  communityLinks: many(communityLink),
  directMessages: many(directMessage),
  memberships: many(membership),
  communityHashtags: many(communityHashtag),
  communityBoards: many(communityBoard),
}));

export const profileRelations = relations(profile, ({ one, many }) => ({
  groupChats: many(groupChat),
  groupChatMemberships_profileId: many(groupChatMembership, {
    relationName: "groupChatMembership_profileId_profile_id",
  }),
  groupChatMemberships_addedById: many(groupChatMembership, {
    relationName: "groupChatMembership_addedById_profile_id",
  }),
  groupChatMessages: many(groupChatMessage),
  groupChatMessageReads: many(groupChatMessageRead),
  groupChatMessageReactions: many(groupChatMessageReaction),
  community: one(community, {
    fields: [profile.communityId],
    references: [community.id],
  }),
  profilePictures: many(profilePicture),
  mentions: many(mention),
  postReactions: many(postReaction),
  directMessageReactions: many(directMessageReaction),
  directMessages_receiverId: many(directMessage, {
    relationName: "directMessage_receiverId_profile_id",
  }),
  directMessages_senderId: many(directMessage, {
    relationName: "directMessage_senderId_profile_id",
  }),
  posts: many(post),
  postBookmarks: many(postBookmark),
  moderationLogs_moderatorId: many(moderationLog, {
    relationName: "moderationLog_moderatorId_profile_id",
  }),
  moderationLogs_targetProfileId: many(moderationLog, {
    relationName: "moderationLog_targetProfileId_profile_id",
  }),
  notifications_profileId: many(notification, {
    relationName: "notification_profileId_profile_id",
  }),
  notifications_recipientId: many(notification, {
    relationName: "notification_recipientId_profile_id",
  }),
  ownerships: many(profileOwnership),
  mutedBy: one(profile, {
    fields: [profile.mutedById],
    references: [profile.id],
    relationName: "profile_mutedBy_profile_id",
  }),
  mutedProfiles: many(profile, {
    relationName: "profile_mutedBy_profile_id",
  }),
}));

export const profileOwnershipRelations = relations(
  profileOwnership,
  ({ one }) => ({
    profile: one(profile, {
      fields: [profileOwnership.profileId],
      references: [profile.id],
    }),
    user: one(user, {
      fields: [profileOwnership.userId],
      references: [user.id],
    }),
    createdByUser: one(user, {
      fields: [profileOwnership.createdBy],
      references: [user.id],
      relationName: "profileOwnership_createdBy_user_id",
    }),
  }),
);

export const groupChatMembershipRelations = relations(
  groupChatMembership,
  ({ one }) => ({
    groupChat: one(groupChat, {
      fields: [groupChatMembership.groupChatId],
      references: [groupChat.id],
    }),
    profile_profileId: one(profile, {
      fields: [groupChatMembership.profileId],
      references: [profile.id],
      relationName: "groupChatMembership_profileId_profile_id",
    }),
    profile_addedById: one(profile, {
      fields: [groupChatMembership.addedById],
      references: [profile.id],
      relationName: "groupChatMembership_addedById_profile_id",
    }),
  }),
);

export const groupChatMessageRelations = relations(
  groupChatMessage,
  ({ one, many }) => ({
    groupChat: one(groupChat, {
      fields: [groupChatMessage.groupChatId],
      references: [groupChat.id],
    }),
    profile: one(profile, {
      fields: [groupChatMessage.senderId],
      references: [profile.id],
    }),
    groupChatMessageDeletions: many(groupChatMessageDeletion),
    groupChatMessageReads: many(groupChatMessageRead),
    groupChatMessageReactions: many(groupChatMessageReaction),
    groupChatMessageImages: many(groupChatMessageImage),
  }),
);

export const groupChatMessageReadRelations = relations(
  groupChatMessageRead,
  ({ one }) => ({
    groupChatMessage: one(groupChatMessage, {
      fields: [groupChatMessageRead.messageId],
      references: [groupChatMessage.id],
    }),
    profile: one(profile, {
      fields: [groupChatMessageRead.profileId],
      references: [profile.id],
    }),
  }),
);

export const groupChatMessageReactionRelations = relations(
  groupChatMessageReaction,
  ({ one }) => ({
    groupChatMessage: one(groupChatMessage, {
      fields: [groupChatMessageReaction.messageId],
      references: [groupChatMessage.id],
    }),
    profile: one(profile, {
      fields: [groupChatMessageReaction.profileId],
      references: [profile.id],
    }),
  }),
);

export const userRelations = relations(user, ({ many }) => ({
  exchangeTokens: many(exchangeToken),
  sessions: many(session),
  communityApplications_reviewedById: many(communityApplication, {
    relationName: "communityApplication_reviewedById_user_id",
  }),
  communityApplications_userId: many(communityApplication, {
    relationName: "communityApplication_userId_user_id",
  }),
  memberships: many(membership),
  moderationLogs: many(moderationLog),
  profileOwnerships: many(profileOwnership),
  createdOwnerships: many(profileOwnership, {
    relationName: "profileOwnership_createdBy_user_id",
  }),
  boardPosts: many(boardPost),
  blockedUsers: many(userBlock, {
    relationName: "userBlock_blockerId_user_id",
  }),
  blockedByUsers: many(userBlock, {
    relationName: "userBlock_blockedId_user_id",
  }),
}));

export const exchangeTokenRelations = relations(exchangeToken, ({ one }) => ({
  user: one(user, {
    fields: [exchangeToken.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const communityBannerImageRelations = relations(
  communityBannerImage,
  ({ one }) => ({
    community: one(community, {
      fields: [communityBannerImage.communityId],
      references: [community.id],
    }),
    image: one(image, {
      fields: [communityBannerImage.imageId],
      references: [image.id],
    }),
  }),
);

export const communityDescriptionImageRelations = relations(
  communityDescriptionImage,
  ({ one }) => ({
    community: one(community, {
      fields: [communityDescriptionImage.communityId],
      references: [community.id],
    }),
    image: one(image, {
      fields: [communityDescriptionImage.imageId],
      references: [image.id],
    }),
  }),
);

export const imageRelations = relations(image, ({ many }) => ({
  communityBannerImages: many(communityBannerImage),
  communityDescriptionImages: many(communityDescriptionImage),
  applicationAttachments: many(applicationAttachment),
  profilePictures: many(profilePicture),
  postImages: many(postImage),
  postHistoryImages: many(postHistoryImage),
  groupChatMessageImages: many(groupChatMessageImage),
  directMessageImages: many(directMessageImage),
  boardPosts: many(boardPost),
}));

export const communityApplicationRelations = relations(
  communityApplication,
  ({ one, many }) => ({
    community: one(community, {
      fields: [communityApplication.communityId],
      references: [community.id],
    }),
    user_reviewedById: one(user, {
      fields: [communityApplication.reviewedById],
      references: [user.id],
      relationName: "communityApplication_reviewedById_user_id",
    }),
    user_userId: one(user, {
      fields: [communityApplication.userId],
      references: [user.id],
      relationName: "communityApplication_userId_user_id",
    }),
    attachments: many(applicationAttachment),
  }),
);

export const applicationAttachmentRelations = relations(
  applicationAttachment,
  ({ one }) => ({
    application: one(communityApplication, {
      fields: [applicationAttachment.applicationId],
      references: [communityApplication.id],
    }),
    image: one(image, {
      fields: [applicationAttachment.imageId],
      references: [image.id],
    }),
  }),
);

export const communityLinkRelations = relations(communityLink, ({ one }) => ({
  community: one(community, {
    fields: [communityLink.communityId],
    references: [community.id],
  }),
}));

export const profilePictureRelations = relations(profilePicture, ({ one }) => ({
  profile: one(profile, {
    fields: [profilePicture.profileId],
    references: [profile.id],
  }),
  image: one(image, {
    fields: [profilePicture.imageId],
    references: [image.id],
  }),
}));

export const mentionRelations = relations(mention, ({ one }) => ({
  post: one(post, {
    fields: [mention.postId],
    references: [post.id],
  }),
  profile: one(profile, {
    fields: [mention.profileId],
    references: [profile.id],
  }),
}));

export const postRelations = relations(post, ({ one, many }) => ({
  mentions: many(mention),
  postImages: many(postImage),
  postReactions: many(postReaction),
  postHistories: many(postHistory),
  profile: one(profile, {
    fields: [post.authorId],
    references: [profile.id],
  }),
  post_inReplyToId: one(post, {
    fields: [post.inReplyToId],
    references: [post.id],
    relationName: "post_inReplyToId_post_id",
  }),
  posts_inReplyToId: many(post, {
    relationName: "post_inReplyToId_post_id",
  }),
  post_rootPostId: one(post, {
    fields: [post.rootPostId],
    references: [post.id],
    relationName: "post_rootPostId_post_id",
  }),
  posts_rootPostId: many(post, {
    relationName: "post_rootPostId_post_id",
  }),
  postBookmarks: many(postBookmark),
  moderationLogs: many(moderationLog),
  notifications: many(notification),
}));

export const postImageRelations = relations(postImage, ({ one }) => ({
  image: one(image, {
    fields: [postImage.imageId],
    references: [image.id],
  }),
  post: one(post, {
    fields: [postImage.postId],
    references: [post.id],
  }),
}));

export const postReactionRelations = relations(postReaction, ({ one }) => ({
  post: one(post, {
    fields: [postReaction.postId],
    references: [post.id],
  }),
  profile: one(profile, {
    fields: [postReaction.profileId],
    references: [profile.id],
  }),
}));

export const directMessageReactionRelations = relations(
  directMessageReaction,
  ({ one }) => ({
    profile: one(profile, {
      fields: [directMessageReaction.profileId],
      references: [profile.id],
    }),
    directMessage: one(directMessage, {
      fields: [directMessageReaction.messageId],
      references: [directMessage.id],
    }),
  }),
);

export const directMessageDeletionRelations = relations(
  directMessageDeletion,
  ({ one }) => ({
    directMessage: one(directMessage, {
      fields: [directMessageDeletion.messageId],
      references: [directMessage.id],
    }),
    profile: one(profile, {
      fields: [directMessageDeletion.profileId],
      references: [profile.id],
    }),
  }),
);

export const groupChatMessageDeletionRelations = relations(
  groupChatMessageDeletion,
  ({ one }) => ({
    groupChatMessage: one(groupChatMessage, {
      fields: [groupChatMessageDeletion.messageId],
      references: [groupChatMessage.id],
    }),
    profile: one(profile, {
      fields: [groupChatMessageDeletion.profileId],
      references: [profile.id],
    }),
  }),
);

export const directMessageRelations = relations(
  directMessage,
  ({ one, many }) => ({
    directMessageDeletions: many(directMessageDeletion),
    directMessageReactions: many(directMessageReaction),
    directMessageImages: many(directMessageImage),
    community: one(community, {
      fields: [directMessage.communityId],
      references: [community.id],
    }),
    profile_receiverId: one(profile, {
      fields: [directMessage.receiverId],
      references: [profile.id],
      relationName: "directMessage_receiverId_profile_id",
    }),
    profile_senderId: one(profile, {
      fields: [directMessage.senderId],
      references: [profile.id],
      relationName: "directMessage_senderId_profile_id",
    }),
    notifications: many(notification),
  }),
);

export const directMessageImageRelations = relations(
  directMessageImage,
  ({ one }) => ({
    image: one(image, {
      fields: [directMessageImage.imageId],
      references: [image.id],
    }),
    directMessage: one(directMessage, {
      fields: [directMessageImage.messageId],
      references: [directMessage.id],
    }),
  }),
);

export const postBookmarkRelations = relations(postBookmark, ({ one }) => ({
  profile: one(profile, {
    fields: [postBookmark.profileId],
    references: [profile.id],
  }),
  post: one(post, {
    fields: [postBookmark.postId],
    references: [post.id],
  }),
}));

export const postHistoryRelations = relations(postHistory, ({ one, many }) => ({
  post: one(post, {
    fields: [postHistory.postId],
    references: [post.id],
  }),
  profile: one(profile, {
    fields: [postHistory.editedByProfileId],
    references: [profile.id],
  }),
  postHistoryImages: many(postHistoryImage),
}));

export const postHistoryImageRelations = relations(
  postHistoryImage,
  ({ one }) => ({
    postHistory: one(postHistory, {
      fields: [postHistoryImage.postHistoryId],
      references: [postHistory.id],
    }),
    image: one(image, {
      fields: [postHistoryImage.imageId],
      references: [image.id],
    }),
  }),
);

export const membershipRelations = relations(membership, ({ one }) => ({
  community: one(community, {
    fields: [membership.communityId],
    references: [community.id],
  }),
  user: one(user, {
    fields: [membership.userId],
    references: [user.id],
  }),
}));

export const moderationLogRelations = relations(moderationLog, ({ one }) => ({
  profile_moderatorId: one(profile, {
    fields: [moderationLog.moderatorId],
    references: [profile.id],
    relationName: "moderationLog_moderatorId_profile_id",
  }),
  profile_targetProfileId: one(profile, {
    fields: [moderationLog.targetProfileId],
    references: [profile.id],
    relationName: "moderationLog_targetProfileId_profile_id",
  }),
  post: one(post, {
    fields: [moderationLog.targetPostId],
    references: [post.id],
  }),
  user: one(user, {
    fields: [moderationLog.targetUserId],
    references: [user.id],
  }),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  profile_profileId: one(profile, {
    fields: [notification.profileId],
    references: [profile.id],
    relationName: "notification_profileId_profile_id",
  }),
  post: one(post, {
    fields: [notification.postId],
    references: [post.id],
  }),
  profile_recipientId: one(profile, {
    fields: [notification.recipientId],
    references: [profile.id],
    relationName: "notification_recipientId_profile_id",
  }),
  directMessage: one(directMessage, {
    fields: [notification.directMessageId],
    references: [directMessage.id],
  }),
}));

export const communityHashtagRelations = relations(
  communityHashtag,
  ({ one }) => ({
    community: one(community, {
      fields: [communityHashtag.communityId],
      references: [community.id],
    }),
    hashtag: one(hashtag, {
      fields: [communityHashtag.hashtagId],
      references: [hashtag.id],
    }),
  }),
);

export const hashtagRelations = relations(hashtag, ({ many }) => ({
  communityHashtags: many(communityHashtag),
}));

export const groupChatMessageImageRelations = relations(
  groupChatMessageImage,
  ({ one }) => ({
    image: one(image, {
      fields: [groupChatMessageImage.imageId],
      references: [image.id],
    }),
    groupChatMessage: one(groupChatMessage, {
      fields: [groupChatMessageImage.messageId],
      references: [groupChatMessage.id],
    }),
  }),
);

export const boardRelations = relations(board, ({ many }) => ({
  boardPosts: many(boardPost),
}));

export const boardPostRelations = relations(boardPost, ({ one, many }) => ({
  board: one(board, {
    fields: [boardPost.boardId],
    references: [board.id],
  }),
  user: one(user, {
    fields: [boardPost.authorId],
    references: [user.id],
  }),
  image: one(image, {
    fields: [boardPost.imageId],
    references: [image.id],
  }),
  boardPostHashtags: many(boardPostHashtag),
}));

export const boardHashtagRelations = relations(boardHashtag, ({ many }) => ({
  boardPostHashtags: many(boardPostHashtag),
}));

export const boardPostHashtagRelations = relations(
  boardPostHashtag,
  ({ one }) => ({
    boardPost: one(boardPost, {
      fields: [boardPostHashtag.boardPostId],
      references: [boardPost.id],
    }),
    hashtag: one(boardHashtag, {
      fields: [boardPostHashtag.hashtagId],
      references: [boardHashtag.id],
    }),
  }),
);

export const userBlockRelations = relations(userBlock, ({ one }) => ({
  blocker: one(user, {
    fields: [userBlock.blockerId],
    references: [user.id],
    relationName: "userBlock_blockerId_user_id",
  }),
  blocked: one(user, {
    fields: [userBlock.blockedId],
    references: [user.id],
    relationName: "userBlock_blockedId_user_id",
  }),
}));

export const communityBoardRelations = relations(
  communityBoard,
  ({ one, many }) => ({
    community: one(community, {
      fields: [communityBoard.communityId],
      references: [community.id],
    }),
    communityBoardPosts: many(communityBoardPost),
  }),
);

export const communityBoardPostRelations = relations(
  communityBoardPost,
  ({ one, many }) => ({
    board: one(communityBoard, {
      fields: [communityBoardPost.boardId],
      references: [communityBoard.id],
    }),
    author: one(profile, {
      fields: [communityBoardPost.authorId],
      references: [profile.id],
    }),
    image: one(image, {
      fields: [communityBoardPost.imageId],
      references: [image.id],
    }),
    replies: many(communityBoardPostReply),
  }),
);

export const communityBoardPostReplyRelations = relations(
  communityBoardPostReply,
  ({ one, many }) => ({
    post: one(communityBoardPost, {
      fields: [communityBoardPostReply.postId],
      references: [communityBoardPost.id],
    }),
    author: one(profile, {
      fields: [communityBoardPostReply.authorId],
      references: [profile.id],
    }),
    inReplyTo: one(communityBoardPostReply, {
      fields: [communityBoardPostReply.inReplyToId],
      references: [communityBoardPostReply.id],
      relationName: "communityBoardPostReply_inReplyToId",
    }),
    replies: many(communityBoardPostReply, {
      relationName: "communityBoardPostReply_inReplyToId",
    }),
    rootReply: one(communityBoardPostReply, {
      fields: [communityBoardPostReply.rootReplyId],
      references: [communityBoardPostReply.id],
      relationName: "communityBoardPostReply_rootReplyId",
    }),
    childReplies: many(communityBoardPostReply, {
      relationName: "communityBoardPostReply_rootReplyId",
    }),
  }),
);
