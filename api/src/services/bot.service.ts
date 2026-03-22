import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { bot, botToken, community, profile } from "../drizzle/schema";
import { AppException } from "../exception";
import { GeneralErrorCode } from "../types/api-responses";

export async function createBot(
  communityId: string,
  name: string,
  description: string | null,
  profileId: string,
  createdById: string,
) {
  const [newBot] = await db
    .insert(bot)
    .values({
      communityId,
      name,
      description,
      profileId,
      createdById,
    })
    .returning();

  return newBot;
}

export async function getBotsByCommunity(communityId: string) {
  const bots = await db
    .select({
      id: bot.id,
      name: bot.name,
      description: bot.description,
      profileId: bot.profileId,
      profileName: profile.name,
      profileUsername: profile.username,
      createdById: bot.createdById,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
    })
    .from(bot)
    .innerJoin(profile, eq(bot.profileId, profile.id))
    .where(and(eq(bot.communityId, communityId), isNull(bot.deletedAt)));

  return bots;
}

export async function getBot(botId: string, communityId: string) {
  const [result] = await db
    .select({
      id: bot.id,
      name: bot.name,
      description: bot.description,
      communityId: bot.communityId,
      profileId: bot.profileId,
      profileName: profile.name,
      profileUsername: profile.username,
      createdById: bot.createdById,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
    })
    .from(bot)
    .innerJoin(profile, eq(bot.profileId, profile.id))
    .where(
      and(
        eq(bot.id, botId),
        eq(bot.communityId, communityId),
        isNull(bot.deletedAt),
      ),
    );

  return result;
}

export async function updateBot(
  botId: string,
  communityId: string,
  name: string,
  description: string | null,
) {
  const [updated] = await db
    .update(bot)
    .set({
      name,
      description,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(bot.id, botId),
        eq(bot.communityId, communityId),
        isNull(bot.deletedAt),
      ),
    )
    .returning();

  return updated;
}

export async function deleteBot(botId: string, communityId: string) {
  // Soft delete the bot
  await db
    .update(bot)
    .set({
      deletedAt: sql`now()`,
    })
    .where(
      and(
        eq(bot.id, botId),
        eq(bot.communityId, communityId),
        isNull(bot.deletedAt),
      ),
    );

  // Revoke all tokens for this bot
  await db
    .update(botToken)
    .set({
      revokedAt: sql`now()`,
    })
    .where(and(eq(botToken.botId, botId), isNull(botToken.revokedAt)));
}

export async function createBotToken(
  botId: string,
  name: string | null,
  expiresAt: string | null,
) {
  const [newToken] = await db
    .insert(botToken)
    .values({
      botId,
      name,
      expiresAt,
    })
    .returning();

  return newToken;
}

export async function getBotTokens(botId: string) {
  const tokens = await db
    .select({
      id: botToken.id,
      name: botToken.name,
      createdAt: botToken.createdAt,
      expiresAt: botToken.expiresAt,
      revokedAt: botToken.revokedAt,
      lastUsedAt: botToken.lastUsedAt,
    })
    .from(botToken)
    .where(eq(botToken.botId, botId))
    .orderBy(botToken.createdAt);

  return tokens;
}

export async function revokeBotToken(tokenId: string, botId: string) {
  await db
    .update(botToken)
    .set({
      revokedAt: sql`now()`,
    })
    .where(
      and(
        eq(botToken.id, tokenId),
        eq(botToken.botId, botId),
        isNull(botToken.revokedAt),
      ),
    );
}

export async function validateBotToken(token: string) {
  const now = new Date().toISOString();

  const [result] = await db
    .select({
      tokenId: botToken.id,
      botId: bot.id,
      botName: bot.name,
      communityId: bot.communityId,
      profileId: bot.profileId,
      profileName: profile.name,
      profileUsername: profile.username,
      createdByUserId: bot.createdById,
    })
    .from(botToken)
    .innerJoin(bot, eq(botToken.botId, bot.id))
    .innerJoin(profile, eq(bot.profileId, profile.id))
    .where(
      and(
        eq(botToken.token, token),
        isNull(botToken.revokedAt),
        isNull(bot.deletedAt),
        // Check expiration: either no expiration or not yet expired
        sql`(${botToken.expiresAt} IS NULL OR ${botToken.expiresAt} > ${now})`,
      ),
    );

  if (!result) {
    return null;
  }

  // Update last used timestamp (fire and forget)
  db.update(botToken)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(botToken.id, result.tokenId))
    .catch(() => {
      // Ignore errors
    });

  return result;
}

export async function validateBotBelongsToCommunity(
  botId: string,
  communityId: string,
) {
  const botRecord = await getBot(botId, communityId);

  if (!botRecord) {
    throw new AppException(
      404,
      GeneralErrorCode.NOT_FOUND,
      "봇을 찾을 수 없습니다",
    );
  }

  return botRecord;
}

export async function getCommunityById(communityId: string) {
  const [result] = await db
    .select()
    .from(community)
    .where(and(eq(community.id, communityId), isNull(community.deletedAt)));

  return result;
}
