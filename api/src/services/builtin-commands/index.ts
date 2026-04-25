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

export type BuiltinAppCommandExample = {
  input: string;
  output: string;
  note?: string;
};

export type BuiltinAppCommand = {
  defaultName: string;
  description: string;
  handlerBuiltinId: string;
  requiredRole?: CommandRole;
  longDescription?: string;
  examples?: readonly BuiltinAppCommandExample[];
};

export type BuiltinApp = {
  id: string;
  version: string;
  description: string;
  longDescription?: string;
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
    longDescription:
      "TRPG 세션에서 필요한 모든 주사위 굴림을 한 명령어로 처리합니다. 일반 굴림(`XdY`), 보너스/페널티(`+N` `-N`), 어드밴티지/디스어드밴티지(`khN` `klN`), 능력치 굴림(`dlN`)까지 지원합니다.",
    defaultProfile: { name: "DiceBot", username: "dicebot" },
    commands: [
      {
        defaultName: "roll",
        description:
          "주사위 굴리기: 3d6, 1d20+5, 2d20kh1 (어드밴티지), 4d6dl1 (최저값 버림).",
        longDescription:
          "표준 다이스 표기법 `XdY`을 사용합니다. `kh`/`kl`은 가장 높은/낮은 N개 사용, `dh`/`dl`은 가장 높은/낮은 N개 버림. 보너스는 `+5`, 페널티는 `-2`처럼 끝에 붙입니다.",
        handlerBuiltinId: diceRoll.id,
        examples: [
          {
            input: "/roll 3d6",
            output: "🎲 3d6: [4, 1, 5] = 10",
            note: "기본 주사위 굴림",
          },
          {
            input: "/roll 1d20+5",
            output: "🎲 1d20+5: [12] + 5 = 17",
            note: "공격 굴림 (보너스 포함)",
          },
          {
            input: "/roll 2d20kh1",
            output: "🎲 2d20kh1: 굴림 [18, 3], 사용 [18] = 18",
            note: "어드밴티지: 높은 값 1개만 사용",
          },
          {
            input: "/roll 4d6dl1",
            output: "🎲 4d6dl1: 굴림 [3, 5, 2, 6], 사용 [3, 5, 6] = 14",
            note: "D&D 능력치: 4d6에서 가장 낮은 값 버림",
          },
        ],
      },
    ],
    configSchema: z.object({}).strict(),
  },
  help: {
    id: "help",
    version: "1.0.0",
    description: "사용 가능한 슬래시 명령어 목록을 보여줍니다.",
    longDescription:
      "이 커뮤에서 설치된 모든 슬래시 명령어를 한눈에 확인할 수 있습니다. 새로 가입한 멤버에게 어떤 봇이 작동하는지 알려주는 가장 빠른 방법입니다.",
    defaultProfile: { name: "Help", username: "help" },
    commands: [
      {
        defaultName: "help",
        description: "사용 가능한 명령어 목록을 보여줍니다.",
        longDescription:
          "현재 커뮤에 활성화된 슬래시 명령어를 마크다운 목록으로 출력합니다.",
        handlerBuiltinId: helpList.id,
        examples: [
          {
            input: "/help",
            output:
              "**사용 가능한 명령어**\n\n- `/balance` — 내 잔액을 확인합니다.\n- `/buy` — 상품을 구매합니다.\n- `/coin` — 동전을 던져 앞면/뒷면을 결정합니다.\n- `/roll` — 주사위 굴리기.\n…",
          },
        ],
      },
    ],
    configSchema: z.object({}).strict(),
  },
  coin: {
    id: "coin",
    version: "1.0.0",
    description: "동전 던지기. /coin으로 앞면 또는 뒷면을 결정합니다.",
    longDescription:
      "둘 중 하나를 정해야 할 때 빠르게 동전을 던집니다. 짜장면 vs 짬뽕, 외출할까 말까 같은 즉흥 결정에 좋습니다.",
    defaultProfile: { name: "CoinBot", username: "coinbot" },
    commands: [
      {
        defaultName: "coin",
        description: "동전을 던져 앞면/뒷면을 결정합니다.",
        handlerBuiltinId: coinFlip.id,
        examples: [
          { input: "/coin", output: "🪙 앞면" },
          { input: "/coin", output: "🪙 뒷면", note: "50/50 확률" },
        ],
      },
    ],
    configSchema: z.object({}).strict(),
  },
  choose: {
    id: "choose",
    version: "1.0.0",
    description:
      "주어진 옵션 중 하나를 무작위로 선택합니다. 예: /choose 짜장, 짬뽕",
    longDescription:
      "여러 후보 중에서 하나를 무작위로 골라줍니다. 점심 메뉴, 다음에 볼 영화, 추첨처럼 결정 못 하는 모든 순간에 유용합니다. 옵션은 공백 또는 쉼표로 구분합니다.",
    defaultProfile: { name: "ChooseBot", username: "choosebot" },
    commands: [
      {
        defaultName: "choose",
        description:
          "옵션 중 하나를 무작위로 선택합니다 (쉼표 또는 공백으로 구분).",
        handlerBuiltinId: choosePick.id,
        examples: [
          {
            input: "/choose 짜장 짬뽕 볶음밥",
            output: "🎯 볶음밥",
            note: "공백으로 구분",
          },
          {
            input: "/choose 가위, 바위, 보",
            output: "🎯 보",
            note: "쉼표로 구분 (옵션에 공백을 포함하고 싶을 때)",
          },
        ],
      },
    ],
    configSchema: z.object({}).strict(),
  },
  shop: {
    id: "shop",
    version: "1.1.0",
    description:
      "커뮤 상점. /balance로 잔액 확인, /items로 상품 목록, /buy <이름>으로 구매, /inventory로 보유 확인, /use <이름>으로 사용.",
    longDescription:
      "커뮤니티 안에서 통화를 모으고 상품을 사고 자랑할 수 있는 상점 시스템. 소유자가 통화와 상품을 정의하면 멤버는 슬래시 명령으로 잔액을 확인하고, 구매하고, 보유 상품을 꺼내 보일 수 있습니다. 상품에는 설명(로어)을 붙일 수 있어서 RP에도 잘 어울립니다.",
    defaultProfile: { name: "ShopBot", username: "shopbot" },
    commands: [
      {
        defaultName: "balance",
        description: "내 잔액을 확인합니다.",
        longDescription:
          "내 프로필이 보유한 모든 통화의 잔액을 보여줍니다. 기본 통화에는 `(기본)` 표시가 붙습니다.",
        handlerBuiltinId: shopBalance.id,
        examples: [
          {
            input: "/balance",
            output: "**잔액**\n\n- **골드**: 250 (기본)\n- **별점**: 12",
          },
        ],
      },
      {
        defaultName: "items",
        description: "판매 중인 상품 목록을 봅니다.",
        longDescription:
          "상점에 등록된 모든 상품을 가격, 통화, 속성과 함께 보여줍니다.",
        handlerBuiltinId: shopItems.id,
        examples: [
          {
            input: "/items",
            output:
              "**상점**\n\n- **검** (100 골드) — 번뜩이는 직검 · 유니크\n- **포션** (10 골드) — HP를 회복합니다 · 소모품",
          },
        ],
      },
      {
        defaultName: "buy",
        description: "상품을 구매합니다. 사용법: /buy <상품 이름>",
        longDescription:
          "잔액이 충분하면 상품을 구매합니다. 잔액 부족이나 이미 보유 중인 유니크 상품의 경우 사유를 알려줍니다.",
        handlerBuiltinId: shopBuy.id,
        examples: [
          { input: "/buy 검", output: "🛒 **검** 구매 완료!" },
          {
            input: "/buy 검",
            output: "이미 보유 중인 상품입니다",
            note: "유니크 상품은 한 번만 구매 가능",
          },
          {
            input: "/buy 포션",
            output: "잔액이 부족합니다",
            note: "잔액 부족 시",
          },
        ],
      },
      {
        defaultName: "inventory",
        description: "보유 중인 상품 목록을 봅니다.",
        longDescription:
          "내가 보유한 모든 상품을 수량과 함께 보여줍니다. 다른 사람의 보유 상품은 그 사람의 프로필 페이지에서 확인할 수 있습니다.",
        handlerBuiltinId: shopInventory.id,
        examples: [
          {
            input: "/inventory",
            output: "**보유 상품**\n\n- **검** ×1\n- **포션** ×3 · 소모품",
          },
        ],
      },
      {
        defaultName: "use",
        description:
          "보유한 상품을 사용/꺼내 보입니다. 소모품은 1개 차감됩니다. 사용법: /use <상품 이름>",
        longDescription:
          '보유한 상품을 "사용"합니다. 소모품(consumable)은 1개 차감되고 사용 메시지가 게시됩니다. 소모품이 아닌 상품은 차감 없이 "꺼내 보였습니다"로 표시되며 RP에 활용할 수 있습니다. 상품 설명(로어)이 결과 메시지에 함께 표시됩니다.',
        handlerBuiltinId: shopUse.id,
        examples: [
          {
            input: "/use 검",
            output:
              "🪄 **홍길동**님이 **검**을(를) 꺼내 보였습니다.\n\n번뜩이는 직검",
            note: "소모품이 아닌 상품: 차감 없이 자랑하기 용도",
          },
          {
            input: "/use 포션",
            output:
              "🪄 **홍길동**님이 **포션**을(를) 사용했습니다.\n\nHP를 회복합니다.",
            note: "소모품: 1개 차감",
          },
        ],
      },
    ],
    configSchema: z.object({}).strict(),
  },
  shop_admin: {
    id: "shop_admin",
    version: "1.0.0",
    description:
      "상점 관리 명령어. 소유자가 슬래시 명령으로 통화를 지급할 수 있습니다.",
    longDescription:
      "상점을 운영하는 소유자를 위한 관리 명령어 모음입니다. 콘솔의 상점 페이지에서도 같은 작업을 할 수 있지만, 게시물 흐름에서 빠르게 처리하고 싶을 때 유용합니다.",
    defaultProfile: { name: "ShopAdmin", username: "shopadmin" },
    commands: [
      {
        defaultName: "grant",
        description:
          "소유자 전용. 사용법: /grant <사용자명> <금액> <통화> [사유]",
        longDescription:
          "특정 멤버에게 통화를 지급합니다. 인자는 `<사용자명> <금액> <통화 이름> [사유]` 순서이며, 사유는 거래 내역에 함께 기록됩니다. **소유자만 사용 가능합니다.**",
        handlerBuiltinId: shopAdminGrant.id,
        requiredRole: "owner",
        examples: [
          {
            input: "/grant alice 100 골드 신규 가입 환영",
            output: "🎁 **앨리스** 님에게 100 골드 지급되었습니다.",
            note: "사유는 거래 내역에 기록됨",
          },
          {
            input: "/grant bob 50 별점",
            output: "🎁 **밥** 님에게 50 별점 지급되었습니다.",
            note: "사유 생략 가능",
          },
        ],
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
