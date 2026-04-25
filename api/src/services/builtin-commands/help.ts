import { listEnabledForCommunity } from "../bot-command.service";
import type { BuiltinCommandHandler } from "./index";

export const helpList: BuiltinCommandHandler = {
  id: "help.list",
  description: "List all enabled slash commands in the community.",
  async handle(input) {
    const commands = await listEnabledForCommunity(input.post.communityId);
    if (commands.length === 0) {
      return { content: "사용 가능한 명령어가 없습니다." };
    }
    const lines = commands.map((cmd) =>
      cmd.description
        ? `- \`/${cmd.name}\` — ${cmd.description}`
        : `- \`/${cmd.name}\``,
    );
    return {
      content: `**사용 가능한 명령어**\n\n${lines.join("\n")}`,
    };
  },
};
