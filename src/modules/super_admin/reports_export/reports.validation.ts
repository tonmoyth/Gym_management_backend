import { z } from 'zod';

const getPlatformReportValidation = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

const exportPlatformReportValidation = z.object({
  query: z.object({
    format: z.enum(['pdf', 'excel', 'xlsx'], {
      message: "Format must be either 'pdf', 'excel', or 'xlsx'",
    }),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const ReportsValidation = {
  getPlatformReportValidation,
  exportPlatformReportValidation,
};
