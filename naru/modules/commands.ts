// Slash commands in posts (commung's builtin-commands and their dispatch):
// a post that is just `/name args` runs the installed app's command inside
// the posting mutation, so the shop commands change balances in the same
// transaction, and answers the reply its bot profile posts. The posts area
// calls `commandReply` after a post is published and writes the reply.
import {
  type CommandRole,
  listEnabledCommands,
  requiredRoleOf,
} from "./apps.js";
import type { MutationCtx } from "./core.js";
import {
  consumeItem,
  getCurrencyByName,
  getItemByName,
  grantCurrency,
  listBalances,
  listInventory,
  listItems,
  purchaseItem,
  ShopError,
} from "./shop.js";

export interface CommandTrigger {
  /** The post that may hold a command. */
  id: string;
  content: string;
  authorProfileId: string;
  /** The member who wrote it (null for a bot). */
  actorMember: string | null;
  rootPostId: string | null;
}

interface CommandInput {
  args: string;
  trigger: CommandTrigger;
}

type Handler = (ctx: MutationCtx, input: CommandInput) => Promise<string>;

const SLASH_COMMAND_PATTERN = /^\/([a-z][a-z0-9_-]{0,30})(?:\s+([\s\S]*))?$/i;

/** The command in a post: one line that starts with `/name`. */
export function parseSlashCommand(
  content: string,
): { name: string; args: string } | null {
  if (content.includes("\n")) return null;
  const match = SLASH_COMMAND_PATTERN.exec(content.trim());
  if (!match?.[1]) return null;
  return { name: match[1].toLowerCase(), args: match[2] ?? "" };
}

// ---------- dice ----------

const MAX_DICE_COUNT = 1000;
const MAX_DICE_SIDES = 10000;
const MAX_CONSTANT = 1_000_000;
const DICE_PATTERN =
  /^(\d+)?d(\d+)(?:(kh|kl|dh|dl)(\d+))?\s*(?:([+-])\s*(\d+))?$/i;
const DICE_USAGE =
  "사용법: `/roll <dice>` (예: `3d6`, `1d20+5`, `2d20kh1`, `4d6dl1`)";

type Modifier = "kh" | "kl" | "dh" | "dl";
interface ParsedRoll {
  count: number;
  sides: number;
  modifier?: { kind: Modifier; n: number };
  constant: number;
  raw: string;
}

function parseDice(input: string): ParsedRoll | string {
  const trimmed = input.trim();
  if (!trimmed) return DICE_USAGE;
  const match = DICE_PATTERN.exec(trimmed);
  if (!match) return DICE_USAGE;
  const [, countStr, sidesStr, modKind, modN, sign, constStr] = match;
  if (!sidesStr) return DICE_USAGE;
  const count = countStr ? Number.parseInt(countStr, 10) : 1;
  const sides = Number.parseInt(sidesStr, 10);
  if (!Number.isFinite(count) || count < 1)
    return "주사위 개수는 1 이상이어야 합니다.";
  if (count > MAX_DICE_COUNT)
    return `주사위 개수는 ${MAX_DICE_COUNT}개 이하로 입력해주세요.`;
  if (!Number.isFinite(sides) || sides < 2)
    return "주사위 면 수는 2 이상이어야 합니다.";
  if (sides > MAX_DICE_SIDES)
    return `주사위 면 수는 ${MAX_DICE_SIDES} 이하로 입력해주세요.`;
  let modifier: ParsedRoll["modifier"];
  if (modKind && modN) {
    const n = Number.parseInt(modN, 10);
    if (!Number.isFinite(n) || n < 1)
      return "수정자(kh/kl/dh/dl) 뒤에는 1 이상의 숫자가 필요합니다.";
    if (n >= count)
      return `수정자 ${modKind}${n}는 주사위 개수(${count})보다 작아야 합니다.`;
    modifier = { kind: modKind.toLowerCase() as Modifier, n };
  }
  let constant = 0;
  if (sign && constStr) {
    const value = Number.parseInt(constStr, 10);
    if (!Number.isFinite(value)) return DICE_USAGE;
    if (value > MAX_CONSTANT)
      return `상수는 ${MAX_CONSTANT} 이하로 입력해주세요.`;
    constant = sign === "-" ? -value : value;
  }
  return { count, sides, modifier, constant, raw: trimmed };
}

/** 0 to n - 1 (Math.random: QuickJS has no crypto). */
const randomInt = (n: number) => Math.floor(Math.random() * n);

function applyModifier(rolls: number[], modifier: ParsedRoll["modifier"]) {
  if (!modifier) return { kept: rolls, dropped: [] as number[] };
  const sortedDesc = [...rolls.entries()].sort((a, b) => b[1] - a[1]);
  const { kind, n } = modifier;
  const keptEntries =
    kind === "kh"
      ? sortedDesc.slice(0, n)
      : kind === "kl"
        ? sortedDesc.slice(-n)
        : kind === "dh"
          ? sortedDesc.slice(n)
          : sortedDesc.slice(0, sortedDesc.length - n);
  const keptIndices = new Set(keptEntries.map(([index]) => index));
  const kept: number[] = [];
  const dropped: number[] = [];
  rolls.forEach((roll, index) => {
    (keptIndices.has(index) ? kept : dropped).push(roll);
  });
  return { kept, dropped };
}

function rollDice(parsed: ParsedRoll): string {
  const { count, sides, modifier, constant, raw } = parsed;
  const rolls = Array.from({ length: count }, () => randomInt(sides) + 1);
  const { kept, dropped } = applyModifier(rolls, modifier);
  const total = kept.reduce((a, b) => a + b, 0) + constant;
  const rollsStr = `[${rolls.join(", ")}]`;
  const constStr =
    constant === 0 ? "" : constant > 0 ? ` + ${constant}` : ` - ${-constant}`;
  if (modifier)
    return dropped.length === 0
      ? `🎲 ${raw}: 굴림 ${rollsStr}${constStr} = ${total}`
      : `🎲 ${raw}: 굴림 ${rollsStr}, 사용 [${kept.join(", ")}]${constStr} = ${total}`;
  return `🎲 ${raw}: ${rollsStr}${constStr} = ${total}`;
}

// ---------- choose ----------

const CHOOSE_USAGE =
  "사용법: `/choose 옵션1 옵션2 ...` 또는 `/choose 옵션1, 옵션2, 옵션3`";

function chooseOptions(args: string): string[] {
  const trimmed = args.trim();
  if (!trimmed) return [];
  const raw = trimmed.includes(",") ? trimmed.split(",") : trimmed.split(/\s+/);
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 100)
    .slice(0, 100);
}

// ---------- shop ----------

/** Runs a shop change, answering the shop's refusal as the reply. */
async function orShopMessage(fn: () => Promise<string>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ShopError) return error.message;
    throw error;
  }
}

function itemNotFound(name: string) {
  return new ShopError(
    "NOT_FOUND",
    `상품을 찾을 수 없습니다: ${name}`,
    "not_found",
  );
}

const HANDLERS: Record<string, Handler> = {
  "dice.roll": async (_ctx, { args }) => {
    const parsed = parseDice(args);
    return typeof parsed === "string" ? parsed : rollDice(parsed);
  },
  "coin.flip": async () => `🪙 ${Math.random() < 0.5 ? "앞면" : "뒷면"}`,
  "choose.pick": async (_ctx, { args }) => {
    const options = chooseOptions(args);
    if (!options.length) return CHOOSE_USAGE;
    return `🎯 ${options[randomInt(options.length)]}`;
  },
  "help.list": async (ctx) => {
    const commands = await listEnabledCommands(ctx);
    if (!commands.length) return "사용 가능한 명령어가 없습니다.";
    const lines = commands.map((cmd) =>
      cmd.description
        ? `- \`/${cmd.name}\` — ${cmd.description}`
        : `- \`/${cmd.name}\``,
    );
    return `**사용 가능한 명령어**\n\n${lines.join("\n")}`;
  },
  "shop.balance": async (ctx, { trigger }) => {
    const balances = await listBalances(ctx, trigger.authorProfileId);
    if (!balances.length) return "잔액이 없습니다.";
    const lines = balances.map(
      (b) =>
        `- **${b.currencyName}**: ${b.amount}${b.isDefault ? " (기본)" : ""}`,
    );
    return `**잔액**\n\n${lines.join("\n")}`;
  },
  "shop.items": async (ctx) => {
    const items = await listItems(ctx);
    if (!items.length) return "판매 중인 상품이 없습니다.";
    const lines = items.map((i) => {
      const tags: string[] = [];
      if (i.consumable) tags.push("소모품");
      if (i.isUnique) tags.push("유니크");
      const tagStr = tags.length ? ` · ${tags.join(", ")}` : "";
      const desc = i.description ? ` — ${i.description}` : "";
      return `- **${i.name}** (${i.priceAmount} ${i.currencyName})${desc}${tagStr}`;
    });
    return `**상점**\n\n${lines.join("\n")}`;
  },
  "shop.buy": async (ctx, { args, trigger }) => {
    const name = args.trim();
    if (!name) return "사용법: `/buy <상품 이름>`";
    return await orShopMessage(async () => {
      const item = await getItemByName(ctx, name);
      if (!item) throw itemNotFound(name);
      await purchaseItem(ctx, {
        profileId: trigger.authorProfileId,
        itemId: item.id,
        actor: trigger.actorMember,
      });
      return `🛒 **${item.name}** 구매 완료!`;
    });
  },
  "shop.inventory": async (ctx, { trigger }) => {
    const inventory = await listInventory(ctx, trigger.authorProfileId);
    if (!inventory.length) return "보유 중인 상품이 없습니다.";
    const lines = inventory.map(
      (i) => `- **${i.itemName}** ×${i.qty}${i.consumable ? " · 소모품" : ""}`,
    );
    return `**보유 상품**\n\n${lines.join("\n")}`;
  },
  "shop.use": async (ctx, { args, trigger }) => {
    const name = args.trim();
    if (!name) return "사용법: `/use <상품 이름>`";
    return await orShopMessage(async () => {
      const item = await getItemByName(ctx, name);
      if (!item) throw itemNotFound(name);
      const profileId = trigger.authorProfileId;
      if (item.consumable)
        await consumeItem(ctx, {
          profileId,
          itemId: item.id,
          actor: trigger.actorMember,
        });
      else if (
        !(await listInventory(ctx, profileId)).some(
          (row) => row.itemId === item.id && row.qty > 0,
        )
      )
        throw new ShopError(
          "INVALID_REQUEST",
          `보유하고 있지 않습니다: ${item.name}`,
          "not_owned",
        );
      const { rows } = await ctx.sql<{ name: string }>`
        SELECT name FROM profiles WHERE id = ${profileId}`;
      const verb = item.consumable ? "사용했습니다" : "꺼내 보였습니다";
      let content = `🪄 **${rows[0]?.name ?? ""}**님이 **${item.name}**을(를) ${verb}.`;
      if (item.description) content += `\n\n${item.description}`;
      return content;
    });
  },
  "shop_admin.grant": async (ctx, { args, trigger }) => {
    const usage = "사용법: `/grant <사용자명> <금액> <통화> [사유]`";
    const match = args.trim().match(/^(\S+)\s+(\d+)\s+(\S+)(?:\s+([\s\S]+))?$/);
    if (!match) return usage;
    const [, username, amountStr, currencyName, reason] = match;
    if (!username || !amountStr || !currencyName) return usage;
    const amount = Number.parseInt(amountStr, 10);
    if (!Number.isFinite(amount) || amount <= 0)
      return "금액은 1 이상의 정수여야 합니다.";
    const { rows } = await ctx.sql<{ id: string; name: string }>`
      SELECT id, name FROM profiles
      WHERE lower(username) = ${username.toLowerCase()}
        AND activated_at IS NOT NULL AND deleted_at IS NULL`;
    const profile = rows[0];
    if (!profile) return `사용자를 찾을 수 없습니다: ${username}`;
    const currency = await getCurrencyByName(ctx, currencyName);
    if (!currency) return `통화를 찾을 수 없습니다: ${currencyName}`;
    return await orShopMessage(async () => {
      await grantCurrency(ctx, {
        profileId: profile.id,
        currencyId: currency.id,
        amount,
        source: "owner_grant",
        actor: trigger.actorMember,
        reason: reason ?? null,
      });
      return `🎁 **${profile.name}** 님에게 ${amount} ${currency.name} 지급되었습니다.`;
    });
  },
};

function roleSatisfies(actor: string | null, required: CommandRole) {
  if (actor === "owner") return true;
  return actor === "moderator" && required === "moderator";
}

/**
 * The reply a command in `trigger` answers with, as the installed app's bot
 * profile, or null when the post holds no command. The caller writes the
 * reply as a post in reply to `trigger.id`.
 */
export async function commandReply(
  ctx: MutationCtx,
  trigger: CommandTrigger,
): Promise<{ authorProfileId: string; content: string } | null> {
  const parsed = parseSlashCommand(trigger.content);
  if (!parsed) return null;
  const { rows } = await ctx.sql<{
    handler_builtin_id: string;
    enabled: number;
    profile_id: string;
  }>`
    SELECT c.handler_builtin_id, c.enabled, a.profile_id
    FROM bot_commands c JOIN installed_apps a ON a.id = c.installed_app_id
    WHERE lower(c.name) = ${parsed.name} AND c.deleted_at IS NULL
      AND a.deleted_at IS NULL`;
  const command = rows[0];
  if (!command || command.enabled !== 1) return null;
  const handler = Object.hasOwn(HANDLERS, command.handler_builtin_id)
    ? HANDLERS[command.handler_builtin_id]
    : undefined;
  if (!handler) return null;
  const authorProfileId = command.profile_id;

  const requiredRole = requiredRoleOf(command.handler_builtin_id);
  if (requiredRole) {
    let role: string | null = null;
    if (trigger.actorMember) {
      const { rows: members } = await ctx.sql<{ role: string }>`
        SELECT role FROM members WHERE member = ${trigger.actorMember}`;
      role = members[0]?.role ?? null;
    }
    if (!roleSatisfies(role, requiredRole))
      return {
        authorProfileId,
        content: "이 명령어를 사용할 권한이 없습니다.",
      };
  }

  return {
    authorProfileId,
    content: await handler(ctx, { args: parsed.args, trigger }),
  };
}
