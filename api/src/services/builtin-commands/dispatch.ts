import * as botCommandService from "../bot-command.service";
import * as postService from "../post.service";
import { getBuiltinHandler } from "./index";

const SLASH_COMMAND_PATTERN = /^\/([a-z][a-z0-9_-]{0,30})(?:\s+([\s\S]*))?$/i;
const HANDLER_TIMEOUT_MS = 2000;

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
        {},
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
): Promise<void> {
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

  try {
    await postService.createPost(
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
  }
}
