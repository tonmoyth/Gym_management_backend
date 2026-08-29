import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { QueryBuilder } from "../../utils/queryBuilder";
import { pushJob } from "../../utils/redisQueue";
import { AttendanceEvent } from "./attendance.parser";
import { DeviceStatus, BiometricAttendanceType, VerifyMethod } from "../../generated/prisma/client";

// ==========================================
// Device Management
// ==========================================

const verifyBusinessOwner = async (businessId: string, userId: string) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });

  if (!business) {
    throw new AppError(httpStatus.NOT_FOUND, "Business not found");
  }

  if (business.ownerId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, "You do not own this business");
  }
};

const registerDevice = async (userId: string, businessId: string, payload: { name: string; serialNumber: string; brand: string }) => {
  await verifyBusinessOwner(businessId, userId);

  // Check if serial number exists globally
  const existingDevice = await prisma.biometricDevice.findUnique({
    where: { serialNumber: payload.serialNumber },
  });

  if (existingDevice) {
    throw new AppError(httpStatus.BAD_REQUEST, "Device with this serial number already exists");
  }

  const device = await prisma.biometricDevice.create({
    data: {
      businessId,
      name: payload.name,
      serialNumber: payload.serialNumber,
      brand: payload.brand,
    },
  });

  return device;
};

const getDevices = async (userId: string, businessId: string, queryParams: any) => {
  await verifyBusinessOwner(businessId, userId);

  const deviceConfig = {
    searchableFields: ["name", "serialNumber", "brand"],
    filterableFields: ["status"],
  };

  const deviceQuery = new QueryBuilder(
    prisma.biometricDevice,
    { ...queryParams, sortBy: queryParams.sortBy || "createdAt", sortOrder: queryParams.sortOrder || "desc" },
    deviceConfig
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .where({ businessId });

  const [total, data] = await Promise.all([
    deviceQuery.count(),
    prisma.biometricDevice.findMany(deviceQuery.getQuery() as any),
  ]);

  return {
    meta: {
      page: Number(queryParams.page) || 1,
      limit: Number(queryParams.limit) || 10,
      total,
      totalPages: Math.ceil(total / (Number(queryParams.limit) || 10)),
    },
    data,
  };
};

const deleteDevice = async (userId: string, businessId: string, deviceId: string) => {
  await verifyBusinessOwner(businessId, userId);

  const device = await prisma.biometricDevice.findUnique({
    where: { id: deviceId },
  });

  if (!device || device.businessId !== businessId) {
    throw new AppError(httpStatus.NOT_FOUND, "Device not found in this business");
  }

  await prisma.biometricDevice.delete({
    where: { id: deviceId },
  });

  return null;
};

// ==========================================
// ZKTeco Handshake
// ==========================================

const handleIclockHandshake = async (serialNumber?: string) => {
  if (!serialNumber) {
    throw new AppError(httpStatus.BAD_REQUEST, "SN is required");
  }

  const device = await prisma.biometricDevice.findUnique({
    where: { serialNumber },
    select: { id: true },
  });

  if (!device) {
    throw new AppError(httpStatus.NOT_FOUND, "Device not found");
  }

  // Update heartbeat asynchronously
  prisma.biometricDevice.update({
    where: { id: device.id },
    data: { lastHeartbeat: new Date(), status: DeviceStatus.ONLINE },
  }).catch(console.error);

  // Return standard ADMS handshake response
  return "GET OPTION FROM: " + serialNumber + "\nStamp=9999\nOpStamp=9999\nErrorDelay=60\nDelay=10\nTransTimes=00:00;14:00\nTransInterval=1\nTransFlag=1111000000\nTimeZone=54\nRealtime=1\nEncrypt=0";
};

// ==========================================
// Core Attendance Processing
// ==========================================

const processAttendanceEvent = async (serialNumber: string, events: AttendanceEvent[], rawPayload?: string) => {
  const device = await prisma.biometricDevice.findUnique({
    where: { serialNumber },
    select: { id: true, businessId: true },
  });

  if (!device) {
    throw new AppError(httpStatus.NOT_FOUND, "Device not found");
  }

  // Update heartbeat asynchronously
  prisma.biometricDevice.update({
    where: { id: device.id },
    data: { lastHeartbeat: new Date(), status: DeviceStatus.ONLINE },
  }).catch(console.error);

  let successCount = 0;

  // Process sequentially to easily handle db errors for duplicates, or use Promise.allSettled
  for (const event of events) {
    try {
      // Find member mapping
      const memberMapping = await prisma.memberBiometric.findUnique({
        where: {
          businessId_biometricId: {
            businessId: device.businessId,
            biometricId: event.biometricId,
          }
        },
        select: { memberId: true },
      });

      if (!memberMapping) {
        // Unknown member, just skip
        continue;
      }

      // Check for exact duplicate attendance to prevent unique constraint error crashing loop
      const existingLog = await prisma.attendanceLog.findUnique({
        where: {
          memberId_attendanceTime: {
            memberId: memberMapping.memberId,
            attendanceTime: event.attendanceTime,
          }
        }
      });

      if (existingLog) {
        continue; // Duplicate, skip
      }

      // Insert log
      const log = await prisma.attendanceLog.create({
        data: {
          businessId: device.businessId,
          memberId: memberMapping.memberId,
          deviceId: device.id,
          attendanceType: event.type,
          verifyMethod: event.verifyMethod,
          attendanceTime: event.attendanceTime,
          rawPayload,
        }
      });

      // Push Redis Event
      pushJob("attendance_queue", {
        eventType: "ATTENDANCE_CREATED",
        attendanceId: log.id,
        businessId: log.businessId,
        memberId: log.memberId,
        type: log.attendanceType,
        time: log.attendanceTime,
      });

      successCount++;
    } catch (err) {
      console.error(`Failed to process attendance for ${event.biometricId}:`, err);
    }
  }

  return { processed: successCount, total: events.length };
};

// ==========================================
// Reporting & Analytics
// ==========================================

const getAttendanceReport = async (userId: string, businessId: string, queryParams: any) => {
  await verifyBusinessOwner(businessId, userId);

  const params = { ...queryParams };

  // Manual date filters mapping for QueryBuilder
  const whereConditions: any = { businessId };
  if (params.dateFrom || params.dateTo) {
    whereConditions.attendanceTime = {};
    if (params.dateFrom) whereConditions.attendanceTime.gte = new Date(params.dateFrom);
    if (params.dateTo) whereConditions.attendanceTime.lte = new Date(params.dateTo);
  }
  if (params.memberId) whereConditions.memberId = params.memberId;
  if (params.attendanceType) whereConditions.attendanceType = params.attendanceType;
  if (params.verifyMethod) whereConditions.verifyMethod = params.verifyMethod;

  const config = {
    searchableFields: ["member.user.fullName", "member.user.email", "member.user.phoneNumber"],
    filterableFields: [],
  };

  const attendanceQuery = new QueryBuilder(
    prisma.attendanceLog,
    { ...params, sortBy: params.sortBy || "attendanceTime", sortOrder: params.sortOrder || "desc" },
    config
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .where(whereConditions);

  const args = attendanceQuery.getQuery();
  delete args.include;
  args.select = {
    id: true,
    attendanceType: true,
    verifyMethod: true,
    attendanceTime: true,
    member: {
      select: {
        id: true,
        user: { select: { fullName: true, email: true, profileImage: true } },
      }
    },
    device: {
      select: { id: true, name: true, serialNumber: true },
    }
  };

  const [total, data] = await Promise.all([
    attendanceQuery.count(),
    prisma.attendanceLog.findMany(args as any),
  ]);

  return {
    meta: {
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 10,
      total,
      totalPages: Math.ceil(total / (Number(params.limit) || 10)),
    },
    data,
  };
};

const getTodayAttendanceSummary = async (userId: string, businessId: string) => {
  await verifyBusinessOwner(businessId, userId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all logs for today for this business
  const todayLogs = await prisma.attendanceLog.findMany({
    where: {
      businessId,
      attendanceTime: {
        gte: today,
        lt: tomorrow,
      }
    },
    select: {
      memberId: true,
      attendanceType: true,
    }
  });

  let totalCheckIn = 0;
  let totalCheckOut = 0;
  
  // To find "currentlyInside", we can track the last event type for each member
  const memberLastState = new Map<string, string>();

  for (const log of todayLogs) {
    if (log.attendanceType === 'CHECK_IN') {
      totalCheckIn++;
      memberLastState.set(log.memberId, 'CHECK_IN');
    } else {
      totalCheckOut++;
      memberLastState.set(log.memberId, 'CHECK_OUT');
    }
  }

  let currentlyInside = 0;
  for (const [_, state] of memberLastState.entries()) {
    if (state === 'CHECK_IN') {
      currentlyInside++;
    }
  }

  // To calculate rate, we might need total active members for this business.
  const totalActiveMemberships = await prisma.membership.count({
    where: {
      businessId,
      status: "ACTIVE",
    }
  });

  const uniqueMembersAttended = memberLastState.size;
  const attendanceRate = totalActiveMemberships > 0 ? Math.round((uniqueMembersAttended / totalActiveMemberships) * 100) : 0;

  return {
    totalCheckIn,
    totalCheckOut,
    currentlyInside,
    attendanceRate,
  };
};

const getMemberAttendanceHistory = async (userId: string, businessId: string, memberId: string, queryParams: any) => {
  await verifyBusinessOwner(businessId, userId);

  // Verify member belongs to this business
  const membership = await prisma.membership.findFirst({
    where: { businessId, memberId },
  });

  if (!membership) {
    throw new AppError(httpStatus.NOT_FOUND, "Member not found in this business");
  }

  const params = { ...queryParams };
  const whereConditions: any = { businessId, memberId };
  
  if (params.dateFrom || params.dateTo) {
    whereConditions.attendanceTime = {};
    if (params.dateFrom) whereConditions.attendanceTime.gte = new Date(params.dateFrom);
    if (params.dateTo) whereConditions.attendanceTime.lte = new Date(params.dateTo);
  }

  const historyQuery = new QueryBuilder(
    prisma.attendanceLog,
    { ...params, sortBy: params.sortBy || "attendanceTime", sortOrder: params.sortOrder || "desc" },
    { searchableFields: [], filterableFields: [] }
  )
    .sort()
    .paginate()
    .where(whereConditions);

  const args = historyQuery.getQuery();
  delete args.include;
  args.select = {
    id: true,
    attendanceType: true,
    verifyMethod: true,
    attendanceTime: true,
    device: {
      select: { name: true, serialNumber: true },
    }
  };

  const [total, data] = await Promise.all([
    historyQuery.count(),
    prisma.attendanceLog.findMany(args as any),
  ]);

  return {
    meta: {
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 10,
      total,
      totalPages: Math.ceil(total / (Number(params.limit) || 10)),
    },
    data,
  };
};

const memberCheckIn = async (userId: string, businessId: string) => {
  const member = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!member) {
    throw new AppError(httpStatus.NOT_FOUND, "Member profile not found");
  }

  const membership = await prisma.membership.findFirst({
    where: {
      memberId: member.id,
      businessId,
      status: "ACTIVE",
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } }
      ]
    },
  });

  if (!membership) {
    throw new AppError(httpStatus.BAD_REQUEST, "You do not have an active membership for this business.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Use transaction for check and create
  const log = await prisma.$transaction(async (tx) => {
    const recentLog = await tx.attendanceLog.findFirst({
      where: {
        memberId: member.id,
        businessId,
        attendanceTime: {
          gte: today,
          lt: tomorrow,
        }
      },
      orderBy: { attendanceTime: 'desc' },
    });

    if (recentLog && recentLog.attendanceType === BiometricAttendanceType.CHECK_IN) {
      throw new AppError(httpStatus.CONFLICT, "Member is already checked in.");
    }

    return await tx.attendanceLog.create({
      data: {
        businessId,
        memberId: member.id,
        attendanceType: BiometricAttendanceType.CHECK_IN,
        verifyMethod: VerifyMethod.MANUAL,
        attendanceTime: new Date(),
        rawPayload: "Manual Check-in via App",
      },
    });
  });

  // Push Redis Event
  pushJob("attendance_queue", {
    eventType: "ATTENDANCE_CREATED",
    attendanceId: log.id,
    businessId: log.businessId,
    memberId: log.memberId,
    type: log.attendanceType,
    time: log.attendanceTime,
  });

  return log;
};

const getMyAttendance = async (userId: string, queryParams: any) => {
  const member = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!member) {
    throw new AppError(httpStatus.NOT_FOUND, "Member profile not found");
  }

  const params = { ...queryParams };
  const whereConditions: any = { memberId: member.id };
  
  if (params.dateFrom || params.dateTo) {
    whereConditions.attendanceTime = {};
    if (params.dateFrom) whereConditions.attendanceTime.gte = new Date(params.dateFrom);
    if (params.dateTo) whereConditions.attendanceTime.lte = new Date(params.dateTo);
  }

  const historyQuery = new QueryBuilder(
    prisma.attendanceLog,
    { ...params, sortBy: params.sortBy || "attendanceTime", sortOrder: params.sortOrder || "desc" },
    { searchableFields: [], filterableFields: [] }
  )
    .sort()
    .paginate()
    .where(whereConditions);

  const args = historyQuery.getQuery();
  delete args.include;
  args.select = {
    id: true,
    attendanceType: true,
    verifyMethod: true,
    attendanceTime: true,
    business: {
      select: { name: true }
    }
  };

  const [total, data] = await Promise.all([
    historyQuery.count(),
    prisma.attendanceLog.findMany(args as any),
  ]);

  // Calculate Streak
  const allLogs = await prisma.attendanceLog.findMany({
    where: { memberId: member.id },
    select: { attendanceTime: true },
    orderBy: { attendanceTime: 'desc' },
  });

  const attendedDates = new Set<string>();
  allLogs.forEach(log => {
    const dateStr = log.attendanceTime.toISOString().split('T')[0];
    attendedDates.add(dateStr);
  });

  const uniqueDates = Array.from(attendedDates).sort((a, b) => (a < b ? 1 : -1));

  let currentStreak = 0;
  let longestStreak = 0;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let checkDate = new Date();
  if (attendedDates.has(todayStr) || attendedDates.has(yesterdayStr)) {
    if (!attendedDates.has(todayStr)) {
      checkDate = yesterday;
    }
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (attendedDates.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  if (uniqueDates.length > 0) {
    let currentLongest = 1;
    longestStreak = 1;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const curr = new Date(uniqueDates[i]);
      const prev = new Date(uniqueDates[i + 1]);
      
      const diffTime = Math.abs(curr.getTime() - prev.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentLongest++;
        if (currentLongest > longestStreak) {
          longestStreak = currentLongest;
        }
      } else {
        currentLongest = 1;
      }
    }
  }

  const historyMap = new Map<string, any>();
  for (const log of data) {
    const date = log.attendanceTime.toISOString().split('T')[0];
    if (!historyMap.has(date)) {
      historyMap.set(date, {
        id: log.id,
        date,
        checkIn: null,
        checkOut: null,
        method: log.verifyMethod,
        business: (log as any).business?.name,
      });
    }
    const dayData = historyMap.get(date);
    if (log.attendanceType === BiometricAttendanceType.CHECK_IN) {
      if (!dayData.checkIn || log.attendanceTime < dayData.checkIn) {
        dayData.checkIn = log.attendanceTime;
      }
    } else {
      if (!dayData.checkOut || log.attendanceTime > dayData.checkOut) {
        dayData.checkOut = log.attendanceTime;
      }
    }
  }

  return {
    meta: {
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 10,
      total,
      totalPages: Math.ceil(total / (Number(params.limit) || 10)),
    },
    data: {
      summary: {
        totalDays: uniqueDates.length,
        currentStreak,
        longestStreak,
      },
      history: Array.from(historyMap.values()),
    },
  };
};

export const AttendanceService = {
  registerDevice,
  getDevices,
  deleteDevice,
  handleIclockHandshake,
  processAttendanceEvent,
  getAttendanceReport,
  getTodayAttendanceSummary,
  getMemberAttendanceHistory,
  memberCheckIn,
  getMyAttendance,
};
