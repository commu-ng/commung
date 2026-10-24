import assert from "node:assert/strict";
import test from "node:test";
import { as, community, refusal, VISITOR } from "./helpers.mjs";

const install = (site, builtin, extra = {}) => {
  const app = {
    dice: ["DiceBot", "dicebot"],
    help: ["Help", "help"],
    coin: ["CoinBot", "coinbot"],
    shop: ["ShopBot", "shopbot"],
    shop_admin: ["ShopAdmin", "shopadmin"],
  }[builtin];
  return site.mutate(
    "apps:adminInstall",
    { builtin_id: builtin, profile_name: app[0], profile_username: app[1], ...extra },
    as("m-owner"),
  );
};

/** Posts as a member's profile and answers the reply a command left, or null. */
async function post(site, member, profile, content) {
  site.now += 1000;
  const written = await site.mutate("posts:create", { profile_id: profile, content }, as(member));
  const replies = site.rows(
    `SELECT po.content, p.username FROM posts po JOIN profiles p ON p.id = po.author_id
     WHERE po.in_reply_to_id = ?`,
    written.id,
  );
  return replies[0] ?? null;
}

test("the catalog is public; installing makes the app's bot profile and commands", async () => {
  const { site } = await community();
  const catalog = await site.query("apps:catalog", null, VISITOR);
  assert.ok(catalog.some((app) => app.builtin_id === "shop"));
  assert.equal(await refusal(site.query("apps:catalogApp", { builtin_id: "nope" }, VISITOR)), "not_found");

  assert.equal(
    await refusal(
      site.mutate("apps:adminInstall", { builtin_id: "dice", profile_name: "D", profile_username: "d" }, as("m-alice")),
    ),
    "not_owner",
  );
  const result = await install(site, "dice", { command_overrides: { roll: { name: "r" } } });
  assert.equal(result.profile.username, "dicebot");
  assert.deepEqual(result.commands.map((c) => c.name), ["r"]);
  assert.deepEqual(
    site.rows("SELECT member, role FROM profile_owners WHERE profile_id = ?", result.profile.id),
    [{ member: "m-owner", role: "owner" }],
  );
  assert.equal(await refusal(install(site, "dice")), "duplicate_entry");
  // A command name another app holds is refused, and so is a taken username.
  assert.equal(
    await refusal(install(site, "coin", { command_overrides: { coin: { name: "r" } } })),
    "duplicate_entry",
  );
  assert.equal(
    await refusal(
      site.mutate("apps:adminInstall", { builtin_id: "coin", profile_name: "C", profile_username: "ALICE" }, as("m-owner")),
    ),
    "username_taken",
  );

  const apps = await site.query("apps:list", null, as("m-alice"));
  assert.deepEqual(apps.map((a) => [a.builtin_id, a.commands.map((c) => c.name)]), [["dice", ["r"]]]);
  assert.equal((await site.query("apps:get", { builtin_id: "dice" }, as("m-alice"))).profile.username, "dicebot");
  assert.deepEqual((await site.query("commands:list", null, as("m-bob"))).map((c) => c.name), ["r"]);

  const detail = await site.query("apps:adminGet", { install_id: result.install.id }, as("m-owner"));
  const command = detail.commands[0];
  await site.mutate(
    "apps:adminUpdateCommand",
    { install_id: result.install.id, command_id: command.id, enabled: false },
    as("m-owner"),
  );
  assert.deepEqual(await site.query("commands:list", null, as("m-bob")), []);
  assert.equal(
    await refusal(site.mutate("apps:adminConfigure", { install_id: result.install.id, config: { x: 1 } }, as("m-owner"))),
    "invalid",
  );
  await site.mutate("apps:adminUninstall", { install_id: result.install.id }, as("m-owner"));
  assert.deepEqual(await site.query("apps:adminList", null, as("m-owner")), []);
  assert.equal(
    site.rows("SELECT deleted_at FROM profiles WHERE id = ?", result.profile.id)[0].deleted_at,
    site.now,
  );
  // Uninstalled, its username and commands are free again.
  await install(site, "dice");
});

test("slash commands reply as the app's bot, inside the posting mutation", async () => {
  const { site, profiles } = await community();
  await install(site, "dice");
  await install(site, "help");
  await install(site, "coin");
  assert.equal(await post(site, "m-alice", profiles.alice, "그냥 글"), null);
  assert.equal(await post(site, "m-alice", profiles.alice, "/unknown"), null);
  const roll = await post(site, "m-alice", profiles.alice, "/roll 2d6+3");
  assert.equal(roll.username, "dicebot");
  const [, a, b, total] = roll.content.match(/^🎲 2d6\+3: \[(\d), (\d)\] \+ 3 = (\d+)$/);
  assert.equal(Number(a) + Number(b) + 3, Number(total));
  assert.match((await post(site, "m-alice", profiles.alice, "/roll 4d6dl1")).content, /사용 \[/);
  assert.equal(
    (await post(site, "m-alice", profiles.alice, "/roll 0d6")).content,
    "주사위 개수는 1 이상이어야 합니다.",
  );
  assert.match((await post(site, "m-alice", profiles.alice, "/COIN")).content, /^🪙 (앞면|뒷면)$/);
  const help = await post(site, "m-alice", profiles.alice, "/help");
  assert.match(help.content, /^\*\*사용 가능한 명령어\*\*/);
  assert.match(help.content, /`\/roll`/);
  // A command must be the whole post, on one line.
  assert.equal(await post(site, "m-alice", profiles.alice, "/coin\n둘째 줄"), null);
});

test("shop commands change balances in the same transaction, and refusals reply", async () => {
  const { site, profiles } = await community();
  await install(site, "shop");
  await install(site, "shop_admin");
  const gold = await site.mutate("shop:adminCreateCurrency", { name: "골드", is_default: true }, as("m-owner"));
  const potion = await site.mutate(
    "shop:adminCreateItem",
    { name: "포션", description: "HP를 회복합니다.", price_amount: 10, currency_id: gold.id, consumable: true },
    as("m-owner"),
  );
  const balance = () =>
    site.rows("SELECT amount FROM shop_balances WHERE profile_id = ?", profiles.alice)[0]?.amount ?? 0;
  const say = (content, member = "m-alice", profile = profiles.alice) =>
    post(site, member, profile, content).then((reply) => reply?.content);

  assert.equal(await say("/balance"), "잔액이 없습니다.");
  assert.equal(await say("/buy 포션"), "잔액이 부족합니다");
  assert.equal(await say("/buy 없는거"), "상품을 찾을 수 없습니다: 없는거");
  // Only the owner grants.
  assert.equal(await say("/grant alice 25 골드"), "이 명령어를 사용할 권한이 없습니다.");
  assert.equal(balance(), 0);
  assert.equal(
    await say("/grant alice 25 골드 환영", "m-owner", profiles.owner),
    "🎁 **ALICE** 님에게 25 골드 지급되었습니다.",
  );
  assert.equal(balance(), 25);
  assert.equal(await say("/buy 포션"), "🛒 **포션** 구매 완료!");
  assert.equal(await say("/buy 포션"), "🛒 **포션** 구매 완료!");
  assert.equal(await say("/buy 포션"), "잔액이 부족합니다");
  assert.equal(balance(), 5);
  assert.equal(await say("/inventory"), "**보유 상품**\n\n- **포션** ×2 · 소모품");
  assert.equal(await say("/use 포션"), "🪄 **ALICE**님이 **포션**을(를) 사용했습니다.\n\nHP를 회복합니다.");
  assert.equal(
    site.rows("SELECT qty FROM shop_inventory WHERE profile_id = ? AND item_id = ?", profiles.alice, potion.id)[0].qty,
    1,
  );
  assert.equal(await say("/balance"), "**잔액**\n\n- **골드**: 5 (기본)");
  assert.equal(await say("/items"), "**상점**\n\n- **포션** (10 골드) — HP를 회복합니다. · 소모품");
  const kinds = site.rows("SELECT kind, actor_member FROM shop_transactions ORDER BY id");
  assert.deepEqual(kinds.map((k) => k.kind), [
    "currency_grant",
    "item_purchase",
    "item_purchase",
    "item_consume",
  ]);
  assert.equal(kinds[1].actor_member, "m-alice");
});

test("the owner makes bots and tokens; a token is shown once and kept as a hash", async () => {
  const { site } = await community();
  const make = (member) =>
    site.mutate(
      "bots:adminCreate",
      { name: "알림봇", description: "알려줘요", profile_name: "알림", profile_username: "notifier" },
      as(member),
    );
  assert.equal(await refusal(make("m-alice")), "not_owner");
  const bot = await make("m-owner");
  assert.equal(bot.profile.username, "notifier");
  assert.equal(await refusal(site.query("bots:adminList", null, as("m-alice"))), "not_moderator");
  assert.equal((await site.query("bots:adminList", null, as("m-owner")))[0].profileUsername, "notifier");

  const token = await site.mutate("bots:adminCreateToken", { bot_id: bot.id, name: "서버" }, as("m-owner"));
  assert.match(token.token, new RegExp(`^${token.id}\\.[A-Za-z0-9]{40}$`));
  const [stored] = site.rows("SELECT hash FROM bot_tokens WHERE id = ?", token.id);
  assert.notEqual(stored.hash, token.token);
  assert.ok(!stored.hash.includes(token.token));
  const detail = await site.query("bots:adminGet", { bot_id: bot.id }, as("m-owner"));
  assert.deepEqual(Object.keys(detail.tokens[0]).sort(), [
    "createdAt",
    "expiresAt",
    "id",
    "lastUsedAt",
    "name",
    "revokedAt",
  ]);

  const updated = await site.mutate("bots:adminUpdate", { bot_id: bot.id, name: "새 이름" }, as("m-owner"));
  assert.equal(updated.name, "새 이름");
  await site.mutate("bots:adminDelete", { bot_id: bot.id }, as("m-owner"));
  assert.deepEqual(await site.query("bots:adminList", null, as("m-owner")), []);
  assert.equal(
    await refusal(site.query("bot:posts", { token: token.token }, VISITOR)),
    "invalid_token",
  );
});

test("the bot API: a token acts as the bot's profile", async () => {
  const { site, profiles } = await community();
  await install(site, "coin");
  const bot = await site.mutate(
    "bots:adminCreate",
    { name: "봇", profile_name: "봇", profile_username: "bot" },
    as("m-owner"),
  );
  const { token, id: tokenId } = await site.mutate("bots:adminCreateToken", { bot_id: bot.id }, as("m-owner"));
  const wrong = `${tokenId}.${"x".repeat(40)}`;
  assert.equal(await refusal(site.query("bot:posts", { token: wrong }, VISITOR)), "invalid_token");
  assert.equal(await refusal(site.query("bot:posts", { token: "nonsense" }, VISITOR)), "invalid_token");

  site.now += 1000;
  const created = await site.mutate("bot:createPost", { token, content: "안녕하세요" }, VISITOR);
  assert.equal(created.author.username, "bot");
  assert.equal(created.content, "안녕하세요");
  assert.equal(
    site.rows("SELECT last_used_at FROM bot_tokens WHERE id = ?", tokenId)[0].last_used_at,
    site.now,
  );
  // A command in a bot's post runs too.
  site.now += 1000;
  const coin = await site.mutate("bot:createPost", { token, content: "/coin" }, VISITOR);
  const [reply] = site.rows("SELECT content FROM posts WHERE in_reply_to_id = ?", coin.id);
  assert.match(reply.content, /^🪙/);

  site.now += 1000;
  const alicePost = await site.mutate("posts:create", { profile_id: profiles.alice, content: "앨리스 글" }, as("m-alice"));
  const timeline = await site.query("bot:posts", { token, limit: 2 }, VISITOR);
  assert.equal(timeline.data[0].id, alicePost.id);
  assert.equal(timeline.pagination.has_more, true);
  assert.equal((await site.query("bot:post", { token, post_id: coin.id }, VISITOR)).replies.length, 1);

  await site.mutate("bot:addReaction", { token, post_id: alicePost.id, emoji: "👍" }, VISITOR);
  assert.equal(
    await refusal(site.mutate("bot:addReaction", { token, post_id: alicePost.id, emoji: "👍" }, VISITOR)),
    "already_reacted",
  );
  const [notification] = site.rows("SELECT type, recipient_id FROM notifications WHERE type = 'reaction'");
  assert.equal(notification.recipient_id, profiles.alice);
  await site.mutate("bot:removeReaction", { token, post_id: alicePost.id, emoji: "👍" }, VISITOR);

  assert.equal(
    await refusal(site.mutate("bot:updatePost", { token, post_id: alicePost.id, content: "x" }, VISITOR)),
    "not_post_author",
  );
  assert.equal(
    await refusal(site.mutate("bot:deletePost", { token, post_id: alicePost.id }, VISITOR)),
    "not_post_author",
  );
  const edited = await site.mutate("bot:updatePost", { token, post_id: created.id, content: "고침" }, VISITOR);
  assert.equal(edited.content, "고침");
  assert.equal(site.rows("SELECT content FROM post_history WHERE post_id = ?", created.id)[0].content, "안녕하세요");
  await site.mutate("bot:deletePost", { token, post_id: created.id }, VISITOR);
  assert.equal(await refusal(site.query("bot:post", { token, post_id: created.id }, VISITOR)), "not_found");

  // Revoked or expired tokens stop working.
  await site.mutate("bots:adminRevokeToken", { bot_id: bot.id, token_id: tokenId }, as("m-owner"));
  assert.equal(await refusal(site.query("bot:posts", { token }, VISITOR)), "invalid_token");
  const expiring = await site.mutate(
    "bots:adminCreateToken",
    { bot_id: bot.id, expires_at: new Date(site.now + 1000).toISOString() },
    as("m-owner"),
  );
  assert.equal((await site.query("bot:posts", { token: expiring.token }, VISITOR)).data.length > 0, true);
  site.now += 2000;
  assert.equal(await refusal(site.query("bot:posts", { token: expiring.token }, VISITOR)), "invalid_token");
});
