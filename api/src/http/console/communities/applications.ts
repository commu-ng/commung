import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { AppException } from "../../../exception";
import { authMiddleware } from "../../../middleware/auth";
import * as communityService from "../../../services/community.service";
import * as membershipService from "../../../services/membership.service";
import { GeneralErrorCode } from "../../../types/api-responses";
import { getPrimaryProfileIdForUserInCommunity } from "../../../utils/profile-ownership";
import { addImageUrl } from "../../../utils/r2";
import {
  applicationReviewSchema,
  communityApplicationParamSchema,
  communityApplicationSchema,
  communityApplicationUpdateSchema,
  communityIdParamSchema,
} from "./schemas";

export const applicationsRouter = new Hono()
  .get(
    "/:id/my-applications",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Get all applications for this user in this community
      const applications =
        await membershipService.getUserApplicationsForCommunity(
          user.id,
          community.id,
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
          attachments: app.attachments.map((att) => ({
            id: att.id,
            image_id: att.imageId,
            image_url: addImageUrl(att.image),
            created_at: att.createdAt,
          })),
        })),
      });
    },
  )
  .post(
    "/:id/apply",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    zValidator("json", communityApplicationSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");
      const { message, profile_name, profile_username, attachment_ids } =
        c.req.valid("json");

      // Create application using service
      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      const newApplication = await membershipService.createApplication(
        user.id,
        community.id,
        {
          message,
          profileName: profile_name,
          profileUsername: profile_username,
          attachmentIds: attachment_ids,
        },
      );

      return c.json(
        {
          data: {
            id: newApplication.id,
            status: newApplication.status,
            profile_name: newApplication.profileName,
            profile_username: newApplication.profileUsername,
            message: newApplication.message,
            created_at: newApplication.createdAt,
          },
        },
        201,
      );
    },
  )
  .patch(
    "/:id/applications/:application_id",
    authMiddleware,
    zValidator("param", communityApplicationParamSchema),
    zValidator("json", communityApplicationUpdateSchema),
    async (c) => {
      const { id: slug, application_id: applicationId } = c.req.valid("param");
      const user = c.get("user");
      const { message, profile_name, profile_username, attachment_ids } =
        c.req.valid("json");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Update application using service (will validate ownership and pending status)
      const updatedApplication = await membershipService.updateApplication(
        user.id,
        applicationId,
        community.id,
        {
          message,
          profileName: profile_name,
          profileUsername: profile_username,
          attachmentIds: attachment_ids,
        },
      );

      if (!updatedApplication) {
        throw new AppException(404, "NOT_FOUND", "지원서를 찾을 수 없습니다");
      }

      return c.json({
        data: {
          id: updatedApplication.id,
          status: updatedApplication.status,
          profile_name: updatedApplication.profileName,
          profile_username: updatedApplication.profileUsername,
          message: updatedApplication.message,
          updated_at: updatedApplication.updatedAt,
        },
      });
    },
  )
  .put(
    "/:id/applications/:application_id/review",
    authMiddleware,
    zValidator("param", communityApplicationParamSchema),
    zValidator("json", applicationReviewSchema),
    async (c) => {
      const { application_id: applicationId } = c.req.valid("param");
      const user = c.get("user");
      const { status, rejection_reason } = c.req.valid("json");

      // Find the application
      const application =
        await membershipService.getApplicationByIdSimple(applicationId);

      if (!application) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.APPLICATION_NOT_FOUND,
              message: "지원서를 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      // Check if user has permission (community owner or moderator)
      const community = application.community;
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);

      if (status === "approved") {
        // Use membership service to approve and create membership + profile
        const result = await membershipService.approveMembershipApplication(
          applicationId,
          user.id,
        );

        return c.json({
          data: {
            id: applicationId,
            status: "approved",
            membership_id: result.membership.id,
            profile_id: result.profile.id,
            reviewed_at: new Date().toISOString(),
          },
        });
      } else {
        // Use membership service to reject
        const updatedApplication =
          await membershipService.rejectMembershipApplication(
            applicationId,
            user.id,
            rejection_reason,
          );

        return c.json({
          data: {
            id: updatedApplication.id,
            status: updatedApplication.status,
            reviewed_at: updatedApplication.reviewedAt,
          },
        });
      }
    },
  )
  .delete(
    "/:id/applications/:application_id/revoke",
    authMiddleware,
    zValidator("param", communityApplicationParamSchema),
    async (c) => {
      const { application_id: applicationId } = c.req.valid("param");
      const user = c.get("user");

      // Find the application
      const application =
        await membershipService.getApplicationByIdSimple(applicationId);

      if (!application) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.APPLICATION_NOT_FOUND,
              message: "지원서를 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      const community = application.community;

      // Check if user has permission (community owner only)
      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
      ]);

      await membershipService.revokeApplicationReview(applicationId);
      return c.json({
        data: {
          id: applicationId,
          revoked: true,
          revoked_at: new Date().toISOString(),
        },
      });
    },
  )
  .get(
    "/:id/applications",
    authMiddleware,
    zValidator("param", communityIdParamSchema),
    async (c) => {
      const { id: slug } = c.req.valid("param");
      const user = c.get("user");

      // Check if user is owner or moderator
      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      await membershipService.validateMembershipRole(user.id, community.id, [
        "owner",
        "moderator",
      ]);
      // Get applications
      const applications = await membershipService.getCommunityApplications(
        community.id,
      );

      // Batch fetch profile IDs for all applicants and reviewers
      const userCommunityPairs: Array<{
        userId: string;
        communityId: string;
      }> = [];

      for (const app of applications) {
        // Add applicant
        userCommunityPairs.push({
          userId: app.user_userId.id,
          communityId: community.id,
        });
        // Add reviewer if exists
        if (app.user_reviewedById) {
          userCommunityPairs.push({
            userId: app.user_reviewedById.id,
            communityId: community.id,
          });
        }
      }

      const profileIdsMap =
        userCommunityPairs.length > 0
          ? await getPrimaryProfileIdForUserInCommunity(userCommunityPairs)
          : new Map<string, string | null>();

      // Build result using the batched profile IDs
      const result = applications.map((app) => {
        const applicantKey = `${app.user_userId.id}:${community.id}`;
        const applicantProfileId = profileIdsMap.get(applicantKey) || null;

        let reviewerProfileId = null;
        if (app.user_reviewedById) {
          const reviewerKey = `${app.user_reviewedById.id}:${community.id}`;
          reviewerProfileId = profileIdsMap.get(reviewerKey) || null;
        }

        return {
          id: app.id,
          status: app.status,
          profile_name: app.profileName,
          profile_username: app.profileUsername,
          message: app.message,
          created_at: app.createdAt,
          reviewed_at: app.reviewedAt,
          applicant: {
            profile_id: applicantProfileId,
          },
          reviewed_by: app.user_reviewedById
            ? {
                profile_id: reviewerProfileId,
              }
            : null,
          attachments: app.attachments.map((att) => ({
            id: att.id,
            image_id: att.imageId,
            image_url: addImageUrl(att.image),
            created_at: att.createdAt,
          })),
        };
      });

      return c.json({ data: result });
    },
  )
  .get(
    "/:id/applications/:application_id",
    authMiddleware,
    zValidator("param", communityApplicationParamSchema),
    async (c) => {
      const { id: slug, application_id: applicationId } = c.req.valid("param");
      const user = c.get("user");

      // Validate community exists and get its ID
      const community =
        await communityService.validateCommunityExistsBySlug(slug);

      // Get the application
      const application = await membershipService.getApplicationById(
        applicationId,
        community.id,
      );

      if (!application) {
        return c.json(
          {
            error: {
              code: GeneralErrorCode.APPLICATION_NOT_FOUND,
              message: "지원서를 찾을 수 없습니다",
            },
          },
          404,
        );
      }

      // Check if user has permission to view this application
      // Either the applicant themselves OR a moderator/owner
      const isApplicant = application.userId === user.id;

      if (!isApplicant) {
        try {
          await membershipService.validateMembershipRole(
            user.id,
            community.id,
            ["owner", "moderator"],
          );
        } catch (_error) {
          return c.json(
            {
              error: {
                code: GeneralErrorCode.FORBIDDEN,
                message: "이 지원서를 볼 수 있는 권한이 없습니다",
              },
            },
            403,
          );
        }
      }

      // Batch fetch profile IDs for applicant and reviewer
      const userCommunityPairs: Array<{
        userId: string;
        communityId: string;
      }> = [{ userId: application.user_userId.id, communityId: community.id }];

      if (application.user_reviewedById?.id) {
        userCommunityPairs.push({
          userId: application.user_reviewedById.id,
          communityId: community.id,
        });
      }

      const profileIdsMap =
        await getPrimaryProfileIdForUserInCommunity(userCommunityPairs);

      const applicantKey = `${application.user_userId.id}:${community.id}`;
      const applicantProfileId = profileIdsMap.get(applicantKey) || null;

      let reviewerProfileId = null;
      if (application.user_reviewedById?.id) {
        const reviewerKey = `${application.user_reviewedById.id}:${community.id}`;
        reviewerProfileId = profileIdsMap.get(reviewerKey) || null;
      }

      return c.json({
        data: {
          id: application.id,
          profile_name: application.profileName,
          profile_username: application.profileUsername,
          message: application.message,
          status: application.status,
          rejection_reason: application.rejectionReason,
          created_at: application.createdAt,
          reviewed_at: application.reviewedAt,
          applicant: {
            profile_id: applicantProfileId,
          },
          reviewed_by: application.user_reviewedById
            ? {
                profile_id: reviewerProfileId,
              }
            : null,
          attachments: application.attachments.map((att) => ({
            id: att.id,
            image_id: att.imageId,
            image_url: addImageUrl(att.image),
            created_at: att.createdAt,
          })),
        },
      });
    },
  );
