import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import { checkPermission } from '../../../middlewares/checkPermission';
import { Role } from '../../../generated/prisma/enums';
import validateRequest from '../../../middlewares/validateRequest';
import { ContentModerationController } from './content_moderation.controller';
import { ContentModerationValidation } from './content_moderation.validation';

const router = express.Router();

router.get(
  '/reviews',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('CONTENT_READ'),
  validateRequest(ContentModerationValidation.getReviewsQuerySchema),
  ContentModerationController.getModerationReviews
);

router.delete(
  '/reviews/:id',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('CONTENT_MODERATE'),
  validateRequest(ContentModerationValidation.removeReviewSchema),
  ContentModerationController.removeReview
);

router.get(
  '/job-posts',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('CONTENT_READ'),
  validateRequest(ContentModerationValidation.getJobPostsQuerySchema),
  ContentModerationController.getModerationJobPosts
);

router.patch(
  '/job-posts/:id/remove',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('CONTENT_MODERATE'),
  validateRequest(ContentModerationValidation.removeJobPostSchema),
  ContentModerationController.removeJobPost
);

export const contentModerationRoutes = router;
