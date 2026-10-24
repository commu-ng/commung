// The bot API's reads (commung's /bot/communities/:id/posts): visitor calls
// that carry a bot token, `{ token, ... }`. Naru limits visitors' calls to
// 20 a minute per address.
import { authenticateBot, botPost, botTimeline } from "../modules/bots.js";
import {
  argsOf,
  id,
  limitOf,
  optionalId,
  type QueryCtx,
} from "../modules/core.js";

/** The timeline's posts, newest first (GET /posts). */
export async function posts(ctx: QueryCtx, args: unknown) {
  const a = argsOf(args);
  const caller = await authenticateBot(ctx, a.token);
  return await botTimeline(
    ctx,
    caller,
    limitOf(a.limit, 20, 100),
    optionalId(ctx, a.cursor, "cursor"),
  );
}

/** One post (GET /posts/:postId). */
export async function post(ctx: QueryCtx, args: unknown) {
  const a = argsOf(args);
  const caller = await authenticateBot(ctx, a.token);
  return await botPost(ctx, caller, id(ctx, a.post_id, "post_id"));
}
