import type { BuiltinCommandHandler } from "./index";

const MAX_OPTIONS = 100;
const MAX_OPTION_LENGTH = 100;
const USAGE =
  "사용법: `/choose 옵션1 옵션2 ...` 또는 `/choose 옵션1, 옵션2, 옵션3`";

function parseOptions(args: string): string[] {
  const trimmed = args.trim();
  if (!trimmed) return [];
  const raw = trimmed.includes(",") ? trimmed.split(",") : trimmed.split(/\s+/);
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= MAX_OPTION_LENGTH)
    .slice(0, MAX_OPTIONS);
}

export const choosePick: BuiltinCommandHandler = {
  id: "choose.pick",
  description: "Pick one item at random from a comma- or space-separated list.",
  async handle(input) {
    const options = parseOptions(input.args);
    if (options.length === 0) {
      return { content: USAGE };
    }
    if (options.length === 1) {
      return { content: `🎯 ${options[0]}` };
    }
    const picked = options[Math.floor(Math.random() * options.length)];
    return { content: `🎯 ${picked}` };
  },
};
