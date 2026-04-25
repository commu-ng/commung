import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db";
import { botCommand, installedApp } from "../../drizzle/schema";
import { appAuthMiddleware } from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import { membershipMiddleware } from "../../middleware/membership";
import type { AuthVariables } from "../../types";

export const commandsRouter = new Hono<{ Variables: AuthVariables }>().get(
  "/commands",
  communityMiddleware,
  appAuthMiddleware,
  membershipMiddleware,
  async (c) => {
    const community = c.get("community");
    const rows = await db
      .select({
        id: botCommand.id,
        name: botCommand.name,
        description: botCommand.description,
        handlerBuiltinId: botCommand.handlerBuiltinId,
        installedAppId: botCommand.installedAppId,
        builtinId: installedApp.builtinId,
      })
      .from(botCommand)
      .innerJoin(installedApp, eq(botCommand.installedAppId, installedApp.id))
      .where(
        and(
          eq(botCommand.communityId, community.id),
          eq(botCommand.enabled, true),
          isNull(botCommand.deletedAt),
          isNull(installedApp.deletedAt),
        ),
      )
      .orderBy(botCommand.name);
    return c.json({ data: rows });
  },
);
