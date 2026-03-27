import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db";
import {
  community as communityTable,
  membership as membershipTable,
  post as postTable,
  user as userTable,
} from "../../drizzle/schema";
import { authMiddleware } from "../../middleware/auth";
import { AppException } from "../../exception";
import { GENERAL_ERROR_CODE } from "../../types/api-responses";
import type { AuthVariables } from "../../types";

const adminCommunitiesQuerySchema = z.object({
  sort: z
    .enum(["activity", "members", "created"])
    .optional()
    .default("activity"),
  days: z.coerce.number().min(1).max(365).optional().default(30),
});

export const consoleAdminCommunitiesRouter = new Hono<{
  Variables: AuthVariables;
}>().get(
  "/admin/communities",
  authMiddleware,
  zValidator("query", adminCommunitiesQuerySchema),
  async (c) => {
    const user = c.get("user");
    if (!user.isAdmin) {
      throw new AppException(
        403,
        GENERAL_ERROR_CODE,
        "관리자만 접근할 수 있습니다",
      );
    }

    const { sort, days } = c.req.valid("query");
    const since = sql`NOW() - INTERVAL '1 day' * ${days}`;

    const ownerSubquery = db
      .select({
        communityId: membershipTable.communityId,
        userId: userTable.id,
        loginName: userTable.loginName,
      })
      .from(membershipTable)
      .innerJoin(userTable, eq(userTable.id, membershipTable.userId))
      .where(
        and(
          eq(membershipTable.role, "owner"),
          sql`${membershipTable.activatedAt} IS NOT NULL`,
        ),
      )
      .as("owner");

    const memberCountExpr = count(
      sql`DISTINCT CASE WHEN ${membershipTable.activatedAt} IS NOT NULL THEN ${membershipTable.id} END`,
    );
    const postCountExpr = count(
      sql`DISTINCT CASE WHEN ${postTable.id} IS NOT NULL AND ${postTable.createdAt} > ${since} THEN ${postTable.id} END`,
    );

    const communities = await db
      .select({
        id: communityTable.id,
        name: communityTable.name,
        slug: communityTable.slug,
        createdAt: communityTable.createdAt,
        startsAt: communityTable.startsAt,
        endsAt: communityTable.endsAt,
        isRecruiting: communityTable.isRecruiting,
        memberCount: memberCountExpr,
        postCount: postCountExpr,
        ownerUserId: ownerSubquery.userId,
        ownerLoginName: ownerSubquery.loginName,
      })
      .from(communityTable)
      .leftJoin(
        membershipTable,
        eq(membershipTable.communityId, communityTable.id),
      )
      .leftJoin(
        postTable,
        and(
          eq(postTable.communityId, communityTable.id),
          isNull(postTable.deletedAt),
        ),
      )
      .leftJoin(ownerSubquery, eq(ownerSubquery.communityId, communityTable.id))
      .where(isNull(communityTable.deletedAt))
      .groupBy(communityTable.id, ownerSubquery.userId, ownerSubquery.loginName)
      .orderBy(
        sort === "members"
          ? desc(memberCountExpr)
          : sort === "created"
            ? desc(communityTable.createdAt)
            : desc(postCountExpr),
      );

    return c.json({
      data: {
        communities: communities.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          created_at: c.createdAt,
          starts_at: c.startsAt,
          ends_at: c.endsAt,
          is_recruiting: c.isRecruiting,
          member_count: c.memberCount,
          post_count: c.postCount,
          owner_user_id: c.ownerUserId,
          owner_login_name: c.ownerLoginName,
        })),
        days,
      },
    });
  },
);
