import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth";
import * as botCommandService from "../../../services/bot-command.service";
import * as communityService from "../../../services/community.service";
import * as installedAppService from "../../../services/installed-app.service";
import * as membershipService from "../../../services/membership.service";
import { GeneralErrorCode } from "../../../types/api-responses";

const communityIdParamSchema = z.object({
  id: z.string().min(1),
});

const installIdParamSchema = z.object({
  id: z.string().min(1),
  installId: z.uuid(),
});

const commandIdParamSchema = z.object({
  id: z.string().min(1),
  installId: z.uuid(),
  commandId: z.uuid(),
});

const slashName = z
  .string()
  .min(1)
  .max(31)
  .regex(/^[a-z][a-z0-9_-]{0,30}$/);

const installCreateSchema = z.object({
  builtin_id: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_.-]*$/),
  profile_name: z.string().min(1).max(100),
  profile_username: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/),
  command_overrides: z
    .record(
      z.string(),
      z.object({
        name: slashName.optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .optional(),
});

const configureSchema = z.object({
  config: z.record(z.string(), z.unknown()),
});

const commandUpdateSchema = z
  .object({
    name: slashName.optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.enabled !== undefined, {
    message: "name 또는 enabled 중 하나는 필요합니다",
  });

export const installedAppsRouter = new Hono()
  .get(
    "/:id/apps/catalog",
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
        "member",
      ]);

      const data = installedAppService.listCatalog().map((app) => ({
        id: app.id,
        version: app.version,
        description: app.description,
        default_profile: app.defaultProfile,
        commands: app.commands.map((cmd) => ({
          default_name: cmd.defaultName,
          description: cmd.description,
          handler_builtin_id: cmd.handlerBuiltinId,
        })),
      }));
      return c.json({ data });
    },
  )

  .get(
    "/:id/apps",
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
      const installs = await installedAppService.listInstalled(community.id);
      return c.json({ data: installs });
    },
  )

  .post(
    "/:id/apps",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", installCreateSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const body = c.req.valid("json");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      const result = await installedAppService.installApp(
        community.id,
        body.builtin_id,
        {
          profileName: body.profile_name,
          profileUsername: body.profile_username,
          installedById: user.id,
          commandOverrides: body.command_overrides,
        },
      );
      return c.json({ data: result }, 201);
    },
  )

  .get(
    "/:id/apps/:installId",
    authMiddleware,
    zValidator("param", installIdParamSchema),
    async (c) => {
      const { id: slug, installId } = c.req.valid("param");
      const user = c.get("user");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);

      const install = await installedAppService.getInstalled(
        community.id,
        installId,
      );
      if (!install) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.NOT_FOUND,
              message: "설치된 앱을 찾을 수 없습니다",
            },
          },
          404,
        );
      }
      const commands = await botCommandService.listForInstall(
        installId,
        community.id,
      );
      return c.json({ data: { ...install, commands } });
    },
  )

  .patch(
    "/:id/apps/:installId",
    authMiddleware,
    zValidator("param", installIdParamSchema),
    zValidator("json", configureSchema),
    async (c) => {
      const { id: slug, installId } = c.req.valid("param");
      const user = c.get("user");
      const { config } = c.req.valid("json");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);
      const updated = await installedAppService.configureApp(
        community.id,
        installId,
        config,
      );
      return c.json({ data: updated });
    },
  )

  .delete(
    "/:id/apps/:installId",
    authMiddleware,
    zValidator("param", installIdParamSchema),
    async (c) => {
      const { id: slug, installId } = c.req.valid("param");
      const user = c.get("user");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);
      await installedAppService.uninstallApp(community.id, installId);
      return c.body(null, 204);
    },
  )

  .patch(
    "/:id/apps/:installId/commands/:commandId",
    authMiddleware,
    zValidator("param", commandIdParamSchema),
    zValidator("json", commandUpdateSchema),
    async (c) => {
      const { id: slug, installId, commandId } = c.req.valid("param");
      const user = c.get("user");
      const body = c.req.valid("json");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);
      await installedAppService.validateInstalledExists(
        community.id,
        installId,
      );

      let result = await botCommandService.validateCommandExists(
        commandId,
        community.id,
      );
      if (result.installedAppId !== installId) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.NOT_FOUND,
              message: "명령어를 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      if (body.name !== undefined) {
        const renamed = await botCommandService.rename(
          commandId,
          community.id,
          body.name,
        );
        if (renamed) result = renamed;
      }
      if (body.enabled !== undefined) {
        const toggled = await botCommandService.setEnabled(
          commandId,
          community.id,
          body.enabled,
        );
        if (toggled) result = toggled;
      }
      return c.json({ data: result });
    },
  );
