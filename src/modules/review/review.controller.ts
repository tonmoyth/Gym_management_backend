import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ReviewService } from "./review.service";

const getTrainerReviews = catchAsync(async (req: Request, res: Response) => {
  const { trainerId } = req.params;
  const result = await ReviewService.getTrainerReviews(trainerId as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer reviews retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

export const ReviewController = {
  getTrainerReviews,
};
