import express from 'express';
import { Role } from '../../../generated/prisma/enums';
import { checkAuth } from '../../../middlewares/checkAuth';
import validateRequest from '../../../middlewares/validateRequest';
import { SystemAnnouncementValidations } from './systemAnnouncement.validation';
import { SystemAnnouncementController } from './systemAnnouncement.controller';

const router = express.Router();

router.post(
  '/',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(SystemAnnouncementValidations.createAnnouncementValidation),
  SystemAnnouncementController.createAnnouncement
);

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  SystemAnnouncementController.getAnnouncements
);

export const systemAnnouncementRoutes = router;
