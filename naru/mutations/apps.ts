// Installing and managing apps (the console's community apps, owner only).
import { requireOwner } from "../modules/access.js";
import {
  BUILTIN_ID_PATTERN,
  botProfileFields,
  type CommandOverride,
  configureApp,
  installApp,
  SLASH_NAME_PATTERN,
  uninstallApp,
  updateCommand,
} from "../modules/apps.js";
import {
  argsOf,
  type Ctx,
  id,
  invalid,
  type MutationCtx,
} from "../modules/core.js";

function overridesOf(ctx: Ctx, value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value))
    invalid(ctx, "command_overrides 값이 올바르지 않습니다.");
  const out: Record<string, CommandOverride> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      invalid(ctx, "command_overrides 값이 올바르지 않습니다.");
    const { name, enabled } = raw as Record<string, unknown>;
    if (
      name !== undefined &&
      (typeof name !== "string" || !SLASH_NAME_PATTERN.test(name))
    )
      invalid(ctx, `잘못된 명령어 이름입니다: /${String(name)}`);
    if (enabled !== undefined && typeof enabled !== "boolean")
      invalid(ctx, "command_overrides 값이 올바르지 않습니다.");
    out[key] = {
      ...(name === undefined ? {} : { name: name as string }),
      ...(enabled === undefined ? {} : { enabled: enabled as boolean }),
    };
  }
  return out;
}

/** Installs a catalog app with its bot profile (POST /console/communities/:id/apps). */
export async function adminInstall(ctx: MutationCtx, args: unknown) {
  const membership = await requireOwner(ctx);
  const a = argsOf(args);
  const builtinId = a.builtin_id;
  if (
    typeof builtinId !== "string" ||
    builtinId.length > 50 ||
    !BUILTIN_ID_PATTERN.test(builtinId)
  )
    invalid(ctx, "builtin_id 값이 올바르지 않습니다.");
  const profile = botProfileFields(ctx, a);
  return await installApp(ctx, builtinId, {
    profileName: profile.name,
    profileUsername: profile.username,
    installedBy: membership.member,
    commandOverrides: overridesOf(ctx, a.command_overrides),
  });
}

/** Sets an install's config (PATCH /console/communities/:id/apps/:installId). */
export async function adminConfigure(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  return await configureApp(ctx, id(ctx, a.install_id, "install_id"), a.config);
}

/** Uninstalls an app, its commands and bot profile. */
export async function adminUninstall(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  await uninstallApp(ctx, id(ctx, argsOf(args).install_id, "install_id"));
  return null;
}

/** Renames or turns on or off one of an install's commands. */
export async function adminUpdateCommand(ctx: MutationCtx, args: unknown) {
  await requireOwner(ctx);
  const a = argsOf(args);
  const installId = id(ctx, a.install_id, "install_id");
  const commandId = id(ctx, a.command_id, "command_id");
  if (
    a.name !== undefined &&
    (typeof a.name !== "string" || !SLASH_NAME_PATTERN.test(a.name))
  )
    invalid(ctx, `잘못된 명령어 이름입니다: /${String(a.name)}`);
  if (a.enabled !== undefined && typeof a.enabled !== "boolean")
    invalid(ctx, "enabled 값이 올바르지 않습니다.");
  if (a.name === undefined && a.enabled === undefined)
    invalid(ctx, "name 또는 enabled 중 하나는 필요합니다");
  return await updateCommand(ctx, installId, commandId, {
    name: a.name as string | undefined,
    enabled: a.enabled as boolean | undefined,
  });
}
