import { z } from "zod";
import { BiometricAttendanceType, VerifyMethod } from "../../generated/prisma/client";

const registerDeviceValidation = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    serialNumber: z.string().min(1, "Serial Number is required"),
    brand: z.string().min(1, "Brand is required"),
  }),
});

const getDevicesValidation = z.object({
  params: z.object({
    businessId: z.string().uuid("Invalid businessId UUID"),
  }),
});

const deleteDeviceValidation = z.object({
  params: z.object({
    businessId: z.string().uuid("Invalid businessId UUID"),
    deviceId: z.string().uuid("Invalid deviceId UUID"),
  }),
});

const getReportValidation = z.object({
  params: z.object({
    businessId: z.string().uuid("Invalid businessId UUID"),
  }),
  query: z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    memberId: z.string().uuid().optional(),
    attendanceType: z.nativeEnum(BiometricAttendanceType).optional(),
    verifyMethod: z.nativeEnum(VerifyMethod).optional(),
  }).passthrough(), // Allow QueryBuilder generic fields
});

const getSummaryValidation = z.object({
  params: z.object({
    businessId: z.string().uuid("Invalid businessId UUID"),
  }),
});

const getMemberHistoryValidation = z.object({
  params: z.object({
    businessId: z.string().uuid("Invalid businessId UUID"),
    memberId: z.string().uuid("Invalid memberId UUID"),
  }),
});

const testDeviceAttendanceValidation = z.object({
  body: z.object({
    serialNumber: z.string().min(1, "Serial number is required"),
    biometricId: z.string().min(1, "Biometric ID is required"),
    attendanceTime: z.string().datetime(),
    verifyMethod: z.nativeEnum(VerifyMethod).default(VerifyMethod.FINGERPRINT),
    type: z.nativeEnum(BiometricAttendanceType).default(BiometricAttendanceType.CHECK_IN),
  }),
});

export const AttendanceValidations = {
  registerDeviceValidation,
  getDevicesValidation,
  deleteDeviceValidation,
  getReportValidation,
  getSummaryValidation,
  getMemberHistoryValidation,
  testDeviceAttendanceValidation,
};
