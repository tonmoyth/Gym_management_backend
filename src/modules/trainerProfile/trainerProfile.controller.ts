import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { TrainerProfileService } from "./trainerProfile.service";

const upsertTrainerProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const payload = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const profilePhoto = files?.profilePhoto?.[0];
  const certificationFiles = files?.certificationFiles || [];

  const result = await TrainerProfileService.upsertTrainerProfile(userId, payload, profilePhoto, certificationFiles);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer profile updated successfully.",
    data: result,
  });
});

const getOwnTrainerProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const result = await TrainerProfileService.getOwnTrainerProfile(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer profile retrieved successfully.",
    data: result,
  });
});

export const TrainerProfileController = {
  upsertTrainerProfile,
  getOwnTrainerProfile,
};
