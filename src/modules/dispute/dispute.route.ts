import express from 'express';
import { DisputeController } from './dispute.controller';
import validateRequest from '../../middlewares/validateRequest';
import { DisputeValidation } from './dispute.validation';
import { checkAuth } from '../../middlewares/checkAuth';
import { USER_ROLE } from '../Business/business.constant';

const router = express.Router();

router.post(
  '/',
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER, USER_ROLE.TRAINER),
  validateRequest(DisputeValidation.createDisputeSchema),
  DisputeController.createDispute,
);

router.get(
  '/me',
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER, USER_ROLE.TRAINER),
  DisputeController.getMyDisputes,
);

export const disputeRoutes = router;
