import { z } from 'zod';

const bdPhoneRegex = /^01[3-9]\d{8}$/;

const createPaymentAccountSchema = z
  .object({
    accountType: z.enum(['BANK', 'BKASH', 'NAGAD'] as const, {
      message: 'Account type is required (BANK, BKASH, NAGAD)',
    }),
    accountName: z.string().min(2, 'Account name must be at least 2 characters'),
    accountNumber: z.string().min(6, 'Account number is required'),
    bankName: z.string().optional(),
    branchName: z.string().optional(),
    routingNumber: z.string().optional(),
    isDefault: z.boolean().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE'] as const).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accountType === 'BANK') {
      if (!data.bankName || data.bankName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bank name is required for BANK accounts',
          path: ['bankName'],
        });
      }
    } else if (data.accountType === 'BKASH' || data.accountType === 'NAGAD') {
      if (!bdPhoneRegex.test(data.accountNumber.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Must be a valid 11-digit Bangladeshi mobile number (e.g. 01712345678)',
          path: ['accountNumber'],
        });
      }
    }
  });

const updatePaymentAccountSchema = z
  .object({
    accountType: z.enum(['BANK', 'BKASH', 'NAGAD'] as const).optional(),
    accountName: z.string().min(2).optional(),
    accountNumber: z.string().min(6).optional(),
    bankName: z.string().optional(),
    branchName: z.string().optional(),
    routingNumber: z.string().optional(),
    isDefault: z.boolean().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE'] as const).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accountType === 'BANK' && data.bankName !== undefined && data.bankName.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bank name must be at least 2 characters',
        path: ['bankName'],
      });
    }
    if ((data.accountType === 'BKASH' || data.accountType === 'NAGAD') && data.accountNumber) {
      if (!bdPhoneRegex.test(data.accountNumber.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Must be a valid 11-digit Bangladeshi mobile number (e.g. 01712345678)',
          path: ['accountNumber'],
        });
      }
    }
  });

export const PaymentAccountValidation = {
  createPaymentAccountValidation: z.object({
    body: createPaymentAccountSchema,
  }),
  updatePaymentAccountValidation: z.object({
    body: updatePaymentAccountSchema,
  }),
};
