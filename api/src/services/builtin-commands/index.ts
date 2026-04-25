import { z } from "zod";
import { diceRoll } from "./dice-roll";

export type CommandInput = {
  args: string;
  post: {
    id: string;
    authorProfileId: string;
    rootPostId: string | null;
    communityId: string;
  };
};

export type CommandContext = Record<string, never>;

export type CommandOutput = {
  content: string;
  contentWarning?: string | null;
};

export type BuiltinCommandHandler = {
  id: string;
  description: string;
  handle: (input: CommandInput, ctx: CommandContext) => Promise<CommandOutput>;
};

export type BuiltinAppCommand = {
  defaultName: string;
  description: string;
  handlerBuiltinId: string;
};

export type BuiltinApp = {
  id: string;
  version: string;
  description: string;
  defaultProfile: { name: string; username: string };
  commands: readonly BuiltinAppCommand[];
  configSchema: z.ZodTypeAny;
};

export const BUILTIN_HANDLERS: Record<string, BuiltinCommandHandler> = {
  [diceRoll.id]: diceRoll,
};

export const BUILTIN_APPS: Record<string, BuiltinApp> = {
  dice: {
    id: "dice",
    version: "1.0.0",
    description:
      "TRPG 주사위 굴리기. /roll 3d6, 1d20+5, 2d20kh1, 4d6dl1 형식으로 사용하세요.",
    defaultProfile: { name: "DiceBot", username: "dicebot" },
    commands: [
      {
        defaultName: "roll",
        description:
          "주사위 굴리기: 3d6, 1d20+5, 2d20kh1 (어드밴티지), 4d6dl1 (최저값 버림).",
        handlerBuiltinId: diceRoll.id,
      },
    ],
    configSchema: z.object({}).strict(),
  },
};

export function getBuiltinApp(builtinId: string): BuiltinApp | undefined {
  return BUILTIN_APPS[builtinId];
}

export function getBuiltinHandler(
  handlerBuiltinId: string,
): BuiltinCommandHandler | undefined {
  return BUILTIN_HANDLERS[handlerBuiltinId];
}
