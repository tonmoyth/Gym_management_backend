import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { TrainerProfileService } from "./trainerProfile.service";

const createTrainerProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const payload = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const profilePhoto = files?.profilePhoto?.[0];
  const certificationFiles = files?.certificationFiles || [];

  const result = await TrainerProfileService.createTrainerProfile(
    userId,
    payload,
    profilePhoto,
    certificationFiles,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Trainer profile created successfully.",
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

const getPublicTrainerProfile = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TrainerProfileService.getPublicTrainerProfile(id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer profile retrieved successfully.",
    data: result,
  });
});

const getAllTrainers = catchAsync(async (req: Request, res: Response) => {
  const result = await TrainerProfileService.getAllTrainers(req.query as any);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Verified trainers retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});
const setOwnSpecializations = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const { specializationIds } = req.body;
  const result = await TrainerProfileService.setOwnSpecializations(userId, specializationIds);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer specializations updated successfully.",
    data: result,
  });
});

export const TrainerProfileController = {
  createTrainerProfile,
  getOwnTrainerProfile,
  getPublicTrainerProfile,
  getAllTrainers,
  setOwnSpecializations,
};
