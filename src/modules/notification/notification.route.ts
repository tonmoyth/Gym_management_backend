import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import validateRequest from '../../middlewares/validateRequest';
import { NotificationController } from './notification.controller';
import { NotificationValidations } from './notification.validation';

const router = express.Router();

router.get(
  '/',
  checkAuth(),
  validateRequest(NotificationValidations.getMyNotificationsValidation),
  NotificationController.getMyNotifications
);

router.patch(
  '/read-all',
  checkAuth(),
  NotificationController.markAllNotificationsAsRead
);

router.patch(
  '/:id/read',
  checkAuth(),
  validateRequest(NotificationValidations.markNotificationAsReadValidation),
  NotificationController.markNotificationAsRead
);

export const notificationRoutes = router;
