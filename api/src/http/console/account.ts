import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth";
import {
  accountDeletionConfirmSchema,
  emailUpdateSchema,
  emailVerificationSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  userLoginSchema,
} from "../../schemas";
import * as authService from "../../services/auth.service";
import * as emailService from "../../services/email.service";
import * as membershipService from "../../services/membership.service";
import * as userService from "../../services/user.service";
import { GeneralErrorCode } from "../../types/api-responses";
import { addImageUrl } from "../../utils/r2";

const passwordChangeRequestSchema = z.object({
  current_password: z.string().min(1, "Current password cannot be empty"),
  new_password: z
    .string()
    .min(8, "New password must be at least 8 characters long"),
});

export const consoleAccountRouter = new Hono()
  .get("/me", authMiddleware, async (c) => {
    const user = c.get("user");

    const currentUser = await userService.getCurrentUser(user.id);

    return c.json({
      data: {
        ...currentUser,
        email: user.email,
        email_verified: user.emailVerifiedAt !== null,
        email_verified_at: user.emailVerifiedAt,
      },
    });
  })
  .post(
    "/change-password",
    authMiddleware,
    zValidator("json", passwordChangeRequestSchema),
    async (c) => {
      const user = c.get("user");
      const isMasquerading = c.get("isMasquerading");

      // Block password changes during masquerade
      if (isMasquerading) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.CANNOT_DELETE_WHILE_TRANSITIONING,
              message: "전환 중에는 비밀번호를 변경할 수 없습니다",
            },
          },
          403,
        );
      }

      const { current_password, new_password } = c.req.valid("json");

      await userService.updateUserPassword(
        user.id,
        current_password,
        new_password,
      );
      return c.json({
        data: { password_changed: true, changed_at: new Date().toISOString() },
      });
    },
  )
  .post(
    "/email",
    authMiddleware,
    zValidator("json", emailUpdateSchema),
    async (c) => {
      const user = c.get("user");
      const isMasquerading = c.get("isMasquerading");

      // Block email changes during masquerade
      if (isMasquerading) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.CANNOT_DELETE_WHILE_TRANSITIONING,
              message: "전환 중에는 이메일을 변경할 수 없습니다",
            },
          },
          403,
        );
      }

      const { email } = c.req.valid("json");

      await userService.requestEmailUpdate(user.id, email);
      return c.json({
        data: { email_sent: true, sent_at: new Date().toISOString() },
      });
    },
  )
  .post(
    "/verify-email",
    zValidator("json", emailVerificationSchema),
    async (c) => {
      const { token } = c.req.valid("json");

      const result = await emailService.verifyEmail(token);

      return c.json({
        data: {
          email: result.email,
          verified: true,
          verified_at: new Date().toISOString(),
        },
      });
    },
  )
  .post("/login", zValidator("json", userLoginSchema), async (c) => {
    const { login_name: loginName, password } = c.req.valid("json");
    const { session, user } = await authService.loginUser(loginName, password);

    // Set session cookie
    setCookie(c, "session_token", session.token, {
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      httpOnly: true,
      sameSite: "Lax",
    });

    // Return user data with session token (for mobile clients)
    return c.json({ data: { ...user, session_token: session.token } });
  })

  .delete("/users/me", authMiddleware, async (c) => {
    const user = c.get("user");
    const isMasquerading = c.get("isMasquerading");

    // Block account deletion during masquerade
    if (isMasquerading) {
      return c.json(
        {
          error: {
            code: GeneralErrorCode.CANNOT_DELETE_WHILE_TRANSITIONING,
            message: "전환 중에는 계정을 삭제할 수 없습니다",
          },
        },
        403,
      );
    }

    // Check if user owns any active communities
    const { hasActiveCommunities, communities } =
      await userService.checkUserOwnsActiveCommunities(user.id);

    if (hasActiveCommunities) {
      const communityNames = communities.map((comm) => comm.name);
      return c.json(
        {
          error: {
            code: GeneralErrorCode.OPERATION_NOT_ALLOWED,
            message: "활성 커뮤를 소유하고 있는 동안 계정을 삭제할 수 없습니다",
            details: { communities: communityNames },
          },
        },
        400,
      );
    }

    // If user has verified email, send confirmation email instead of deleting immediately
    if (user.emailVerifiedAt && user.email) {
      await emailService.sendAccountDeletionEmail(user.id, user.email);
      return c.json({
        data: {
          requires_email_confirmation: true,
          email_sent: true,
          sent_at: new Date().toISOString(),
        },
      });
    }

    // If no verified email, delete immediately
    await userService.deleteUserAccount(user.id);

    return c.json({ data: { id: user.id, deleted: true } });
  })
  .get(
    "/verify-delete-token/:token",
    zValidator("param", z.object({ token: z.uuid() })),
    async (c) => {
      const { token } = c.req.valid("param");

      // Check token without marking it as used
      const { userId } = await emailService.checkAccountDeletionToken(token);

      // Get user info
      const user = await userService.getUserById(userId);

      return c.json({
        data: {
          login_name: user.login_name,
          email: user.email || "",
        },
      });
    },
  )
  .post(
    "/confirm-delete-account",
    zValidator("json", accountDeletionConfirmSchema),
    async (c) => {
      const { token } = c.req.valid("json");

      // Verify token
      const result = await emailService.verifyAccountDeletionToken(token);

      // Delete the user account
      await userService.deleteUserAccount(result.userId);

      return c.json({ data: { id: result.userId, deleted: true } });
    },
  )
  .get("/my-applications", authMiddleware, async (c) => {
    const user = c.get("user");

    const applications = await membershipService.getAllUserApplications(
      user.id,
    );

    return c.json({
      data: applications.map((app) => ({
        id: app.id,
        status: app.status,
        profile_name: app.profileName,
        profile_username: app.profileUsername,
        message: app.message,
        rejection_reason: app.rejectionReason,
        created_at: app.createdAt,
        reviewed_at: app.reviewedAt,
        community: {
          id: app.community.id,
          name: app.community.name,
          slug: app.community.slug,
        },
        attachments: app.attachments.map((att) => ({
          id: att.id,
          image_id: att.imageId,
          image_url: addImageUrl(att.image),
          created_at: att.createdAt,
        })),
      })),
    });
  })
  .post(
    "/request-password-reset",
    zValidator("json", passwordResetRequestSchema),
    async (c) => {
      const { email } = c.req.valid("json");

      await emailService.sendPasswordResetEmail(email);
      return c.json({
        data: { email_sent: true, sent_at: new Date().toISOString() },
      });
    },
  )
  .get(
    "/verify-reset-token/:token",
    zValidator("param", z.object({ token: z.uuid() })),
    async (c) => {
      const { token } = c.req.valid("param");

      await emailService.checkPasswordResetToken(token);
      return c.json({ data: { valid: true } });
    },
  )
  .post(
    "/reset-password",
    zValidator("json", passwordResetSchema),
    async (c) => {
      const { token, new_password } = c.req.valid("json");

      const result = await authService.resetPassword(token, new_password);

      // Set session cookie for web clients
      setCookie(c, "session_token", result.session.token, {
        maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
        httpOnly: true,
        sameSite: "Lax",
      });

      // Return success message with session token (for mobile clients)
      return c.json({
        data: {
          password_reset: true,
          session_token: result.session.token,
          reset_at: new Date().toISOString(),
        },
      });
    },
  );
