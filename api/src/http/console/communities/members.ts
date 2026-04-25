import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { authMiddleware } from "../../../middleware/auth";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import {
  communityIdParamSchema,
  communityMemberParamSchema,
  memberListQuerySchema,
  memberRoleUpdateSchema,
} from "./schemas";

export const membersRouter = new Hono()
  .delete(
    "/:id/members/:membership_id",
    authMiddleware,
    zValidator("param", communityMemberParamSchema),
    async (c) => {
      const { id: slug, membership_id: membershipId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      await membershipService.removeMember(community.id, membershipId, user.id);
      return c.body(null, 204);
    },
  )
  .delete(
    "/:id/leave",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      await membershipService.leaveCommunity(user.id, community.id);
      return c.body(null, 204);
    },
  )
  .get(
    "/:id/members/stats",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);
      const stats = await membershipService.getMemberRoleCounts(community.id);
      return c.json({ data: stats });
    },
  )
  .get(
    "/:id/members",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("query", memberListQuerySchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const { limit = 50, offset = 0, q, role } = c.req.valid("query");

      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      const result = await membershipService.getCommunityMembers(
        community.id,
        user.id,
        { limit, offset, q, role },
      );

      return c.json({ data: result });
    },
  )
  .put(
    "/:id/members/role",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", memberRoleUpdateSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const { membership_id: membershipId, role: newRole } =
        c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      const result = await membershipService.updateMemberRole(
        community.id,
        membershipId,
        newRole,
        user.id,
      );

      // Check if ownership was transferred
      if (
        typeof result === "object" &&
        "transferred" in result &&
        result.transferred
      ) {
        return c.json({
          data: {
            membership_id: membershipId,
            role: newRole,
            ownership_transferred: true,
            updated_at: new Date().toISOString(),
          },
        });
      }

      return c.json({
        data: {
          membership_id: membershipId,
          role: newRole,
          updated_at: new Date().toISOString(),
        },
      });
    },
  );
