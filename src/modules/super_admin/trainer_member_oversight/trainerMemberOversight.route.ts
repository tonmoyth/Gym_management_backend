import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import { checkPermission } from '../../../middlewares/checkPermission';
import { Role } from '../../../generated/prisma/enums';
import validateRequest from '../../../middlewares/validateRequest';
import { TrainerMemberOversightController } from './trainerMemberOversight.controller';
import { TrainerMemberOversightValidation } from './trainerMemberOversight.validation';

const router = express.Router();

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('USER_READ'),
  validateRequest(TrainerMemberOversightValidation.getUsersQueryZodSchema),
  TrainerMemberOversightController.getAllUsers
);

router.patch(
  '/:id/status',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  checkPermission('USER_SUSPEND'),
  validateRequest(TrainerMemberOversightValidation.updateAccountStatusZodSchema),
  TrainerMemberOversightController.updateAccountStatus
);

export const trainerMemberOversightRoutes = router;
