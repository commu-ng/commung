import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { appAuthMiddleware } from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import { membershipMiddleware } from "../../middleware/membership";
import * as installedAppService from "../../services/installed-app.service";
import type { AuthVariables } from "../../types";
import { GeneralErrorCode } from "../../types/api-responses";

const builtinIdParamSchema = z.object({
  builtinId: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_.-]*$/),
});

export const appsRouter = new Hono<{ Variables: AuthVariables }>()
  .get(
    "/apps",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    async (c) => {
      const community = c.get("community");
      const data = await installedAppService.listInstalledAppsWithDocs(
        community.id,
      );
      return c.json({ data });
    },
  )
  .get(
    "/apps/:builtinId",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("param", builtinIdParamSchema),
    async (c) => {
      const community = c.get("community");
      const { builtinId } = c.req.valid("param");
      const all = await installedAppService.listInstalledAppsWithDocs(
        community.id,
      );
      const found = all.find((a) => a.builtin_id === builtinId);
      if (!found) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.NOT_FOUND,
              message: "앱을 찾을 수 없습니다",
            },
          },
          404,
        );
      }
      return c.json({ data: found });
    },
  );
