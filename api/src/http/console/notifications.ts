import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth";
import * as notificationService from "../../services/notification.service";
import type { AuthVariables } from "../../types";

const markReadParamSchema = z.object({
  source: z.enum(["profile", "user"]),
  notification_id: z.string().uuid(),
});

export const consoleNotificationsRouter = new Hono<{
  Variables: AuthVariables;
}>()
  .get("/notifications/recent", authMiddleware, async (c) => {
    const user = c.get("user");
    const result = await notificationService.getRecentNotificationsForUser(
      user.id,
      10,
    );
    return c.json(result);
  })
  .post(
    "/notifications/:source/:notification_id/read",
    authMiddleware,
    zValidator("param", markReadParamSchema),
    async (c) => {
      const user = c.get("user");
      const { source, notification_id: notificationId } = c.req.valid("param");
      await notificationService.markConsoleNotificationAsRead(
        user.id,
        source,
        notificationId,
      );
      return c.json({ data: { id: notificationId, source } });
    },
  );
