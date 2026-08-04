import { Request, Response } from "express";

import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ReportService } from "./report.service";

const getRevenueReport = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const { businessId } = req.params;

  const result = await ReportService.getRevenueReport(userId, businessId as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Revenue report retrieved successfully.",
    data: result,
  });
});

const getPayoutReport = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const { businessId } = req.params;

  const result = await ReportService.getPayoutReport(userId, businessId as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer payout report retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

export const ReportController = {
  getRevenueReport,
  getPayoutReport,
};
