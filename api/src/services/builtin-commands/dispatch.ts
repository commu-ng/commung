import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { profile as profileTable } from "../../drizzle/schema";
import { AppException } from "../../exception";
import { GeneralErrorCode } from "../../types/api-responses";
import * as botCommandService from "../bot-command.service";
import * as membershipService from "../membership.service";
import * as postService from "../post.service";
import * as shopService from "../shop.service";
import {
  type CommandContext,
  type CommandRole,
  getBuiltinHandler,
  getRequiredRoleForHandler,
  type ShopContext,
} from "./index";

const SLASH_COMMAND_PATTERN = /^\/([a-z][a-z0-9_-]{0,30})(?:\s+([\s\S]*))?$/i;
const HANDLER_TIMEOUT_MS = 2000;
const MAX_DISPATCH_DEPTH = 3;

type TriggerPost = {
  id: string;
  content: string;
  communityId: string;
  authorProfileId: string;
  actorUserId: string | null;
  rootPostId: string | null;
};

type CommunityWindow = {
  startsAt: string;
  endsAt: string;
};

function parseSlashCommand(
  content: string,
): { name: string; args: string } | null {
  if (content.includes("\n")) return null;
  const match = SLASH_COMMAND_PATTERN.exec(content.trim());
  if (!match) return null;
  const [, rawName, rawArgs] = match;
  if (!rawName) return null;
  return { name: rawName.toLowerCase(), args: rawArgs ?? "" };
}

function makeShopContext(
  communityId: string,
  actorUserId: string | null,
): ShopContext {
  return {
    listBalances: (profileId) =>
      shopService.listBalancesForProfile(communityId, profileId),
    listItems: () => shopService.listItems(communityId),
    listInventory: (profileId) =>
      shopService.listInventoryForProfile(communityId, profileId),
    getItemByName: async (name) => {
      const item = await shopService.getItemByName(communityId, name);
      if (!item) return null;
      const currency = await shopService.getCurrency(
        communityId,
        item.currencyId,
      );
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        priceAmount: item.priceAmount,
        currencyName: currency?.name ?? "",
        consumable: item.consumable,
        isUnique: item.isUnique,
      };
    },
    purchaseItemByName: async (profileId, name) => {
      const item = await shopService.getItemByName(communityId, name);
      if (!item) {
        throw new AppException(
          404,
          GeneralErrorCode.NOT_FOUND,
          `상품을 찾을 수 없습니다: ${name}`,
        );
      }
      await shopService.purchaseItem({
        communityId,
        profileId,
        itemId: item.id,
        actorUserId,
      });
      return { name: item.name };
    },
    useItemByName: async (profileId, name) => {
      const item = await shopService.getItemByName(communityId, name);
      if (!item) {
        throw new AppException(
          404,
          GeneralErrorCode.NOT_FOUND,
          `상품을 찾을 수 없습니다: ${name}`,
        );
      }
      if (item.consumable) {
        await shopService.consumeItem({
          communityId,
          profileId,
          itemId: item.id,
          actorUserId,
        });
      } else {
        // Non-consumable: just verify ownership
        const inv = await shopService.listInventoryForProfile(
          communityId,
          profileId,
        );
        const owned = inv.find((row) => row.itemId === item.id && row.qty > 0);
        if (!owned) {
          throw new AppException(
            400,
            GeneralErrorCode.INVALID_REQUEST,
            `보유하고 있지 않습니다: ${item.name}`,
          );
        }
      }
      const [prof] = await db
        .select({ name: profileTable.name })
        .from(profileTable)
        .where(eq(profileTable.id, profileId));
      return {
        profileName: prof?.name ?? "",
        itemName: item.name,
        itemDescription: item.description,
        consumed: item.consumable,
      };
    },
    findProfileByUsername: async (username) => {
      const [row] = await db
        .select({
          id: profileTable.id,
          username: profileTable.username,
          name: profileTable.name,
        })
        .from(profileTable)
        .where(
          and(
            eq(profileTable.communityId, communityId),
            sql`LOWER(${profileTable.username}) = ${username.toLowerCase()}`,
            isNotNull(profileTable.activatedAt),
            isNull(profileTable.deletedAt),
          ),
        );
      return row ?? null;
    },
    findCurrencyByName: async (name) => {
      const row = await shopService.getCurrencyByName(communityId, name);
      return row ? { id: row.id, name: row.name } : null;
    },
    grantCurrency: async (profileId, currencyId, amount, reason) => {
      await shopService.grantCurrency({
        communityId,
        profileId,
        currencyId,
        amount,
        source: "owner_grant",
        actorUserId,
        reason,
      });
    },
  };
}

function roleSatisfies(actor: string | null, required: CommandRole): boolean {
  if (actor === "owner") return true;
  if (actor === "moderator" && required === "moderator") return true;
  return false;
}

function makeCommandContext(
  communityId: string,
  actorUserId: string | null,
): CommandContext {
  return { shop: makeShopContext(communityId, actorUserId) };
}

async function callHandlerWithTimeout(
  handler: NonNullable<ReturnType<typeof getBuiltinHandler>>,
  args: string,
  trigger: TriggerPost,
): Promise<{ content: string; contentWarning?: string | null } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      handler.handle(
        {
          args,
          post: {
            id: trigger.id,
            authorProfileId: trigger.authorProfileId,
            rootPostId: trigger.rootPostId,
            communityId: trigger.communityId,
          },
        },
        makeCommandContext(trigger.communityId, trigger.actorUserId),
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`handler timeout: ${handler.id}`)),
          HANDLER_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (err) {
    console.error("[bot-command] handler failed", handler.id, err);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function maybeDispatchCommand(
  trigger: TriggerPost,
  community: CommunityWindow,
  depth = 0,
): Promise<void> {
  if (depth >= MAX_DISPATCH_DEPTH) {
    console.warn("[bot-command] dispatch depth exceeded", {
      depth,
      triggerId: trigger.id,
    });
    return;
  }

  const parsed = parseSlashCommand(trigger.content);
  if (!parsed) return;

  const cmd = await botCommandService.findByNameInCommunity(
    trigger.communityId,
    parsed.name,
  );
  if (!cmd || !cmd.enabled) return;

  const handler = getBuiltinHandler(cmd.handlerBuiltinId);
  if (!handler) return;

  const requiredRole = getRequiredRoleForHandler(cmd.handlerBuiltinId);
  if (requiredRole) {
    const actorRole = trigger.actorUserId
      ? await membershipService.getMembershipRole(
          trigger.actorUserId,
          trigger.communityId,
        )
      : null;
    if (!roleSatisfies(actorRole, requiredRole)) {
      try {
        await postService.createPost(
          cmd.installedById,
          cmd.profileId,
          trigger.communityId,
          "이 명령어를 사용할 권한이 없습니다.",
          trigger.id,
          [],
          false,
          null,
          null,
          community.startsAt,
          community.endsAt,
        );
      } catch (err) {
        console.error(
          "[bot-command] permission denial reply failed",
          handler.id,
          err,
        );
      }
      return;
    }
  }

  const output = await callHandlerWithTimeout(handler, parsed.args, trigger);
  if (!output) return;

  let replyPost: Awaited<ReturnType<typeof postService.createPost>> | null =
    null;
  try {
    replyPost = await postService.createPost(
      cmd.installedById,
      cmd.profileId,
      trigger.communityId,
      output.content,
      trigger.id,
      [],
      false,
      output.contentWarning ?? null,
      null,
      community.startsAt,
      community.endsAt,
    );
  } catch (err) {
    console.error("[bot-command] reply post failed", handler.id, err);
    return;
  }

  if (replyPost?.id) {
    maybeDispatchCommand(
      {
        id: replyPost.id,
        content: output.content,
        communityId: trigger.communityId,
        authorProfileId: cmd.profileId,
        actorUserId: null,
        rootPostId: replyPost.root_post_id ?? null,
      },
      community,
      depth + 1,
    ).catch((err) => {
      console.error("[bot-command] chain dispatch failed", err);
    });
  }
}
