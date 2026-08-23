import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ProgressService } from "./progress.service";


const createProgress = catchAsync(async (req: Request, res: Response) => {
  const trainerUserId = req.user.id as string;
  const result = await ProgressService.createProgressEntry(trainerUserId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Progress updated successfully.",
    data: result,
  });
});

const getMemberProgressHistory = catchAsync(async (req: Request, res: Response) => {
  const trainerUserId = req.user.id as string;
  const { memberId } = req.params;

  const result = await ProgressService.getMemberProgressHistory(trainerUserId, memberId as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Member progress history retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

export const ProgressController = {
  createProgress,
  getMemberProgressHistory,
};
