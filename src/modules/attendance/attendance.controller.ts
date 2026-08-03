import { Request, Response } from "express";

import { AttendanceService } from "./attendance.service";
import { parseZKTecoPayload, AttendanceEvent } from "./attendance.parser";
import {
  BiometricAttendanceType,
  VerifyMethod,
} from "../../generated/prisma/client";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";

const registerDevice = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const { businessId } = req.params;
  const result = await AttendanceService.registerDevice(
    userId,
    businessId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Device registered successfully",
    data: result,
  });
});

const getDevices = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const { businessId } = req.params;
  const result = await AttendanceService.getDevices(
    userId,
    businessId as string,
    req.query,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Devices retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const deleteDevice = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const { businessId, deviceId } = req.params;
  await AttendanceService.deleteDevice(
    userId,
    businessId as string,
    deviceId as string,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Device deleted successfully",
    data: null,
  });
});

// ZKTeco specific Handshake Endpoint
const handleIclockHandshake = catchAsync(
  async (req: Request, res: Response) => {
    const { SN } = req.query;
    const responseText = await AttendanceService.handleIclockHandshake(
      SN as string,
    );

    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(responseText);
  },
);

// ZKTeco specific Attendance Push Endpoint
const handleIclockCdata = catchAsync(async (req: Request, res: Response) => {
  const { SN } = req.query;
  const rawPayload = req.body; // Since we need to read raw text body

  if (!SN) {
    res.status(400).send("SN required");
    return;
  }

  // Parse raw text to AttendanceEvents
  const events = parseZKTecoPayload(rawPayload);

  // Process asynchronously if needed, but for now we wait to confirm
  await AttendanceService.processAttendanceEvent(
    SN as string,
    events,
    rawPayload,
  );

  // Always return OK for ADMS
  res.setHeader("Content-Type", "text/plain");
  res.status(200).send("OK");
});

// Postman testing endpoint
const testDeviceAttendance = catchAsync(async (req: Request, res: Response) => {
  const { serialNumber, biometricId, attendanceTime, verifyMethod, type } =
    req.body;

  const event: AttendanceEvent = {
    biometricId,
    attendanceTime: new Date(attendanceTime),
    verifyMethod: verifyMethod as VerifyMethod,
    type: type as BiometricAttendanceType,
  };

  const result = await AttendanceService.processAttendanceEvent(
    serialNumber,
    [event],
    JSON.stringify(req.body),
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance tested successfully",
    data: result,
  });
});

const getAttendanceReport = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const { businessId } = req.params;
  const result = await AttendanceService.getAttendanceReport(
    userId,
    businessId as string,
    req.query,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance report retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getTodayAttendanceSummary = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id as string;
    const { businessId } = req.params;
    const result = await AttendanceService.getTodayAttendanceSummary(
      userId,
      businessId as string,
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Today's summary retrieved successfully",
      data: result,
    });
  },
);

const getMemberAttendanceHistory = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id as string;
    const { businessId, memberId } = req.params;
    const result = await AttendanceService.getMemberAttendanceHistory(
      userId,
      businessId as string,
      memberId as string,
      req.query,
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Member history retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  },
);

export const AttendanceController = {
  registerDevice,
  getDevices,
  deleteDevice,
  handleIclockHandshake,
  handleIclockCdata,
  testDeviceAttendance,
  getAttendanceReport,
  getTodayAttendanceSummary,
  getMemberAttendanceHistory,
};
