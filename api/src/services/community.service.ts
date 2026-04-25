import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { logger } from "../config/logger";
import { db } from "../db";
import {
  communityApplication as communityApplicationTable,
  communityBannerImage as communityBannerImageTable,
  communityDescriptionImage as communityDescriptionImageTable,
  communityLink as communityLinkTable,
  community as communityTable,
  directMessage as directMessageTable,
  groupChatMessage as groupChatMessageTable,
  groupChat as groupChatTable,
  image as imageTable,
  membership as membershipTable,
  post as postTable,
  profileOwnership as profileOwnershipTable,
  profile as profileTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";
import {
  createCommunityHashtags,
  replaceCommunityHashtags,
} from "../utils/hashtag-helper";
import { getPrimaryProfileIdForUserInCommunity } from "../utils/profile-ownership";
import { batchLoadProfilePictures } from "../utils/profile-picture-helper";
import { addImageUrl } from "../utils/r2";
import { getBuiltinApp } from "./builtin-commands";
import * as imageService from "./image.service";
import * as installedAppService from "./installed-app.service";

/**
 * Get community by custom domain
 */
export async function getCommunityByCustomDomain(customDomain: string) {
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.customDomain, customDomain),
      isNotNull(communityTable.domainVerifiedAt),
      isNull(communityTable.deletedAt),
    ),
  });

  return community;
}

/**
 * Get community by slug
 */
export async function getCommunityBySlug(slug: string) {
  const community = await db.query.community.findFirst({
    where: and(eq(communityTable.slug, slug), isNull(communityTable.deletedAt)),
  });

  return community;
}

/**
 * Get community by ID
 */
export async function getCommunityById(id: string) {
  const community = await db.query.community.findFirst({
    where: and(eq(communityTable.id, id), isNull(communityTable.deletedAt)),
  });

  return community;
}

/**
 * Validate that a community exists by slug and is not deleted
 */
export async function validateCommunityExistsBySlug(slug: string) {
  const community = await getCommunityBySlug(slug);

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  return community;
}

/**
 * Validate that a community exists by ID and is not deleted
 */
export async function validateCommunityExistsById(id: string) {
  const community = await getCommunityById(id);

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  return community;
}

/**
 * Create a new community with owner membership, profile, and metadata
 */
export async function createCommunity(
  userId: string,
  data: {
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    recruiting: boolean;
    recruitingStartsAt?: string | null;
    recruitingEndsAt?: string | null;
    minimumBirthYear?: number | null;
    imageId?: string | null;
    hashtags?: string[];
    profileUsername: string;
    profileName: string;
    description?: string | null;
    muteNewMembers?: boolean;
    showAllReplies?: boolean;
    bumpOnReply?: boolean;
  },
) {
  // Validate image if provided
  if (data.imageId) {
    const image = await db.query.image.findFirst({
      where: and(eq(imageTable.id, data.imageId), isNull(imageTable.deletedAt)),
    });
    if (!image) {
      throw new AppException(400, GENERAL_ERROR_CODE, "잘못된 이미지 ID입니다");
    }
  }

  try {
    // Create community in a transaction
    const result = await db.transaction(async (tx) => {
      // Create community
      const newCommunityResult = await tx
        .insert(communityTable)
        .values({
          name: data.name,
          slug: data.slug,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          isRecruiting: data.recruiting,
          recruitingStartsAt: data.recruitingStartsAt,
          recruitingEndsAt: data.recruitingEndsAt,
          minimumBirthYear: data.minimumBirthYear,
          description: data.description || null,
          muteNewMembers: data.muteNewMembers ?? false,
          showAllReplies: data.showAllReplies ?? false,
          bumpOnReply: data.bumpOnReply ?? false,
        })
        .returning();

      const newCommunity = newCommunityResult[0];
      if (!newCommunity) {
        throw new Error("Failed to create community");
      }

      // Create owner membership for the user
      await tx.insert(membershipTable).values({
        userId,
        communityId: newCommunity.id,
        role: "owner",
        activatedAt: sql`NOW()`,
      });

      // Create an Profile for the community owner
      const newProfileResult = await tx
        .insert(profileTable)
        .values({
          name: data.profileName,
          username: data.profileUsername,
          communityId: newCommunity.id,
          activatedAt: sql`NOW()`, // Community owner is immediately active
          isPrimary: true, // First profile is primary
        })
        .returning();

      const newProfile = newProfileResult[0];
      if (!newProfile) {
        throw new Error("Failed to create profile");
      }

      // Create ownership record for the profile
      await tx.insert(profileOwnershipTable).values({
        profileId: newProfile.id,
        userId: userId,
        role: "owner",
        createdBy: userId,
      });

      // Create banner image association if provided
      if (data.imageId) {
        await tx.insert(communityBannerImageTable).values({
          communityId: newCommunity.id,
          imageId: data.imageId,
        });
      }

      // Create hashtag associations if provided
      if (data.hashtags && data.hashtags.length > 0) {
        await createCommunityHashtags(newCommunity.id, data.hashtags, tx);
      }

      return {
        community: newCommunity,
        profile: newProfile,
      };
    });

    // Best-effort auto-install of the help app. Runs outside the transaction
    // so a failure (e.g. username collision with the owner) doesn't abort
    // community creation. Owner can install manually from the catalog.
    const helpApp = getBuiltinApp("help");
    if (helpApp) {
      try {
        await installedAppService.installApp(result.community.id, helpApp.id, {
          profileName: helpApp.defaultProfile.name,
          profileUsername: helpApp.defaultProfile.username,
          installedById: userId,
        });
      } catch (err) {
        logger.service.warn("Auto-install of help app failed", {
          communityId: result.community.id,
          error: err,
        });
      }
    }

    return result;
  } catch (error: unknown) {
    logger.service.error("Error creating community", { error });
    if (error instanceof Error && error.message.includes("unique_slug")) {
      throw new AppException(
        409,
        GENERAL_ERROR_CODE,
        "이미 존재하는 커뮤 ID입니다",
      );
    }
    throw new AppException(400, GENERAL_ERROR_CODE, "커뮤 생성에 실패했습니다");
  }
}

/**
 * Update a community
 */
export async function updateCommunity(
  communityId: string,
  data: {
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    recruiting: boolean;
    recruitingStartsAt?: string | null;
    recruitingEndsAt?: string | null;
    minimumBirthYear?: number | null;
    imageId?: string | null;
    hashtags?: string[];
    description?: string | null;
    descriptionImageIds?: string[];
    muteNewMembers?: boolean;
    showAllReplies?: boolean;
    bumpOnReply?: boolean;
  },
) {
  // Get existing community
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  // Update community in a transaction
  const updatedCommunity = await db.transaction(async (tx) => {
    // Update community fields
    const updatedCommunityResult = await tx
      .update(communityTable)
      .set({
        name: data.name,
        slug: data.slug,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        isRecruiting: data.recruiting,
        recruitingStartsAt: data.recruitingStartsAt,
        recruitingEndsAt: data.recruitingEndsAt,
        minimumBirthYear: data.minimumBirthYear,
        description: data.description || null,
        muteNewMembers: data.muteNewMembers,
        showAllReplies: data.showAllReplies,
        bumpOnReply: data.bumpOnReply,
      })
      .where(eq(communityTable.id, communityId))
      .returning();

    const updated = updatedCommunityResult[0];
    if (!updated) {
      throw new Error("Failed to update community");
    }

    // Update hashtags
    if (data.hashtags) {
      await replaceCommunityHashtags(communityId, data.hashtags, tx);
    }

    // Update banner image if provided
    if (data.imageId) {
      // Remove existing banner images (soft delete)
      await tx
        .update(communityBannerImageTable)
        .set({ deletedAt: sql`NOW()` })
        .where(
          and(
            eq(communityBannerImageTable.communityId, communityId),
            isNull(communityBannerImageTable.deletedAt),
          ),
        );

      // Validate that the image exists and is not deleted
      const image = await tx.query.image.findFirst({
        where: and(
          eq(imageTable.id, data.imageId),
          isNull(imageTable.deletedAt),
        ),
      });
      if (!image) {
        throw new AppException(
          400,
          GENERAL_ERROR_CODE,
          `잘못된 이미지 ID입니다: ${data.imageId}`,
        );
      }

      // Create new banner image association
      await tx.insert(communityBannerImageTable).values({
        communityId: communityId,
        imageId: data.imageId,
      });
    }

    // Update description images if provided
    if (data.descriptionImageIds) {
      // Get existing description images
      const existingDescImages =
        await tx.query.communityDescriptionImage.findMany({
          where: and(
            eq(communityDescriptionImageTable.communityId, communityId),
            isNull(communityDescriptionImageTable.deletedAt),
          ),
        });

      const existingImageIds = new Set(
        existingDescImages.map((img) => img.imageId),
      );
      const newImageIds = new Set(data.descriptionImageIds);

      // Soft delete images that are no longer in the description
      const imagesToRemove = existingDescImages
        .filter((img) => !newImageIds.has(img.imageId))
        .map((img) => img.id);

      if (imagesToRemove.length > 0) {
        await tx
          .update(communityDescriptionImageTable)
          .set({ deletedAt: sql`NOW()` })
          .where(inArray(communityDescriptionImageTable.id, imagesToRemove));
      }

      // Add new images
      const newImageIdsToAdd = data.descriptionImageIds.filter(
        (imageId) => !existingImageIds.has(imageId),
      );

      if (newImageIdsToAdd.length > 0) {
        // Batch validate all new images exist
        const validImages = await tx.query.image.findMany({
          where: and(
            inArray(imageTable.id, newImageIdsToAdd),
            isNull(imageTable.deletedAt),
          ),
        });

        if (validImages.length !== newImageIdsToAdd.length) {
          const validImageIds = new Set(validImages.map((img) => img.id));
          const invalidIds = newImageIdsToAdd.filter(
            (id) => !validImageIds.has(id),
          );
          throw new AppException(
            400,
            GENERAL_ERROR_CODE,
            `잘못된 이미지 ID입니다: ${invalidIds.join(", ")}`,
          );
        }

        // Batch insert all new associations
        await tx.insert(communityDescriptionImageTable).values(
          newImageIdsToAdd.map((imageId) => ({
            communityId: communityId,
            imageId: imageId,
          })),
        );
      }
    }

    return updated;
  });

  const ownerMembership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.communityId, updatedCommunity.id),
      eq(membershipTable.role, "owner"),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  let ownerProfileId = null;
  if (ownerMembership?.userId) {
    ownerProfileId = await getPrimaryProfileIdForUserInCommunity(
      ownerMembership.userId,
      updatedCommunity.id,
    );
  }

  return {
    community: updatedCommunity,
    ownerProfileId,
  };
}

export async function updateCommunityThemeKeyColor(
  communityId: string,
  themeKeyColor: string | null,
) {
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  const updated = await db
    .update(communityTable)
    .set({ themeKeyColor })
    .where(eq(communityTable.id, communityId))
    .returning();

  const result = updated[0];
  if (!result) {
    throw new Error("Failed to update community theme key color");
  }

  return result;
}

/**
 * Delete a community (soft delete)
 */
export async function deleteCommunity(communityId: string) {
  // Get existing community
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  // Get banner images before transaction
  const bannerImages = await db.query.communityBannerImage.findMany({
    where: and(
      eq(communityBannerImageTable.communityId, communityId),
      isNull(communityBannerImageTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });

  // Get description images before transaction
  const descriptionImages = await db.query.communityDescriptionImage.findMany({
    where: and(
      eq(communityDescriptionImageTable.communityId, communityId),
      isNull(communityDescriptionImageTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });

  // Delete community in a transaction
  await db.transaction(async (tx) => {
    // Soft delete all community banner images
    if (bannerImages.length > 0) {
      const bannerImageIds = bannerImages.map((img) => img.id);
      await tx
        .update(communityBannerImageTable)
        .set({ deletedAt: sql`NOW()` })
        .where(inArray(communityBannerImageTable.id, bannerImageIds));
    }

    // Soft delete all community description images
    if (descriptionImages.length > 0) {
      const descImageIds = descriptionImages.map((img) => img.id);
      await tx
        .update(communityDescriptionImageTable)
        .set({ deletedAt: sql`NOW()` })
        .where(inArray(communityDescriptionImageTable.id, descImageIds));
    }

    // Soft delete the community
    await tx
      .update(communityTable)
      .set({
        deletedAt: sql`NOW()`,
      })
      .where(eq(communityTable.id, communityId));
  });

  // Delete images if unused (outside transaction since it might involve external calls)
  // Collect all image IDs
  const imageIdsToDelete = [
    ...bannerImages.filter((bi) => bi.image).map((bi) => bi.image.id),
    ...descriptionImages.filter((di) => di.image).map((di) => di.image.id),
  ];

  // Batch delete unused images
  if (imageIdsToDelete.length > 0) {
    await imageService.batchDeleteImagesIfUnused(imageIdsToDelete);
  }
}

/**
 * Delete a community banner image
 */
export async function deleteBannerImage(
  communityId: string,
  bannerImageId: string,
) {
  // Find the banner image association
  const bannerImage = await db.query.communityBannerImage.findFirst({
    where: and(
      eq(communityBannerImageTable.id, bannerImageId),
      eq(communityBannerImageTable.communityId, communityId),
      isNull(communityBannerImageTable.deletedAt),
    ),
    with: {
      image: true,
    },
  });

  if (!bannerImage) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "배너 이미지를 찾을 수 없습니다",
    );
  }

  // Soft delete the banner image association
  await db
    .update(communityBannerImageTable)
    .set({ deletedAt: sql`NOW()` })
    .where(eq(communityBannerImageTable.id, bannerImage.id));

  // Delete the image if it's not used elsewhere
  if (bannerImage.image) {
    await imageService.deleteImageIfUnused(bannerImage.image.id);
  }
}

/**
 * Get all recruiting communities with hashtags
 * Filters by recruiting status and date ranges
 */
export async function getRecruitingCommunities() {
  const communities = await db.query.community.findMany({
    where: and(
      eq(communityTable.isRecruiting, true),
      isNull(communityTable.deletedAt),
      sql`${communityTable.endsAt} > NOW()`,
      // Check recruiting dates if they are set
      or(
        isNull(communityTable.recruitingStartsAt),
        sql`${communityTable.recruitingStartsAt} <= NOW()`,
      ),
      or(
        isNull(communityTable.recruitingEndsAt),
        sql`${communityTable.recruitingEndsAt} > NOW()`,
      ),
    ),
    orderBy: [desc(communityTable.createdAt)],
    with: {
      communityHashtags: {
        with: {
          hashtag: true,
        },
      },
    },
  });

  return communities;
}

/**
 * Get all links for a community
 */
export async function getCommunityLinks(communityId: string) {
  const links = await db.query.communityLink.findMany({
    where: and(
      eq(communityLinkTable.communityId, communityId),
      isNull(communityLinkTable.deletedAt),
    ),
    orderBy: [desc(communityLinkTable.createdAt)],
  });

  return links;
}

/**
 * Create a new community link
 */
export async function createCommunityLink(
  communityId: string,
  title: string,
  url: string,
) {
  const newLink = await db
    .insert(communityLinkTable)
    .values({
      communityId,
      title,
      url,
    })
    .returning();

  if (!newLink[0]) {
    throw new AppException(500, GENERAL_ERROR_CODE, "링크 생성에 실패했습니다");
  }

  return newLink[0];
}

/**
 * Update a community link
 */
export async function updateCommunityLink(
  communityId: string,
  linkId: string,
  title: string,
  url: string,
) {
  const updatedLinks = await db
    .update(communityLinkTable)
    .set({ title, url })
    .where(
      and(
        eq(communityLinkTable.id, linkId),
        eq(communityLinkTable.communityId, communityId),
        isNull(communityLinkTable.deletedAt),
      ),
    )
    .returning();

  const updatedLink = updatedLinks[0];
  if (!updatedLink) {
    throw new AppException(404, GENERAL_ERROR_CODE, "링크를 찾을 수 없습니다");
  }

  return updatedLink;
}

/**
 * Delete (soft delete) a community link
 */
export async function deleteCommunityLink(communityId: string, linkId: string) {
  const deletedLinks = await db
    .update(communityLinkTable)
    .set({ deletedAt: sql`NOW()` })
    .where(
      and(
        eq(communityLinkTable.id, linkId),
        eq(communityLinkTable.communityId, communityId),
        isNull(communityLinkTable.deletedAt),
      ),
    )
    .returning();

  if (deletedLinks.length === 0) {
    throw new AppException(404, GENERAL_ERROR_CODE, "링크를 찾을 수 없습니다");
  }

  return deletedLinks[0];
}

/**
 * Get all communities that a user is a member of with enriched data
 * Returns communities with banner images, hashtags, and owner profile info
 */
export async function getUserCommunities(userId: string) {
  const communityTableWithRoles = await db.query.membership.findMany({
    where: and(
      eq(membershipTable.userId, userId),
      isNotNull(membershipTable.activatedAt),
    ),
    with: {
      community: {
        with: {
          communityHashtags: {
            with: {
              hashtag: true,
            },
          },
        },
      },
    },
  });

  // Filter out deleted communities and collect IDs
  const validMemberships = communityTableWithRoles.filter(
    (m) => m.community && !m.community.deletedAt,
  );
  const communityIds = validMemberships.map((m) => m.community.id);

  // Batch fetch banner images for all communities
  const bannerImages =
    communityIds.length > 0
      ? await imageService.getCommunityBannerInfo(communityIds)
      : new Map();

  // Batch fetch owner memberships for all communities
  const ownerMemberships =
    communityIds.length > 0
      ? await db.query.membership.findMany({
          where: and(
            inArray(membershipTable.communityId, communityIds),
            eq(membershipTable.role, "owner"),
            isNotNull(membershipTable.activatedAt),
          ),
        })
      : [];

  // Build map of community ID -> owner user ID
  const ownerUserIdMap = new Map(
    ownerMemberships.map((m) => [m.communityId, m.userId]),
  );

  // Batch fetch pending application counts for communities where user is owner or moderator
  const managedCommunityIds = validMemberships
    .filter((m) => m.role === "owner" || m.role === "moderator")
    .map((m) => m.community.id);

  const pendingApplicationCounts =
    managedCommunityIds.length > 0
      ? await db
          .select({
            communityId: communityApplicationTable.communityId,
            count: count(communityApplicationTable.id),
          })
          .from(communityApplicationTable)
          .where(
            and(
              inArray(
                communityApplicationTable.communityId,
                managedCommunityIds,
              ),
              eq(communityApplicationTable.status, "pending"),
            ),
          )
          .groupBy(communityApplicationTable.communityId)
      : [];

  // Build map of community ID -> pending application count
  const pendingCountMap = new Map(
    pendingApplicationCounts.map((c) => [c.communityId, Number(c.count)]),
  );

  // Collect all unique owner user IDs and their communities
  const ownerUserCommunityPairs = Array.from(ownerUserIdMap.entries()).map(
    ([communityId, userId]) => ({ userId, communityId }),
  );

  // Batch fetch primary profile IDs for all owners
  const ownerProfileIdsMap =
    ownerUserCommunityPairs.length > 0
      ? await getPrimaryProfileIdForUserInCommunity(ownerUserCommunityPairs)
      : new Map<string, string | null>();

  // Convert map keys from "userId:communityId" to just communityId
  const ownerProfileIds = new Map<string, string | null>();
  for (const { userId, communityId } of ownerUserCommunityPairs) {
    const key = `${userId}:${communityId}`;
    ownerProfileIds.set(communityId, ownerProfileIdsMap.get(key) || null);
  }

  const result = validMemberships.map((membership) => {
    const community = membership.community;
    const bannerInfo = bannerImages.get(community.id) || null;

    const hashtagTableData = community.communityHashtags.map((ch) => ({
      id: ch.hashtag.id,
      tag: ch.hashtag.tag,
    }));

    const ownerProfileId = ownerProfileIds.get(community.id) || null;
    const pendingApplicationCount = pendingCountMap.get(community.id) || 0;

    return {
      id: community.id,
      name: community.name,
      slug: community.slug,
      starts_at: community.startsAt,
      ends_at: community.endsAt,
      is_recruiting: community.isRecruiting,
      recruiting_starts_at: community.recruitingStartsAt,
      recruiting_ends_at: community.recruitingEndsAt,
      minimum_birth_year: community.minimumBirthYear,
      created_at: community.createdAt,
      role: membership.role,
      custom_domain: community.customDomain,
      domain_verified: community.domainVerifiedAt,
      banner_image_url: bannerInfo?.url || null,
      banner_image_width: bannerInfo?.width || null,
      banner_image_height: bannerInfo?.height || null,
      hashtags: hashtagTableData,
      owner_profile_id: ownerProfileId,
      pending_application_count: pendingApplicationCount,
    };
  });

  // Sort by creation date
  result.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return result;
}

/**
 * Get recruiting communities with user context (applications, memberships)
 * If userId is provided, includes user's application status and membership info
 */
export async function getRecruitingCommunitiesWithUserContext(userId?: string) {
  const recruitingCommunities = await db.query.community.findMany({
    where: and(
      eq(communityTable.isRecruiting, true),
      isNull(communityTable.deletedAt),
      sql`${communityTable.endsAt} > NOW()`,
      // Check recruiting dates if they are set
      or(
        isNull(communityTable.recruitingStartsAt),
        sql`${communityTable.recruitingStartsAt} <= NOW()`,
      ),
      or(
        isNull(communityTable.recruitingEndsAt),
        sql`${communityTable.recruitingEndsAt} > NOW()`,
      ),
    ),
    orderBy: [desc(communityTable.createdAt)],
    with: {
      communityHashtags: {
        with: {
          hashtag: true,
        },
      },
    },
  });

  // Get user applications and memberships if user is authenticated
  const userApplications: {
    [key: string]: typeof communityApplicationTable.$inferSelect;
  } = {};
  const userMemberships: Set<string> = new Set();
  const userRoles: { [key: string]: string } = {};

  if (userId) {
    const applications = await db.query.communityApplication.findMany({
      where: and(
        eq(communityApplicationTable.userId, userId),
        or(
          eq(communityApplicationTable.status, "pending"),
          eq(communityApplicationTable.status, "rejected"),
        ),
      ),
    });
    applications.forEach((app) => {
      userApplications[app.communityId] = app;
    });

    const membershipTableList = await db.query.membership.findMany({
      where: and(
        eq(membershipTable.userId, userId),
        isNotNull(membershipTable.activatedAt),
      ),
    });
    membershipTableList.forEach((membership) => {
      userMemberships.add(membership.communityId);
      userRoles[membership.communityId] = membership.role;
    });
  }

  // Collect all community IDs for batch operations
  const communityIds = recruitingCommunities.map((c) => c.id);

  // Batch fetch banner images for all communities
  const bannerImages =
    communityIds.length > 0
      ? await imageService.getCommunityBannerInfo(communityIds)
      : new Map();

  // Batch fetch owner memberships for all communities
  const ownerMemberships =
    communityIds.length > 0
      ? await db.query.membership.findMany({
          where: and(
            inArray(membershipTable.communityId, communityIds),
            eq(membershipTable.role, "owner"),
            isNotNull(membershipTable.activatedAt),
          ),
        })
      : [];

  // Build map of community ID -> owner user ID
  const ownerUserIdMap = new Map(
    ownerMemberships.map((m) => [m.communityId, m.userId]),
  );

  // Collect all unique owner user IDs and their communities
  const ownerUserCommunityPairs = Array.from(ownerUserIdMap.entries()).map(
    ([communityId, userId]) => ({ userId, communityId }),
  );

  // Batch fetch primary profile IDs for all owners
  const ownerProfileIdsMap =
    ownerUserCommunityPairs.length > 0
      ? await getPrimaryProfileIdForUserInCommunity(ownerUserCommunityPairs)
      : new Map<string, string | null>();

  // Convert map keys from "userId:communityId" to just communityId
  const ownerProfileIds = new Map<string, string | null>();
  for (const { userId, communityId } of ownerUserCommunityPairs) {
    const key = `${userId}:${communityId}`;
    ownerProfileIds.set(communityId, ownerProfileIdsMap.get(key) || null);
  }

  const result = recruitingCommunities.map((community) => {
    const bannerInfo = bannerImages.get(community.id) || null;

    const hashtagTableData = community.communityHashtags.map((ch) => ({
      id: ch.hashtag.id,
      tag: ch.hashtag.tag,
    }));

    const hasApplied = userApplications[community.id] !== undefined;
    const application = userApplications[community.id];
    const applicationId = application?.id || null;
    const applicationStatus = application?.status || null;
    const isMember = userMemberships.has(community.id);
    const userRole = userRoles[community.id] || null;

    const ownerProfileId = ownerProfileIds.get(community.id) || null;

    return {
      id: community.id,
      name: community.name,
      slug: community.slug,
      starts_at: community.startsAt,
      ends_at: community.endsAt,
      is_recruiting: community.isRecruiting,
      recruiting_starts_at: community.recruitingStartsAt,
      recruiting_ends_at: community.recruitingEndsAt,
      minimum_birth_year: community.minimumBirthYear,
      created_at: community.createdAt,
      custom_domain: community.customDomain,
      domain_verified: community.domainVerifiedAt,
      owner_profile_id: ownerProfileId,
      banner_image_url: bannerInfo?.url || null,
      banner_image_width: bannerInfo?.width || null,
      banner_image_height: bannerInfo?.height || null,
      has_applied: hasApplied,
      application_id: applicationId,
      application_status: applicationStatus,
      is_member: isMember,
      role: userRole,
      hashtags: hashtagTableData,
    };
  });

  // Sort by creation date
  result.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return result;
}

export async function getOngoingCommunitiesWithUserContext(userId?: string) {
  const ongoingCommunities = await db.query.community.findMany({
    where: and(
      eq(communityTable.isRecruiting, false),
      isNull(communityTable.deletedAt),
      sql`${communityTable.startsAt} <= NOW()`,
      sql`${communityTable.endsAt} > NOW()`,
    ),
    orderBy: [desc(communityTable.createdAt)],
    with: {
      communityHashtags: {
        with: {
          hashtag: true,
        },
      },
    },
  });

  // Get user applications and memberships if user is authenticated
  const userApplications: {
    [key: string]: typeof communityApplicationTable.$inferSelect;
  } = {};
  const userMemberships: Set<string> = new Set();
  const userRoles: { [key: string]: string } = {};

  if (userId) {
    const applications = await db.query.communityApplication.findMany({
      where: and(
        eq(communityApplicationTable.userId, userId),
        or(
          eq(communityApplicationTable.status, "pending"),
          eq(communityApplicationTable.status, "rejected"),
        ),
      ),
    });
    applications.forEach((app) => {
      userApplications[app.communityId] = app;
    });

    const membershipTableList = await db.query.membership.findMany({
      where: and(
        eq(membershipTable.userId, userId),
        isNotNull(membershipTable.activatedAt),
      ),
    });
    membershipTableList.forEach((membership) => {
      userMemberships.add(membership.communityId);
      userRoles[membership.communityId] = membership.role;
    });
  }

  // Collect all community IDs for batch operations
  const communityIds = ongoingCommunities.map((c) => c.id);

  // Batch fetch banner images for all communities
  const bannerImages =
    communityIds.length > 0
      ? await imageService.getCommunityBannerInfo(communityIds)
      : new Map();

  // Batch fetch owner memberships for all communities
  const ownerMemberships =
    communityIds.length > 0
      ? await db.query.membership.findMany({
          where: and(
            inArray(membershipTable.communityId, communityIds),
            eq(membershipTable.role, "owner"),
            isNotNull(membershipTable.activatedAt),
          ),
        })
      : [];

  // Build map of community ID -> owner user ID
  const ownerUserIdMap = new Map(
    ownerMemberships.map((m) => [m.communityId, m.userId]),
  );

  // Collect all unique owner user IDs and their communities
  const ownerUserCommunityPairs = Array.from(ownerUserIdMap.entries()).map(
    ([communityId, userId]) => ({ userId, communityId }),
  );

  // Batch fetch primary profile IDs for all owners
  const ownerProfileIdsMap =
    ownerUserCommunityPairs.length > 0
      ? await getPrimaryProfileIdForUserInCommunity(ownerUserCommunityPairs)
      : new Map<string, string | null>();

  // Convert map keys from "userId:communityId" to just communityId
  const ownerProfileIds = new Map<string, string | null>();
  for (const { userId, communityId } of ownerUserCommunityPairs) {
    const key = `${userId}:${communityId}`;
    ownerProfileIds.set(communityId, ownerProfileIdsMap.get(key) || null);
  }

  const result = ongoingCommunities.map((community) => {
    const bannerInfo = bannerImages.get(community.id) || null;

    const hashtagTableData = community.communityHashtags.map((ch) => ({
      id: ch.hashtag.id,
      tag: ch.hashtag.tag,
    }));

    const hasApplied = userApplications[community.id] !== undefined;
    const application = userApplications[community.id];
    const applicationId = application?.id || null;
    const applicationStatus = application?.status || null;
    const isMember = userMemberships.has(community.id);
    const userRole = userRoles[community.id] || null;

    const ownerProfileId = ownerProfileIds.get(community.id) || null;

    return {
      id: community.id,
      name: community.name,
      slug: community.slug,
      starts_at: community.startsAt,
      ends_at: community.endsAt,
      is_recruiting: community.isRecruiting,
      recruiting_starts_at: community.recruitingStartsAt,
      recruiting_ends_at: community.recruitingEndsAt,
      minimum_birth_year: community.minimumBirthYear,
      created_at: community.createdAt,
      custom_domain: community.customDomain,
      domain_verified: community.domainVerifiedAt,
      owner_profile_id: ownerProfileId,
      banner_image_url: bannerInfo?.url || null,
      banner_image_width: bannerInfo?.width || null,
      banner_image_height: bannerInfo?.height || null,
      has_applied: hasApplied,
      application_id: applicationId,
      application_status: applicationStatus,
      is_member: isMember,
      role: userRole,
      hashtags: hashtagTableData,
    };
  });

  // Sort by creation date
  result.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return result;
}

/**
 * Get community statistics including applications and member counts
 * Returns aggregated data for community dashboard
 */
export async function getCommunityStats(communityId: string) {
  // Get community with hashtags
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
    with: {
      communityHashtags: {
        with: {
          hashtag: true,
        },
      },
    },
  });

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  // Get application statistics
  const appStats = await db
    .select({
      status: communityApplicationTable.status,
      count: count(communityApplicationTable.id),
    })
    .from(communityApplicationTable)
    .where(eq(communityApplicationTable.communityId, communityId))
    .groupBy(communityApplicationTable.status);

  // Convert to object for easier access
  const statsDict: { [key: string]: number } = {};
  for (const stat of appStats) {
    statsDict[stat.status] = stat.count;
  }

  // Get total member count (active members)
  const totalMembersResult = await db
    .select({ count: count(membershipTable.id) })
    .from(membershipTable)
    .where(
      and(
        eq(membershipTable.communityId, communityId),
        isNotNull(membershipTable.activatedAt),
      ),
    );

  // Get banner image info
  const bannerInfo = await imageService.getCommunityBannerInfo(communityId);

  // Get hashtags
  const hashtags = community.communityHashtags.map((ch) => ({
    id: ch.hashtag.id,
    tag: ch.hashtag.tag,
  }));

  return {
    community: {
      id: community.id,
      name: community.name,
      slug: community.slug,
      banner_image_url: bannerInfo?.url || null,
      banner_image_width: bannerInfo?.width || null,
      banner_image_height: bannerInfo?.height || null,
      hashtags: hashtags,
    },
    applications: {
      pending: statsDict.pending || 0,
      approved: statsDict.approved || 0,
      rejected: statsDict.rejected || 0,
      total: Object.values(statsDict).reduce((sum, count) => sum + count, 0),
    },
    members: {
      total: totalMembersResult[0]?.count ?? 0,
    },
  };
}

/**
 * Get community activity statistics for analytics dashboard
 * Returns time-series data for posts and direct messages
 */
export async function getCommunityActivityStats(
  communityId: string,
  days = 30,
) {
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  // Get posts activity by date
  const postsTimeline = await db
    .select({
      date: sql<string>`DATE(${postTable.createdAt})`.as("date"),
      count: count(postTable.id),
    })
    .from(postTable)
    .where(
      and(
        eq(postTable.communityId, communityId),
        isNull(postTable.deletedAt),
        sql`${postTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    )
    .groupBy(sql`DATE(${postTable.createdAt})`)
    .orderBy(sql`DATE(${postTable.createdAt})`);

  // Get direct messages activity by date
  const dmsTimeline = await db
    .select({
      date: sql<string>`DATE(${directMessageTable.createdAt})`.as("date"),
      count: count(directMessageTable.id),
    })
    .from(directMessageTable)
    .where(
      and(
        eq(directMessageTable.communityId, communityId),
        isNull(directMessageTable.deletedAt),
        sql`${directMessageTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    )
    .groupBy(sql`DATE(${directMessageTable.createdAt})`)
    .orderBy(sql`DATE(${directMessageTable.createdAt})`);

  // Get posts activity by hour (hourly timeline)
  const postsHourlyTimeline = await db
    .select({
      datetime: sql<string>`DATE_TRUNC('hour', ${postTable.createdAt})`.as(
        "datetime",
      ),
      count: count(postTable.id),
    })
    .from(postTable)
    .where(
      and(
        eq(postTable.communityId, communityId),
        isNull(postTable.deletedAt),
        sql`${postTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    )
    .groupBy(sql`DATE_TRUNC('hour', ${postTable.createdAt})`)
    .orderBy(sql`DATE_TRUNC('hour', ${postTable.createdAt})`);

  // Get direct messages activity by hour (hourly timeline)
  const dmsHourlyTimeline = await db
    .select({
      datetime:
        sql<string>`DATE_TRUNC('hour', ${directMessageTable.createdAt})`.as(
          "datetime",
        ),
      count: count(directMessageTable.id),
    })
    .from(directMessageTable)
    .where(
      and(
        eq(directMessageTable.communityId, communityId),
        isNull(directMessageTable.deletedAt),
        sql`${directMessageTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    )
    .groupBy(sql`DATE_TRUNC('hour', ${directMessageTable.createdAt})`)
    .orderBy(sql`DATE_TRUNC('hour', ${directMessageTable.createdAt})`);

  // Get group messages activity by date
  const groupMessagesTimeline = await db
    .select({
      date: sql<string>`DATE(${groupChatMessageTable.createdAt})`.as("date"),
      count: count(groupChatMessageTable.id),
    })
    .from(groupChatMessageTable)
    .innerJoin(
      groupChatTable,
      eq(groupChatMessageTable.groupChatId, groupChatTable.id),
    )
    .where(
      and(
        eq(groupChatTable.communityId, communityId),
        isNull(groupChatMessageTable.deletedAt),
        isNull(groupChatTable.deletedAt),
        sql`${groupChatMessageTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    )
    .groupBy(sql`DATE(${groupChatMessageTable.createdAt})`)
    .orderBy(sql`DATE(${groupChatMessageTable.createdAt})`);

  // Get group messages activity by hour (hourly timeline)
  const groupMessagesHourlyTimeline = await db
    .select({
      datetime:
        sql<string>`DATE_TRUNC('hour', ${groupChatMessageTable.createdAt})`.as(
          "datetime",
        ),
      count: count(groupChatMessageTable.id),
    })
    .from(groupChatMessageTable)
    .innerJoin(
      groupChatTable,
      eq(groupChatMessageTable.groupChatId, groupChatTable.id),
    )
    .where(
      and(
        eq(groupChatTable.communityId, communityId),
        isNull(groupChatMessageTable.deletedAt),
        isNull(groupChatTable.deletedAt),
        sql`${groupChatMessageTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    )
    .groupBy(sql`DATE_TRUNC('hour', ${groupChatMessageTable.createdAt})`)
    .orderBy(sql`DATE_TRUNC('hour', ${groupChatMessageTable.createdAt})`);

  // Get posts activity heatmap (hour of day x day of week) - use ALL data for patterns
  const postsHeatmap = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${postTable.createdAt})`.as("hour"),
      dayOfWeek: sql<number>`EXTRACT(DOW FROM ${postTable.createdAt})`.as(
        "dayOfWeek",
      ),
      count: count(postTable.id),
    })
    .from(postTable)
    .where(
      and(eq(postTable.communityId, communityId), isNull(postTable.deletedAt)),
    )
    .groupBy(
      sql`EXTRACT(HOUR FROM ${postTable.createdAt})`,
      sql`EXTRACT(DOW FROM ${postTable.createdAt})`,
    );

  // Get direct messages activity heatmap (hour of day x day of week) - use ALL data for patterns
  const dmsHeatmap = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${directMessageTable.createdAt})`.as(
        "hour",
      ),
      dayOfWeek:
        sql<number>`EXTRACT(DOW FROM ${directMessageTable.createdAt})`.as(
          "dayOfWeek",
        ),
      count: count(directMessageTable.id),
    })
    .from(directMessageTable)
    .where(
      and(
        eq(directMessageTable.communityId, communityId),
        isNull(directMessageTable.deletedAt),
      ),
    )
    .groupBy(
      sql`EXTRACT(HOUR FROM ${directMessageTable.createdAt})`,
      sql`EXTRACT(DOW FROM ${directMessageTable.createdAt})`,
    );

  // Get group messages activity heatmap (hour of day x day of week) - use ALL data for patterns
  const groupMessagesHeatmap = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${groupChatMessageTable.createdAt})`.as(
        "hour",
      ),
      dayOfWeek:
        sql<number>`EXTRACT(DOW FROM ${groupChatMessageTable.createdAt})`.as(
          "dayOfWeek",
        ),
      count: count(groupChatMessageTable.id),
    })
    .from(groupChatMessageTable)
    .innerJoin(
      groupChatTable,
      eq(groupChatMessageTable.groupChatId, groupChatTable.id),
    )
    .where(
      and(
        eq(groupChatTable.communityId, communityId),
        isNull(groupChatMessageTable.deletedAt),
        isNull(groupChatTable.deletedAt),
      ),
    )
    .groupBy(
      sql`EXTRACT(HOUR FROM ${groupChatMessageTable.createdAt})`,
      sql`EXTRACT(DOW FROM ${groupChatMessageTable.createdAt})`,
    );

  // Get totals
  const totalPostsResult = await db
    .select({ count: count(postTable.id) })
    .from(postTable)
    .where(
      and(
        eq(postTable.communityId, communityId),
        isNull(postTable.deletedAt),
        sql`${postTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    );

  const totalDmsResult = await db
    .select({ count: count(directMessageTable.id) })
    .from(directMessageTable)
    .where(
      and(
        eq(directMessageTable.communityId, communityId),
        isNull(directMessageTable.deletedAt),
        sql`${directMessageTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    );

  const totalGroupMessagesResult = await db
    .select({ count: count(groupChatMessageTable.id) })
    .from(groupChatMessageTable)
    .innerJoin(
      groupChatTable,
      eq(groupChatMessageTable.groupChatId, groupChatTable.id),
    )
    .where(
      and(
        eq(groupChatTable.communityId, communityId),
        isNull(groupChatMessageTable.deletedAt),
        isNull(groupChatTable.deletedAt),
        sql`${groupChatMessageTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    );

  // Get most active profiles (top 10)
  // Count posts by profile
  const profilePostCounts = await db
    .select({
      profileId: postTable.authorId,
      count: count(postTable.id),
    })
    .from(postTable)
    .where(
      and(
        eq(postTable.communityId, communityId),
        isNull(postTable.deletedAt),
        isNotNull(postTable.authorId),
        sql`${postTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    )
    .groupBy(postTable.authorId);

  // Count DMs sent by profile
  const profileDmCounts = await db
    .select({
      profileId: directMessageTable.senderId,
      count: count(directMessageTable.id),
    })
    .from(directMessageTable)
    .where(
      and(
        eq(directMessageTable.communityId, communityId),
        isNull(directMessageTable.deletedAt),
        isNotNull(directMessageTable.senderId),
        sql`${directMessageTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    )
    .groupBy(directMessageTable.senderId);

  // Count group messages by profile
  const profileGroupMessageCounts = await db
    .select({
      profileId: groupChatMessageTable.createdByUserId,
      count: count(groupChatMessageTable.id),
    })
    .from(groupChatMessageTable)
    .innerJoin(
      groupChatTable,
      eq(groupChatMessageTable.groupChatId, groupChatTable.id),
    )
    .where(
      and(
        eq(groupChatTable.communityId, communityId),
        isNull(groupChatMessageTable.deletedAt),
        isNull(groupChatTable.deletedAt),
        isNotNull(groupChatMessageTable.createdByUserId),
        sql`${groupChatMessageTable.createdAt} >= NOW() - INTERVAL '${sql.raw(days.toString())} days'`,
      ),
    )
    .groupBy(groupChatMessageTable.createdByUserId);

  // Aggregate counts by profile
  const profileActivityMap = new Map<
    string,
    { posts: number; dms: number; groupMessages: number }
  >();

  for (const { profileId, count: postCount } of profilePostCounts) {
    if (!profileActivityMap.has(profileId)) {
      profileActivityMap.set(profileId, { posts: 0, dms: 0, groupMessages: 0 });
    }
    const activity = profileActivityMap.get(profileId);
    if (activity) {
      activity.posts = Number(postCount);
    }
  }

  for (const { profileId, count: dmCount } of profileDmCounts) {
    if (!profileActivityMap.has(profileId)) {
      profileActivityMap.set(profileId, { posts: 0, dms: 0, groupMessages: 0 });
    }
    const activity = profileActivityMap.get(profileId);
    if (activity) {
      activity.dms = Number(dmCount);
    }
  }

  for (const { profileId, count: gmCount } of profileGroupMessageCounts) {
    if (!profileActivityMap.has(profileId)) {
      profileActivityMap.set(profileId, { posts: 0, dms: 0, groupMessages: 0 });
    }
    const activity = profileActivityMap.get(profileId);
    if (activity) {
      activity.groupMessages = Number(gmCount);
    }
  }

  // Sort by total activity
  const profileActivityList = Array.from(profileActivityMap.entries())
    .map(([profileId, activity]) => ({
      profileId,
      ...activity,
      total: activity.posts + activity.dms + activity.groupMessages,
    }))
    .sort((a, b) => b.total - a.total);

  // Get top 10 most active
  const mostActiveList = profileActivityList.slice(0, 10);

  // Get bottom 10 least active (but still with some activity)
  const leastActiveList = profileActivityList
    .filter((p) => p.total > 0)
    .slice(-10)
    .reverse(); // Reverse to show lowest first

  // Fetch profile details and pictures for both most and least active
  let profiles: Array<{ id: string; name: string; username: string }> = [];
  let profilePictureMap = new Map<string, string | null>();

  try {
    if (mostActiveList.length > 0 || leastActiveList.length > 0) {
      const allProfileIds = [
        ...mostActiveList.map((p) => p.profileId),
        ...leastActiveList.map((p) => p.profileId),
      ];
      const uniqueProfileIds = [...new Set(allProfileIds)].filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      );

      if (uniqueProfileIds.length > 0) {
        const profilesPromise = db
          .select({
            id: profileTable.id,
            name: profileTable.name,
            username: profileTable.username,
          })
          .from(profileTable)
          .where(
            and(
              inArray(profileTable.id, uniqueProfileIds),
              isNull(profileTable.deletedAt),
            ),
          );

        const picturesPromise = batchLoadProfilePictures(uniqueProfileIds);

        [profiles, profilePictureMap] = await Promise.all([
          profilesPromise,
          picturesPromise,
        ]);
      }
    }
  } catch (error) {
    logger.service.error("Error loading profile data for analytics", { error });
    // Continue with empty profiles - don't fail the entire request
    profiles = [];
    profilePictureMap = new Map();
  }

  // Build final most active profiles list with activity counts
  const mostActiveProfilesWithActivity = mostActiveList
    .map((activity) => {
      const profile = profiles.find((p) => p.id === activity.profileId);
      if (!profile) return null;

      return {
        profile_id: profile.id,
        profile_name: profile.name,
        profile_username: profile.username,
        avatar_url: profilePictureMap.get(profile.id) || null,
        posts_count: activity.posts,
        dms_count: activity.dms,
        group_messages_count: activity.groupMessages,
        total_activity: activity.total,
      };
    })
    .filter((p) => p !== null);

  // Build final least active profiles list with activity counts
  const leastActiveProfilesWithActivity = leastActiveList
    .map((activity) => {
      const profile = profiles.find((p) => p.id === activity.profileId);
      if (!profile) return null;

      return {
        profile_id: profile.id,
        profile_name: profile.name,
        profile_username: profile.username,
        avatar_url: profilePictureMap.get(profile.id) || null,
        posts_count: activity.posts,
        dms_count: activity.dms,
        group_messages_count: activity.groupMessages,
        total_activity: activity.total,
      };
    })
    .filter((p) => p !== null);

  return {
    timeline: {
      posts: postsTimeline.map((row) => ({
        date: row.date,
        count: Number(row.count),
      })),
      directMessages: dmsTimeline.map((row) => ({
        date: row.date,
        count: Number(row.count),
      })),
      groupMessages: groupMessagesTimeline.map((row) => ({
        date: row.date,
        count: Number(row.count),
      })),
    },
    hourlyTimeline: {
      posts: postsHourlyTimeline.map((row) => ({
        datetime: row.datetime,
        count: Number(row.count),
      })),
      directMessages: dmsHourlyTimeline.map((row) => ({
        datetime: row.datetime,
        count: Number(row.count),
      })),
      groupMessages: groupMessagesHourlyTimeline.map((row) => ({
        datetime: row.datetime,
        count: Number(row.count),
      })),
    },
    heatmap: {
      posts: postsHeatmap.map((row) => ({
        hour: Number(row.hour),
        dayOfWeek: Number(row.dayOfWeek),
        count: Number(row.count),
      })),
      directMessages: dmsHeatmap.map((row) => ({
        hour: Number(row.hour),
        dayOfWeek: Number(row.dayOfWeek),
        count: Number(row.count),
      })),
      groupMessages: groupMessagesHeatmap.map((row) => ({
        hour: Number(row.hour),
        dayOfWeek: Number(row.dayOfWeek),
        count: Number(row.count),
      })),
    },
    totals: {
      posts: Number(totalPostsResult[0]?.count ?? 0),
      directMessages: Number(totalDmsResult[0]?.count ?? 0),
      groupMessages: Number(totalGroupMessagesResult[0]?.count ?? 0),
    },
    mostActiveProfiles: mostActiveProfilesWithActivity,
    leastActiveProfiles: leastActiveProfilesWithActivity,
  };
}

/**
 * Get community detail with user membership and application status
 */
export async function getCommunityDetailWithUserContext(
  communityId: string,
  userId?: string,
) {
  // Find the community with hashtags
  const community = await db.query.community.findFirst({
    where: and(
      eq(communityTable.id, communityId),
      isNull(communityTable.deletedAt),
    ),
    with: {
      communityHashtags: {
        with: {
          hashtag: true,
        },
      },
    },
  });

  if (!community) {
    throw new AppException(404, GENERAL_ERROR_CODE, "커뮤를 찾을 수 없습니다");
  }

  // Get banner info
  const bannerInfo = await imageService.getCommunityBannerInfo(community.id);

  // Get hashtags
  const hashtags = community.communityHashtags.map((ch) => ({
    id: ch.hashtag.id,
    tag: ch.hashtag.tag,
  }));

  let membershipStatus = null;
  let applicationStatus = null;
  let userRole = null;

  if (userId) {
    // Check if user is already a member
    const membership = await db.query.membership.findFirst({
      where: and(
        eq(membershipTable.userId, userId),
        eq(membershipTable.communityId, communityId),
        isNotNull(membershipTable.activatedAt),
      ),
    });

    if (membership) {
      membershipStatus = "member";
      userRole = membership.role;
    } else {
      // Check for existing application
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

      if (application) {
        applicationStatus = {
          status: application.status,
          application_id: application.id,
          created_at: application.createdAt,
          message: application.message,
          rejection_reason: application.rejectionReason,
          attachments: application.attachments.map((attachment) => ({
            id: attachment.id,
            image_id: attachment.imageId,
            image_url: addImageUrl(attachment.image),
            created_at: attachment.createdAt,
          })),
        };
      }
    }
  }

  // Get owner profile ID
  const ownerMembership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.communityId, communityId),
      eq(membershipTable.role, "owner"),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  let ownerProfileId = null;
  if (ownerMembership?.userId) {
    ownerProfileId = await getPrimaryProfileIdForUserInCommunity(
      ownerMembership.userId,
      communityId,
    );
  }

  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    starts_at: community.startsAt,
    ends_at: community.endsAt,
    is_recruiting: community.isRecruiting,
    recruiting_starts_at: community.recruitingStartsAt,
    recruiting_ends_at: community.recruitingEndsAt,
    minimum_birth_year: community.minimumBirthYear,
    custom_domain: community.customDomain,
    domain_verified: community.domainVerifiedAt,
    created_at: community.createdAt,
    hashtags,
    banner_image_url: bannerInfo?.url || null,
    banner_image_width: bannerInfo?.width || null,
    banner_image_height: bannerInfo?.height || null,
    membership_status: membershipStatus,
    application_status: applicationStatus,
    user_role: userRole,
    description: community.description,
    owner_profile_id: ownerProfileId,
    mute_new_members: community.muteNewMembers,
    show_all_replies: community.showAllReplies,
    bump_on_reply: community.bumpOnReply,
  };
}
