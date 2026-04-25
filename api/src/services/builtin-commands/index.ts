import { z } from "zod";
import { choosePick } from "./choose";
import { coinFlip } from "./coin";
import { diceRoll } from "./dice-roll";
import { helpList } from "./help";

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
  [helpList.id]: helpList,
  [coinFlip.id]: coinFlip,
  [choosePick.id]: choosePick,
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
  help: {
    id: "help",
    version: "1.0.0",
    description: "사용 가능한 슬래시 명령어 목록을 보여줍니다.",
    defaultProfile: { name: "Help", username: "help" },
    commands: [
      {
        defaultName: "help",
        description: "사용 가능한 명령어 목록을 보여줍니다.",
        handlerBuiltinId: helpList.id,
      },
    ],
    configSchema: z.object({}).strict(),
  },
  coin: {
    id: "coin",
    version: "1.0.0",
    description: "동전 던지기. /coin으로 앞면 또는 뒷면을 결정합니다.",
    defaultProfile: { name: "CoinBot", username: "coinbot" },
    commands: [
      {
        defaultName: "coin",
        description: "동전을 던져 앞면/뒷면을 결정합니다.",
        handlerBuiltinId: coinFlip.id,
      },
    ],
    configSchema: z.object({}).strict(),
  },
  choose: {
    id: "choose",
    version: "1.0.0",
    description:
      "주어진 옵션 중 하나를 무작위로 선택합니다. 예: /choose 짜장, 짬뽕",
    defaultProfile: { name: "ChooseBot", username: "choosebot" },
    commands: [
      {
        defaultName: "choose",
        description:
          "옵션 중 하나를 무작위로 선택합니다 (쉼표 또는 공백으로 구분).",
        handlerBuiltinId: choosePick.id,
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
