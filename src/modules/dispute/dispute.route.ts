import express from 'express';
import { DisputeController } from './dispute.controller';
import validateRequest from '../../middlewares/validateRequest';
import { DisputeValidation } from './dispute.validation';
import { checkAuth } from '../../middlewares/checkAuth';

const router = express.Router();

router.post(
  '/',
  checkAuth(),
  validateRequest(DisputeValidation.createDisputeSchema),
  DisputeController.createDispute,
);

router.get(
  '/me',
  checkAuth(),
  DisputeController.getMyDisputes,
);

export const disputeRoutes = router;
