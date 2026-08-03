import { Router } from "express";
import express from "express";
import { AttendanceController } from "./attendance.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import validateRequest from "../../middlewares/validateRequest";
import { Role } from "../../generated/prisma/client";
import { AttendanceValidations } from "./attendance.validation";

const router = Router();

// ==========================================
// ZKTeco Device Endpoints (PUBLIC)
// ==========================================

// Handshake
router.get(
  "/iclock/cdata",
  AttendanceController.handleIclockHandshake
);

// Push Data (Requires text parsing)
router.post(
  "/iclock/cdata",
  express.text({ type: '*/*' }),
  AttendanceController.handleIclockCdata
);

// ==========================================
// Test Endpoints (PUBLIC for now as per prompt)
// ==========================================
router.post(
  "/device",
  validateRequest(AttendanceValidations.testDeviceAttendanceValidation),
  AttendanceController.testDeviceAttendance
);


// ==========================================
// Business Owner Endpoints
// ==========================================

// Devices
router.post(
  "/businesses/:businessId/devices",
  // @ts-ignore
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(AttendanceValidations.registerDeviceValidation),
  AttendanceController.registerDevice
);

router.get(
  "/businesses/:businessId/devices",
  // @ts-ignore
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(AttendanceValidations.getDevicesValidation),
  AttendanceController.getDevices
);

router.delete(
  "/businesses/:businessId/devices/:deviceId",
  // @ts-ignore
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(AttendanceValidations.deleteDeviceValidation),
  AttendanceController.deleteDevice
);

// Reports & Analytics
router.get(
  "/businesses/:businessId/attendance",
  // @ts-ignore
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(AttendanceValidations.getReportValidation),
  AttendanceController.getAttendanceReport
);

router.get(
  "/businesses/:businessId/attendance/today",
  // @ts-ignore
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(AttendanceValidations.getSummaryValidation),
  AttendanceController.getTodayAttendanceSummary
);

router.get(
  "/businesses/:businessId/attendance/member/:memberId",
  // @ts-ignore
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(AttendanceValidations.getMemberHistoryValidation),
  AttendanceController.getMemberAttendanceHistory
);

export const attendanceRoutes = router;
