import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { appAuthMiddleware } from "../../middleware/auth";
import { communityMiddleware } from "../../middleware/community";
import { membershipMiddleware } from "../../middleware/membership";
import * as profileService from "../../services/profile.service";
import * as shopService from "../../services/shop.service";
import type { AuthVariables } from "../../types";
import { GeneralErrorCode } from "../../types/api-responses";

const summaryQuerySchema = z.object({
  profile_id: z.uuid(),
});

const buySchema = z.object({
  profile_id: z.uuid(),
  item_id: z.uuid(),
});

export const shopRouter = new Hono<{ Variables: AuthVariables }>()
  .get(
    "/shop",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("query", summaryQuerySchema),
    async (c) => {
      const community = c.get("community");
      const user = c.get("user");
      const { profile_id } = c.req.valid("query");

      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        true,
      );
      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      const [currencies, items, balances, inventory] = await Promise.all([
        shopService.listCurrencies(community.id),
        shopService.listItems(community.id),
        shopService.listBalancesForProfile(community.id, profile.id),
        shopService.listInventoryForProfile(community.id, profile.id),
      ]);

      const defaultCurrency = currencies.find((c) => c.isDefault) ?? null;

      return c.json({
        data: {
          default_currency: defaultCurrency,
          currencies,
          items,
          balances,
          inventory,
          has_currency: currencies.length > 0,
          has_items: items.length > 0,
        },
      });
    },
  )
  .post(
    "/shop/buy",
    communityMiddleware,
    appAuthMiddleware,
    membershipMiddleware,
    zValidator("json", buySchema),
    async (c) => {
      const community = c.get("community");
      const user = c.get("user");
      const { profile_id, item_id } = c.req.valid("json");

      const profile = await profileService.validateAndGetProfile(
        user.id,
        profile_id,
        community.id,
        true,
      );
      if (!profile) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.PROFILE_NOT_FOUND,
              message: "프로필을 찾을 수 없거나 귀하의 소유가 아닙니다",
            },
          },
          404,
        );
      }

      const item = await shopService.purchaseItem({
        communityId: community.id,
        profileId: profile.id,
        itemId: item_id,
        actorUserId: user.id,
      });
      return c.json({ data: { item } });
    },
  );
