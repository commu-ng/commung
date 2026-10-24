// Built-in apps (commung's builtin-commands catalog) and installing them:
// each installed app posts as its own bot profile and answers the slash
// commands it brings (installed-app.service, bot-command.service).
import {
  bool,
  type Ctx,
  invalid,
  iso,
  type MutationCtx,
  type SqlValue,
  uuidv7,
} from "./core.js";

export type CommandRole = "owner" | "moderator";

export interface BuiltinAppCommandExample {
  input: string;
  output: string;
  note?: string;
}

export interface BuiltinAppCommand {
  defaultName: string;
  description: string;
  handlerBuiltinId: string;
  requiredRole?: CommandRole;
  longDescription?: string;
  examples?: readonly BuiltinAppCommandExample[];
}

export interface BuiltinApp {
  id: string;
  version: string;
  description: string;
  longDescription?: string;
  defaultProfile: { name: string; username: string };
  commands: readonly BuiltinAppCommand[];
}

export const BUILTIN_APPS: Record<string, BuiltinApp> = {
  dice: {
    id: "dice",
    version: "1.0.0",
    description:
      "TRPG 주사위 굴리기. /roll 3d6, 1d20+5, 2d20kh1, 4d6dl1 형식으로 사용하세요.",
    longDescription:
      "TRPG 세션에서 필요한 모든 주사위 굴림을 한 명령어로 처리합니다. 일반 굴림(`XdY`), 보너스/페널티(`+N` `-N`), 어드밴티지/디스어드밴티지(`khN` `klN`), 능력치 굴림(`dlN`)까지 지원합니다.",
    defaultProfile: { name: "DiceBot", username: "dicebot" },
    commands: [
      {
        defaultName: "roll",
        description:
          "주사위 굴리기: 3d6, 1d20+5, 2d20kh1 (어드밴티지), 4d6dl1 (최저값 버림).",
        longDescription:
          "표준 다이스 표기법 `XdY`을 사용합니다. `kh`/`kl`은 가장 높은/낮은 N개 사용, `dh`/`dl`은 가장 높은/낮은 N개 버림. 보너스는 `+5`, 페널티는 `-2`처럼 끝에 붙입니다.",
        handlerBuiltinId: "dice.roll",
        examples: [
          {
            input: "/roll 3d6",
            output: "🎲 3d6: [4, 1, 5] = 10",
            note: "기본 주사위 굴림",
          },
          {
            input: "/roll 1d20+5",
            output: "🎲 1d20+5: [12] + 5 = 17",
            note: "공격 굴림 (보너스 포함)",
          },
          {
            input: "/roll 2d20kh1",
            output: "🎲 2d20kh1: 굴림 [18, 3], 사용 [18] = 18",
            note: "어드밴티지: 높은 값 1개만 사용",
          },
          {
            input: "/roll 4d6dl1",
            output: "🎲 4d6dl1: 굴림 [3, 5, 2, 6], 사용 [3, 5, 6] = 14",
            note: "D&D 능력치: 4d6에서 가장 낮은 값 버림",
          },
        ],
      },
    ],
  },
  help: {
    id: "help",
    version: "1.0.0",
    description: "사용 가능한 슬래시 명령어 목록을 보여줍니다.",
    longDescription:
      "이 커뮤에서 설치된 모든 슬래시 명령어를 한눈에 확인할 수 있습니다. 새로 가입한 멤버에게 어떤 봇이 작동하는지 알려주는 가장 빠른 방법입니다.",
    defaultProfile: { name: "Help", username: "help" },
    commands: [
      {
        defaultName: "help",
        description: "사용 가능한 명령어 목록을 보여줍니다.",
        longDescription:
          "현재 커뮤에 활성화된 슬래시 명령어를 마크다운 목록으로 출력합니다.",
        handlerBuiltinId: "help.list",
        examples: [
          {
            input: "/help",
            output:
              "**사용 가능한 명령어**\n\n- `/balance` — 내 잔액을 확인합니다.\n- `/buy` — 상품을 구매합니다.\n- `/coin` — 동전을 던져 앞면/뒷면을 결정합니다.\n- `/roll` — 주사위 굴리기.\n…",
          },
        ],
      },
    ],
  },
  coin: {
    id: "coin",
    version: "1.0.0",
    description: "동전 던지기. /coin으로 앞면 또는 뒷면을 결정합니다.",
    longDescription:
      "둘 중 하나를 정해야 할 때 빠르게 동전을 던집니다. 짜장면 vs 짬뽕, 외출할까 말까 같은 즉흥 결정에 좋습니다.",
    defaultProfile: { name: "CoinBot", username: "coinbot" },
    commands: [
      {
        defaultName: "coin",
        description: "동전을 던져 앞면/뒷면을 결정합니다.",
        handlerBuiltinId: "coin.flip",
        examples: [
          { input: "/coin", output: "🪙 앞면" },
          { input: "/coin", output: "🪙 뒷면", note: "50/50 확률" },
        ],
      },
    ],
  },
  choose: {
    id: "choose",
    version: "1.0.0",
    description:
      "주어진 옵션 중 하나를 무작위로 선택합니다. 예: /choose 짜장, 짬뽕",
    longDescription:
      "여러 후보 중에서 하나를 무작위로 골라줍니다. 점심 메뉴, 다음에 볼 영화, 추첨처럼 결정 못 하는 모든 순간에 유용합니다. 옵션은 공백 또는 쉼표로 구분합니다.",
    defaultProfile: { name: "ChooseBot", username: "choosebot" },
    commands: [
      {
        defaultName: "choose",
        description:
          "옵션 중 하나를 무작위로 선택합니다 (쉼표 또는 공백으로 구분).",
        handlerBuiltinId: "choose.pick",
        examples: [
          {
            input: "/choose 짜장 짬뽕 볶음밥",
            output: "🎯 볶음밥",
            note: "공백으로 구분",
          },
          {
            input: "/choose 가위, 바위, 보",
            output: "🎯 보",
            note: "쉼표로 구분 (옵션에 공백을 포함하고 싶을 때)",
          },
        ],
      },
    ],
  },
  shop: {
    id: "shop",
    version: "1.1.0",
    description:
      "커뮤 상점. /balance로 잔액 확인, /items로 상품 목록, /buy <이름>으로 구매, /inventory로 보유 확인, /use <이름>으로 사용.",
    longDescription:
      "커뮤니티 안에서 통화를 모으고 상품을 사고 자랑할 수 있는 상점 시스템. 소유자가 통화와 상품을 정의하면 멤버는 슬래시 명령으로 잔액을 확인하고, 구매하고, 보유 상품을 꺼내 보일 수 있습니다. 상품에는 설명(로어)을 붙일 수 있어서 RP에도 잘 어울립니다.",
    defaultProfile: { name: "ShopBot", username: "shopbot" },
    commands: [
      {
        defaultName: "balance",
        description: "내 잔액을 확인합니다.",
        longDescription:
          "내 프로필이 보유한 모든 통화의 잔액을 보여줍니다. 기본 통화에는 `(기본)` 표시가 붙습니다.",
        handlerBuiltinId: "shop.balance",
        examples: [
          {
            input: "/balance",
            output: "**잔액**\n\n- **골드**: 250 (기본)\n- **별점**: 12",
          },
        ],
      },
      {
        defaultName: "items",
        description: "판매 중인 상품 목록을 봅니다.",
        longDescription:
          "상점에 등록된 모든 상품을 가격, 통화, 속성과 함께 보여줍니다.",
        handlerBuiltinId: "shop.items",
        examples: [
          {
            input: "/items",
            output:
              "**상점**\n\n- **검** (100 골드) — 번뜩이는 직검 · 유니크\n- **포션** (10 골드) — HP를 회복합니다 · 소모품",
          },
        ],
      },
      {
        defaultName: "buy",
        description: "상품을 구매합니다. 사용법: /buy <상품 이름>",
        longDescription:
          "잔액이 충분하면 상품을 구매합니다. 잔액 부족이나 이미 보유 중인 유니크 상품의 경우 사유를 알려줍니다.",
        handlerBuiltinId: "shop.buy",
        examples: [
          { input: "/buy 검", output: "🛒 **검** 구매 완료!" },
          {
            input: "/buy 검",
            output: "이미 보유 중인 상품입니다",
            note: "유니크 상품은 한 번만 구매 가능",
          },
          {
            input: "/buy 포션",
            output: "잔액이 부족합니다",
            note: "잔액 부족 시",
          },
        ],
      },
      {
        defaultName: "inventory",
        description: "보유 중인 상품 목록을 봅니다.",
        longDescription:
          "내가 보유한 모든 상품을 수량과 함께 보여줍니다. 다른 사람의 보유 상품은 그 사람의 프로필 페이지에서 확인할 수 있습니다.",
        handlerBuiltinId: "shop.inventory",
        examples: [
          {
            input: "/inventory",
            output: "**보유 상품**\n\n- **검** ×1\n- **포션** ×3 · 소모품",
          },
        ],
      },
      {
        defaultName: "use",
        description:
          "보유한 상품을 사용/꺼내 보입니다. 소모품은 1개 차감됩니다. 사용법: /use <상품 이름>",
        longDescription:
          '보유한 상품을 "사용"합니다. 소모품(consumable)은 1개 차감되고 사용 메시지가 게시됩니다. 소모품이 아닌 상품은 차감 없이 "꺼내 보였습니다"로 표시되며 RP에 활용할 수 있습니다. 상품 설명(로어)이 결과 메시지에 함께 표시됩니다.',
        handlerBuiltinId: "shop.use",
        examples: [
          {
            input: "/use 검",
            output:
              "🪄 **홍길동**님이 **검**을(를) 꺼내 보였습니다.\n\n번뜩이는 직검",
            note: "소모품이 아닌 상품: 차감 없이 자랑하기 용도",
          },
          {
            input: "/use 포션",
            output:
              "🪄 **홍길동**님이 **포션**을(를) 사용했습니다.\n\nHP를 회복합니다.",
            note: "소모품: 1개 차감",
          },
        ],
      },
    ],
  },
  shop_admin: {
    id: "shop_admin",
    version: "1.0.0",
    description:
      "상점 관리 명령어. 소유자가 슬래시 명령으로 통화를 지급할 수 있습니다.",
    longDescription:
      "상점을 운영하는 소유자를 위한 관리 명령어 모음입니다. 콘솔의 상점 페이지에서도 같은 작업을 할 수 있지만, 게시물 흐름에서 빠르게 처리하고 싶을 때 유용합니다.",
    defaultProfile: { name: "ShopAdmin", username: "shopadmin" },
    commands: [
      {
        defaultName: "grant",
        description:
          "소유자 전용. 사용법: /grant <사용자명> <금액> <통화> [사유]",
        longDescription:
          "특정 멤버에게 통화를 지급합니다. 인자는 `<사용자명> <금액> <통화 이름> [사유]` 순서이며, 사유는 거래 내역에 함께 기록됩니다. **소유자만 사용 가능합니다.**",
        handlerBuiltinId: "shop_admin.grant",
        requiredRole: "owner",
        examples: [
          {
            input: "/grant alice 100 골드 신규 가입 환영",
            output: "🎁 **앨리스** 님에게 100 골드 지급되었습니다.",
            note: "사유는 거래 내역에 기록됨",
          },
          {
            input: "/grant bob 50 별점",
            output: "🎁 **밥** 님에게 50 별점 지급되었습니다.",
            note: "사유 생략 가능",
          },
        ],
      },
    ],
  },
};

export const getBuiltinApp = (builtinId: string): BuiltinApp | undefined =>
  Object.hasOwn(BUILTIN_APPS, builtinId) ? BUILTIN_APPS[builtinId] : undefined;

export function requiredRoleOf(
  handlerBuiltinId: string,
): CommandRole | undefined {
  for (const app of Object.values(BUILTIN_APPS))
    for (const cmd of app.commands)
      if (cmd.handlerBuiltinId === handlerBuiltinId) return cmd.requiredRole;
  return undefined;
}

export const BUILTIN_ID_PATTERN = /^[a-z][a-z0-9_.-]*$/;
export const SLASH_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,30}$/;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/** A catalog command as the app directory and the catalog answer it. */
export const commandView = (
  cmd: BuiltinAppCommand,
  name = cmd.defaultName,
) => ({
  name,
  default_name: cmd.defaultName,
  description: cmd.description,
  long_description: cmd.longDescription ?? null,
  required_role: cmd.requiredRole ?? null,
  examples: (cmd.examples ?? []).map((ex) => ({
    input: ex.input,
    output: ex.output,
    note: ex.note ?? null,
  })),
});

// ---------- Bot profiles ----------

/**
 * Makes an active, non-primary profile owned by `member`, for an app or a
 * bot to post as (commung's createBotProfile).
 */
export async function createBotProfile(
  ctx: MutationCtx,
  name: string,
  username: string,
  member: string,
) {
  const { rows: taken } = await ctx.sql<{ id: string }>`
    SELECT id FROM profiles
    WHERE lower(username) = ${username.toLowerCase()} AND deleted_at IS NULL`;
  if (taken[0])
    invalid(ctx, "이 커뮤에서 이미 사용 중인 사용자명입니다", "username_taken");
  const profileId = uuidv7(ctx.now);
  const { rows } = await ctx.sql<{
    id: string;
    name: string;
    username: string;
    bio: string | null;
    created_at: number;
    updated_at: number;
    activated_at: number;
  }>`
    INSERT INTO profiles (id, name, username, is_primary, activated_at, created_at, updated_at)
    VALUES (${profileId}, ${name}, ${username}, 0, ${ctx.now}, ${ctx.now}, ${ctx.now})
    RETURNING id, name, username, bio, created_at, updated_at, activated_at`;
  await ctx.sql`
    INSERT INTO profile_owners (profile_id, member, role, created_at, created_by)
    VALUES (${profileId}, ${member}, 'owner', ${ctx.now}, ${member})`;
  const profile = rows[0];
  return {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    bio: profile.bio,
    created_at: iso(profile.created_at),
    updated_at: iso(profile.updated_at),
    activatedAt: iso(profile.activated_at),
  };
}

/** A bot profile's name and username, checked as the console's schemas did. */
export function botProfileFields(ctx: Ctx, a: Record<string, unknown>) {
  const name = a.profile_name;
  if (typeof name !== "string" || name.length < 1 || name.length > 100)
    invalid(ctx, "프로필 이름은 1~100자여야 합니다.");
  const username = a.profile_username;
  if (
    typeof username !== "string" ||
    username.length < 1 ||
    username.length > 50 ||
    !USERNAME_PATTERN.test(username)
  )
    invalid(ctx, "사용자명은 영문, 숫자, 밑줄(_)로 50자 이하여야 합니다.");
  return { name, username };
}

// ---------- Installed apps ----------

export interface InstalledAppRow {
  id: string;
  profile_id: string;
  builtin_id: string;
  version: string;
  config: string;
  installed_by: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number | null;
  profile_name?: string;
  profile_username?: string;
  [key: string]: SqlValue | undefined;
}

export const installJson = (row: InstalledAppRow) => ({
  id: row.id,
  profileId: row.profile_id,
  builtinId: row.builtin_id,
  version: row.version,
  config: JSON.parse(row.config) as Record<string, unknown>,
  installedById: row.installed_by,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  ...(row.profile_name === undefined
    ? {}
    : { profileName: row.profile_name, profileUsername: row.profile_username }),
});

export interface CommandRow {
  id: string;
  installed_app_id: string;
  name: string;
  description: string | null;
  handler_builtin_id: string;
  enabled: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export const commandJson = (row: CommandRow) => ({
  id: row.id,
  installedAppId: row.installed_app_id,
  name: row.name,
  description: row.description,
  handlerBuiltinId: row.handler_builtin_id,
  enabled: bool(row.enabled),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  deletedAt: iso(row.deleted_at),
});

const INSTALL_SELECT = `SELECT a.*, p.name AS profile_name, p.username AS profile_username
  FROM installed_apps a JOIN profiles p ON p.id = a.profile_id`;

export async function listInstalled(ctx: Ctx) {
  const { rows } = await ctx.sql<InstalledAppRow>(
    `${INSTALL_SELECT} WHERE a.deleted_at IS NULL ORDER BY a.created_at, a.id`,
  );
  return rows.map(installJson);
}

export async function getInstalled(ctx: Ctx, installId: string) {
  const { rows } = await ctx.sql<InstalledAppRow>(
    `${INSTALL_SELECT} WHERE a.id = ? AND a.deleted_at IS NULL`,
    [installId],
  );
  return rows[0] ? installJson(rows[0]) : null;
}

export async function validateInstalledExists(ctx: Ctx, installId: string) {
  return (
    (await getInstalled(ctx, installId)) ??
    ctx.fail("NOT_FOUND", "설치된 앱을 찾을 수 없습니다", {
      reason: "not_found",
    })
  );
}

export async function listCommandsForInstall(ctx: Ctx, installId: string) {
  const { rows } = await ctx.sql<CommandRow>`
    SELECT * FROM bot_commands
    WHERE installed_app_id = ${installId} AND deleted_at IS NULL
    ORDER BY created_at, id`;
  return rows.map(commandJson);
}

/** Enabled commands of installed apps, by name (the /help list, /commands). */
export async function listEnabledCommands(ctx: Ctx) {
  const { rows } = await ctx.sql<{
    id: string;
    name: string;
    description: string | null;
    handler_builtin_id: string;
    installed_app_id: string;
    builtin_id: string;
  }>`
    SELECT c.id, c.name, c.description, c.handler_builtin_id, c.installed_app_id, a.builtin_id
    FROM bot_commands c JOIN installed_apps a ON a.id = c.installed_app_id
    WHERE c.enabled = 1 AND c.deleted_at IS NULL AND a.deleted_at IS NULL
    ORDER BY c.name`;
  return rows;
}

export type CommandOverride = { name?: string; enabled?: boolean };

function commandPlan(
  ctx: Ctx,
  app: BuiltinApp,
  overrides: Record<string, CommandOverride> | undefined,
) {
  const seen = new Set<string>();
  return app.commands.map((cmd) => {
    const override = overrides?.[cmd.defaultName];
    const name = (override?.name ?? cmd.defaultName).toLowerCase();
    if (!SLASH_NAME_PATTERN.test(name))
      invalid(ctx, `잘못된 명령어 이름입니다: /${name}`);
    if (seen.has(name))
      ctx.fail("CONFLICT", `이 앱 내에서 명령어 이름이 중복됩니다: /${name}`, {
        reason: "duplicate_entry",
      });
    seen.add(name);
    return {
      name,
      description: cmd.description,
      handlerBuiltinId: cmd.handlerBuiltinId,
      enabled: override?.enabled ?? true,
    };
  });
}

async function namesAvailable(
  ctx: Ctx,
  names: string[],
  exceptInstall?: string,
) {
  if (!names.length) return;
  const { rows } = await ctx.sql<{ name: string; installed_app_id: string }>`
    SELECT name, installed_app_id FROM bot_commands
    WHERE deleted_at IS NULL
      AND lower(name) IN (SELECT value FROM json_each(${JSON.stringify(names.map((n) => n.toLowerCase()))}))`;
  const conflict = rows.find((row) => row.installed_app_id !== exceptInstall);
  if (conflict)
    ctx.fail("CONFLICT", `이미 사용 중인 명령어입니다: /${conflict.name}`, {
      reason: "duplicate_entry",
    });
}

/** Installs a catalog app: its bot profile, the install and its commands. */
export async function installApp(
  ctx: MutationCtx,
  builtinId: string,
  params: {
    profileName: string;
    profileUsername: string;
    installedBy: string;
    commandOverrides?: Record<string, CommandOverride>;
  },
) {
  const app =
    getBuiltinApp(builtinId) ??
    ctx.fail("NOT_FOUND", "카탈로그에서 앱을 찾을 수 없습니다", {
      reason: "not_found",
    });
  const { rows: existing } = await ctx.sql<{ id: string }>`
    SELECT id FROM installed_apps WHERE builtin_id = ${builtinId} AND deleted_at IS NULL`;
  if (existing[0])
    ctx.fail("CONFLICT", "이 앱은 이미 설치되어 있습니다", {
      reason: "duplicate_entry",
    });
  const plan = commandPlan(ctx, app, params.commandOverrides);
  await namesAvailable(
    ctx,
    plan.map((p) => p.name),
  );
  const profile = await createBotProfile(
    ctx,
    params.profileName,
    params.profileUsername,
    params.installedBy,
  );
  const { rows: installs } = await ctx.sql<InstalledAppRow>`
    INSERT INTO installed_apps (id, profile_id, builtin_id, version, installed_by, created_at, updated_at)
    VALUES (${uuidv7(ctx.now)}, ${profile.id}, ${app.id}, ${app.version}, ${params.installedBy}, ${ctx.now}, ${ctx.now})
    RETURNING *`;
  const install = installs[0];
  const commands = [];
  for (const p of plan) {
    const { rows } = await ctx.sql<CommandRow>`
      INSERT INTO bot_commands (id, installed_app_id, name, description, handler_builtin_id, enabled, created_at, updated_at)
      VALUES (${uuidv7(ctx.now)}, ${install.id}, ${p.name}, ${p.description}, ${p.handlerBuiltinId}, ${p.enabled}, ${ctx.now}, ${ctx.now})
      RETURNING *`;
    commands.push(commandJson(rows[0]));
  }
  return { install: installJson(install), commands, profile };
}

/** Uninstalls an app: the install, its commands and its bot profile. */
export async function uninstallApp(ctx: MutationCtx, installId: string) {
  const install = await validateInstalledExists(ctx, installId);
  await ctx.sql`UPDATE installed_apps SET deleted_at = ${ctx.now} WHERE id = ${installId}`;
  await ctx.sql`
    UPDATE bot_commands SET deleted_at = ${ctx.now}
    WHERE installed_app_id = ${installId} AND deleted_at IS NULL`;
  await ctx.sql`
    UPDATE profiles SET deleted_at = ${ctx.now}
    WHERE id = ${install.profileId} AND deleted_at IS NULL`;
}

/**
 * Sets an install's config. Every built-in app takes none (commung's
 * `z.object({}).strict()`), so only `{}` passes.
 */
export async function configureApp(
  ctx: MutationCtx,
  installId: string,
  config: unknown,
) {
  const install = await validateInstalledExists(ctx, installId);
  if (!getBuiltinApp(install.builtinId))
    ctx.fail("NOT_FOUND", "카탈로그에서 앱을 찾을 수 없습니다", {
      reason: "not_found",
    });
  if (!config || typeof config !== "object" || Array.isArray(config))
    invalid(ctx, "잘못된 설정입니다: 객체가 필요합니다");
  const keys = Object.keys(config);
  if (keys.length)
    invalid(ctx, `잘못된 설정입니다: 알 수 없는 키: ${keys.join(", ")}`);
  const { rows } = await ctx.sql<InstalledAppRow>`
    UPDATE installed_apps SET config = '{}', updated_at = ${ctx.now}
    WHERE id = ${installId} RETURNING *`;
  return installJson(rows[0]);
}

async function validateCommandExists(ctx: Ctx, commandId: string) {
  const { rows } = await ctx.sql<CommandRow>`
    SELECT * FROM bot_commands WHERE id = ${commandId} AND deleted_at IS NULL`;
  return (
    rows[0] ??
    ctx.fail("NOT_FOUND", "명령어를 찾을 수 없습니다", { reason: "not_found" })
  );
}

/** Renames and/or enables a command of an install. */
export async function updateCommand(
  ctx: MutationCtx,
  installId: string,
  commandId: string,
  changes: { name?: string; enabled?: boolean },
) {
  await validateInstalledExists(ctx, installId);
  const command = await validateCommandExists(ctx, commandId);
  if (command.installed_app_id !== installId)
    ctx.fail("NOT_FOUND", "명령어를 찾을 수 없습니다", { reason: "not_found" });
  let name = command.name;
  if (changes.name !== undefined) {
    name = changes.name.toLowerCase();
    if (!SLASH_NAME_PATTERN.test(name))
      invalid(ctx, `잘못된 명령어 이름입니다: /${changes.name}`);
    const { rows } = await ctx.sql<{ id: string }>`
      SELECT id FROM bot_commands
      WHERE lower(name) = ${name} AND deleted_at IS NULL AND id <> ${commandId}`;
    if (rows[0])
      ctx.fail("CONFLICT", `이미 사용 중인 명령어입니다: /${name}`, {
        reason: "duplicate_entry",
      });
  }
  const enabled = changes.enabled ?? command.enabled === 1;
  const { rows } = await ctx.sql<CommandRow>`
    UPDATE bot_commands SET name = ${name}, enabled = ${enabled}, updated_at = ${ctx.now}
    WHERE id = ${commandId} RETURNING *`;
  return commandJson(rows[0]);
}

/**
 * Installed apps with their catalog documentation and their enabled
 * commands' names, for the app directory (listInstalledAppsWithDocs).
 */
export async function installedAppsWithDocs(ctx: Ctx) {
  const { rows: installs } = await ctx.sql<{
    id: string;
    builtin_id: string;
    version: string;
    profile_name: string;
    profile_username: string;
  }>`
    SELECT a.id, a.builtin_id, a.version, p.name AS profile_name, p.username AS profile_username
    FROM installed_apps a JOIN profiles p ON p.id = a.profile_id
    WHERE a.deleted_at IS NULL AND p.deleted_at IS NULL
    ORDER BY a.created_at, a.id`;
  const { rows: commands } = await ctx.sql<{
    installed_app_id: string;
    name: string;
    handler_builtin_id: string;
  }>`
    SELECT installed_app_id, name, handler_builtin_id FROM bot_commands
    WHERE enabled = 1 AND deleted_at IS NULL`;
  const result = [];
  for (const install of installs) {
    const catalog = getBuiltinApp(install.builtin_id);
    if (!catalog) continue;
    const byHandler = new Map(
      commands
        .filter((c) => c.installed_app_id === install.id)
        .map((c) => [c.handler_builtin_id, c.name]),
    );
    result.push({
      builtin_id: install.builtin_id,
      version: install.version,
      profile: {
        name: install.profile_name,
        username: install.profile_username,
      },
      description: catalog.description,
      long_description: catalog.longDescription ?? null,
      commands: catalog.commands.flatMap((cmd) => {
        const name = byHandler.get(cmd.handlerBuiltinId);
        return name === undefined ? [] : [commandView(cmd, name)];
      }),
    });
  }
  return result;
}
