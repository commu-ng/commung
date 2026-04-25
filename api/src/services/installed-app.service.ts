import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { botCommand, installedApp, profile } from "../drizzle/schema";
import { AppException } from "../exception";
import { GeneralErrorCode } from "../types/api-responses";
import {
  BUILTIN_APPS,
  type BuiltinApp,
  getBuiltinApp,
} from "./builtin-commands";
import * as profileService from "./profile.service";

export type InstalledAppRow = typeof installedApp.$inferSelect;
export type BotCommandRow = typeof botCommand.$inferSelect;

export type CommandOverride = { name?: string; enabled?: boolean };

export type InstallParams = {
  profileName: string;
  profileUsername: string;
  installedById: string;
  commandOverrides?: Record<string, CommandOverride>;
};

const SLASH_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,30}$/;

export function listCatalog(): BuiltinApp[] {
  return Object.values(BUILTIN_APPS);
}

export async function listInstalled(communityId: string) {
  return db
    .select({
      id: installedApp.id,
      communityId: installedApp.communityId,
      profileId: installedApp.profileId,
      builtinId: installedApp.builtinId,
      version: installedApp.version,
      config: installedApp.config,
      installedById: installedApp.installedById,
      createdAt: installedApp.createdAt,
      updatedAt: installedApp.updatedAt,
      profileName: profile.name,
      profileUsername: profile.username,
    })
    .from(installedApp)
    .innerJoin(profile, eq(installedApp.profileId, profile.id))
    .where(
      and(
        eq(installedApp.communityId, communityId),
        isNull(installedApp.deletedAt),
      ),
    )
    .orderBy(installedApp.createdAt);
}

export async function getInstalled(communityId: string, installId: string) {
  const [row] = await db
    .select({
      id: installedApp.id,
      communityId: installedApp.communityId,
      profileId: installedApp.profileId,
      builtinId: installedApp.builtinId,
      version: installedApp.version,
      config: installedApp.config,
      installedById: installedApp.installedById,
      createdAt: installedApp.createdAt,
      updatedAt: installedApp.updatedAt,
      profileName: profile.name,
      profileUsername: profile.username,
    })
    .from(installedApp)
    .innerJoin(profile, eq(installedApp.profileId, profile.id))
    .where(
      and(
        eq(installedApp.id, installId),
        eq(installedApp.communityId, communityId),
        isNull(installedApp.deletedAt),
      ),
    );
  return row;
}

export async function validateInstalledExists(
  communityId: string,
  installId: string,
) {
  const row = await getInstalled(communityId, installId);
  if (!row) {
    throw new AppException(
      404,
      GeneralErrorCode.NOT_FOUND,
      "설치된 앱을 찾을 수 없습니다",
    );
  }
  return row;
}

function resolveCommandPlan(
  app: BuiltinApp,
  overrides: Record<string, CommandOverride> | undefined,
) {
  const seen = new Set<string>();
  return app.commands.map((cmd) => {
    const override = overrides?.[cmd.defaultName];
    const name = (override?.name ?? cmd.defaultName).toLowerCase();
    const enabled = override?.enabled ?? true;
    if (!SLASH_NAME_PATTERN.test(name)) {
      throw new AppException(
        400,
        GeneralErrorCode.INVALID_REQUEST,
        `잘못된 명령어 이름입니다: /${name}`,
      );
    }
    if (seen.has(name)) {
      throw new AppException(
        400,
        GeneralErrorCode.DUPLICATE_ENTRY,
        `이 앱 내에서 명령어 이름이 중복됩니다: /${name}`,
      );
    }
    seen.add(name);
    return {
      defaultName: cmd.defaultName,
      name,
      description: cmd.description,
      handlerBuiltinId: cmd.handlerBuiltinId,
      enabled,
    };
  });
}

async function assertNamesAvailable(
  communityId: string,
  names: string[],
  exceptInstallId?: string,
) {
  if (names.length === 0) return;
  const existing = await db
    .select({
      name: botCommand.name,
      installedAppId: botCommand.installedAppId,
    })
    .from(botCommand)
    .where(
      and(
        eq(botCommand.communityId, communityId),
        isNull(botCommand.deletedAt),
        inArray(
          sql`LOWER(${botCommand.name})`,
          names.map((n) => n.toLowerCase()),
        ),
      ),
    );
  const conflict = existing.find(
    (row) => row.installedAppId !== exceptInstallId,
  );
  if (conflict) {
    throw new AppException(
      409,
      GeneralErrorCode.DUPLICATE_ENTRY,
      `이미 사용 중인 명령어입니다: /${conflict.name}`,
    );
  }
}

export async function installApp(
  communityId: string,
  builtinId: string,
  params: InstallParams,
) {
  const app = getBuiltinApp(builtinId);
  if (!app) {
    throw new AppException(
      404,
      GeneralErrorCode.NOT_FOUND,
      "카탈로그에서 앱을 찾을 수 없습니다",
    );
  }

  const existingInstall = await db
    .select({ id: installedApp.id })
    .from(installedApp)
    .where(
      and(
        eq(installedApp.communityId, communityId),
        eq(installedApp.builtinId, builtinId),
        isNull(installedApp.deletedAt),
      ),
    );
  if (existingInstall.length > 0) {
    throw new AppException(
      409,
      GeneralErrorCode.DUPLICATE_ENTRY,
      "이 앱은 이미 설치되어 있습니다",
    );
  }

  const plan = resolveCommandPlan(app, params.commandOverrides);
  await assertNamesAvailable(
    communityId,
    plan.map((p) => p.name),
  );

  const botProfile = await profileService.createBotProfile(
    communityId,
    params.profileName,
    params.profileUsername,
    params.installedById,
  );

  const result = await db.transaction(async (tx) => {
    const [installRow] = await tx
      .insert(installedApp)
      .values({
        communityId,
        profileId: botProfile.id,
        builtinId: app.id,
        version: app.version,
        installedById: params.installedById,
      })
      .returning();
    if (!installRow) {
      throw new Error("Failed to create installed_app row");
    }

    const commandRows =
      plan.length === 0
        ? []
        : await tx
            .insert(botCommand)
            .values(
              plan.map((p) => ({
                communityId,
                installedAppId: installRow.id,
                name: p.name,
                description: p.description,
                handlerBuiltinId: p.handlerBuiltinId,
                enabled: p.enabled,
              })),
            )
            .returning();

    return { install: installRow, commands: commandRows };
  });

  return { ...result, profile: botProfile };
}

export async function uninstallApp(communityId: string, installId: string) {
  const install = await validateInstalledExists(communityId, installId);
  await db.transaction(async (tx) => {
    await tx
      .update(installedApp)
      .set({ deletedAt: sql`now()` })
      .where(
        and(
          eq(installedApp.id, installId),
          eq(installedApp.communityId, communityId),
          isNull(installedApp.deletedAt),
        ),
      );
    await tx
      .update(botCommand)
      .set({ deletedAt: sql`now()` })
      .where(
        and(
          eq(botCommand.installedAppId, installId),
          isNull(botCommand.deletedAt),
        ),
      );
    await tx
      .update(profile)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(profile.id, install.profileId), isNull(profile.deletedAt)));
  });
}

function validateConfigForApp(
  app: BuiltinApp,
  config: unknown,
): Record<string, unknown> {
  const result = app.configSchema.safeParse(config);
  if (!result.success) {
    throw new AppException(
      400,
      GeneralErrorCode.INVALID_REQUEST,
      `잘못된 설정입니다: ${result.error.issues.map((i) => i.message).join(", ")}`,
    );
  }
  return (result.data ?? {}) as Record<string, unknown>;
}

export async function configureApp(
  communityId: string,
  installId: string,
  config: unknown,
) {
  const install = await validateInstalledExists(communityId, installId);
  const app = getBuiltinApp(install.builtinId);
  if (!app) {
    throw new AppException(
      404,
      GeneralErrorCode.NOT_FOUND,
      "카탈로그에서 앱을 찾을 수 없습니다",
    );
  }
  const validated = validateConfigForApp(app, config);
  const [updated] = await db
    .update(installedApp)
    .set({ config: validated, updatedAt: sql`now()` })
    .where(
      and(
        eq(installedApp.id, installId),
        eq(installedApp.communityId, communityId),
        isNull(installedApp.deletedAt),
      ),
    )
    .returning();
  return updated;
}

export async function upgradeApp(communityId: string, installId: string) {
  const install = await validateInstalledExists(communityId, installId);
  const app = getBuiltinApp(install.builtinId);
  if (!app) {
    throw new AppException(
      404,
      GeneralErrorCode.NOT_FOUND,
      "카탈로그에서 앱을 찾을 수 없습니다",
    );
  }

  if (install.version === app.version) {
    return { install, addedCommands: [] as BotCommandRow[] };
  }

  const existing = await db
    .select({
      handlerBuiltinId: botCommand.handlerBuiltinId,
    })
    .from(botCommand)
    .where(
      and(
        eq(botCommand.installedAppId, installId),
        isNull(botCommand.deletedAt),
      ),
    );
  const existingHandlers = new Set(existing.map((r) => r.handlerBuiltinId));
  const newCommands = app.commands.filter(
    (c) => !existingHandlers.has(c.handlerBuiltinId),
  );

  await assertNamesAvailable(
    communityId,
    newCommands.map((c) => c.defaultName),
    installId,
  );

  const result = await db.transaction(async (tx) => {
    const [updatedInstall] = await tx
      .update(installedApp)
      .set({ version: app.version, updatedAt: sql`now()` })
      .where(
        and(
          eq(installedApp.id, installId),
          eq(installedApp.communityId, communityId),
          isNull(installedApp.deletedAt),
        ),
      )
      .returning();

    const addedCommands =
      newCommands.length === 0
        ? []
        : await tx
            .insert(botCommand)
            .values(
              newCommands.map((c) => ({
                communityId,
                installedAppId: installId,
                name: c.defaultName,
                description: c.description,
                handlerBuiltinId: c.handlerBuiltinId,
                enabled: true,
              })),
            )
            .returning();

    return { install: updatedInstall, addedCommands };
  });

  return result;
}
