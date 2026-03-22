import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { logger } from "../config/logger";
import { db } from "../db";
import {
  applicationAttachment as applicationAttachmentTable,
  communityApplication as communityApplicationTable,
  community as communityTable,
  image as imageTable,
  membership as membershipTable,
  moderationLog as moderationLogTable,
  profileOwnership as profileOwnershipTable,
  profile as profileTable,
  user as userTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";
import {
  getPrimaryProfileIdForUserInCommunity,
  revokeSharedProfileAccess,
} from "../utils/profile-ownership";
import * as emailService from "./email.service";
import { pushNotificationService } from "./push-notification.service";

/**
 * Query Functions
 */

/**
 * Get user's membership in a community (simple version)
 */
export async function getUserMembership(userId: string, communityId: string) {
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  return membership;
}

/**
 * Check if user is a community owner
 */
export async function isUserCommunityOwner(
  userId: string,
  communityId: string,
): Promise<boolean> {
  const membership = await getUserMembership(userId, communityId);
  return membership?.role === "owner";
}

/**
 * Get user's membership with all their profiles for a community
 * This is the optimized version that prevents N+1 queries
 */
export async function getUserMembershipWithProfiles(
  userId: string,
  communityId: string,
) {
  // Get membership first
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
    with: {
      user: true,
    },
  });

  if (!membership) {
    return null;
  }

  // Get profiles via ownership with JOIN to filter in database
  const profileOwnerships = await db
    .select({
      profile: profileTable,
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
        isNotNull(profileTable.activatedAt),
      ),
    );

  const profiles = profileOwnerships.map((row) => row.profile);

  return {
    ...membership,
    profiles,
  };
}

/**
 * Validate membership and get specific profile belonging to user
 * Returns the profile if valid, throws error if not
 */
export async function validateMembershipAndProfile(
  userId: string,
  communityId: string,
  profileId: string,
) {
  // Check membership first
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  if (!membership) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 커뮤의 회원이 아닙니다",
    );
  }

  // Check profile ownership separately
  const profileOwnership = await db.query.profileOwnership.findFirst({
    where: and(
      eq(profileOwnershipTable.userId, userId),
      eq(profileOwnershipTable.profileId, profileId),
    ),
    with: {
      profile: true,
    },
  });

  if (
    !profileOwnership ||
    !profileOwnership.profile ||
    profileOwnership.profile.communityId !== communityId ||
    profileOwnership.profile.activatedAt === null ||
    profileOwnership.profile.deletedAt !== null
  ) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
    );
  }

  return { membership, profile: profileOwnership.profile };
}

/**
 * Check if user has a specific role in community
 */
export async function validateMembershipRole(
  userId: string,
  communityId: string,
  requiredRoles: string[],
) {
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  if (!membership) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 커뮤의 회원이 아닙니다",
    );
  }

  if (!requiredRoles.includes(membership.role)) {
    throw new AppException(403, GENERAL_ERROR_CODE, "접근이 거부되었습니다");
  }

  return membership;
}

/**
 * Get all active profiles for a user in a community (via ownership)
 */
export async function getUserProfilesInCommunity(
  userId: string,
  communityId: string,
) {
  return await db.query.profileOwnership
    .findMany({
      where: eq(profileOwnershipTable.userId, userId),
      with: {
        profile: true,
      },
    })
    .then((ownerships) =>
      ownerships
        .filter(
          (ownership) =>
            ownership.profile !== null &&
            ownership.profile.communityId === communityId &&
            ownership.profile.activatedAt !== null &&
            ownership.profile.deletedAt === null,
        )
        .map((ownership) => ownership.profile)
        .filter(
          (profile): profile is NonNullable<typeof profile> => profile !== null,
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    );
}

/**
 * Business Operations
 */

/**
 * Create a new membership for a user in a community
 */
export async function createMembership(
  userId: string,
  communityId: string,
  role: "owner" | "moderator" | "member" = "member",
  applicationId?: string,
) {
  const result = await db
    .insert(membershipTable)
    .values({
      userId,
      communityId,
      role,
      activatedAt: sql`NOW()`,
      applicationId,
    })
    .returning();

  return result[0];
}

/**
 * Reactivate an inactive membership
 */
export async function activateMembership(
  membershipId: string,
  role: "owner" | "moderator" | "member" = "member",
  applicationId?: string,
) {
  const result = await db
    .update(membershipTable)
    .set({
      activatedAt: sql`NOW()`,
      role,
      applicationId,
    })
    .where(eq(membershipTable.id, membershipId))
    .returning();

  return result[0];
}

/**
 * Deactivate profiles for a user in a community
 * Sets activatedAt = null to deactivate profiles
 */
async function deactivateUserProfilesInCommunity(
  userId: string,
  communityId: string,
) {
  const profileOwnerships = await db.query.profileOwnership.findMany({
    where: eq(profileOwnershipTable.userId, userId),
    with: { profile: true },
  });

  const profileIds = profileOwnerships
    .filter(
      (o): o is typeof o & { profile: NonNullable<typeof o.profile> } =>
        o.profile !== null &&
        o.profile !== undefined &&
        o.profile.communityId === communityId &&
        o.profile.deletedAt === null &&
        o.role === "owner", // Only owned profiles, not shared
    )
    .map((o) => o.profile.id);

  if (profileIds.length > 0) {
    await db
      .update(profileTable)
      .set({ activatedAt: null }) // Deactivate profiles
      .where(inArray(profileTable.id, profileIds));
  }
}

/**
 * Deactivate a membership (soft delete)
 */
export async function deactivateMembership(membershipId: string) {
  const result = await db
    .update(membershipTable)
    .set({ activatedAt: null })
    .where(eq(membershipTable.id, membershipId))
    .returning();

  const membership = result[0];
  if (!membership) {
    throw new Error("Failed to deactivate membership");
  }

  // Deactivate user's owned profiles in this community
  await deactivateUserProfilesInCommunity(
    membership.userId,
    membership.communityId,
  );

  // Revoke shared profile access
  await revokeSharedProfileAccess(membership.userId, membership.communityId);

  return membership;
}

/**
 * Remove a member from a community
 * Validates permissions and prevents removing owners
 * Only community owners can remove members
 */
export async function removeMember(
  communityId: string,
  membershipId: string,
  requestingUserId: string,
) {
  // Check if requesting user has permission (must be owner only)
  const userMembership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, requestingUserId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  if (!userMembership || userMembership.role !== "owner") {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "커뮤 소유자만 회원을 제거할 수 있습니다",
    );
  }

  // Cannot remove community owner
  const targetMembership = await db.query.membership.findFirst({
    where: eq(membershipTable.id, membershipId),
  });

  if (!targetMembership) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "멤버십을 찾을 수 없습니다",
    );
  }

  if (targetMembership.role === "owner") {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "커뮤 소유자는 제거할 수 없습니다",
    );
  }

  // Remove the member (set inactive)
  return await deactivateMembership(membershipId);
}

/**
 * Update a member's role in a community
 * Handles ownership transfer if promoting to owner
 * Revokes shared profile access when demoting to regular member
 */
export async function updateMemberRole(
  communityId: string,
  membershipId: string,
  newRole: "owner" | "moderator" | "member",
  requestingUserId: string,
) {
  // Check if requesting user has permission (must be owner)
  const userMembership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, requestingUserId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  if (!userMembership || userMembership.role !== "owner") {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "커뮤 소유자만 회원 역할을 업데이트할 수 있습니다",
    );
  }

  // Get the target membership to check current role
  const targetMembership = await db.query.membership.findFirst({
    where: eq(membershipTable.id, membershipId),
  });

  if (!targetMembership) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "멤버십을 찾을 수 없습니다",
    );
  }

  // Special handling for owner role changes
  if (newRole === "owner") {
    if (targetMembership.role === "owner") {
      throw new AppException(400, GENERAL_ERROR_CODE, "이미 소유자입니다");
    }

    // Transfer ownership: demote current owner to moderator and promote target to owner
    await db.transaction(async (tx) => {
      // Demote current owner to moderator
      await tx
        .update(membershipTable)
        .set({ role: "moderator" })
        .where(eq(membershipTable.id, userMembership.id));

      // Promote target to owner
      await tx
        .update(membershipTable)
        .set({ role: newRole })
        .where(eq(membershipTable.id, membershipId));
    });

    return { transferred: true };
  }

  // For non-owner role changes, prevent demoting the current owner
  if (targetMembership.role === "owner") {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "소유자의 역할을 변경할 수 없습니다. 소유권을 먼저 이전하세요",
    );
  }

  // Check if demoting from moderator to member
  // (owner demotion is already handled above)
  const isDemotionToMember =
    targetMembership.role === "moderator" && newRole === "member";

  // Update the target membership's role (for non-owner roles)
  const result = await db
    .update(membershipTable)
    .set({ role: newRole })
    .where(eq(membershipTable.id, membershipId))
    .returning();

  // Revoke shared profile access when demoting to regular member
  if (isDemotionToMember) {
    await revokeSharedProfileAccess(targetMembership.userId, communityId);
  }

  return result[0];
}

/**
 * Transfer ownership from one user to another
 */
export async function transferOwnership(
  communityId: string,
  currentOwnerId: string,
  newOwnerId: string,
) {
  await db.transaction(async (tx) => {
    // Demote current owner to moderator
    await tx
      .update(membershipTable)
      .set({ role: "moderator" })
      .where(
        and(
          eq(membershipTable.userId, currentOwnerId),
          eq(membershipTable.communityId, communityId),
        ),
      );

    // Promote new owner
    await tx
      .update(membershipTable)
      .set({ role: "owner" })
      .where(
        and(
          eq(membershipTable.userId, newOwnerId),
          eq(membershipTable.communityId, communityId),
        ),
      );
  });
}

/**
 * User leaves a community
 * Owners cannot leave - they must transfer ownership first
 */
export async function leaveCommunity(userId: string, communityId: string) {
  // Get user's membership
  const userMembership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  if (!userMembership) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤 멤버가 아닙니다");
  }

  // Owners cannot leave - they must transfer ownership first
  if (userMembership.role === "owner") {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "소유자는 커뮤를 떠날 수 없습니다. 먼저 소유권을 이전하세요",
    );
  }

  // Remove the member (set inactive)
  return await deactivateMembership(userMembership.id);
}

/**
 * Approve a membership application
 * Creates membership and profile for the applicant
 */
export async function approveMembershipApplication(
  applicationId: string,
  reviewerId: string,
) {
  // Find the application
  const application = await db.query.communityApplication.findFirst({
    where: eq(communityApplicationTable.id, applicationId),
    with: {
      community: true,
    },
  });

  if (!application) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "지원서를 찾을 수 없습니다",
    );
  }

  // Can only approve pending applications
  if (application.status !== "pending") {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "지원서가 대기 중이 아닙니다",
    );
  }

  const community = application.community;

  // Approve application in a transaction
  const result = await db.transaction(async (tx) => {
    // Update application status
    await tx
      .update(communityApplicationTable)
      .set({
        status: "approved",
        reviewedAt: sql`NOW()`,
        reviewedById: reviewerId,
      })
      .where(eq(communityApplicationTable.id, applicationId));

    // Check if user already has a membership (active or inactive)
    const existingMembership = await tx.query.membership.findFirst({
      where: and(
        eq(membershipTable.userId, application.userId),
        eq(membershipTable.communityId, community.id),
      ),
    });

    // Track if this is the same application being re-approved
    const isSameApplicationReApproval =
      existingMembership?.applicationId === applicationId;

    let membership: typeof membershipTable.$inferSelect;
    if (existingMembership) {
      // Reactivate existing membership
      const result = await tx
        .update(membershipTable)
        .set({
          activatedAt: sql`NOW()`,
          role: "member",
          applicationId,
        })
        .where(eq(membershipTable.id, existingMembership.id))
        .returning();
      const updatedMembership = result[0];
      if (!updatedMembership) {
        throw new Error("Failed to reactivate membership");
      }
      membership = updatedMembership;

      // Reactivate user's profiles
      const profileOwnerships = await tx.query.profileOwnership.findMany({
        where: eq(profileOwnershipTable.userId, application.userId),
        with: { profile: true },
      });

      const profileIds = profileOwnerships
        .filter(
          (o): o is typeof o & { profile: NonNullable<typeof o.profile> } =>
            o.profile !== null &&
            o.profile !== undefined &&
            o.profile.communityId === community.id &&
            o.profile.deletedAt === null &&
            o.profile.activatedAt !== null && // Was previously activated
            o.role === "owner",
        )
        .map((o) => o.profile.id);

      if (profileIds.length > 0) {
        await tx
          .update(profileTable)
          .set({ activatedAt: sql`NOW()` }) // Reactivate profiles
          .where(inArray(profileTable.id, profileIds));
      }
    } else {
      // Create new membership
      const result = await tx
        .insert(membershipTable)
        .values({
          userId: application.userId,
          communityId: community.id,
          role: "member",
          activatedAt: sql`NOW()`,
          applicationId,
        })
        .returning();
      const createdMembership = result[0];
      if (!createdMembership) {
        throw new Error("Failed to create membership");
      }
      membership = createdMembership;
    }

    // Check if a profile with this username already exists in this community
    const existingProfile = await tx.query.profile.findFirst({
      where: and(
        eq(profileTable.username, application.profileUsername),
        eq(profileTable.communityId, community.id),
        isNull(profileTable.deletedAt),
      ),
    });

    // Get reviewer's profile ID if auto-mute is enabled
    let reviewerProfileId: string | null = null;
    if (community.muteNewMembers) {
      const reviewerProfileOwnerships = await tx
        .select({ profileId: profileOwnershipTable.profileId })
        .from(profileOwnershipTable)
        .innerJoin(
          profileTable,
          eq(profileOwnershipTable.profileId, profileTable.id),
        )
        .where(
          and(
            eq(profileOwnershipTable.userId, reviewerId),
            eq(profileTable.communityId, community.id),
            isNotNull(profileTable.activatedAt),
            isNull(profileTable.deletedAt),
            eq(profileTable.isPrimary, true),
          ),
        )
        .limit(1);

      reviewerProfileId = reviewerProfileOwnerships[0]?.profileId ?? null;
    }

    let profile: typeof profileTable.$inferSelect;
    if (existingProfile) {
      // Profile with this username exists - check if it's for this application
      const ownership = await tx.query.profileOwnership.findFirst({
        where: and(
          eq(profileOwnershipTable.profileId, existingProfile.id),
          eq(profileOwnershipTable.userId, application.userId),
          eq(profileOwnershipTable.role, "owner"),
        ),
      });

      // Check if this is the same application being re-approved
      if (ownership && isSameApplicationReApproval) {
        // Reactivating the same application - reactivate the profile
        const updatedProfileResult = await tx
          .update(profileTable)
          .set({
            name: application.profileName,
            activatedAt: sql`NOW()`,
            // Auto-mute if community setting is enabled (on reactivation)
            mutedAt: community.muteNewMembers ? sql`NOW()` : undefined,
            mutedById: community.muteNewMembers ? reviewerProfileId : undefined,
          })
          .where(eq(profileTable.id, existingProfile.id))
          .returning();
        const updatedProfile = updatedProfileResult[0];
        if (!updatedProfile) {
          throw new Error("Failed to update profile");
        }
        profile = updatedProfile;

        // Log auto-mute action if enabled
        if (community.muteNewMembers && reviewerProfileId) {
          await tx.insert(moderationLogTable).values({
            action: "mute_profile",
            description: "재가입 시 자동 음소거 (커뮤 설정)",
            moderatorId: reviewerProfileId,
            targetProfileId: profile.id,
          });
        }
      } else {
        // Username already taken (either by someone else or by user's old profile)
        // Usernames are permanent and cannot be reused even by the same user
        throw new AppException(
          409,
          GENERAL_ERROR_CODE,
          "이 사용자명은 이미 다른 사용자가 사용중입니다",
        );
      }
    } else {
      // No profile exists with this username - create new profile
      const newProfileResult = await tx
        .insert(profileTable)
        .values({
          name: application.profileName,
          username: application.profileUsername,
          communityId: community.id,
          isPrimary: false,
          activatedAt: sql`NOW()`,
          // Auto-mute if community setting is enabled
          mutedAt: community.muteNewMembers ? sql`NOW()` : null,
          mutedById: community.muteNewMembers ? reviewerProfileId : null,
        })
        .returning();
      const createdProfile = newProfileResult[0];
      if (!createdProfile) {
        throw new Error("Failed to create profile");
      }
      profile = createdProfile;

      // Create ownership record for the new profile
      await tx.insert(profileOwnershipTable).values({
        profileId: profile.id,
        userId: application.userId,
        role: "owner",
        createdBy: reviewerId,
      });

      // Log auto-mute action if enabled
      if (community.muteNewMembers && reviewerProfileId) {
        await tx.insert(moderationLogTable).values({
          action: "mute_profile",
          description: "신규 가입 시 자동 음소거 (커뮤 설정)",
          moderatorId: reviewerProfileId,
          targetProfileId: profile.id,
        });
      }
    }

    // Set this profile as primary and unset any other primary profiles
    // First, get all profiles owned by this user in this community via profile_ownership
    const userProfilesInCommunity = await tx
      .select({ id: profileTable.id })
      .from(profileOwnershipTable)
      .innerJoin(
        profileTable,
        eq(profileOwnershipTable.profileId, profileTable.id),
      )
      .where(
        and(
          eq(profileOwnershipTable.userId, application.userId),
          eq(profileOwnershipTable.role, "owner"),
          eq(profileTable.communityId, community.id),
          ne(profileTable.id, profile.id),
          isNull(profileTable.deletedAt),
        ),
      );

    // Unset isPrimary for all other profiles
    if (userProfilesInCommunity.length > 0) {
      await tx
        .update(profileTable)
        .set({ isPrimary: false })
        .where(
          inArray(
            profileTable.id,
            userProfilesInCommunity.map((p) => p.id),
          ),
        );
    }

    // Then set the current profile as primary
    await tx
      .update(profileTable)
      .set({ isPrimary: true })
      .where(eq(profileTable.id, profile.id));

    return {
      membership,
      profile,
    };
  });

  // Send email notification to applicant
  // This is done after the transaction to avoid blocking application approval
  // Errors in email sending are logged but do not prevent application approval
  try {
    // Get applicant's user information with email
    const applicantUser = await db.query.user.findFirst({
      where: and(
        eq(userTable.id, application.userId),
        isNull(userTable.deletedAt),
      ),
    });

    // Send email only if applicant has a verified email
    if (applicantUser?.email && applicantUser.emailVerifiedAt) {
      await emailService.sendApplicationApprovedEmail(
        applicantUser.email,
        community.name,
      );
    }

    // Send push notification to applicant
    if (applicantUser) {
      // Build community URL
      const baseDomain = process.env.BASE_DOMAIN || "commu.ng";
      const communityUrl =
        community.customDomain && community.domainVerifiedAt
          ? `https://${community.customDomain}`
          : `https://${community.slug}.${baseDomain}`;

      await pushNotificationService.sendPushNotification(applicantUser.id, {
        title: "가입 신청 승인",
        body: `${community.name} 가입이 승인되었습니다`,
        data: {
          type: "application_approved",
          community_slug: community.slug,
          community_url: communityUrl,
          url: communityUrl,
        },
      });
    }
  } catch (emailError: unknown) {
    // Log email error but don't fail the application approval
    logger.service.error("Failed to send application approved email", {
      error: emailError,
      applicationId,
    });
  }

  return result;
}

/**
 * Reject a membership application
 */
export async function rejectMembershipApplication(
  applicationId: string,
  reviewerId: string,
  rejectionReason?: string,
) {
  // Find the application
  const application = await db.query.communityApplication.findFirst({
    where: eq(communityApplicationTable.id, applicationId),
  });

  if (!application) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "지원서를 찾을 수 없습니다",
    );
  }

  // Can only reject pending applications
  if (application.status !== "pending") {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "지원서가 대기 중이 아닙니다",
    );
  }

  // Update application status
  const result = await db
    .update(communityApplicationTable)
    .set({
      status: "rejected",
      reviewedAt: sql`NOW()`,
      reviewedById: reviewerId,
      rejectionReason: rejectionReason || null,
    })
    .where(eq(communityApplicationTable.id, applicationId))
    .returning();

  const updatedApplication = result[0];
  if (!updatedApplication) {
    throw new Error("Failed to reject application");
  }

  // Send email notification to applicant
  // This is done after the update to avoid blocking application rejection
  // Errors in email sending are logged but do not prevent application rejection
  try {
    // Get community information
    const community = await db.query.community.findFirst({
      where: and(
        eq(communityTable.id, application.communityId),
        isNull(communityTable.deletedAt),
      ),
    });

    if (community) {
      // Get applicant's user information with email
      const applicantUser = await db.query.user.findFirst({
        where: and(
          eq(userTable.id, application.userId),
          isNull(userTable.deletedAt),
        ),
      });

      // Send email only if applicant has a verified email
      if (applicantUser?.email && applicantUser.emailVerifiedAt) {
        await emailService.sendApplicationRejectedEmail(
          applicantUser.email,
          community.name,
          rejectionReason,
        );
      }
    }
  } catch (emailError: unknown) {
    // Log email error but don't fail the application rejection
    logger.service.error("Failed to send application rejected email", {
      error: emailError,
      applicationId,
    });
  }

  return updatedApplication;
}

/**
 * Revoke an application review (reset to pending)
 * If the application was approved, deactivate the membership and profile
 */
export async function revokeApplicationReview(applicationId: string) {
  const application = await db.query.communityApplication.findFirst({
    where: eq(communityApplicationTable.id, applicationId),
    with: {
      community: true,
    },
  });

  if (!application) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "지원서를 찾을 수 없습니다",
    );
  }

  // Can only revoke reviewed applications (approved or rejected)
  if (application.status === "pending") {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "대기 중인 지원서는 취소할 수 없습니다",
    );
  }

  // Revoke application in a transaction
  const result = await db.transaction(async (tx) => {
    // If revoking an approved application, deactivate membership and profile
    if (application.status === "approved") {
      const community = application.community;

      // Deactivate the membership using the direct application link
      await tx
        .update(membershipTable)
        .set({
          activatedAt: null,
        })
        .where(eq(membershipTable.applicationId, applicationId));

      // Find and deactivate the profile created for this application
      const profile = await tx.query.profile.findFirst({
        where: and(
          eq(profileTable.username, application.profileUsername),
          eq(profileTable.communityId, community.id),
          isNull(profileTable.deletedAt),
        ),
        with: {
          ownerships: {
            where: eq(profileOwnershipTable.userId, application.userId),
          },
        },
      });

      if (profile && profile.ownerships.length > 0) {
        // Deactivate the profile
        await tx
          .update(profileTable)
          .set({
            activatedAt: null,
          })
          .where(eq(profileTable.id, profile.id));
      }
    }

    // Reset application to pending state
    const result = await tx
      .update(communityApplicationTable)
      .set({
        status: "pending",
        reviewedAt: null,
        reviewedById: null,
        rejectionReason: null,
      })
      .where(eq(communityApplicationTable.id, applicationId))
      .returning();

    return result[0];
  });

  return result;
}

/**
 * Create a community application
 */
export async function createApplication(
  userId: string,
  communityId: string,
  data: {
    message?: string | null;
    profileName: string;
    profileUsername: string;
    attachmentIds?: string[];
  },
) {
  // Check if user is already a member
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  if (membership) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "이미 이 커뮤의 회원입니다",
    );
  }

  // Check if user has a pending application
  const existingPendingApplication =
    await db.query.communityApplication.findFirst({
      where: and(
        eq(communityApplicationTable.userId, userId),
        eq(communityApplicationTable.communityId, communityId),
        eq(communityApplicationTable.status, "pending"),
      ),
    });

  if (existingPendingApplication) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "이 커뮤에 이미 대기 중인 지원서가 있습니다",
    );
  }

  // Check if username is already taken by an existing profile
  const existingProfile = await db.query.profile.findFirst({
    where: and(
      eq(profileTable.username, data.profileUsername),
      eq(profileTable.communityId, communityId),
      isNull(profileTable.deletedAt),
    ),
    with: {
      ownerships: {
        where: and(
          eq(profileOwnershipTable.userId, userId),
          eq(profileOwnershipTable.role, "owner"),
        ),
      },
    },
  });

  // Allow reapplying with your own deactivated username
  // Reject if username is taken by someone else (active or inactive) or by an active profile of the same user
  if (existingProfile) {
    const isOwnProfile = existingProfile.ownerships.length > 0;
    const isActive = existingProfile.activatedAt !== null;

    // Reject if it's someone else's username OR if it's your own active profile
    if (!isOwnProfile || isActive) {
      throw new AppException(
        409,
        GENERAL_ERROR_CODE,
        "이 사용자명은 이미 사용중입니다. 다른 사용자명을 선택해주세요",
      );
    }
  }

  // Check if username is reserved by another pending application
  const pendingApplicationWithUsername =
    await db.query.communityApplication.findFirst({
      where: and(
        eq(communityApplicationTable.profileUsername, data.profileUsername),
        eq(communityApplicationTable.communityId, communityId),
        eq(communityApplicationTable.status, "pending"),
        ne(communityApplicationTable.userId, userId), // Allow user to update their own pending application
      ),
    });

  if (pendingApplicationWithUsername) {
    throw new AppException(
      409,
      GENERAL_ERROR_CODE,
      "이 사용자명은 다른 대기 중인 지원서에서 사용중입니다. 다른 사용자명을 선택해주세요",
    );
  }

  // Validate that all attachment images exist if provided
  if (data.attachmentIds && data.attachmentIds.length > 0) {
    const existingImages = await db.query.image.findMany({
      where: inArray(imageTable.id, data.attachmentIds),
    });

    if (existingImages.length !== data.attachmentIds.length) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "하나 이상의 첨부 이미지를 찾을 수 없습니다",
      );
    }
  }

  try {
    // Create application in a transaction
    const newApplication = await db.transaction(async (tx) => {
      const newApplicationResult = await tx
        .insert(communityApplicationTable)
        .values({
          userId: userId,
          communityId: communityId,
          message: data.message || null,
          profileName: data.profileName,
          profileUsername: data.profileUsername,
          status: "pending",
        })
        .returning();

      const application = newApplicationResult[0];
      if (!application) {
        throw new Error("Failed to create application");
      }

      // Create attachment records if any images were provided
      if (data.attachmentIds && data.attachmentIds.length > 0) {
        await tx.insert(applicationAttachmentTable).values(
          data.attachmentIds.map((imageId) => ({
            applicationId: application.id,
            imageId,
          })),
        );
      }

      return application;
    });

    // Send email notification to community owner
    // This is done after the transaction to avoid blocking application creation
    // Errors in email sending are logged but do not prevent application creation
    try {
      // Get community information
      const community = await db.query.community.findFirst({
        where: and(
          eq(communityTable.id, communityId),
          isNull(communityTable.deletedAt),
        ),
      });

      if (community) {
        // Get community owner's membership
        const ownerMembership = await db.query.membership.findFirst({
          where: and(
            eq(membershipTable.communityId, communityId),
            eq(membershipTable.role, "owner"),
            isNotNull(membershipTable.activatedAt),
          ),
        });

        if (ownerMembership) {
          // Get owner's user information with email
          const ownerUser = await db.query.user.findFirst({
            where: and(
              eq(userTable.id, ownerMembership.userId),
              isNull(userTable.deletedAt),
            ),
          });

          // Send email only if owner has a verified email
          if (ownerUser?.email && ownerUser.emailVerifiedAt) {
            await emailService.sendApplicationNotificationEmail(
              ownerUser.email,
              community.name,
              community.slug,
              data.profileUsername,
            );
          }

          // Send push notification to community owner
          if (ownerUser) {
            await pushNotificationService.sendPushNotification(ownerUser.id, {
              title: "새로운 가입 신청",
              body: `${data.profileName}님이 ${community.name}에 가입 신청했습니다`,
              data: {
                type: "application",
                community_slug: community.slug,
                url: `https://${process.env.BASE_DOMAIN || "commu.ng"}/communities/${community.slug}/applications`,
              },
            });
          }
        }
      }
    } catch (emailError: unknown) {
      // Log email error but don't fail the application creation
      logger.service.error("Failed to send application notification email", {
        error: emailError,
        applicationId: newApplication.id,
        communityId,
      });
    }

    return newApplication;
  } catch (error: unknown) {
    logger.service.error("Error creating application", { error });
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "지원서 제출에 실패했습니다",
    );
  }
}

/**
 * Withdraw a pending application
 */
export async function withdrawApplication(
  userId: string,
  applicationId: string,
) {
  // Find the application
  const application = await db.query.communityApplication.findFirst({
    where: and(
      eq(communityApplicationTable.id, applicationId),
      eq(communityApplicationTable.userId, userId),
    ),
  });

  if (!application) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "지원서를 찾을 수 없습니다",
    );
  }

  // Can only withdraw pending applications
  if (application.status !== "pending") {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "대기 중인 지원서만 철회할 수 있습니다",
    );
  }

  // Delete the application
  await db
    .delete(communityApplicationTable)
    .where(eq(communityApplicationTable.id, applicationId));
}

/**
 * Update a pending application
 */
export async function updateApplication(
  userId: string,
  applicationId: string,
  communityId: string,
  data: {
    message?: string | null;
    profileName: string;
    profileUsername: string;
    attachmentIds?: string[];
  },
) {
  // Find the application
  const application = await db.query.communityApplication.findFirst({
    where: and(
      eq(communityApplicationTable.id, applicationId),
      eq(communityApplicationTable.userId, userId),
    ),
    with: {
      attachments: true,
    },
  });

  if (!application) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "지원서를 찾을 수 없습니다",
    );
  }

  // Can only edit pending applications
  if (application.status !== "pending") {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "대기 중인 지원서만 수정할 수 있습니다",
    );
  }

  // Check if username is already taken by an existing profile (if username changed)
  if (data.profileUsername !== application.profileUsername) {
    const existingProfile = await db.query.profile.findFirst({
      where: and(
        eq(profileTable.username, data.profileUsername),
        eq(profileTable.communityId, communityId),
        isNull(profileTable.deletedAt),
      ),
      with: {
        ownerships: {
          where: and(
            eq(profileOwnershipTable.userId, userId),
            eq(profileOwnershipTable.role, "owner"),
          ),
        },
      },
    });

    if (existingProfile) {
      const isOwnProfile = existingProfile.ownerships.length > 0;
      const isActive = existingProfile.activatedAt !== null;

      if (!isOwnProfile || isActive) {
        throw new AppException(
          409,
          GENERAL_ERROR_CODE,
          "이 사용자명은 이미 사용중입니다. 다른 사용자명을 선택해주세요",
        );
      }
    }

    // Check if username is reserved by another pending application
    const pendingApplicationWithUsername =
      await db.query.communityApplication.findFirst({
        where: and(
          eq(communityApplicationTable.profileUsername, data.profileUsername),
          eq(communityApplicationTable.communityId, communityId),
          eq(communityApplicationTable.status, "pending"),
          ne(communityApplicationTable.id, applicationId),
        ),
      });

    if (pendingApplicationWithUsername) {
      throw new AppException(
        409,
        GENERAL_ERROR_CODE,
        "이 사용자명은 다른 대기 중인 지원서에서 사용중입니다. 다른 사용자명을 선택해주세요",
      );
    }
  }

  // Validate that all attachment images exist if provided
  if (data.attachmentIds && data.attachmentIds.length > 0) {
    const existingImages = await db.query.image.findMany({
      where: inArray(imageTable.id, data.attachmentIds),
    });

    if (existingImages.length !== data.attachmentIds.length) {
      throw new AppException(
        400,
        GENERAL_ERROR_CODE,
        "하나 이상의 첨부 이미지를 찾을 수 없습니다",
      );
    }
  }

  // Update application in a transaction
  const updatedApplication = await db.transaction(async (tx) => {
    // Update the application
    const [updated] = await tx
      .update(communityApplicationTable)
      .set({
        message: data.message,
        profileName: data.profileName,
        profileUsername: data.profileUsername,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(communityApplicationTable.id, applicationId))
      .returning();

    // Handle attachments: delete old ones and create new ones
    await tx
      .delete(applicationAttachmentTable)
      .where(eq(applicationAttachmentTable.applicationId, applicationId));

    if (data.attachmentIds && data.attachmentIds.length > 0) {
      await tx.insert(applicationAttachmentTable).values(
        data.attachmentIds.map((imageId) => ({
          applicationId: applicationId,
          imageId: imageId,
        })),
      );
    }

    return updated;
  });

  return updatedApplication;
}

/**
 * Get all applications for a user in a specific community
 */
export async function getUserApplicationsForCommunity(
  userId: string,
  communityId: string,
) {
  const applications = await db.query.communityApplication.findMany({
    where: and(
      eq(communityApplicationTable.userId, userId),
      eq(communityApplicationTable.communityId, communityId),
    ),
    orderBy: [desc(communityApplicationTable.createdAt)],
    with: {
      attachments: {
        with: {
          image: true,
        },
      },
    },
  });

  return applications;
}

/**
 * Get user's pending or rejected applications across multiple communities
 * Used to show application status in recruiting communities list
 */
export async function getUserPendingApplications(userId: string) {
  const applications = await db.query.communityApplication.findMany({
    where: and(
      eq(communityApplicationTable.userId, userId),
      or(
        eq(communityApplicationTable.status, "pending"),
        eq(communityApplicationTable.status, "rejected"),
      ),
    ),
  });

  // Return as a map for easy lookup by community ID
  const applicationMap: {
    [key: string]: typeof communityApplicationTable.$inferSelect;
  } = {};
  applications.forEach((app) => {
    applicationMap[app.communityId] = app;
  });

  return applicationMap;
}

/**
 * Get all applications sent by a user (across all communities)
 */
export async function getAllUserApplications(userId: string) {
  const applications = await db.query.communityApplication.findMany({
    where: eq(communityApplicationTable.userId, userId),
    orderBy: [desc(communityApplicationTable.createdAt)],
    with: {
      community: true,
      attachments: {
        with: {
          image: true,
        },
      },
    },
  });

  return applications;
}

/**
 * Get all applications for a community (for moderators/owners)
 */
export async function getCommunityApplications(communityId: string) {
  const applications = await db.query.communityApplication.findMany({
    where: eq(communityApplicationTable.communityId, communityId),
    orderBy: [desc(communityApplicationTable.createdAt)],
    with: {
      user_userId: true,
      user_reviewedById: true,
      attachments: {
        with: {
          image: true,
        },
      },
    },
  });

  return applications;
}

/**
 * Get a specific application by ID (simple version, just by application ID)
 */
export async function getApplicationByIdSimple(applicationId: string) {
  const application = await db.query.communityApplication.findFirst({
    where: eq(communityApplicationTable.id, applicationId),
    with: {
      community: true,
      user_userId: true,
    },
  });

  return application;
}

/**
 * Get a specific application by ID
 */
export async function getApplicationById(
  applicationId: string,
  communityId: string,
) {
  const application = await db.query.communityApplication.findFirst({
    where: and(
      eq(communityApplicationTable.id, applicationId),
      eq(communityApplicationTable.communityId, communityId),
    ),
    with: {
      user_userId: true,
      user_reviewedById: true,
      attachments: {
        with: {
          image: true,
        },
      },
    },
  });

  return application;
}

/**
 * Get application statistics for a community (count by status)
 */
export async function getApplicationStatistics(communityId: string) {
  const stats = await db
    .select({
      status: communityApplicationTable.status,
      count: count(communityApplicationTable.id),
    })
    .from(communityApplicationTable)
    .where(eq(communityApplicationTable.communityId, communityId))
    .groupBy(communityApplicationTable.status);

  return stats;
}

/**
 * Get user's latest application for a specific community
 * Used to show application status on community detail page
 */
export async function getUserLatestApplication(
  userId: string,
  communityId: string,
) {
  const application = await db.query.communityApplication.findFirst({
    where: and(
      eq(communityApplicationTable.communityId, communityId),
      eq(communityApplicationTable.userId, userId),
    ),
    orderBy: [desc(communityApplicationTable.createdAt)],
    with: {
      attachments: {
        with: {
          image: true,
        },
      },
    },
  });

  return application;
}

/**
 * Get community members with their profiles
 */
export async function getCommunityMembers(
  communityId: string,
  currentUserId: string,
  pagination: { limit: number; offset: number },
) {
  // Get community members
  const members = await db.query.membership.findMany({
    where: and(
      eq(membershipTable.communityId, communityId),
      isNotNull(membershipTable.activatedAt),
    ),
    with: {
      user: true,
    },
    limit: pagination.limit,
    offset: pagination.offset,
    orderBy: [desc(membershipTable.createdAt)],
  });

  // Get all profiles for these users in this community via ownership
  const userIds = members.map((m) => m.userId);
  const profileOwnerships =
    userIds.length > 0
      ? await db.query.profileOwnership.findMany({
          where: inArray(profileOwnershipTable.userId, userIds),
          with: {
            profile: true,
          },
        })
      : [];

  // Group profiles by user ID
  const profilesByUserId = new Map<
    string,
    Array<{
      id: string;
      name: string;
      username: string;
      bio: string | null;
      primary: boolean;
      activated: boolean;
      muted_at: string | null;
      muted_by_id: string | null;
    }>
  >();
  profileOwnerships.forEach((ownership) => {
    // Filter for profiles in this community that are active and not deleted
    if (
      ownership.profile &&
      ownership.profile.communityId === communityId &&
      ownership.profile.activatedAt !== null &&
      ownership.profile.deletedAt === null
    ) {
      if (!profilesByUserId.has(ownership.userId)) {
        profilesByUserId.set(ownership.userId, []);
      }
      const profiles = profilesByUserId.get(ownership.userId);
      if (profiles) {
        profiles.push({
          id: ownership.profile.id,
          name: ownership.profile.name,
          username: ownership.profile.username,
          bio: ownership.profile.bio,
          primary: ownership.profile.isPrimary,
          activated: ownership.profile.activatedAt !== null,
          muted_at: ownership.profile.mutedAt,
          muted_by_id: ownership.profile.mutedById,
        });
      }
    }
  });

  // Get current user's primary profile in this community
  const currentUserProfileId = await getPrimaryProfileIdForUserInCommunity(
    currentUserId,
    communityId,
  );

  // Generate random group IDs for each user (always owner-only endpoint)
  const userGroupIds = new Map<string, string>();
  members.forEach((membership) => {
    userGroupIds.set(membership.userId, crypto.randomUUID());
  });

  // Transform the data using the preloaded profiles
  const result = members.map((membership) => {
    const memberProfiles = profilesByUserId.get(membership.userId) || [];
    const memberPrimaryProfile = memberProfiles.find((a) => a.primary);
    const isCurrentUserMember =
      currentUserProfileId !== null &&
      memberPrimaryProfile?.id === currentUserProfileId;

    // Use random UUID for grouping (only set when user has multiple profiles)
    const userGroupId =
      memberProfiles.length > 1
        ? userGroupIds.get(membership.userId)
        : undefined;

    return {
      id: membership.id,
      role: membership.role,
      active: membership.activatedAt !== null,
      created_at: membership.createdAt,
      is_current_user: isCurrentUserMember,
      profiles: memberProfiles,
      user_group: userGroupId, // Random UUID per request, not reversible
      application: null,
    };
  });

  return result;
}
