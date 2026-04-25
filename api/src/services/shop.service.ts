import { and, asc, desc, eq, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "../db";
import {
  shopBalance,
  shopCurrency,
  shopInventory,
  shopItem,
  shopTransaction,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GeneralErrorCode } from "../types/api-responses";

export type CurrencyRow = typeof shopCurrency.$inferSelect;
export type ItemRow = typeof shopItem.$inferSelect;
export type BalanceRow = typeof shopBalance.$inferSelect;
export type InventoryRow = typeof shopInventory.$inferSelect;
export type TransactionRow = typeof shopTransaction.$inferSelect;

export type GrantSource =
  | "owner_grant"
  | "bot_grant"
  | "post_reward"
  | "refund";

const NAME_MAX = 100;
const CURRENCY_NAME_MAX = 50;
const DESC_MAX = 1000;
const REASON_MAX = 500;
const MAX_AMOUNT = 1_000_000_000;

// ---------- Currency CRUD ----------

export async function listCurrencies(communityId: string) {
  return db
    .select()
    .from(shopCurrency)
    .where(
      and(
        eq(shopCurrency.communityId, communityId),
        isNull(shopCurrency.deletedAt),
      ),
    )
    .orderBy(desc(shopCurrency.isDefault), asc(shopCurrency.name));
}

export async function getCurrency(communityId: string, currencyId: string) {
  const [row] = await db
    .select()
    .from(shopCurrency)
    .where(
      and(
        eq(shopCurrency.id, currencyId),
        eq(shopCurrency.communityId, communityId),
        isNull(shopCurrency.deletedAt),
      ),
    );
  return row;
}

export async function getCurrencyByName(communityId: string, name: string) {
  const [row] = await db
    .select()
    .from(shopCurrency)
    .where(
      and(
        eq(shopCurrency.communityId, communityId),
        sql`LOWER(${shopCurrency.name}) = ${name.toLowerCase()}`,
        isNull(shopCurrency.deletedAt),
      ),
    );
  return row;
}

export async function getDefaultCurrency(communityId: string) {
  const [row] = await db
    .select()
    .from(shopCurrency)
    .where(
      and(
        eq(shopCurrency.communityId, communityId),
        eq(shopCurrency.isDefault, true),
        isNull(shopCurrency.deletedAt),
      ),
    );
  return row;
}

export async function createCurrency(
  communityId: string,
  params: { name: string; description?: string | null; isDefault?: boolean },
) {
  const name = params.name.trim();
  if (!name || name.length > CURRENCY_NAME_MAX) {
    throw new AppException(
      400,
      GeneralErrorCode.INVALID_REQUEST,
      `통화 이름은 1~${CURRENCY_NAME_MAX}자여야 합니다`,
    );
  }
  if (params.description && params.description.length > 500) {
    throw new AppException(
      400,
      GeneralErrorCode.INVALID_REQUEST,
      "통화 설명은 500자 이하여야 합니다",
    );
  }

  return db.transaction(async (tx) => {
    if (params.isDefault) {
      await tx
        .update(shopCurrency)
        .set({ isDefault: false, updatedAt: sql`now()` })
        .where(
          and(
            eq(shopCurrency.communityId, communityId),
            eq(shopCurrency.isDefault, true),
            isNull(shopCurrency.deletedAt),
          ),
        );
    }
    const [row] = await tx
      .insert(shopCurrency)
      .values({
        communityId,
        name,
        description: params.description ?? null,
        isDefault: params.isDefault ?? false,
      })
      .returning();
    return row;
  });
}

export async function updateCurrency(
  communityId: string,
  currencyId: string,
  params: { name?: string; description?: string | null; isDefault?: boolean },
) {
  await validateCurrencyExists(communityId, currencyId);
  return db.transaction(async (tx) => {
    if (params.isDefault === true) {
      await tx
        .update(shopCurrency)
        .set({ isDefault: false, updatedAt: sql`now()` })
        .where(
          and(
            eq(shopCurrency.communityId, communityId),
            eq(shopCurrency.isDefault, true),
            ne(shopCurrency.id, currencyId),
            isNull(shopCurrency.deletedAt),
          ),
        );
    }
    const updates: Record<string, unknown> = { updatedAt: sql`now()` };
    if (params.name !== undefined) {
      const trimmed = params.name.trim();
      if (!trimmed || trimmed.length > CURRENCY_NAME_MAX) {
        throw new AppException(
          400,
          GeneralErrorCode.INVALID_REQUEST,
          `통화 이름은 1~${CURRENCY_NAME_MAX}자여야 합니다`,
        );
      }
      updates.name = trimmed;
    }
    if (params.description !== undefined) {
      updates.description = params.description;
    }
    if (params.isDefault !== undefined) {
      updates.isDefault = params.isDefault;
    }
    const [row] = await tx
      .update(shopCurrency)
      .set(updates)
      .where(
        and(
          eq(shopCurrency.id, currencyId),
          eq(shopCurrency.communityId, communityId),
          isNull(shopCurrency.deletedAt),
        ),
      )
      .returning();
    return row;
  });
}

export async function deleteCurrency(communityId: string, currencyId: string) {
  await validateCurrencyExists(communityId, currencyId);
  await db
    .update(shopCurrency)
    .set({ deletedAt: sql`now()`, isDefault: false })
    .where(
      and(
        eq(shopCurrency.id, currencyId),
        eq(shopCurrency.communityId, communityId),
        isNull(shopCurrency.deletedAt),
      ),
    );
}

async function validateCurrencyExists(communityId: string, currencyId: string) {
  const row = await getCurrency(communityId, currencyId);
  if (!row) {
    throw new AppException(
      404,
      GeneralErrorCode.NOT_FOUND,
      "통화를 찾을 수 없습니다",
    );
  }
  return row;
}

// ---------- Item CRUD ----------

export async function listItems(communityId: string) {
  return db
    .select({
      id: shopItem.id,
      communityId: shopItem.communityId,
      name: shopItem.name,
      description: shopItem.description,
      priceAmount: shopItem.priceAmount,
      currencyId: shopItem.currencyId,
      consumable: shopItem.consumable,
      isUnique: shopItem.isUnique,
      createdAt: shopItem.createdAt,
      updatedAt: shopItem.updatedAt,
      currencyName: shopCurrency.name,
    })
    .from(shopItem)
    .innerJoin(shopCurrency, eq(shopItem.currencyId, shopCurrency.id))
    .where(
      and(eq(shopItem.communityId, communityId), isNull(shopItem.deletedAt)),
    )
    .orderBy(asc(shopItem.name));
}

export async function getItem(communityId: string, itemId: string) {
  const [row] = await db
    .select()
    .from(shopItem)
    .where(
      and(
        eq(shopItem.id, itemId),
        eq(shopItem.communityId, communityId),
        isNull(shopItem.deletedAt),
      ),
    );
  return row;
}

export async function getItemByName(communityId: string, name: string) {
  const [row] = await db
    .select()
    .from(shopItem)
    .where(
      and(
        eq(shopItem.communityId, communityId),
        sql`LOWER(${shopItem.name}) = ${name.toLowerCase()}`,
        isNull(shopItem.deletedAt),
      ),
    );
  return row;
}

export async function createItem(
  communityId: string,
  params: {
    name: string;
    description?: string | null;
    priceAmount: number;
    currencyId: string;
    consumable?: boolean;
    isUnique?: boolean;
  },
) {
  const name = params.name.trim();
  if (!name || name.length > NAME_MAX) {
    throw new AppException(
      400,
      GeneralErrorCode.INVALID_REQUEST,
      `상품 이름은 1~${NAME_MAX}자여야 합니다`,
    );
  }
  if (params.description && params.description.length > DESC_MAX) {
    throw new AppException(
      400,
      GeneralErrorCode.INVALID_REQUEST,
      `상품 설명은 ${DESC_MAX}자 이하여야 합니다`,
    );
  }
  if (
    !Number.isInteger(params.priceAmount) ||
    params.priceAmount <= 0 ||
    params.priceAmount > MAX_AMOUNT
  ) {
    throw new AppException(
      400,
      GeneralErrorCode.INVALID_REQUEST,
      "가격은 1 이상의 정수여야 합니다",
    );
  }
  await validateCurrencyExists(communityId, params.currencyId);

  const [row] = await db
    .insert(shopItem)
    .values({
      communityId,
      name,
      description: params.description ?? null,
      priceAmount: params.priceAmount,
      currencyId: params.currencyId,
      consumable: params.consumable ?? false,
      isUnique: params.isUnique ?? false,
    })
    .returning();
  return row;
}

export async function updateItem(
  communityId: string,
  itemId: string,
  params: {
    name?: string;
    description?: string | null;
    priceAmount?: number;
    currencyId?: string;
    consumable?: boolean;
    isUnique?: boolean;
  },
) {
  await validateItemExists(communityId, itemId);
  const updates: Record<string, unknown> = { updatedAt: sql`now()` };
  if (params.name !== undefined) {
    const trimmed = params.name.trim();
    if (!trimmed || trimmed.length > NAME_MAX) {
      throw new AppException(
        400,
        GeneralErrorCode.INVALID_REQUEST,
        `상품 이름은 1~${NAME_MAX}자여야 합니다`,
      );
    }
    updates.name = trimmed;
  }
  if (params.description !== undefined) {
    updates.description = params.description;
  }
  if (params.priceAmount !== undefined) {
    if (
      !Number.isInteger(params.priceAmount) ||
      params.priceAmount <= 0 ||
      params.priceAmount > MAX_AMOUNT
    ) {
      throw new AppException(
        400,
        GeneralErrorCode.INVALID_REQUEST,
        "가격은 1 이상의 정수여야 합니다",
      );
    }
    updates.priceAmount = params.priceAmount;
  }
  if (params.currencyId !== undefined) {
    await validateCurrencyExists(communityId, params.currencyId);
    updates.currencyId = params.currencyId;
  }
  if (params.consumable !== undefined) updates.consumable = params.consumable;
  if (params.isUnique !== undefined) updates.isUnique = params.isUnique;

  const [row] = await db
    .update(shopItem)
    .set(updates)
    .where(
      and(
        eq(shopItem.id, itemId),
        eq(shopItem.communityId, communityId),
        isNull(shopItem.deletedAt),
      ),
    )
    .returning();
  return row;
}

export async function deleteItem(communityId: string, itemId: string) {
  await validateItemExists(communityId, itemId);
  await db
    .update(shopItem)
    .set({ deletedAt: sql`now()` })
    .where(
      and(
        eq(shopItem.id, itemId),
        eq(shopItem.communityId, communityId),
        isNull(shopItem.deletedAt),
      ),
    );
}

async function validateItemExists(communityId: string, itemId: string) {
  const row = await getItem(communityId, itemId);
  if (!row) {
    throw new AppException(
      404,
      GeneralErrorCode.NOT_FOUND,
      "상품을 찾을 수 없습니다",
    );
  }
  return row;
}

// ---------- Balance reads ----------

export async function listBalancesForProfile(
  communityId: string,
  profileId: string,
) {
  return db
    .select({
      id: shopBalance.id,
      currencyId: shopBalance.currencyId,
      currencyName: shopCurrency.name,
      isDefault: shopCurrency.isDefault,
      amount: shopBalance.amount,
      updatedAt: shopBalance.updatedAt,
    })
    .from(shopBalance)
    .innerJoin(shopCurrency, eq(shopBalance.currencyId, shopCurrency.id))
    .where(
      and(
        eq(shopBalance.communityId, communityId),
        eq(shopBalance.profileId, profileId),
        isNull(shopCurrency.deletedAt),
      ),
    )
    .orderBy(desc(shopCurrency.isDefault), asc(shopCurrency.name));
}

export async function getBalance(
  communityId: string,
  profileId: string,
  currencyId: string,
) {
  const [row] = await db
    .select({ amount: shopBalance.amount })
    .from(shopBalance)
    .where(
      and(
        eq(shopBalance.communityId, communityId),
        eq(shopBalance.profileId, profileId),
        eq(shopBalance.currencyId, currencyId),
      ),
    );
  return row?.amount ?? 0;
}

// ---------- Inventory reads ----------

export async function listInventoryForProfile(
  communityId: string,
  profileId: string,
) {
  return db
    .select({
      id: shopInventory.id,
      itemId: shopInventory.itemId,
      itemName: shopItem.name,
      itemDescription: shopItem.description,
      consumable: shopItem.consumable,
      isUnique: shopItem.isUnique,
      qty: shopInventory.qty,
      grantedAt: shopInventory.grantedAt,
      updatedAt: shopInventory.updatedAt,
    })
    .from(shopInventory)
    .innerJoin(shopItem, eq(shopInventory.itemId, shopItem.id))
    .where(
      and(
        eq(shopInventory.communityId, communityId),
        eq(shopInventory.profileId, profileId),
        lt(sql`0`, shopInventory.qty),
        isNull(shopItem.deletedAt),
      ),
    )
    .orderBy(asc(shopItem.name));
}

// ---------- Mutations ----------

function validateAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    throw new AppException(
      400,
      GeneralErrorCode.INVALID_REQUEST,
      "수량은 1 이상의 정수여야 합니다",
    );
  }
}

function validateReason(reason: string | null | undefined) {
  if (reason && reason.length > REASON_MAX) {
    throw new AppException(
      400,
      GeneralErrorCode.INVALID_REQUEST,
      `사유는 ${REASON_MAX}자 이하여야 합니다`,
    );
  }
}

export type GrantCurrencyParams = {
  communityId: string;
  profileId: string;
  currencyId: string;
  amount: number;
  source: GrantSource;
  actorUserId?: string | null;
  reason?: string | null;
};

export async function grantCurrency(params: GrantCurrencyParams) {
  validateAmount(params.amount);
  validateReason(params.reason);
  await validateCurrencyExists(params.communityId, params.currencyId);

  return db.transaction(async (tx) => {
    await tx
      .insert(shopBalance)
      .values({
        communityId: params.communityId,
        profileId: params.profileId,
        currencyId: params.currencyId,
        amount: params.amount,
      })
      .onConflictDoUpdate({
        target: [
          shopBalance.communityId,
          shopBalance.profileId,
          shopBalance.currencyId,
        ],
        set: {
          amount: sql`${shopBalance.amount} + ${params.amount}`,
          updatedAt: sql`now()`,
        },
      });

    const kind =
      params.source === "refund" ? "currency_refund" : "currency_grant";
    await tx.insert(shopTransaction).values({
      communityId: params.communityId,
      profileId: params.profileId,
      kind,
      source: params.source,
      currencyId: params.currencyId,
      currencyDelta: params.amount,
      reason: params.reason ?? null,
      actorUserId: params.actorUserId ?? null,
    });
  });
}

export type ChargeCurrencyParams = {
  communityId: string;
  profileId: string;
  currencyId: string;
  amount: number;
  source: "purchase" | "bot_grant";
  actorUserId?: string | null;
  reason?: string | null;
};

export async function chargeCurrency(params: ChargeCurrencyParams) {
  validateAmount(params.amount);
  validateReason(params.reason);

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(shopBalance)
      .set({
        amount: sql`${shopBalance.amount} - ${params.amount}`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(shopBalance.communityId, params.communityId),
          eq(shopBalance.profileId, params.profileId),
          eq(shopBalance.currencyId, params.currencyId),
          sql`${shopBalance.amount} >= ${params.amount}`,
        ),
      )
      .returning({ amount: shopBalance.amount });

    if (updated.length === 0) {
      throw new AppException(
        400,
        GeneralErrorCode.INVALID_REQUEST,
        "잔액이 부족합니다",
      );
    }

    await tx.insert(shopTransaction).values({
      communityId: params.communityId,
      profileId: params.profileId,
      kind: "currency_charge",
      source: params.source,
      currencyId: params.currencyId,
      currencyDelta: -params.amount,
      reason: params.reason ?? null,
      actorUserId: params.actorUserId ?? null,
    });
  });
}

export type GrantItemParams = {
  communityId: string;
  profileId: string;
  itemId: string;
  qty?: number;
  source: GrantSource;
  actorUserId?: string | null;
  reason?: string | null;
};

export async function grantItem(params: GrantItemParams) {
  const qty = params.qty ?? 1;
  validateAmount(qty);
  validateReason(params.reason);
  const item = await validateItemExists(params.communityId, params.itemId);

  return db.transaction(async (tx) => {
    if (item.isUnique) {
      const [existing] = await tx
        .select({ qty: shopInventory.qty })
        .from(shopInventory)
        .where(
          and(
            eq(shopInventory.communityId, params.communityId),
            eq(shopInventory.profileId, params.profileId),
            eq(shopInventory.itemId, params.itemId),
          ),
        )
        .for("update");
      if (existing && existing.qty > 0) {
        throw new AppException(
          409,
          GeneralErrorCode.RESOURCE_CONFLICT,
          "이미 보유 중인 상품입니다",
        );
      }
    }

    await tx
      .insert(shopInventory)
      .values({
        communityId: params.communityId,
        profileId: params.profileId,
        itemId: params.itemId,
        qty,
      })
      .onConflictDoUpdate({
        target: [
          shopInventory.communityId,
          shopInventory.profileId,
          shopInventory.itemId,
        ],
        set: {
          qty: sql`${shopInventory.qty} + ${qty}`,
          updatedAt: sql`now()`,
        },
      });

    await tx.insert(shopTransaction).values({
      communityId: params.communityId,
      profileId: params.profileId,
      kind: "item_grant",
      source: params.source,
      itemId: params.itemId,
      itemQtyDelta: qty,
      reason: params.reason ?? null,
      actorUserId: params.actorUserId ?? null,
    });
  });
}

export async function purchaseItem(params: {
  communityId: string;
  profileId: string;
  itemId: string;
  actorUserId?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(shopItem)
      .where(
        and(
          eq(shopItem.id, params.itemId),
          eq(shopItem.communityId, params.communityId),
          isNull(shopItem.deletedAt),
        ),
      )
      .for("update");
    if (!item) {
      throw new AppException(
        404,
        GeneralErrorCode.NOT_FOUND,
        "상품을 찾을 수 없습니다",
      );
    }

    if (item.isUnique) {
      const [existing] = await tx
        .select({ qty: shopInventory.qty })
        .from(shopInventory)
        .where(
          and(
            eq(shopInventory.communityId, params.communityId),
            eq(shopInventory.profileId, params.profileId),
            eq(shopInventory.itemId, params.itemId),
          ),
        );
      if (existing && existing.qty > 0) {
        throw new AppException(
          409,
          GeneralErrorCode.RESOURCE_CONFLICT,
          "이미 보유 중인 상품입니다",
        );
      }
    }

    const charged = await tx
      .update(shopBalance)
      .set({
        amount: sql`${shopBalance.amount} - ${item.priceAmount}`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(shopBalance.communityId, params.communityId),
          eq(shopBalance.profileId, params.profileId),
          eq(shopBalance.currencyId, item.currencyId),
          sql`${shopBalance.amount} >= ${item.priceAmount}`,
        ),
      )
      .returning({ amount: shopBalance.amount });

    if (charged.length === 0) {
      throw new AppException(
        400,
        GeneralErrorCode.INVALID_REQUEST,
        "잔액이 부족합니다",
      );
    }

    await tx
      .insert(shopInventory)
      .values({
        communityId: params.communityId,
        profileId: params.profileId,
        itemId: params.itemId,
        qty: 1,
      })
      .onConflictDoUpdate({
        target: [
          shopInventory.communityId,
          shopInventory.profileId,
          shopInventory.itemId,
        ],
        set: {
          qty: sql`${shopInventory.qty} + 1`,
          updatedAt: sql`now()`,
        },
      });

    await tx.insert(shopTransaction).values({
      communityId: params.communityId,
      profileId: params.profileId,
      kind: "item_purchase",
      source: "purchase",
      currencyId: item.currencyId,
      currencyDelta: -item.priceAmount,
      itemId: params.itemId,
      itemQtyDelta: 1,
      actorUserId: params.actorUserId ?? null,
    });

    return item;
  });
}

export async function consumeItem(params: {
  communityId: string;
  profileId: string;
  itemId: string;
  qty?: number;
  actorUserId?: string | null;
  reason?: string | null;
}) {
  const qty = params.qty ?? 1;
  validateAmount(qty);
  validateReason(params.reason);
  const item = await validateItemExists(params.communityId, params.itemId);

  if (!item.consumable) {
    throw new AppException(
      400,
      GeneralErrorCode.INVALID_REQUEST,
      "소비할 수 없는 상품입니다",
    );
  }

  return db.transaction(async (tx) => {
    const consumed = await tx
      .update(shopInventory)
      .set({
        qty: sql`${shopInventory.qty} - ${qty}`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(shopInventory.communityId, params.communityId),
          eq(shopInventory.profileId, params.profileId),
          eq(shopInventory.itemId, params.itemId),
          sql`${shopInventory.qty} >= ${qty}`,
        ),
      )
      .returning({ qty: shopInventory.qty });

    if (consumed.length === 0) {
      throw new AppException(
        400,
        GeneralErrorCode.INVALID_REQUEST,
        "보유 수량이 부족합니다",
      );
    }

    await tx.insert(shopTransaction).values({
      communityId: params.communityId,
      profileId: params.profileId,
      kind: "item_consume",
      source: "consume",
      itemId: params.itemId,
      itemQtyDelta: -qty,
      reason: params.reason ?? null,
      actorUserId: params.actorUserId ?? null,
    });
  });
}

// ---------- Transactions log ----------

export async function listTransactions(
  communityId: string,
  options: {
    limit?: number;
    cursor?: string;
    profileId?: string;
  } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const conditions = [eq(shopTransaction.communityId, communityId)];
  if (options.profileId) {
    conditions.push(eq(shopTransaction.profileId, options.profileId));
  }
  if (options.cursor) {
    conditions.push(lt(shopTransaction.id, options.cursor));
  }
  const rows = await db
    .select()
    .from(shopTransaction)
    .where(and(...conditions))
    .orderBy(desc(shopTransaction.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;
  return { data, nextCursor, hasMore };
}
