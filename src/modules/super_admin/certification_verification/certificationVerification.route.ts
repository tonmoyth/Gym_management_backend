import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import { checkPermission } from '../../../middlewares/checkPermission';
import { Role } from '../../../generated/prisma/enums';
import validateRequest from '../../../middlewares/validateRequest';
import { CertificationVerificationController } from './certificationVerification.controller';
import { CertificationVerificationValidation } from './certificationVerification.validation';

const router = express.Router();

router.get(
  '/pending',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('CERTIFICATION_READ'),
  validateRequest(CertificationVerificationValidation.getPendingCertificationsValidation),
  CertificationVerificationController.getPendingCertifications
);

router.patch(
  '/:id/verify',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('CERTIFICATION_VERIFY'),
  validateRequest(CertificationVerificationValidation.certificationIdParamValidation),
  CertificationVerificationController.verifyCertification
);

router.patch(
  '/:id/reject',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('CERTIFICATION_REJECT'),
  validateRequest(CertificationVerificationValidation.rejectCertificationValidation),
  CertificationVerificationController.rejectCertification
);

export const certificationVerificationRoutes = router;
