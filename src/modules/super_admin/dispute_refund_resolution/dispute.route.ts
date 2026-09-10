import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import { checkPermission } from '../../../middlewares/checkPermission';
import { Role } from '../../../generated/prisma/enums';
import validateRequest from '../../../middlewares/validateRequest';
import { DisputeRefundResolutionController } from './dispute.controller';
import { DisputeRefundResolutionValidation } from './dispute.validation';

const router = express.Router();

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('DISPUTE_READ'),
  validateRequest(DisputeRefundResolutionValidation.getDisputesQuerySchema),
  DisputeRefundResolutionController.getAllDisputes
);

router.get(
  '/:id',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('DISPUTE_READ'),
  validateRequest(DisputeRefundResolutionValidation.getDisputeByIdSchema),
  DisputeRefundResolutionController.getDisputeById
);

router.patch(
  '/:id/resolve',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('DISPUTE_RESOLVE'),
  validateRequest(DisputeRefundResolutionValidation.resolveDisputeSchema),
  DisputeRefundResolutionController.resolveDispute
);

export const disputeRefundResolutionRoutes = router;
