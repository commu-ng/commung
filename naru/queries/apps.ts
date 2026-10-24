// Apps: the built-in catalog (commung's /catalog/apps), the community's
// installed apps as members read them (/app/apps) and as the owner and
// moderators manage them (the console's community apps).
import { requireMembership, requireStaff } from "../modules/access.js";
import {
  BUILTIN_APPS,
  BUILTIN_ID_PATTERN,
  type BuiltinApp,
  commandView,
  getBuiltinApp,
  installedAppsWithDocs,
  listCommandsForInstall,
  listInstalled,
  validateInstalledExists,
} from "../modules/apps.js";
import { argsOf, id, notFound, type QueryCtx } from "../modules/core.js";

function builtinIdOf(ctx: QueryCtx, value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 50 ||
    !BUILTIN_ID_PATTERN.test(value)
  )
    notFound(ctx, "앱을 찾을 수 없습니다");
  return value;
}

const appView = (app: BuiltinApp) => ({
  builtin_id: app.id,
  version: app.version,
  profile: app.defaultProfile,
  description: app.description,
  long_description: app.longDescription ?? null,
  commands: app.commands.map((cmd) => commandView(cmd)),
});

/** Installed apps with their documentation and commands (GET /app/apps). */
export async function list(ctx: QueryCtx) {
  await requireMembership(ctx);
  return await installedAppsWithDocs(ctx);
}

/** One installed app (GET /app/apps/:builtinId). */
export async function get(ctx: QueryCtx, args: unknown) {
  await requireMembership(ctx);
  const builtinId = builtinIdOf(ctx, argsOf(args).builtin_id);
  const found = (await installedAppsWithDocs(ctx)).find(
    (app) => app.builtin_id === builtinId,
  );
  return found ?? notFound(ctx, "앱을 찾을 수 없습니다");
}

/** The built-in catalog, for anyone (GET /catalog/apps). */
export async function catalog() {
  return Object.values(BUILTIN_APPS).map(appView);
}

/** One catalog app (GET /catalog/apps/:builtinId). */
export async function catalogApp(ctx: QueryCtx, args: unknown) {
  const app = getBuiltinApp(builtinIdOf(ctx, argsOf(args).builtin_id));
  return app ? appView(app) : notFound(ctx, "앱을 찾을 수 없습니다");
}

/** The catalog as the console's install form reads it. */
export async function adminCatalog(ctx: QueryCtx) {
  await requireMembership(ctx);
  return Object.values(BUILTIN_APPS).map((app) => ({
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
}

/** The installed apps, for management. */
export async function adminList(ctx: QueryCtx) {
  await requireStaff(ctx);
  return await listInstalled(ctx);
}

/** One install with its commands, for management. */
export async function adminGet(ctx: QueryCtx, args: unknown) {
  await requireStaff(ctx);
  const installId = id(ctx, argsOf(args).install_id, "install_id");
  const install = await validateInstalledExists(ctx, installId);
  return { ...install, commands: await listCommandsForInstall(ctx, installId) };
}
