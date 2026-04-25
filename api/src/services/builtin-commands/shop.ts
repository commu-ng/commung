import { AppException } from "../../exception";
import type { BuiltinCommandHandler } from "./index";

export const shopBalance: BuiltinCommandHandler = {
  id: "shop.balance",
  description: "Show the caller's balances across all currencies.",
  async handle(input, ctx) {
    const balances = await ctx.shop.listBalances(input.post.authorProfileId);
    if (balances.length === 0) {
      return { content: "잔액이 없습니다." };
    }
    const lines = balances.map(
      (b) =>
        `- **${b.currencyName}**: ${b.amount}${b.isDefault ? " (기본)" : ""}`,
    );
    return { content: `**잔액**\n\n${lines.join("\n")}` };
  },
};

export const shopItems: BuiltinCommandHandler = {
  id: "shop.items",
  description: "List items for sale in the community shop.",
  async handle(_input, ctx) {
    const items = await ctx.shop.listItems();
    if (items.length === 0) {
      return { content: "판매 중인 상품이 없습니다." };
    }
    const lines = items.map((i) => {
      const tags: string[] = [];
      if (i.consumable) tags.push("소모품");
      if (i.isUnique) tags.push("유니크");
      const tagStr = tags.length > 0 ? ` · ${tags.join(", ")}` : "";
      const desc = i.description ? ` — ${i.description}` : "";
      return `- **${i.name}** (${i.priceAmount} ${i.currencyName})${desc}${tagStr}`;
    });
    return { content: `**상점**\n\n${lines.join("\n")}` };
  },
};

export const shopBuy: BuiltinCommandHandler = {
  id: "shop.buy",
  description: "Buy an item by name from the community shop.",
  async handle(input, ctx) {
    const name = input.args.trim();
    if (!name) {
      return { content: "사용법: `/buy <상품 이름>`" };
    }
    try {
      const result = await ctx.shop.purchaseItemByName(
        input.post.authorProfileId,
        name,
      );
      return { content: `🛒 **${result.name}** 구매 완료!` };
    } catch (err) {
      if (err instanceof AppException) {
        return { content: err.message };
      }
      return { content: "구매에 실패했습니다." };
    }
  },
};

export const shopInventory: BuiltinCommandHandler = {
  id: "shop.inventory",
  description: "List items the caller currently owns.",
  async handle(input, ctx) {
    const inventory = await ctx.shop.listInventory(input.post.authorProfileId);
    if (inventory.length === 0) {
      return { content: "보유 중인 상품이 없습니다." };
    }
    const lines = inventory.map(
      (i) => `- **${i.itemName}** ×${i.qty}${i.consumable ? " · 소모품" : ""}`,
    );
    return { content: `**보유 상품**\n\n${lines.join("\n")}` };
  },
};
