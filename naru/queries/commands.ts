// The slash commands members can use (commung's GET /app/commands), for the
// composer's suggestions.
import { requireMembership } from "../modules/access.js";
import { listEnabledCommands } from "../modules/apps.js";
import type { QueryCtx } from "../modules/core.js";

export async function list(ctx: QueryCtx) {
  await requireMembership(ctx);
  return (await listEnabledCommands(ctx)).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    handlerBuiltinId: row.handler_builtin_id,
    installedAppId: row.installed_app_id,
    builtinId: row.builtin_id,
  }));
}
