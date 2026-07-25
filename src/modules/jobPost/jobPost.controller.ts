import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { JobPostService } from "./jobPost.service";

const createJobPost = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id as string;

  const result = await JobPostService.createJobPost(ownerId, req.body);

  sendResponse(res, {
    statusCode: 201, // Created
    success: true,
    message: "Trainer job post created successfully.",
    data: result,
  });
});

const closeJobPost = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id as string;
  const { id } = req.params;

  const result = await JobPostService.closeJobPost(ownerId, id as string);

  sendResponse(res, {
    statusCode: 200, // OK
    success: true,
    message: "Job post closed successfully.",
    data: result,
  });
});

const getJobPostApplicants = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id as string;
  const id = req.params.id as string;

  const result = await JobPostService.getJobPostApplicants(ownerId, id, req.query);

  sendResponse(res, {
    statusCode: 200, // OK
    success: true,
    message: "Job applicants retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

export const JobPostController = {
  createJobPost,
  closeJobPost,
  getJobPostApplicants,
};
