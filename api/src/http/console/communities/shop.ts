import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import * as shopService from "../../../services/shop.service";

const communityIdParamSchema = z.object({ id: z.string().min(1) });
const currencyIdParamSchema = z.object({
  id: z.string().min(1),
  currencyId: z.uuid(),
});
const itemIdParamSchema = z.object({
  id: z.string().min(1),
  itemId: z.uuid(),
});

const currencyCreateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).nullable().optional(),
  is_default: z.boolean().optional(),
});

const currencyUpdateSchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().max(500).nullable().optional(),
    is_default: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "변경할 필드가 없습니다",
  });

const itemCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  price_amount: z.number().int().positive().max(1_000_000_000),
  currency_id: z.uuid(),
  consumable: z.boolean().optional(),
  is_unique: z.boolean().optional(),
});

const itemUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).nullable().optional(),
    price_amount: z.number().int().positive().max(1_000_000_000).optional(),
    currency_id: z.uuid().optional(),
    consumable: z.boolean().optional(),
    is_unique: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "변경할 필드가 없습니다",
  });

const grantSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("currency"),
    profile_id: z.uuid(),
    currency_id: z.uuid(),
    amount: z.number().int().positive().max(1_000_000_000),
    reason: z.string().max(500).nullable().optional(),
  }),
  z.object({
    kind: z.literal("item"),
    profile_id: z.uuid(),
    item_id: z.uuid(),
    qty: z.number().int().positive().max(1000).optional(),
    reason: z.string().max(500).nullable().optional(),
  }),
]);

const transactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
  profile_id: z.uuid().optional(),
});

export const shopRouter = new Hono()
  .get(
    "/:id/shop/currencies",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);
      const data = await shopService.listCurrencies(community.id);
      return c.json({ data });
    },
  )
  .post(
    "/:id/shop/currencies",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", currencyCreateSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const body = c.req.valid("json");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);
      const data = await shopService.createCurrency(community.id, {
        name: body.name,
        description: body.description ?? null,
        isDefault: body.is_default,
      });
      return c.json({ data }, 201);
    },
  )
  .patch(
    "/:id/shop/currencies/:currencyId",
    authMiddleware,
    zValidator("param", currencyIdParamSchema),
    zValidator("json", currencyUpdateSchema),
    async (c) => {
      const { id: slug, currencyId } = c.req.valid("param");
      const user = c.get("user");
      const body = c.req.valid("json");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);
      const data = await shopService.updateCurrency(community.id, currencyId, {
        name: body.name,
        description: body.description,
        isDefault: body.is_default,
      });
      return c.json({ data });
    },
  )
  .delete(
    "/:id/shop/currencies/:currencyId",
    authMiddleware,
    zValidator("param", currencyIdParamSchema),
    async (c) => {
      const { id: slug, currencyId } = c.req.valid("param");
      const user = c.get("user");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);
      await shopService.deleteCurrency(community.id, currencyId);
      return c.body(null, 204);
    },
  )

  .get(
    "/:id/shop/items",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);
      const data = await shopService.listItems(community.id);
      return c.json({ data });
    },
  )
  .post(
    "/:id/shop/items",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", itemCreateSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const body = c.req.valid("json");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);
      const data = await shopService.createItem(community.id, {
        name: body.name,
        description: body.description ?? null,
        priceAmount: body.price_amount,
        currencyId: body.currency_id,
        consumable: body.consumable,
        isUnique: body.is_unique,
      });
      return c.json({ data }, 201);
    },
  )
  .patch(
    "/:id/shop/items/:itemId",
    authMiddleware,
    zValidator("param", itemIdParamSchema),
    zValidator("json", itemUpdateSchema),
    async (c) => {
      const { id: slug, itemId } = c.req.valid("param");
      const user = c.get("user");
      const body = c.req.valid("json");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);
      const data = await shopService.updateItem(community.id, itemId, {
        name: body.name,
        description: body.description,
        priceAmount: body.price_amount,
        currencyId: body.currency_id,
        consumable: body.consumable,
        isUnique: body.is_unique,
      });
      return c.json({ data });
    },
  )
  .delete(
    "/:id/shop/items/:itemId",
    authMiddleware,
    zValidator("param", itemIdParamSchema),
    async (c) => {
      const { id: slug, itemId } = c.req.valid("param");
      const user = c.get("user");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);
      await shopService.deleteItem(community.id, itemId);
      return c.body(null, 204);
    },
  )

  .post(
    "/:id/shop/grants",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", grantSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const body = c.req.valid("json");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      if (body.kind === "currency") {
        await shopService.grantCurrency({
          communityId: community.id,
          profileId: body.profile_id,
          currencyId: body.currency_id,
          amount: body.amount,
          source: "owner_grant",
          actorUserId: user.id,
          reason: body.reason ?? null,
        });
      } else {
        await shopService.grantItem({
          communityId: community.id,
          profileId: body.profile_id,
          itemId: body.item_id,
          qty: body.qty,
          source: "owner_grant",
          actorUserId: user.id,
          reason: body.reason ?? null,
        });
      }
      return c.body(null, 204);
    },
  )

  .get(
    "/:id/shop/transactions",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("query", transactionsQuerySchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const { limit, cursor, profile_id } = c.req.valid("query");
      const community =
        await communityService.validateCommunityExistsBySlug(slug);
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);
      const result = await shopService.listTransactions(community.id, {
        limit,
        cursor,
        profileId: profile_id,
      });
      return c.json({
        data: result.data,
        pagination: {
          next_cursor: result.nextCursor,
          has_more: result.hasMore,
        },
      });
    },
  );
