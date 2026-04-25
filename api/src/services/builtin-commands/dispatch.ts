import { AppException } from "../../exception";
import { GeneralErrorCode } from "../../types/api-responses";
import * as botCommandService from "../bot-command.service";
import * as postService from "../post.service";
import * as shopService from "../shop.service";
import {
  type CommandContext,
  getBuiltinHandler,
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

function makeShopContext(communityId: string): ShopContext {
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
      });
      return { name: item.name };
    },
  };
}

function makeCommandContext(communityId: string): CommandContext {
  return { shop: makeShopContext(communityId) };
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
        makeCommandContext(trigger.communityId),
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
        rootPostId: replyPost.root_post_id ?? null,
      },
      community,
      depth + 1,
    ).catch((err) => {
      console.error("[bot-command] chain dispatch failed", err);
    });
  }
}
