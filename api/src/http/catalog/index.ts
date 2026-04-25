import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  BUILTIN_APPS,
  type BuiltinApp,
  type BuiltinAppCommand,
} from "../../services/builtin-commands";
import { GeneralErrorCode } from "../../types/api-responses";

const builtinIdParamSchema = z.object({
  builtinId: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_.-]*$/),
});

function commandView(cmd: BuiltinAppCommand) {
  return {
    name: cmd.defaultName,
    default_name: cmd.defaultName,
    description: cmd.description,
    long_description: cmd.longDescription ?? null,
    required_role: cmd.requiredRole ?? null,
    examples: (cmd.examples ?? []).map((ex) => ({
      input: ex.input,
      output: ex.output,
      note: ex.note ?? null,
    })),
  };
}

function appView(app: BuiltinApp) {
  return {
    builtin_id: app.id,
    version: app.version,
    profile: app.defaultProfile,
    description: app.description,
    long_description: app.longDescription ?? null,
    commands: app.commands.map(commandView),
  };
}

export const catalogRouter = new Hono()
  .get("/apps", (c) => {
    const data = Object.values(BUILTIN_APPS).map(appView);
    return c.json({ data });
  })
  .get("/apps/:builtinId", zValidator("param", builtinIdParamSchema), (c) => {
    const { builtinId } = c.req.valid("param");
    const app = BUILTIN_APPS[builtinId];
    if (!app) {
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
    return c.json({ data: appView(app) });
  });
