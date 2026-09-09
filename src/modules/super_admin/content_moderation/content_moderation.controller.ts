import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { ContentModerationService } from './content_moderation.service';

const getModerationReviews = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ContentModerationService.getModerationReviews(
      req.query
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Reviews retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  }
);

const removeReview = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.id as string;

  const result = await ContentModerationService.removeReview(
    id as string,
    adminId
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Review removed successfully',
    data: result,
  });
});

const getModerationJobPosts = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ContentModerationService.getModerationJobPosts(
      req.query
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Job posts retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  }
);

const removeJobPost = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.id as string;

  const result = await ContentModerationService.removeJobPost(
    id as string,
    adminId
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Job post removed successfully',
    data: result,
  });
});

export const ContentModerationController = {
  getModerationReviews,
  removeReview,
  getModerationJobPosts,
  removeJobPost,
};
