import { and, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  community as communityTable,
  masqueradeAuditLog as masqueradeAuditLogTable,
  membership as membershipTable,
  session as sessionTable,
  user as userTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";
import * as authService from "./auth.service";

/**
 * Start masquerading as another user
 * Only admins can masquerade
 * Creates a console session (communityId = null) for the target user with original admin user ID tracked
 */
export async function startMasquerade(
  adminUserId: string,
  targetUserId: string,
) {
  // Verify admin user
  const adminUser = await db.query.user.findFirst({
    where: and(eq(userTable.id, adminUserId), isNull(userTable.deletedAt)),
  });

  if (!adminUser) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "관리자 사용자를 찾을 수 없습니다",
    );
  }

  if (!adminUser.isAdmin) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "관리자만 다른 사용자로 전환할 수 있습니다",
    );
  }

  // Verify target user exists
  const targetUser = await db.query.user.findFirst({
    where: and(eq(userTable.id, targetUserId), isNull(userTable.deletedAt)),
  });

  if (!targetUser) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "대상 사용자를 찾을 수 없습니다",
    );
  }

  // Cannot masquerade as yourself
  if (adminUserId === targetUserId) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "자기 자신으로 전환할 수 없습니다",
    );
  }

  // Create new session for target user with original user ID tracked
  const session = await authService.createSession(targetUserId, null);

  // Update session to include original user ID
  await db
    .update(sessionTable)
    .set({ originalUserId: adminUserId })
    .where(eq(sessionTable.id, session.id));

  // Log the masquerade start
  await db.insert(masqueradeAuditLogTable).values({
    adminUserId,
    targetUserId,
    action: "start",
    sessionId: session.id,
  });

  // Get updated session with originalUserId
  const updatedSession = await db.query.session.findFirst({
    where: eq(sessionTable.id, session.id),
  });

  return {
    session: updatedSession,
    targetUser: {
      id: targetUser.id,
      login_name: targetUser.loginName,
    },
  };
}

/**
 * End masquerade session and return to admin user
 * Logs the end action and invalidates the masquerade session
 */
export async function endMasquerade(sessionToken: string) {
  // Get the session
  const result = await authService.validateSessionAndGetUser(sessionToken);

  if (!result) {
    throw new AppException(401, GENERAL_ERROR_CODE, "유효하지 않은 세션입니다");
  }

  const { session } = result;

  // Check if this is actually a masquerade session
  if (!session.originalUserId) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "이 세션은 전환 세션이 아닙니다",
    );
  }

  // Log the masquerade end
  const auditLogEntry = await db.query.masqueradeAuditLog.findFirst({
    where: and(
      eq(masqueradeAuditLogTable.sessionId, session.id),
      eq(masqueradeAuditLogTable.action, "start"),
    ),
    orderBy: [desc(masqueradeAuditLogTable.createdAt)],
  });

  if (auditLogEntry) {
    await db.insert(masqueradeAuditLogTable).values({
      adminUserId: session.originalUserId,
      targetUserId: session.userId,
      action: "end",
      sessionId: session.id,
    });
  }

  // Clear session references from audit logs before deletion
  // This prevents foreign key constraint violations
  await db
    .update(masqueradeAuditLogTable)
    .set({ sessionId: null })
    .where(eq(masqueradeAuditLogTable.sessionId, session.id));

  // Delete the masquerade session
  await db.delete(sessionTable).where(eq(sessionTable.token, sessionToken));

  // Create a new session for the original admin user
  const adminSession = await authService.createSession(
    session.originalUserId,
    null,
  );

  return {
    session: adminSession,
    adminUserId: session.originalUserId,
  };
}

/**
 * Get masquerade status for a session
 * Returns null if not masquerading, otherwise returns masquerade info
 */
export async function getMasqueradeStatus(sessionToken: string) {
  const result = await authService.validateSessionAndGetUser(sessionToken);

  if (!result) {
    return null;
  }

  const { session, user } = result;

  // Check if this is a masquerade session
  if (!session.originalUserId) {
    return null;
  }

  // Get the original admin user info
  const adminUser = await db.query.user.findFirst({
    where: eq(userTable.id, session.originalUserId),
  });

  if (!adminUser) {
    return null;
  }

  return {
    isMasquerading: true,
    adminUser: {
      id: adminUser.id,
      login_name: adminUser.loginName,
    },
    targetUser: {
      id: user.id,
      login_name: user.loginName,
    },
  };
}

/**
 * Check if a session is a masquerade session
 */
export function isMasqueradeSession(
  session: typeof sessionTable.$inferSelect,
): boolean {
  return session.originalUserId !== null;
}

/**
 * List users for admin to masquerade as
 * Excludes deleted users and the current admin
 * Supports server-side search by loginName, email, or UUID
 */
export async function listUsersForMasquerade(
  adminUserId: string,
  limit = 100,
  search?: string,
) {
  // Verify admin user
  const adminUser = await db.query.user.findFirst({
    where: and(eq(userTable.id, adminUserId), isNull(userTable.deletedAt)),
  });

  if (!adminUser) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "관리자 사용자를 찾을 수 없습니다",
    );
  }

  if (!adminUser.isAdmin) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "관리자만 사용자 목록을 볼 수 있습니다",
    );
  }

  // Build where conditions
  let whereCondition = and(
    isNull(userTable.deletedAt),
    ne(userTable.id, adminUserId), // Exclude the current admin
  );

  // Add search conditions if provided
  if (search?.trim()) {
    const searchPattern = `%${search.trim()}%`;
    const searchCondition = or(
      ilike(userTable.loginName, searchPattern),
      ilike(userTable.email, searchPattern),
      sql`${userTable.id}::text ilike ${searchPattern}`, // Cast UUID to text for search
    );

    whereCondition = and(whereCondition, searchCondition);
  }

  // Get users with database-level filtering
  const users = await db.query.user.findMany({
    where: whereCondition,
    columns: {
      id: true,
      loginName: true,
      email: true,
      createdAt: true,
      isAdmin: true,
    },
    orderBy: [desc(userTable.createdAt)],
    limit,
  });

  // Fetch owned communities for all returned users in one query
  const userIds = users.map((u) => u.id);
  const ownedCommunities =
    userIds.length > 0
      ? await db
          .select({
            userId: membershipTable.userId,
            communityId: communityTable.id,
            communityName: communityTable.name,
            communitySlug: communityTable.slug,
          })
          .from(membershipTable)
          .innerJoin(
            communityTable,
            and(
              eq(membershipTable.communityId, communityTable.id),
              isNull(communityTable.deletedAt),
            ),
          )
          .where(
            and(
              sql`${membershipTable.userId} IN ${userIds}`,
              eq(membershipTable.role, "owner"),
              sql`${membershipTable.activatedAt} IS NOT NULL`,
            ),
          )
      : [];

  // Group owned communities by user ID
  const communitiesByUser = new Map<
    string,
    Array<{ id: string; name: string; slug: string }>
  >();
  for (const row of ownedCommunities) {
    const list = communitiesByUser.get(row.userId) ?? [];
    list.push({
      id: row.communityId,
      name: row.communityName,
      slug: row.communitySlug,
    });
    communitiesByUser.set(row.userId, list);
  }

  return users.map((user) => ({
    id: user.id,
    login_name: user.loginName,
    email: user.email,
    created_at: user.createdAt,
    is_admin: user.isAdmin,
    owned_communities: communitiesByUser.get(user.id) ?? [],
  }));
}

/**
 * Get masquerade audit logs
 * Admin only
 */
export async function getMasqueradeAuditLogs(adminUserId: string, limit = 100) {
  // Verify admin user
  const adminUser = await db.query.user.findFirst({
    where: and(eq(userTable.id, adminUserId), isNull(userTable.deletedAt)),
  });

  if (!adminUser) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "관리자 사용자를 찾을 수 없습니다",
    );
  }

  if (!adminUser.isAdmin) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "관리자만 감사 로그를 볼 수 있습니다",
    );
  }

  // Get audit logs with user information
  const logs = await db
    .select({
      id: masqueradeAuditLogTable.id,
      action: masqueradeAuditLogTable.action,
      createdAt: masqueradeAuditLogTable.createdAt,
      endedAt: masqueradeAuditLogTable.endedAt,
      sessionId: masqueradeAuditLogTable.sessionId,
      adminUserId: masqueradeAuditLogTable.adminUserId,
      targetUserId: masqueradeAuditLogTable.targetUserId,
    })
    .from(masqueradeAuditLogTable)
    .orderBy(desc(masqueradeAuditLogTable.createdAt))
    .limit(limit);

  return logs;
}
