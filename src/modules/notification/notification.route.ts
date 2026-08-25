import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../Business/business.constant';
import { NotificationController } from './notification.controller';
import { NotificationValidations } from './notification.validation';

const router = express.Router();

router.get(
  '/',
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  validateRequest(NotificationValidations.getMyNotificationsValidation),
  NotificationController.getMyNotifications
);

router.patch(
  '/:id/read',
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  validateRequest(NotificationValidations.markNotificationAsReadValidation),
  NotificationController.markNotificationAsRead
);

export const notificationRoutes = router;
