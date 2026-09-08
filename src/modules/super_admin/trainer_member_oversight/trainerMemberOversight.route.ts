import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import { Role } from '../../../generated/prisma/enums';
import validateRequest from '../../../middlewares/validateRequest';
import { TrainerMemberOversightController } from './trainerMemberOversight.controller';
import { TrainerMemberOversightValidation } from './trainerMemberOversight.validation';

const router = express.Router();

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(TrainerMemberOversightValidation.getUsersQueryZodSchema),
  TrainerMemberOversightController.getAllUsers
);

router.patch(
  '/:id/status',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(TrainerMemberOversightValidation.updateAccountStatusZodSchema),
  TrainerMemberOversightController.updateAccountStatus
);

export const trainerMemberOversightRoutes = router;
