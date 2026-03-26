import * as bcrypt from "bcrypt";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { SESSION_CONFIG } from "../config/session.config";
import { db } from "../db";
import { AppException } from "../exception";
import { GeneralErrorCode } from "../types/api-responses";
import {
  community as communityTable,
  exchangeToken as exchangeTokenTable,
  image as imageTable,
  membership as membershipTable,
  profileOwnership as profileOwnershipTable,
  profilePicture as profilePictureTable,
  profile as profileTable,
  session as sessionTable,
  user as userTable,
} from "../drizzle/schema";
import { addImageUrl } from "../utils/r2";
import * as emailService from "./email.service";
import * as imageService from "./image.service";

/**
 * Get basic user info by ID
 */
export async function getUserById(userId: string) {
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    id: user.id,
    login_name: user.loginName,
    email: user.email,
    created_at: user.createdAt,
    is_admin: user.isAdmin,
  };
}

/**
 * Get current user info with all communities they have access to
 */
export async function getCurrentUser(userId: string) {
  // Get user record
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get all communities user has access to with their role
  const communitiesWithRoles = await db
    .select({
      id: communityTable.id,
      name: communityTable.name,
      slug: communityTable.slug,
      startsAt: communityTable.startsAt,
      endsAt: communityTable.endsAt,
      isRecruiting: communityTable.isRecruiting,
      created_at: communityTable.createdAt,
      role: membershipTable.role,
      customDomain: communityTable.customDomain,
      domainVerified: communityTable.domainVerifiedAt,
    })
    .from(communityTable)
    .innerJoin(
      membershipTable,
      eq(communityTable.id, membershipTable.communityId),
    )
    .where(
      and(
        eq(membershipTable.userId, userId),
        isNotNull(membershipTable.activatedAt),
        isNull(communityTable.deletedAt),
      ),
    )
    .orderBy(communityTable.createdAt);

  return {
    id: user.id,
    login_name: user.loginName,
    created_at: user.createdAt,
    is_admin: user.isAdmin,
    instances: communitiesWithRoles.map((community) => ({
      id: community.id,
      name: community.name,
      slug: community.slug,
      starts_at: community.startsAt,
      ends_at: community.endsAt,
      is_recruiting: community.isRecruiting,
      created_at: community.created_at,
      role: community.role,
      custom_domain: community.customDomain,
      domain_verified: community.domainVerified,
    })),
  };
}

/**
 * Get current user's role in a specific community instance
 */
export async function getCurrentUserInstance(
  userId: string,
  communityId: string,
) {
  // Get community
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new Error("Community not found");
  }

  // Get user's role in this community
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  const userRole = membership?.role || null;

  // Get banner image info
  const bannerInfo = await imageService.getCommunityBannerInfo(community.id);

  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    custom_domain: community.customDomain,
    domain_verified: community.domainVerifiedAt,
    role: userRole,
    starts_at: community.startsAt,
    ends_at: community.endsAt,
    description: community.description,
    banner_image_url: bannerInfo?.url || null,
    show_all_replies: community.showAllReplies,
    bump_on_reply: community.bumpOnReply,
  };
}

/**
 * Get public instance info (no authentication required)
 */
export async function getPublicInstanceInfo(communityId: string) {
  // Get community
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new Error("Community not found");
  }

  // Get banner image info
  const bannerInfo = await imageService.getCommunityBannerInfo(community.id);

  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    description: community.description,
    banner_image_url: bannerInfo?.url || null,
  };
}

/**
 * Get all profiles that a user owns or has access to in a community
 */
export async function getUserProfiles(userId: string, communityId: string) {
  // Get profiles that the user owns or has access to via profile ownership
  // Only return active profiles (activatedAt is not null)
  const userProfiles = await db
    .select({
      profile: profileTable,
      ownership: profileOwnershipTable,
    })
    .from(profileOwnershipTable)
    .innerJoin(
      profileTable,
      eq(profileOwnershipTable.profileId, profileTable.id),
    )
    .where(
      and(
        eq(profileOwnershipTable.userId, userId),
        eq(profileTable.communityId, communityId),
        isNull(profileTable.deletedAt),
        isNotNull(profileTable.activatedAt), // Only active profiles
      ),
    )
    .orderBy(profileTable.createdAt);

  // Get profile pictures for all profiles
  const profileIds = userProfiles.map((ua) => ua.profile.id);
  const profilePictures =
    profileIds.length > 0
      ? await db.query.profilePicture.findMany({
          where: and(
            inArray(profilePictureTable.profileId, profileIds),
            isNull(profilePictureTable.deletedAt),
          ),
          with: {
            image: true,
          },
        })
      : [];

  // Create a map for quick profile picture lookup
  const profilePictureMap = new Map();
  profilePictures.forEach((pp) => {
    profilePictureMap.set(pp.profileId, pp);
  });

  // Extract profiles from ownership records and add ownership info
  const profileList = userProfiles.map(({ profile, ownership }) => {
    const profilePicture = profilePictureMap.get(profile.id);
    const profile_picture_url = profilePicture?.image
      ? addImageUrl(profilePicture.image).url
      : null;

    return {
      id: profile.id,
      username: profile.username,
      name: profile.name,
      bio: profile.bio,
      profile_picture_url: profile_picture_url,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
      activatedAt: profile.activatedAt,
      is_active: profile.activatedAt !== null,
      is_primary: profile.isPrimary,
      role: ownership.role,
    };
  });

  return profileList;
}

/**
 * Update profile that belongs to the current user
 * This is specifically for the /me/profiles endpoint which uses canManageProfile
 */
export async function updateUserProfile(
  profileId: string,
  communityId: string,
  name: string | undefined,
  username: string | undefined,
  bio: string | null | undefined,
  profilePictureId: string | null | undefined,
) {
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
      GeneralErrorCode.PROFILE_NOT_FOUND,
      "프로필을 찾을 수 없습니다",
    );
  }

  // Update the profile in a transaction
  let updatedProfile: Awaited<
    ReturnType<typeof db.transaction<(typeof profileTable)["$inferSelect"]>>
  >;
  try {
    updatedProfile = await db.transaction(async (tx) => {
      // Update the profile's name, username, and bio
      const updatedProfileResult = await tx
        .update(profileTable)
        .set({
          name,
          username,
          bio,
        })
        .where(eq(profileTable.id, profileId))
        .returning();

      const updated = updatedProfileResult[0];
      if (!updated) {
        throw new Error("Failed to update profile");
      }

      // Handle profile picture update
      if (profilePictureId) {
        // Validate image exists
        const image = await tx.query.image.findFirst({
          where: and(
            eq(imageTable.id, profilePictureId),
            isNull(imageTable.deletedAt),
          ),
        });

        if (!image) {
          throw new AppException(
            400,
            GeneralErrorCode.INVALID_PROFILE_PICTURE,
            "잘못된 프로필 사진 ID입니다",
          );
        }

        // Soft delete all existing profile pictures
        await tx
          .update(profilePictureTable)
          .set({ deletedAt: sql`NOW()` })
          .where(
            and(
              eq(profilePictureTable.profileId, profile.id),
              isNull(profilePictureTable.deletedAt),
            ),
          );

        // Create new profile picture record
        await tx.insert(profilePictureTable).values({
          profileId: profile.id,
          imageId: profilePictureId,
        });
      }

      return updated;
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

  // Get current profile picture
  const currentProfilePicture = await db.query.profilePicture.findFirst({
    where: and(
      eq(profilePictureTable.profileId, profile.id),
      isNull(profilePictureTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });

  const profile_picture_url = currentProfilePicture?.image
    ? addImageUrl(currentProfilePicture.image).url
    : null;

  return {
    id: updatedProfile.id,
    username: updatedProfile.username,
    name: updatedProfile.name,
    bio: updatedProfile.bio,
    profile_picture_url: profile_picture_url,
    created_at: updatedProfile.createdAt,
    updated_at: updatedProfile.updatedAt,
    activatedAt: updatedProfile.activatedAt,
    is_active: updatedProfile.activatedAt !== null,
  };
}

/**
 * Update user password
 */
export async function updateUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  // Get user
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Verify current password
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new Error("현재 비밀번호가 올바르지 않습니다");
  }

  // Update to new password
  const hashedPassword = await bcrypt.hash(
    newPassword,
    SESSION_CONFIG.BCRYPT_SALT_ROUNDS,
  );
  await db
    .update(userTable)
    .set({ passwordHash: hashedPassword })
    .where(eq(userTable.id, userId));

  // Invalidate all existing sessions for security
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
}

/**
 * Check if user owns any active communities
 */
export async function checkUserOwnsActiveCommunities(userId: string) {
  // Check if user owns any undeleted communities by checking memberships with JOIN
  const ownerMemberships = await db
    .select({
      community: communityTable,
    })
    .from(membershipTable)
    .innerJoin(
      communityTable,
      eq(membershipTable.communityId, communityTable.id),
    )
    .where(
      and(
        eq(membershipTable.userId, userId),
        eq(membershipTable.role, "owner"),
        isNotNull(membershipTable.activatedAt),
        isNull(communityTable.deletedAt),
      ),
    );

  const undeletedCommunities = ownerMemberships.map((row) => row.community);

  return {
    hasActiveCommunities: undeletedCommunities.length > 0,
    communities: undeletedCommunities.map((comm) => ({
      id: comm.id,
      name: comm.name,
      slug: comm.slug,
    })),
  };
}

/**
 * Delete user account and all associated data
 */
export async function deleteUserAccount(userId: string) {
  // Wrap entire deletion operation in a transaction
  await db.transaction(async (tx) => {
    // Soft delete the user
    await tx
      .update(userTable)
      .set({
        deletedAt: sql`NOW()`,
      })
      .where(eq(userTable.id, userId));

    // Soft delete all profiles owned by this user
    // First get all profile IDs owned by the user
    const userOwnerships = await tx.query.profileOwnership.findMany({
      where: eq(profileOwnershipTable.userId, userId),
      columns: { profileId: true },
    });

    if (userOwnerships.length > 0) {
      const profileIds = userOwnerships.map((ownership) => ownership.profileId);
      await tx
        .update(profileTable)
        .set({ deletedAt: sql`NOW()` })
        .where(inArray(profileTable.id, profileIds));

      // Also delete ownership records
      await tx
        .delete(profileOwnershipTable)
        .where(eq(profileOwnershipTable.userId, userId));
    }

    // Delete all active sessions for this user
    await tx.delete(sessionTable).where(eq(sessionTable.userId, userId));

    // Delete all exchange tokens for this user
    await tx
      .delete(exchangeTokenTable)
      .where(eq(exchangeTokenTable.userId, userId));
  });
}

/**
 * Request email update for user
 * Checks if email is already in use and sends verification email
 */
export async function requestEmailUpdate(userId: string, email: string) {
  // Check if email is already in use by another user
  const existingUser = await db.query.user.findFirst({
    where: and(eq(userTable.email, email), isNull(userTable.deletedAt)),
  });

  if (existingUser && existingUser.id !== userId) {
    throw new Error("이미 사용 중인 이메일입니다");
  }

  // Send verification email
  await emailService.sendVerificationEmail(userId, email);
}
