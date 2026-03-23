import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../../middleware/auth";
import {
  communityCreateRequestSchema,
  communityUpdateRequestSchema,
} from "../../../schemas";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import { communityIdParamSchema } from "./schemas";

export const crudRouter = new Hono()
  .post(
    "/",
    authMiddleware,
    zValidator("json", communityCreateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const {
        name,
        slug,
        starts_at: startsAt,
        ends_at: endsAt,
        is_recruiting: isRecruiting,
        recruiting_starts_at: recruitingStartsAt,
        recruiting_ends_at: recruitingEndsAt,
        minimum_birth_year,
        image_id,
        hashtags,
        profile_username,
        profile_name,
        description,
        mute_new_members,
        show_all_replies,
      } = c.req.valid("json");

      const result = await communityService.createCommunity(user.id, {
        name,
        slug,
        startsAt,
        endsAt,
        recruiting: isRecruiting,
        recruitingStartsAt,
        recruitingEndsAt,
        minimumBirthYear: minimum_birth_year,
        imageId: image_id,
        hashtags,
        profileUsername: profile_username,
        profileName: profile_name,
        description,
        muteNewMembers: mute_new_members,
        showAllReplies: show_all_replies,
      });

      return c.json(
        {
          data: {
            id: result.community.id,
            name: result.community.name,
            slug: result.community.slug,
            starts_at: result.community.startsAt,
            ends_at: result.community.endsAt,
            is_recruiting: result.community.isRecruiting,
            owner_profile_id: result.profile.id,
            created_at: result.community.createdAt,
          },
        },
        201,
      );
    },
  )
  .get("/mine", authMiddleware, async (c) => {
    const user = c.get("user");
    const result = await communityService.getUserCommunities(user.id);
    return c.json({ data: result });
  })
  .get("/recruiting", optionalAuthMiddleware, async (c) => {
    const user = c.get("user");
    const result =
      await communityService.getRecruitingCommunitiesWithUserContext(user?.id);
    return c.json({ data: result });
  })
  .get("/ongoing", optionalAuthMiddleware, async (c) => {
    const user = c.get("user");
    const result = await communityService.getOngoingCommunitiesWithUserContext(
      user?.id,
    );
    return c.json({ data: result });
  })
  .get(
    "/:id",
    optionalAuthMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      const result = await communityService.getCommunityDetailWithUserContext(
        community.id,
        user?.id,
      );
      return c.json({ data: result });
    },
  )
  .put(
    "/:id",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", communityUpdateRequestSchema),
    async (c) => {
      const { id: communityId } = c.req.valid("param");
      const user = c.get("user");
      const {
        name,
        slug,
        starts_at: startsAt,
        ends_at: endsAt,
        is_recruiting: isRecruiting,
        recruiting_starts_at: recruitingStartsAt,
        recruiting_ends_at: recruitingEndsAt,
        minimum_birth_year,
        image_id,
        hashtags,
        description,
        description_image_ids,
        mute_new_members,
        show_all_replies,
      } = c.req.valid("json");

      // Validate community exists by ID
      await communityService.validateCommunityExistsById(communityId);

      await membershipService.validateMembershipRole(user.id, communityId, [
        "owner",
      ]);

      const { community: updatedCommunity, ownerProfileId } =
        await communityService.updateCommunity(communityId, {
          name,
          slug,
          startsAt,
          endsAt,
          recruiting: isRecruiting,
          recruitingStartsAt,
          recruitingEndsAt,
          minimumBirthYear: minimum_birth_year,
          imageId: image_id,
          hashtags,
          description,
          descriptionImageIds: description_image_ids,
          muteNewMembers: mute_new_members,
          showAllReplies: show_all_replies,
        });

      return c.json({
        data: {
          id: updatedCommunity.id,
          name: updatedCommunity.name,
          slug: updatedCommunity.slug,
          starts_at: updatedCommunity.startsAt,
          ends_at: updatedCommunity.endsAt,
          is_recruiting: updatedCommunity.isRecruiting,
          recruiting_starts_at: updatedCommunity.recruitingStartsAt,
          recruiting_ends_at: updatedCommunity.recruitingEndsAt,
          minimum_birth_year: updatedCommunity.minimumBirthYear,
          owner_profile_id: ownerProfileId,
          created_at: updatedCommunity.createdAt,
          updated_at: updatedCommunity.updatedAt,
        },
      });
    },
  )
  .delete(
    "/:id",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: communityId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists by ID
      await communityService.validateCommunityExistsById(communityId);

      await membershipService.validateMembershipRole(user.id, communityId, [
        "owner",
      ]);

      await communityService.deleteCommunity(communityId);
      return c.body(null, 204);
    },
  );
