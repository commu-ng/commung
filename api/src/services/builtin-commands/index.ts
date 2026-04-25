import { z } from "zod";
import { choosePick } from "./choose";
import { coinFlip } from "./coin";
import { diceRoll } from "./dice-roll";
import { helpList } from "./help";
import {
  shopBalance,
  shopBuy,
  shopInventory,
  shopItems,
  shopUse,
} from "./shop";
import { shopAdminGrant } from "./shop-admin";

export type CommandInput = {
  args: string;
  post: {
    id: string;
    authorProfileId: string;
    rootPostId: string | null;
    communityId: string;
  };
};

export type ShopBalanceView = {
  currencyId: string;
  currencyName: string;
  isDefault: boolean;
  amount: number;
};

export type ShopItemView = {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currencyName: string;
  consumable: boolean;
  isUnique: boolean;
};

export type ShopInventoryView = {
  itemId: string;
  itemName: string;
  qty: number;
  consumable: boolean;
};

export type ShopContext = {
  listBalances(profileId: string): Promise<ShopBalanceView[]>;
  listItems(): Promise<ShopItemView[]>;
  listInventory(profileId: string): Promise<ShopInventoryView[]>;
  getItemByName(name: string): Promise<ShopItemView | null>;
  purchaseItemByName(
    profileId: string,
    name: string,
  ): Promise<{ name: string }>;
  useItemByName(
    profileId: string,
    name: string,
  ): Promise<{
    profileName: string;
    itemName: string;
    itemDescription: string | null;
    consumed: boolean;
  }>;
  findProfileByUsername(
    username: string,
  ): Promise<{ id: string; username: string; name: string } | null>;
  findCurrencyByName(
    name: string,
  ): Promise<{ id: string; name: string } | null>;
  grantCurrency(
    profileId: string,
    currencyId: string,
    amount: number,
    reason: string | null,
  ): Promise<void>;
};

export type CommandContext = {
  shop: ShopContext;
};

export type CommandOutput = {
  content: string;
  contentWarning?: string | null;
};

export type BuiltinCommandHandler = {
  id: string;
  description: string;
  handle: (input: CommandInput, ctx: CommandContext) => Promise<CommandOutput>;
};

export type CommandRole = "owner" | "moderator";

export type BuiltinAppCommand = {
  defaultName: string;
  description: string;
  handlerBuiltinId: string;
  requiredRole?: CommandRole;
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
  [shopBalance.id]: shopBalance,
  [shopItems.id]: shopItems,
  [shopBuy.id]: shopBuy,
  [shopInventory.id]: shopInventory,
  [shopUse.id]: shopUse,
  [shopAdminGrant.id]: shopAdminGrant,
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
  shop: {
    id: "shop",
    version: "1.1.0",
    description:
      "커뮤 상점. /balance로 잔액 확인, /items로 상품 목록, /buy <이름>으로 구매, /inventory로 보유 확인, /use <이름>으로 사용.",
    defaultProfile: { name: "ShopBot", username: "shopbot" },
    commands: [
      {
        defaultName: "balance",
        description: "내 잔액을 확인합니다.",
        handlerBuiltinId: shopBalance.id,
      },
      {
        defaultName: "items",
        description: "판매 중인 상품 목록을 봅니다.",
        handlerBuiltinId: shopItems.id,
      },
      {
        defaultName: "buy",
        description: "상품을 구매합니다. 사용법: /buy <상품 이름>",
        handlerBuiltinId: shopBuy.id,
      },
      {
        defaultName: "inventory",
        description: "보유 중인 상품 목록을 봅니다.",
        handlerBuiltinId: shopInventory.id,
      },
      {
        defaultName: "use",
        description:
          "보유한 상품을 사용/꺼내 보입니다. 소모품은 1개 차감됩니다. 사용법: /use <상품 이름>",
        handlerBuiltinId: shopUse.id,
      },
    ],
    configSchema: z.object({}).strict(),
  },
  shop_admin: {
    id: "shop_admin",
    version: "1.0.0",
    description:
      "상점 관리 명령어. 소유자가 슬래시 명령으로 통화를 지급할 수 있습니다.",
    defaultProfile: { name: "ShopAdmin", username: "shopadmin" },
    commands: [
      {
        defaultName: "grant",
        description:
          "소유자 전용. 사용법: /grant <사용자명> <금액> <통화> [사유]",
        handlerBuiltinId: shopAdminGrant.id,
        requiredRole: "owner",
      },
    ],
    configSchema: z.object({}).strict(),
  },
};

export function getRequiredRoleForHandler(
  handlerBuiltinId: string,
): CommandRole | undefined {
  for (const app of Object.values(BUILTIN_APPS)) {
    for (const cmd of app.commands) {
      if (cmd.handlerBuiltinId === handlerBuiltinId) {
        return cmd.requiredRole;
      }
    }
  }
  return undefined;
}

export function getBuiltinApp(builtinId: string): BuiltinApp | undefined {
  return BUILTIN_APPS[builtinId];
}

export function getBuiltinHandler(
  handlerBuiltinId: string,
): BuiltinCommandHandler | undefined {
  return BUILTIN_HANDLERS[handlerBuiltinId];
}
