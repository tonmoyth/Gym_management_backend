import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ReviewService } from "./review.service";
import httpStatus from "http-status";

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

const createReview = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await ReviewService.createReview(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Review submitted successfully.",
    data: result,
  });
});

const getBusinessReviews = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const result = await ReviewService.getBusinessReviews(businessId as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Business reviews retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

export const ReviewController = {
  getTrainerReviews,
  createReview,
  getBusinessReviews,
};
