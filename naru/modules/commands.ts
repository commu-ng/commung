// Slash commands in posts (commung's builtin-commands): the boards/shop area
// replaces this stub. The posts area calls it after a post is published.
import type { MutationCtx } from "./core.js";

export interface CommandTrigger {
  /** The post that may hold a command. */
  id: string;
  content: string;
  authorProfileId: string;
  /** The member who wrote it (null for a bot). */
  actorMember: string | null;
  rootPostId: string | null;
}

/**
 * The reply a command in `trigger` answers with, as the installed app's bot
 * profile, or null when the post holds no command. The caller writes the
 * reply as a post in reply to `trigger.id`.
 */
export async function commandReply(
  _ctx: MutationCtx,
  _trigger: CommandTrigger,
): Promise<{ authorProfileId: string; content: string } | null> {
  return null;
}
