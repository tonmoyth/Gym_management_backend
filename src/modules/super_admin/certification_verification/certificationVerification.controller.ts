import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { CertificationVerificationService } from './certificationVerification.service';

const getPendingCertifications = catchAsync(async (req: Request, res: Response) => {
  const result = await CertificationVerificationService.getPendingCertifications(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Pending certifications retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const verifyCertification = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.id;

  const result = await CertificationVerificationService.verifyCertification(
    id as string,
    adminId as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Trainer certification verified successfully',
    data: result,
  });
});

const rejectCertification = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.id;
  const { reason } = req.body;

  const result = await CertificationVerificationService.rejectCertification(
    id as string,
    adminId as string,
    reason as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Trainer certification rejected successfully',
    data: result,
  });
});

export const CertificationVerificationController = {
  getPendingCertifications,
  verifyCertification,
  rejectCertification,
};
