import { AppException } from "../../exception";
import type { BuiltinCommandHandler } from "./index";

const USAGE = "사용법: `/grant <사용자명> <금액> <통화> [사유]`";

export const shopAdminGrant: BuiltinCommandHandler = {
  id: "shop_admin.grant",
  description: "Grant currency to a profile by username (owner only).",
  async handle(input, ctx) {
    const args = input.args.trim();
    const match = args.match(/^(\S+)\s+(\d+)\s+(\S+)(?:\s+([\s\S]+))?$/);
    if (!match) return { content: USAGE };
    const [, username, amountStr, currencyName, reason] = match;
    if (!username || !amountStr || !currencyName) return { content: USAGE };

    const amount = Number.parseInt(amountStr, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { content: "금액은 1 이상의 정수여야 합니다." };
    }

    const profile = await ctx.shop.findProfileByUsername(username);
    if (!profile) {
      return { content: `사용자를 찾을 수 없습니다: ${username}` };
    }

    const currency = await ctx.shop.findCurrencyByName(currencyName);
    if (!currency) {
      return { content: `통화를 찾을 수 없습니다: ${currencyName}` };
    }

    try {
      await ctx.shop.grantCurrency(
        profile.id,
        currency.id,
        amount,
        reason ?? null,
      );
      return {
        content: `🎁 **${profile.name}** 님에게 ${amount} ${currency.name} 지급되었습니다.`,
      };
    } catch (err) {
      if (err instanceof AppException) {
        return { content: err.message };
      }
      return { content: "지급에 실패했습니다." };
    }
  },
};
