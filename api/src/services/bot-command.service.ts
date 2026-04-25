import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { botCommand, installedApp, profile } from "../drizzle/schema";
import { AppException } from "../exception";
import { GeneralErrorCode } from "../types/api-responses";

export type BotCommandRow = typeof botCommand.$inferSelect;

const SLASH_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,30}$/;

export async function listForInstall(installId: string, communityId: string) {
  return db
    .select()
    .from(botCommand)
    .where(
      and(
        eq(botCommand.installedAppId, installId),
        eq(botCommand.communityId, communityId),
        isNull(botCommand.deletedAt),
      ),
    )
    .orderBy(botCommand.createdAt);
}

export async function findByNameInCommunity(communityId: string, name: string) {
  const [row] = await db
    .select({
      id: botCommand.id,
      name: botCommand.name,
      description: botCommand.description,
      handlerBuiltinId: botCommand.handlerBuiltinId,
      enabled: botCommand.enabled,
      installedAppId: botCommand.installedAppId,
      profileId: installedApp.profileId,
      installedById: installedApp.installedById,
      profileName: profile.name,
      profileUsername: profile.username,
    })
    .from(botCommand)
    .innerJoin(installedApp, eq(botCommand.installedAppId, installedApp.id))
    .innerJoin(profile, eq(installedApp.profileId, profile.id))
    .where(
      and(
        eq(botCommand.communityId, communityId),
        sql`LOWER(${botCommand.name}) = ${name.toLowerCase()}`,
        isNull(botCommand.deletedAt),
        isNull(installedApp.deletedAt),
      ),
    );
  return row;
}

async function getCommand(commandId: string, communityId: string) {
  const [row] = await db
    .select()
    .from(botCommand)
    .where(
      and(
        eq(botCommand.id, commandId),
        eq(botCommand.communityId, communityId),
        isNull(botCommand.deletedAt),
      ),
    );
  return row;
}

export async function validateCommandExists(
  commandId: string,
  communityId: string,
) {
  const row = await getCommand(commandId, communityId);
  if (!row) {
    throw new AppException(
      404,
      GeneralErrorCode.NOT_FOUND,
      "명령어를 찾을 수 없습니다",
    );
  }
  return row;
}

export async function setEnabled(
  commandId: string,
  communityId: string,
  enabled: boolean,
) {
  await validateCommandExists(commandId, communityId);
  const [updated] = await db
    .update(botCommand)
    .set({ enabled, updatedAt: sql`now()` })
    .where(
      and(
        eq(botCommand.id, commandId),
        eq(botCommand.communityId, communityId),
        isNull(botCommand.deletedAt),
      ),
    )
    .returning();
  return updated;
}

export async function rename(
  commandId: string,
  communityId: string,
  newName: string,
) {
  const normalized = newName.toLowerCase();
  if (!SLASH_NAME_PATTERN.test(normalized)) {
    throw new AppException(
      400,
      GeneralErrorCode.INVALID_REQUEST,
      `잘못된 명령어 이름입니다: /${newName}`,
    );
  }
  await validateCommandExists(commandId, communityId);

  const [conflict] = await db
    .select({ id: botCommand.id })
    .from(botCommand)
    .where(
      and(
        eq(botCommand.communityId, communityId),
        sql`LOWER(${botCommand.name}) = ${normalized}`,
        isNull(botCommand.deletedAt),
        ne(botCommand.id, commandId),
      ),
    );
  if (conflict) {
    throw new AppException(
      409,
      GeneralErrorCode.DUPLICATE_ENTRY,
      `이미 사용 중인 명령어입니다: /${normalized}`,
    );
  }

  const [updated] = await db
    .update(botCommand)
    .set({ name: normalized, updatedAt: sql`now()` })
    .where(
      and(
        eq(botCommand.id, commandId),
        eq(botCommand.communityId, communityId),
        isNull(botCommand.deletedAt),
      ),
    )
    .returning();
  return updated;
}
