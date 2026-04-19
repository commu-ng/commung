import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  appAuthMiddleware,
  userScopedAppAuthMiddleware,
} from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import { membershipMiddleware } from "../../middleware/membership";
import {
  profileIdQuerySchema,
  profileUpdateRequestSchema,
  themeKeyColorUpdateRequestSchema,
} from "../../schemas";
import * as communityService from "../../services/community.service";
import * as membershipService from "../../services/membership.service";
import * as userService from "../../services/user.service";
import type { AuthVariables } from "../../types";
import { GeneralErrorCode } from "../../types/api-responses";
import { canManageProfile } from "../../utils/profile-ownership";

export const meRouter = new Hono<{ Variables: AuthVariables }>()
  .get("/instance", communityMiddleware, async (c) => {
    const community = c.get("community");
    const result = await userService.getPublicInstanceInfo(community.id);
    return c.json({ data: result });
  })
  .get("/me", communityMiddleware, appAuthMiddleware, async (c) => {
    const user = c.get("user");
    const result = await userService.getCurrentUser(user.id);
    return c.json({ data: result });
  })
  .get("/me/instance", communityMiddleware, appAuthMiddleware, async (c) => {
    const user = c.get("user");
    const community = c.get("community");
    const result = await userService.getCurrentUserInstance(
      user.id,
      community.id,
    );
    return c.json({ data: result });
  })
  .patch(
    "/me/instance/theme",
    communityMiddleware,
    appAuthMiddleware,
    zValidator("json", themeKeyColorUpdateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { theme_key_color } = c.req.valid("json");

      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      const updated = await communityService.updateCommunityThemeKeyColor(
        community.id,
        theme_key_color,
      );

      return c.json({
        data: { theme_key_color: updated.themeKeyColor },
      });
    },
  )

  .put(
    "/me/profiles",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("query", profileIdQuerySchema),
    zValidator("json", profileUpdateRequestSchema),
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const { profile_id: profileId } = c.req.valid("query");
      const { name, username, bio, profile_picture_id } = c.req.valid("json");

      // Verify the user has access to this profile via ownership
      const canManage = await canManageProfile(user.id, profileId);
      if (!canManage) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 접근할 수 없습니다",
            },
          },
          404,
        );
      }

      const result = await userService.updateUserProfile(
        profileId,
        community.id,
        name,
        username,
        bio,
        profile_picture_id,
      );
      return c.json({ data: result });
    },
  )
  .get(
    "/me/profiles",
    userScopedAppAuthMiddleware,
    communityMiddleware,
    async (c) => {
      const user = c.get("user");
      const community = c.get("community");
      const result = await userService.getUserProfiles(user.id, community.id);
      return c.json({ data: result });
    },
  );
