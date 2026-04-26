import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import * as notificationService from "../../services/notification.service";
import type { AuthVariables } from "../../types";

export const consoleNotificationsRouter = new Hono<{
  Variables: AuthVariables;
}>().get("/notifications/recent", authMiddleware, async (c) => {
  const user = c.get("user");
  const result = await notificationService.getRecentNotificationsForUser(
    user.id,
    10,
  );
  return c.json(result);
});
