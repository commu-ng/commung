// Writing posts, shared by the posts area's mutations and the bot API: the
// posts area replaces this stub.
import type { MutationCtx } from "./core.js";

export interface NewPost {
  authorProfileId: string;
  /** The member writing (commung's created_by_user_id); a bot's creator. */
  actorMember: string;
  content: string;
  contentWarning?: string | null;
  inReplyToId?: string | null;
  imageIds?: string[];
  announcement?: boolean;
  scheduledAt?: number | null;
}

/** Writes a post with its images, mentions, hashtags and notifications; answers its ID. */
export async function createPost(
  ctx: MutationCtx,
  _post: NewPost,
): Promise<string> {
  return ctx.fail("UNAVAILABLE", "아직 준비 중입니다.");
}
