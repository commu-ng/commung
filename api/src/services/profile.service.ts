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
  image as imageTable,
  membership as membershipTable,
  post as postTable,
  profileOwnership as profileOwnershipTable,
  profilePicture as profilePictureTable,
  profile as profileTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE, GeneralErrorCode } from "../types/api-responses";
import {
  addUserToProfile,
  canManageProfile,
  canUseProfile,
  getPrimaryProfileIdForUserInCommunity,
  getProfileUsers,
  getUserProfiles,
  removeUserFromProfile,
} from "../utils/profile-ownership";
import {
  getProfilePictureUrl,
  getProfilePictureUrlById,
} from "../utils/profile-picture-helper";
import { addImageUrl, uploadFileDirect, validateImageFile } from "../utils/r2";

/**
 * Upload and set profile picture for an profile
 */
export async function uploadProfilePicture(
  profileId: string,
  fileBuffer: ArrayBuffer,
  fileName: string,
  fileContentType: string,
  fileSize: number,
) {
  const [isValid, errorMessage] = validateImageFile(
    fileContentType,
    fileSize,
    fileName,
  );
  if (!isValid) {
    throw new AppException(400, GENERAL_ERROR_CODE, errorMessage);
  }

  // Upload to R2
  const uniqueKey = await uploadFileDirect(
    fileBuffer,
    fileName,
    fileContentType,
  );

  // Get image dimensions
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

  // Create image record and profile picture in a transaction
  const result = await db.transaction(async (tx) => {
    const newImageResult = await tx
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

    // Soft delete all existing profile pictures for this profile
    await tx
      .update(profilePictureTable)
      .set({ deletedAt: sql`NOW()` })
      .where(
        and(
          eq(profilePictureTable.profileId, profileId),
          isNull(profilePictureTable.deletedAt),
        ),
      );

    // Create new profile picture record
    const newProfilePictureResult = await tx
      .insert(profilePictureTable)
      .values({
        profileId: profileId,
        imageId: newImage.id,
      })
      .returning();

    const newProfilePicture = newProfilePictureResult[0];
    if (!newProfilePicture) {
      throw new Error("Failed to create profile picture record");
    }

    return { newImage, newProfilePicture };
  });

  const newImage = result.newImage;
  const newProfilePicture = result.newProfilePicture;

  return {
    id: newProfilePicture.id,
    image_id: newImage.id,
    filename: newImage.filename,
    width: newImage.width,
    height: newImage.height,
    url: addImageUrl(newImage).url,
    created_at: newProfilePicture.createdAt,
  };
}

/**
 * Check if username exists in a community
 */
export async function checkUsernameAvailability(
  username: string,
  communityId: string,
) {
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, username),
      eq(profileTable.communityId, communityId),
      isNotNull(profileTable.activatedAt),
      isNull(profileTable.deletedAt),
    ),
  });

  return {
    exists: profile !== undefined,
    username: username,
  };
}

/**
 * Get all profiles in a community
 * Only shows active members (isActive = true)
 * Returns all profiles without pagination for mention autocomplete
 */
export async function listProfilesByUser(communityId: string) {
  // Build where conditions
  const conditions = [
    eq(profileTable.communityId, communityId),
    isNull(profileTable.deletedAt),
    isNotNull(profileTable.activatedAt), // Only show active members
  ];

  // Fetch all profiles without pagination
  const profileTableList = await db.query.profile.findMany({
    where: and(...conditions),
    orderBy: [desc(profileTable.id)], // Use ID for consistent ordering
    with: {
      profilePictures: {
        with: {
          image: true,
        },
      },
      ownerships: {
        with: {
          user: {
            columns: {
              id: true,
              loginName: true,
            },
          },
        },
      },
    },
  });

  // Get memberships to determine user roles
  const memberships = await db.query.membership.findMany({
    where: and(
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
    columns: {
      userId: true,
      role: true,
    },
  });

  // Create a map of userId to role
  const userRoleMap = new Map(memberships.map((m) => [m.userId, m.role]));

  // Create a map of userId to random UUID (user_group_key)
  const userGroupKeyMap = new Map<string, string>();

  // Map each profile to its data, using the owner ownership only (not shared/admin ownerships)
  const allProfiles = profileTableList
    .map((profile) => {
      // Find the ownership with role='owner' (there should be exactly one)
      const ownerOwnership = profile.ownerships.find((o) => o.role === "owner");

      // If no owner found, skip this profile (shouldn't happen in valid data)
      if (!ownerOwnership) {
        return null;
      }

      const userId = ownerOwnership.user.id;

      // Generate or get user_group_key for this user
      let userGroupKey = userGroupKeyMap.get(userId);
      if (!userGroupKey) {
        userGroupKey = crypto.randomUUID();
        userGroupKeyMap.set(userId, userGroupKey);
      }

      const userRole = userRoleMap.get(userId) || "member";

      return {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        bio: profile.bio,
        profile_picture_url: getProfilePictureUrl(profile.profilePictures),
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
        activatedAt: profile.activatedAt,
        is_primary: profile.isPrimary,
        user_group_key: userGroupKey,
        user_role: userRole,
      };
    })
    .filter(
      (profile): profile is NonNullable<typeof profile> => profile !== null,
    );

  return allProfiles;
}

/**
 * Create a new profile
 */
export async function createProfile(
  userId: string,
  communityId: string,
  name: string,
  username: string,
  bio: string | null | undefined,
  isPrimary: boolean | null | undefined,
  profilePictureId: string | null | undefined,
) {
  // Check if username is already taken in this community
  const existingProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, username),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
  });

  if (existingProfile) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "이 커뮤에서 이미 사용 중인 사용자명입니다",
    );
  }

  // Validate profile picture if provided
  if (profilePictureId) {
    const image = await db.query.image.findFirst({
      where: and(
        eq(imageTable.id, profilePictureId),
        isNull(imageTable.deletedAt),
      ),
    });
    if (!image) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "잘못된 프로필 사진 ID입니다",
      );
    }
  }

  // Create profile in a transaction
  let newProfile: (typeof profileTable)["$inferSelect"];
  try {
    newProfile = await db.transaction(async (tx) => {
      // If is_primary is true, unset primary on user's other profiles
      if (isPrimary) {
        // Get user's owned profiles in this community
        const userProfiles = await getUserProfiles(userId);
        const userProfileIds = userProfiles
          .filter(
            (
              ownership,
            ): ownership is typeof ownership & {
              profile: NonNullable<typeof ownership.profile>;
            } =>
              ownership.profile !== null &&
              ownership.profile !== undefined &&
              !ownership.profile.deletedAt &&
              ownership.profile.communityId === communityId,
          )
          .map((ownership) => ownership.profile.id);

        if (userProfileIds.length > 0) {
          await tx
            .update(profileTable)
            .set({ isPrimary: false })
            .where(
              and(
                inArray(profileTable.id, userProfileIds),
                eq(profileTable.communityId, communityId),
              ),
            );
        }
      }

      const newProfileResult = await tx
        .insert(profileTable)
        .values({
          name,
          username,
          bio: bio ?? undefined,
          isPrimary: isPrimary ?? undefined,
          communityId: communityId,
          activatedAt: sql`NOW()`, // New profiles are immediately active
        })
        .returning();

      const profile = newProfileResult[0];
      if (!profile) {
        throw new Error("Failed to create profile");
      }

      // Create ownership record for the new profile
      await tx.insert(profileOwnershipTable).values({
        profileId: profile.id,
        userId: userId,
        role: "owner",
        createdBy: userId,
      });

      // Create profile picture if provided
      if (profilePictureId) {
        await tx.insert(profilePictureTable).values({
          profileId: profile.id,
          imageId: profilePictureId,
        });
      }

      return profile;
    });
  } catch (error) {
    if (error instanceof AppException) {
      throw error;
    }
    const causeMessage =
      error instanceof Error && (error as Error & { cause?: Error }).cause
        ? (error as Error & { cause: Error }).cause.message
        : "";
    if (
      error instanceof Error &&
      (error.message.includes("unique_username_community") ||
        error.message.includes("duplicate key value") ||
        causeMessage.includes("unique_username_community") ||
        causeMessage.includes("duplicate key value"))
    ) {
      throw new AppException(
        409,
        GeneralErrorCode.USERNAME_TAKEN,
        "이 커뮤에서 이미 사용 중인 사용자명입니다",
      );
    }
    throw error;
  }

  // Get profile picture for response
  const profile_picture_url = await getProfilePictureUrlById(newProfile.id);

  return {
    id: newProfile.id,
    username: newProfile.username,
    name: newProfile.name,
    bio: newProfile.bio,
    profile_picture_url,
    created_at: newProfile.createdAt,
    updated_at: newProfile.updatedAt,
    activatedAt: newProfile.activatedAt,
    primary: newProfile.isPrimary,
  };
}

/**
 * Create a profile for a bot
 */
export async function createBotProfile(
  communityId: string,
  name: string,
  username: string,
  createdByUserId: string,
) {
  // Check if username is already taken in this community
  const existingProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, username),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
  });

  if (existingProfile) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "이 커뮤에서 이미 사용 중인 사용자명입니다",
    );
  }

  // Create profile in a transaction
  const newProfile = await db.transaction(async (tx) => {
    const newProfileResult = await tx
      .insert(profileTable)
      .values({
        name,
        username,
        communityId: communityId,
        isPrimary: false,
        activatedAt: sql`NOW()`, // Bot profiles are immediately active
      })
      .returning();

    const profile = newProfileResult[0];
    if (!profile) {
      throw new Error("Failed to create bot profile");
    }

    // Create ownership record for the bot profile (owned by the creator)
    await tx.insert(profileOwnershipTable).values({
      profileId: profile.id,
      userId: createdByUserId,
      role: "owner",
      createdBy: createdByUserId,
    });

    return profile;
  });

  return {
    id: newProfile.id,
    username: newProfile.username,
    name: newProfile.name,
    bio: newProfile.bio,
    created_at: newProfile.createdAt,
    updated_at: newProfile.updatedAt,
    activatedAt: newProfile.activatedAt,
  };
}

/**
 * Get post count for a profile
 */
export async function getProfilePostCount(profileId: string) {
  const postCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postTable)
    .where(and(eq(postTable.authorId, profileId), isNull(postTable.deletedAt)));

  return postCount[0]?.count || 0;
}

/**
 * Delete an profile (soft delete)
 */
export async function deleteProfile(
  userId: string,
  profileId: string,
  communityId: string,
) {
  // Verify user can manage this profile
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없거나 관리 권한이 없습니다",
    );
  }

  // Find the profile to verify it exists and is in the correct community
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

  // Can't delete primary profile
  if (profile.isPrimary) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "메인 프로필은 삭제할 수 없습니다",
    );
  }

  // Can't delete if it's the only profile user has access to
  const userProfilesInCommunity = await getUserProfiles(userId, communityId);

  if (userProfilesInCommunity.length <= 1) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "유일한 프로필은 삭제할 수 없습니다",
    );
  }

  // Soft delete the profile in a transaction
  await db.transaction(async (tx) => {
    // Soft delete the profile
    await tx
      .update(profileTable)
      .set({
        deletedAt: sql`NOW()`,
        activatedAt: null, // Also deactivate
      })
      .where(eq(profileTable.id, profileId));

    // If this was the primary profile, make another profile primary
    if (profile.isPrimary) {
      // Find another profile from user's available profiles
      const availableProfiles = userProfilesInCommunity
        .filter(
          (
            ownership,
          ): ownership is typeof ownership & {
            profile: NonNullable<typeof ownership.profile>;
          } =>
            ownership.profile !== null &&
            ownership.profile !== undefined &&
            ownership.profile.id !== profileId,
        )
        .map((ownership) => ownership.profile);

      const nextProfile =
        availableProfiles.length > 0 ? availableProfiles[0] : null;

      if (nextProfile) {
        await tx
          .update(profileTable)
          .set({ isPrimary: true })
          .where(eq(profileTable.id, nextProfile.id));
      }
    }
  });
}

/**
 * Set an profile as the primary profile for a user in a community
 */
export async function setPrimaryProfile(
  userId: string,
  profileId: string,
  communityId: string,
) {
  // Verify user can manage this profile (only owners can set primary)
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "공유된 프로필은 기본 프로필로 설정할 수 없습니다",
    );
  }

  // Get and validate the profile is active
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
      "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
    );
  }

  // Set all user's profiles in this community as not primary
  const userProfiles = await getUserProfiles(userId);
  const userProfileIds = userProfiles
    .filter(
      (
        ownership,
      ): ownership is typeof ownership & {
        profile: NonNullable<typeof ownership.profile>;
      } =>
        ownership.profile !== null &&
        ownership.profile !== undefined &&
        ownership.profile.communityId === communityId &&
        ownership.profile.deletedAt === null,
    )
    .map((ownership) => ownership.profile.id);

  // Set primary profile in a transaction
  await db.transaction(async (tx) => {
    if (userProfileIds.length > 0) {
      await tx
        .update(profileTable)
        .set({ isPrimary: false })
        .where(
          and(
            inArray(profileTable.id, userProfileIds),
            eq(profileTable.communityId, communityId),
            isNull(profileTable.deletedAt),
          ),
        );
    }

    // Set the specified profile as primary
    await tx
      .update(profileTable)
      .set({ isPrimary: true })
      .where(eq(profileTable.id, profile.id));
  });
}

/**
 * Get profile profile by username
 */
export async function getProfileProfile(username: string, communityId: string) {
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, username),
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

  if (!profile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없습니다",
    );
  }

  // Get post count for this profile
  const postCount = await getProfilePostCount(profile.id);

  return {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    bio: profile.bio,
    profile_picture_url: getProfilePictureUrl(profile.profilePictures),
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    post_count: postCount,
  };
}

/**
 * Get posts by an profile
 */
/**
 * Validate profile access and get profile details
 * Checks if user has permission to use the profile and retrieves it
 */
export async function validateAndGetProfile(
  userId: string,
  profileId: string,
  communityId: string,
  requireActive: boolean = false,
) {
  // Check if user has permission to use this profile
  const hasAccess = await canUseProfile(userId, profileId);
  if (!hasAccess) {
    return null;
  }

  // Get the profile details
  const conditions = [
    eq(profileTable.id, profileId),
    eq(profileTable.communityId, communityId),
    isNull(profileTable.deletedAt),
  ];

  if (requireActive) {
    conditions.push(isNotNull(profileTable.activatedAt));
  }

  const profile = await db.query.profile.findFirst({
    where: and(...conditions),
  });

  return profile;
}

export async function getProfilePosts(
  username: string,
  communityId: string,
  limit: number,
  cursor?: string,
) {
  // Find profile by username in the same community
  const profile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, username),
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

  // Build conditions
  const baseConditions = [
    eq(postTable.authorId, profile.id),
    isNull(postTable.deletedAt),
  ];
  const queryConditions = [...baseConditions];
  if (cursor) {
    queryConditions.push(sql`${postTable.id} < ${cursor}`);
  }

  // Get posts by this profile and count in parallel
  const [postTableList, totalCountResult] = await Promise.all([
    db.query.post.findMany({
      where: and(...queryConditions),
      orderBy: [sql`${postTable.pinnedAt} DESC NULLS LAST`, desc(postTable.id)],
      limit: limit + 1, // Fetch one extra to check for more
      with: {
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
    }),
    db
      .select({ count: count() })
      .from(postTable)
      .where(and(...baseConditions)),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;
  const hasMore = postTableList.length > limit;
  const postsToReturn = hasMore ? postTableList.slice(0, limit) : postTableList;

  // Get profile's profile picture once
  const profileProfilePicture = await db.query.profilePicture.findFirst({
    where: and(
      eq(profilePictureTable.profileId, profile.id),
      isNull(profilePictureTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });
  const profile_profile_picture_url = profileProfilePicture?.image
    ? addImageUrl(profileProfilePicture.image).url
    : null;

  const result = postsToReturn.map((post) => {
    const postImageTableData = post.postImages.map((pi) => ({
      id: pi.image.id,
      url: addImageUrl(pi.image).url,
      width: pi.image.width,
      height: pi.image.height,
      filename: pi.image.filename,
    }));

    return {
      id: post.id,
      content: post.content,
      created_at: post.createdAt,
      updated_at: post.updatedAt,
      announcement: post.announcement,
      content_warning: post.contentWarning,
      pinned_at: post.pinnedAt,
      author: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        profile_picture_url: profile_profile_picture_url,
      },
      images: postImageTableData,
      in_reply_to_id: post.inReplyToId,
      depth: post.depth,
      root_post_id: post.rootPostId,
      is_bookmarked: false,
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

  const nextCursor =
    hasMore && postsToReturn.length > 0
      ? postsToReturn[postsToReturn.length - 1]?.id || null
      : null;

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
 * Update an profile's information
 */
export async function updateProfile(
  userId: string,
  profileId: string,
  communityId: string,
  name: string,
  username: string,
  bio: string | null | undefined,
  _profilePictureId: string | null | undefined,
) {
  // Verify user can manage this profile
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없거나 관리 권한이 없습니다",
    );
  }

  // Get the profile
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

  // Check if username is already taken by another profile
  if (username !== profile.username) {
    const existingProfile = await db.query.profile.findFirst({
      where: and(
        eq(profileTable.username, username),
        eq(profileTable.communityId, communityId),
        isNull(profileTable.deletedAt),
      ),
    });

    if (existingProfile && existingProfile.id !== profile.id) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "사용자명이 이미 사용 중입니다",
      );
    }
  }

  // Note: profilePictureId parameter is deprecated since we no longer support
  // switching between multiple profile pictures. Use uploadProfilePicture() instead.

  // Update the profile
  const updateResult = await db
    .update(profileTable)
    .set({
      name,
      username,
      bio,
    })
    .where(eq(profileTable.id, profileId))
    .returning();

  const updatedProfile = updateResult[0];
  if (!updatedProfile) {
    throw new Error("Failed to update profile");
  }

  // Return the updated profile with profile picture
  const profileWithProfilePicture = await db.query.profile.findFirst({
    where: eq(profileTable.id, updatedProfile.id),
    with: {
      profilePictures: {
        with: {
          image: true,
        },
      },
    },
  });

  return {
    id: updatedProfile.id,
    name: updatedProfile.name,
    username: updatedProfile.username,
    bio: updatedProfile.bio,
    is_primary: updatedProfile.isPrimary,
    created_at: updatedProfile.createdAt,
    updated_at: updatedProfile.updatedAt,
    profile_picture_url: profileWithProfilePicture
      ? getProfilePictureUrl(profileWithProfilePicture.profilePictures)
      : null,
  };
}

/**
 * Get users who have access to an profile (for sharing)
 * Returns all profiles for each user instead of just primary
 */
export async function getProfileSharedUsers(userId: string, profileId: string) {
  // Check if user can manage this profile (only owners can see user list)
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 프로필을 관리할 권한이 없습니다",
    );
  }

  // Get the community ID for this profile
  const profile = await db.query.profile.findFirst({
    where: eq(profileTable.id, profileId),
  });

  if (!profile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없습니다",
    );
  }

  const profileUsers = await getProfileUsers(profileId);

  // For each user, get all their profiles in this community
  const usersWithRoles = await Promise.all(
    profileUsers.map(async (ownership) => {
      // Get all profiles for this user in the community
      const userProfileOwnerships = await getUserProfiles(
        ownership.user.id,
        profile.communityId,
      );

      // Load profile details with pictures
      const profileIds = userProfileOwnerships.map((po) => po.profileId);
      const userProfiles =
        profileIds.length > 0
          ? await db.query.profile.findMany({
              where: inArray(profileTable.id, profileIds),
              with: {
                profilePictures: {
                  where: isNull(profilePictureTable.deletedAt),
                  with: {
                    image: true,
                  },
                },
              },
            })
          : [];

      // Map profiles to return format
      const profiles = userProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        username: p.username,
        profile_picture_url: getProfilePictureUrl(p.profilePictures),
        is_primary: p.isPrimary,
      }));

      // Get primary profile ID for backwards compatibility
      const primaryProfile = profiles.find((p) => p.is_primary);

      return {
        primary_profile_id: primaryProfile?.id || null,
        profiles,
        role: ownership.role,
        added_at: ownership.createdAt,
      };
    }),
  );

  return { users: usersWithRoles };
}

/**
 * Share an profile with another user
 */
export async function shareProfileWithUser(
  userId: string,
  profileId: string,
  communityId: string,
  targetUsername: string,
  role: "admin",
) {
  // Check if user can manage this profile (only owners can add users)
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 프로필을 관리할 권한이 없습니다",
    );
  }

  // Get the profile to check if it's primary
  const profile = await db.query.profile.findFirst({
    where: eq(profileTable.id, profileId),
  });

  if (!profile) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없습니다",
    );
  }

  // Prevent sharing primary profiles
  if (profile.isPrimary) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "주 프로필는 공유할 수 없습니다",
    );
  }

  // Find user by profile username
  const targetProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, targetUsername),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
    with: {
      ownerships: {
        where: eq(profileOwnershipTable.role, "owner"),
        with: {
          user: true,
        },
      },
    },
  });

  if (!targetProfile || !targetProfile.ownerships[0]) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "사용자를 찾을 수 없습니다",
    );
  }

  const targetUser = targetProfile.ownerships[0].user;

  // Check if target user is a member of this community
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, targetUser.id),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  if (!membership) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "사용자가 이 커뮤의 회원이 아닙니다",
    );
  }

  // Check if user already has access to this profile
  const existingOwnership = await db.query.profileOwnership.findFirst({
    where: and(
      eq(profileOwnershipTable.profileId, profileId),
      eq(profileOwnershipTable.userId, targetUser.id),
    ),
  });

  if (existingOwnership) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "사용자가 이미 이 프로필에 액세스 권한을 가지고 있습니다",
    );
  }

  // Add user to profile
  try {
    await addUserToProfile(profileId, targetUser.id, role, userId);
  } catch (error) {
    if (error instanceof AppException) {
      throw error;
    }
    type DatabaseError = Error & { cause?: { constraint?: string } };
    if (
      error instanceof Error &&
      (error.message.includes("unique_profile_user_ownership") ||
        (error as DatabaseError).cause?.constraint ===
          "unique_profile_user_ownership")
    ) {
      throw new AppException(
        409,
        GeneralErrorCode.DUPLICATE_ENTRY,
        "사용자가 이미 이 프로필에 액세스 권한을 가지고 있습니다",
      );
    }
    throw error;
  }

  // Get primary profile ID for the target user in this community
  const primaryProfileId = await getPrimaryProfileIdForUserInCommunity(
    targetUser.id,
    profile.communityId,
  );

  return {
    message: "사용자가 성공적으로 추가되었습니다",
    user: {
      primary_profile_id: primaryProfileId,
      role: role,
    },
  };
}

/**
 * Remove a user's access to an profile
 */
export async function removeUserFromProfileSharing(
  userId: string,
  profileId: string,
  targetUserId: string,
) {
  // Check if user can manage this profile (only owners can remove users)
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 프로필을 관리할 권한이 없습니다",
    );
  }

  // Prevent removing self if you're the only owner
  if (userId === targetUserId) {
    const profileUsers = await getProfileUsers(profileId);
    const owners = profileUsers.filter((u) => u.role === "owner");
    if (owners.length === 1) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "유일한 소유자는 자신을 제거할 수 없습니다",
      );
    }
  }

  await removeUserFromProfile(profileId, targetUserId);
}

/**
 * Get user ID(s) from profile ownership
 */
export async function getUserIdsFromProfile(profileId: string) {
  const profileOwnerships = await db.query.profileOwnership.findMany({
    where: eq(profileOwnershipTable.profileId, profileId),
  });

  if (!profileOwnerships || profileOwnerships.length === 0) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없습니다",
    );
  }

  return profileOwnerships.map((ownership) => ownership.userId);
}

/**
 * In-memory cache for last activity updates to implement debouncing
 * Maps profileId to the last update timestamp
 */
const lastActivityUpdateCache = new Map<string, number>();
const ACTIVITY_UPDATE_DEBOUNCE_MS = 60000; // 1 minute

/**
 * Update lastActiveAt for a profile with debouncing
 * Only updates if more than 1 minute has passed since last update
 */
export async function updateLastActivity(profileId: string) {
  const now = Date.now();
  const lastUpdate = lastActivityUpdateCache.get(profileId);

  // Skip if updated within the last minute
  if (lastUpdate && now - lastUpdate < ACTIVITY_UPDATE_DEBOUNCE_MS) {
    return;
  }

  // Update the database
  await db
    .update(profileTable)
    .set({ lastActiveAt: sql`NOW()` })
    .where(eq(profileTable.id, profileId));

  // Update cache
  lastActivityUpdateCache.set(profileId, now);
}

/**
 * Get online status for a list of profile IDs
 * A profile is considered online if:
 * - lastActiveAt is within the last 5 minutes
 * - onlineStatusVisible is true
 */
export async function getOnlineStatus(profileIds: string[]) {
  if (profileIds.length === 0) {
    return [];
  }

  const profiles = await db.query.profile.findMany({
    where: and(
      inArray(profileTable.id, profileIds),
      isNull(profileTable.deletedAt),
    ),
    columns: {
      id: true,
      lastActiveAt: true,
      onlineStatusVisible: true,
    },
  });

  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  return profiles.map((profile) => {
    if (!profile.onlineStatusVisible || !profile.lastActiveAt) {
      return {
        profile_id: profile.id,
        is_online: false,
      };
    }

    // Parse the timestamp and compare as numbers
    const lastActiveTime = new Date(profile.lastActiveAt).getTime();
    const isOnline = lastActiveTime > fiveMinutesAgo;

    return {
      profile_id: profile.id,
      is_online: isOnline,
    };
  });
}

/**
 * Update online status visibility for a profile
 */
export async function updateOnlineStatusVisibility(
  userId: string,
  profileId: string,
  visible: boolean,
) {
  // Verify user can manage this profile
  const canManage = await canManageProfile(userId, profileId);
  if (!canManage) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없거나 관리 권한이 없습니다",
    );
  }

  await db
    .update(profileTable)
    .set({ onlineStatusVisible: visible })
    .where(eq(profileTable.id, profileId));

  return { success: true };
}

export async function searchProfilesByUsernameInCommunity(
  communityId: string,
  query: string,
  limit = 10,
) {
  const q = query.trim().toLowerCase();
  const conditions = [
    eq(profileTable.communityId, communityId),
    isNotNull(profileTable.activatedAt),
    isNull(profileTable.deletedAt),
  ];
  if (q.length > 0) {
    const pattern = `%${q}%`;
    conditions.push(
      sql`(LOWER(${profileTable.username}) LIKE ${pattern} OR LOWER(${profileTable.name}) LIKE ${pattern})`,
    );
  }
  return db
    .select({
      id: profileTable.id,
      name: profileTable.name,
      username: profileTable.username,
    })
    .from(profileTable)
    .where(and(...conditions))
    .orderBy(profileTable.username)
    .limit(Math.min(Math.max(limit, 1), 50));
}
