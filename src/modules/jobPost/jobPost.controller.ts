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

const approveTrainerApplication = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id as string;
  const appId = req.params.appId as string;

  const result = await JobPostService.approveTrainerApplication(ownerId, appId, req.body);

  sendResponse(res, {
    statusCode: 200, // OK
    success: true,
    message: "Trainer application approved successfully.",
    data: result,
  });
});

const rejectTrainerApplication = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id as string;
  const appId = req.params.appId as string;

  const result = await JobPostService.rejectTrainerApplication(ownerId, appId);

  sendResponse(res, {
    statusCode: 200, // OK
    success: true,
    message: "Trainer application rejected successfully.",
    data: result,
  });
});

const getOpenJobPosts = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const userRole = req.user.role;
  const query = req.query;

  // Fallback: If accessed by Business Owner or Staff, return their business job posts
  if (userRole === "BUSINESS_OWNER" || userRole === "STAFF") {
    const result = await JobPostService.getMyJobPosts(userId, query);
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Job posts retrieved successfully.",
      meta: result.meta,
      data: result.data,
    });
  }

  const result = await JobPostService.getOpenJobPosts(userId, query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Open job posts retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

const getMyJobPosts = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const query = req.query;

  const result = await JobPostService.getMyJobPosts(userId, query);

  sendResponse(res, {
    statusCode: 200, // OK
    success: true,
    message: "Business job posts retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

const getJobPostDetail = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await JobPostService.getJobPostDetail(id as string);

  sendResponse(res, {
    statusCode: 200, // OK
    success: true,
    message: "Job post retrieved successfully.",
    data: result,
  });
});

const applyToJobPost = catchAsync(async (req: Request, res: Response) => {
  const trainerUserId = req.user.id as string;
  const { id } = req.params;

  const result = await JobPostService.applyToJobPost(trainerUserId, id as string);

  sendResponse(res, {
    statusCode: 201, // Created
    success: true,
    message: "Job application submitted successfully.",
    data: result,
  });
});

const getMyApplications = catchAsync(async (req: Request, res: Response) => {
  const trainerUserId = req.user.id as string;
  const query = req.query;

  const result = await JobPostService.getMyApplications(trainerUserId, query);

  sendResponse(res, {
    statusCode: 200, // OK
    success: true,
    message: "Trainer applications retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

export const JobPostController = {
  createJobPost,
  closeJobPost,
  getJobPostApplicants,
  approveTrainerApplication,
  rejectTrainerApplication,
  getOpenJobPosts,
  getMyJobPosts,
  getJobPostDetail,
  applyToJobPost,
  getMyApplications,
};
