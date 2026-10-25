import { randomUUID } from "node:crypto";
import * as bcrypt from "bcrypt";
import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { env } from "../config/env";
import { SESSION_CONFIG } from "../config/session.config";
import { db } from "../db";
import {
  community as communityTable,
  exchangeToken as exchangeTokenTable,
  session as sessionTable,
  user as userTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";
import * as emailService from "./email.service";

/**
 * Validate session and get user
 * Returns session and user if valid, null otherwise
 * Also extends session expiration
 */
export async function validateSessionAndGetUser(sessionToken: string) {
  const session = await db.query.session.findFirst({
    where: and(
      eq(sessionTable.token, sessionToken),
      sql`${sessionTable.expiresAt} > NOW()`,
    ),
  });

  if (!session) {
    return null;
  }

  // Extend session expiration by 30 days
  await db
    .update(sessionTable)
    .set({ expiresAt: sql`NOW() + INTERVAL '30 days'` })
    .where(eq(sessionTable.id, session.id));

  // Get user
  const user = await db.query.user.findFirst({
    where: and(eq(userTable.id, session.userId), isNull(userTable.deletedAt)),
  });

  if (!user) {
    return null;
  }

  return { session, user };
}

/**
 * Logout user by deleting session
 */
export async function logoutUser(sessionToken: string) {
  await db.delete(sessionTable).where(eq(sessionTable.token, sessionToken));
}

/**
 * Find community by target domain (custom domain or subdomain)
 */
export async function findCommunityByDomain(
  targetDomain: string,
  mainDomain: string,
) {
  // Extract slug from subdomain if applicable
  const slug = targetDomain.endsWith(`.${mainDomain}`)
    ? targetDomain.replace(`.${mainDomain}`, "")
    : null;

  // Single query with OR to check both custom domain and subdomain slug
  const community = await db.query.community.findFirst({
    where: and(
      or(
        // Verified custom domain
        and(
          eq(communityTable.customDomain, targetDomain),
          isNotNull(communityTable.domainVerifiedAt),
        ),
        // Or subdomain slug
        slug ? eq(communityTable.slug, slug) : sql`FALSE`,
      ),
      isNull(communityTable.deletedAt),
    ),
  });

  if (!community) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "허용되지 않는 도메인입니다",
    );
  }

  return community;
}

/**
 * Create exchange token for SSO
 */
export async function createExchangeToken(
  userId: string,
  targetDomain: string,
) {
  const exchangeTokenValue = randomUUID();

  const newExchangeToken = await db
    .insert(exchangeTokenTable)
    .values({
      token: exchangeTokenValue,
      targetDomain: targetDomain,
      expiresAt: sql`NOW() + INTERVAL '${sql.raw(String(SESSION_CONFIG.EXCHANGE_TOKEN_DURATION_MINUTES))} minutes'`,
      userId: userId,
    })
    .returning();

  if (!newExchangeToken[0]) {
    throw new Error("교환 토큰 생성에 실패했습니다");
  }

  return newExchangeToken[0];
}

/**
 * Exchange token for session
 * Uses transaction to prevent race conditions
 * Creates a community-scoped session based on the target domain
 */
export async function exchangeTokenForSession(token: string, domain: string) {
  return await db.transaction(async (tx) => {
    const exchangeToken = await tx.query.exchangeToken.findFirst({
      where: and(
        eq(exchangeTokenTable.token, token),
        eq(exchangeTokenTable.targetDomain, domain),
        sql`${exchangeTokenTable.expiresAt} > NOW()`,
      ),
    });

    if (!exchangeToken) {
      throw new AppException(
        401,
        GENERAL_ERROR_CODE,
        "잘못된 또는 만료된 토큰입니다",
      );
    }

    // Look up the community by domain to get its ID for session scoping
    const community = await findCommunityByDomain(domain, env.consoleDomain);

    // Create session scoped to the community
    const sessionToken = randomUUID();

    const newSession = await tx
      .insert(sessionTable)
      .values({
        token: sessionToken,
        expiresAt: sql`NOW() + INTERVAL '${sql.raw(String(SESSION_CONFIG.SESSION_DURATION_DAYS))} days'`,
        userId: exchangeToken.userId,
        communityId: community.id,
      })
      .returning();

    if (!newSession[0]) {
      throw new Error("세션 생성에 실패했습니다");
    }

    return newSession[0];
  });
}

/**
 * Create a session for a user
 * @param userId - User ID
 * @param communityId - Optional community ID to scope the session (null for console sessions)
 */
export async function createSession(
  userId: string,
  communityId: string | null = null,
) {
  const sessionToken = randomUUID();

  const newSession = await db
    .insert(sessionTable)
    .values({
      token: sessionToken,
      expiresAt: sql`NOW() + INTERVAL '30 days'`,
      userId: userId,
      communityId: communityId,
    })
    .returning();

  if (!newSession[0]) {
    throw new Error("세션 생성에 실패했습니다");
  }

  return newSession[0];
}

/**
 * Generate a dummy bcrypt hash for constant-time comparison
 * This ensures timing-safe validation even when user doesn't exist
 */
let DUMMY_HASH: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!DUMMY_HASH) {
    // Generate a valid bcrypt hash once per server instance
    // Using a random string ensures it can't be guessed from the codebase
    const randomString = Math.random().toString(36).substring(2, 15);
    DUMMY_HASH = await bcrypt.hash(randomString, 10);
  }
  return DUMMY_HASH;
}

/**
 * Login user with credentials and create session
 * Uses constant-time comparison to prevent timing attacks
 */
export async function loginUser(loginName: string, password: string) {
  // Input validation
  if (!loginName || loginName.length < 1 || loginName.length > 100) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "유효하지 않은 로그인 이름입니다",
    );
  }
  if (!password || password.length < 8) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "비밀번호는 최소 8자 이상이어야 합니다",
    );
  }

  // Find user by login_name
  const user = await db.query.user.findFirst({
    where: eq(userTable.loginName, loginName),
  });

  // Always run bcrypt.compare to prevent timing attacks
  // Use dynamically generated dummy hash if user doesn't exist
  const passwordHash = user?.passwordHash ?? (await getDummyHash());
  const isValidPassword = await bcrypt.compare(password, passwordHash);

  if (!user || !isValidPassword) {
    throw new AppException(401, GENERAL_ERROR_CODE, "잘못된 로그인 정보입니다");
  }

  // Create session
  const session = await createSession(user.id);

  return {
    session,
    user: {
      id: user.id,
      login_name: user.loginName,
      email: user.email,
      email_verified_at: user.emailVerifiedAt,
      created_at: user.createdAt,
      is_admin: user.isAdmin,
      avatar_url: null,
    },
  };
}

/**
 * Reset password using token from email
 * Returns a new session for immediate login
 */
export async function resetPassword(token: string, newPassword: string) {
  // Input validation
  if (!newPassword || newPassword.length < 8) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "비밀번호는 최소 8자 이상이어야 합니다",
    );
  }

  // Verify token and get user ID
  const { userId } = await emailService.verifyPasswordResetToken(token);

  // Hash new password
  const hashedPassword = await bcrypt.hash(
    newPassword,
    SESSION_CONFIG.BCRYPT_SALT_ROUNDS,
  );

  // Update password
  await db
    .update(userTable)
    .set({ passwordHash: hashedPassword })
    .where(eq(userTable.id, userId));

  // Invalidate all existing sessions for security
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

  // Create new console session for immediate login
  const session = await createSession(userId, null);

  return { success: true, session };
}
