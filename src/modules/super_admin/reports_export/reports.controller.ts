import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { ReportsService } from './reports.service';
import { ReportsExportService } from './reportsExport.service';
import AppError from '../../../errors/AppError';

const getPlatformReport = catchAsync(async (req: Request, res: Response) => {
  const result = await ReportsService.getPlatformReport(req.query as any);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Platform report retrieved successfully',
    data: result,
  });
});

const exportPlatformReport = catchAsync(async (req: Request, res: Response) => {
  const format = (req.query.format as string)?.toLowerCase();

  if (!format || !['pdf', 'excel', 'xlsx'].includes(format)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid format. Supported formats are 'pdf', 'excel', and 'xlsx'."
    );
  }

  // Reuse same underlying report service data
  const reportData = await ReportsService.getPlatformReport(req.query as any);
  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === 'pdf') {
    const pdfBuffer = await ReportsExportService.generatePDF(reportData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="platform-report-${timestamp}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.status(httpStatus.OK).send(pdfBuffer);
    return;
  }

  // Excel (.xlsx) export
  const excelBuffer = await ReportsExportService.generateExcel(reportData);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="platform-report-${timestamp}.xlsx"`
  );
  res.setHeader('Content-Length', excelBuffer.length);
  res.status(httpStatus.OK).send(excelBuffer);
});

export const ReportsController = {
  getPlatformReport,
  exportPlatformReport,
};
