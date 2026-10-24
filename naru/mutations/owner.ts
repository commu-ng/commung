// What only the site's owner does, signed in as the owner (`admin` handle):
// opening the community and claiming its owner membership. Everything else
// the community's owner does as a member whose role is `owner`.
import { requireSiteOwner } from "../modules/access.js";
import { settingsJson, settingsOf } from "../modules/community.js";
import {
  argsOf,
  invalid,
  type MutationCtx,
  msOf,
  optionalText,
  text,
} from "../modules/core.js";

/** Opens the community with its name and dates, once (commung's create). */
export async function setup(ctx: MutationCtx, args: unknown) {
  requireSiteOwner(ctx);
  if (await settingsOf(ctx)) invalid(ctx, "이미 개설된 커뮤입니다.", "already_set_up");
  const a = argsOf(args);
  const name = text(ctx, a.name, "커뮤 이름", { max: 100 });
  const description = optionalText(ctx, a.description, "커뮤 설명", {
    max: 10000,
  });
  const startsAt = msOf(ctx, a.starts_at, "시작일") ?? ctx.now;
  const endsAt = msOf(ctx, a.ends_at, "종료일");
  if (endsAt === null || endsAt <= startsAt)
    invalid(ctx, "종료일은 시작일 이후여야 합니다.");
  await ctx.sql`
    INSERT INTO settings (id, name, description, starts_at, ends_at, created_at, updated_at)
    VALUES (1, ${name}, ${description}, ${startsAt}, ${endsAt}, ${ctx.now}, ${ctx.now})`;
  return settingsJson(ctx, await settingsOf(ctx));
}

/**
 * Makes `member` (the owner's own member ID, from the member sign-in on the
 * same page) the community's owner; a previous owner stays a member.
 */
export async function claim(ctx: MutationCtx, args: unknown) {
  requireSiteOwner(ctx);
  const member = text(ctx, argsOf(args).member, "member", { max: 200 });
  await ctx.sql`
    UPDATE members SET role = 'member', updated_at = ${ctx.now}
    WHERE role = 'owner' AND member <> ${member}`;
  await ctx.sql`
    INSERT INTO members (member, role, created_at, updated_at, activated_at)
    VALUES (${member}, 'owner', ${ctx.now}, ${ctx.now}, ${ctx.now})
    ON CONFLICT (member) DO UPDATE SET role = 'owner', updated_at = excluded.updated_at`;
  return { member, role: "owner" };
}
