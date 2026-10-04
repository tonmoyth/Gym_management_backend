import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { ProgressSource } from "../../generated/prisma/client";
import { QueryBuilder } from "../../utils/queryBuilder";

interface ICreateProgressPayload {
  memberId: string;
  weight?: number;
  bmi?: number;
  measurements?: any;
  workoutLog?: string;
  loggedAt?: Date;
}

const verifyTrainerMemberAssignment = async (trainerUserId: string, memberId: string) => {
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId: trainerUserId },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  const memberProfile = await prisma.memberProfile.findFirst({
    where: {
      OR: [
        { id: memberId },
        { userId: memberId }
      ]
    },
  });

  if (!memberProfile) {
    throw new AppError(404, "Member not found.");
  }

  const isAssigned =
    (await prisma.classBooking.findFirst({
      where: {
        memberId: memberProfile.id,
        classSchedule: {
          trainerId: trainerProfile.id,
        },
      },
    })) ||
    (await prisma.chatThread.findFirst({
      where: {
        memberId: memberProfile.id,
        trainerId: trainerProfile.id,
      },
    })) ||
    (await prisma.dietPlan.findFirst({
      where: {
        memberId: memberProfile.id,
        trainerId: trainerProfile.id,
      },
    })) ||
    (await prisma.membership.findFirst({
      where: {
        memberId: memberProfile.id,
        business: {
          trainers: {
            some: { trainerId: trainerProfile.id, isActive: true },
          },
        },
      },
    }));

  if (!isAssigned) {
    throw new AppError(403, "Trainer is not assigned to this member.");
  }

  return { trainerProfile, memberProfile };
};

const sanitizeProgressMetrics = (payload: ICreateProgressPayload) => {
  let sanitizedWeight: number | null = null;
  if (payload.weight !== undefined && payload.weight !== null && !isNaN(Number(payload.weight))) {
    const w = Number(Number(payload.weight).toFixed(2));
    if (w > 0 && w < 9999) {
      sanitizedWeight = w;
    }
  }

  let sanitizedBmi: number | null = null;
  let rawBmi = payload.bmi;

  // If BMI not provided but height and weight exist, compute it
  if (
    (rawBmi === undefined || rawBmi === null || isNaN(Number(rawBmi))) &&
    sanitizedWeight &&
    (payload.measurements as any)?.height
  ) {
    let h = Number((payload.measurements as any).height);
    if (h < 3) h = h * 100; // was entered in meters (e.g. 1.75m -> 175cm)
    if (h > 30) {
      const heightInM = h / 100;
      rawBmi = Number((sanitizedWeight / (heightInM * heightInM)).toFixed(2));
    }
  }

  if (rawBmi !== undefined && rawBmi !== null && !isNaN(Number(rawBmi)) && isFinite(Number(rawBmi))) {
    let b = Number(Number(rawBmi).toFixed(2));
    // If someone entered height in meters when cm was expected without converting, BMI could be > 1000
    if (b > 100 && (payload.measurements as any)?.height && sanitizedWeight) {
      let h = Number((payload.measurements as any).height);
      if (h < 3) h = h * 100;
      if (h > 30) {
        const heightInM = h / 100;
        b = Number((sanitizedWeight / (heightInM * heightInM)).toFixed(2));
      }
    }
    // Safe clamp between 5.0 and 99.99
    if (b > 99.99) b = 99.99;
    if (b > 0) {
      sanitizedBmi = b;
    }
  }

  return { sanitizedWeight, sanitizedBmi };
};

const createProgressEntry = async (trainerUserId: string, payload: ICreateProgressPayload) => {
  const { memberProfile } = await verifyTrainerMemberAssignment(trainerUserId, payload.memberId);
  const { sanitizedWeight, sanitizedBmi } = sanitizeProgressMetrics(payload);

  const progressEntry = await prisma.progressLog.create({
    data: {
      memberId: memberProfile.id,
      source: ProgressSource.TRAINER,
      loggedByUserId: trainerUserId,
      weight: sanitizedWeight,
      bmi: sanitizedBmi,
      measurements: payload.measurements,
      workoutLog: payload.workoutLog,
      loggedAt: payload.loggedAt || new Date(),
    },
  });

  return progressEntry;
};

const getMemberProgressHistory = async (trainerUserId: string, memberId: string, query: Record<string, unknown>) => {
  const { memberProfile } = await verifyTrainerMemberAssignment(trainerUserId, memberId);

  const queryBuilder = new QueryBuilder(prisma.progressLog as any, query as any)
    .where({ memberId: memberProfile.id })
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await queryBuilder.execute();

  return result;
};

const getOrCreateMemberProfile = async (userId: string) => {
  let memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!memberProfile) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.role === 'MEMBER') {
      memberProfile = await prisma.memberProfile.create({
        data: { userId },
      });
    } else {
      throw new AppError(404, "Member not found.");
    }
  }

  return memberProfile;
};

const createSelfProgress = async (userId: string, payload: ICreateProgressPayload) => {
  const memberProfile = await getOrCreateMemberProfile(userId);
  const { sanitizedWeight, sanitizedBmi } = sanitizeProgressMetrics(payload);

  const progressEntry = await prisma.progressLog.create({
    data: {
      memberId: memberProfile.id,
      source: ProgressSource.SELF,
      loggedByUserId: userId,
      weight: sanitizedWeight,
      bmi: sanitizedBmi,
      measurements: payload.measurements,
      workoutLog: payload.workoutLog,
      loggedAt: payload.loggedAt || new Date(),
    },
  });

  return progressEntry;
};

const getMyProgress = async (userId: string, query: Record<string, unknown>) => {
  const memberProfile = await getOrCreateMemberProfile(userId);

  const queryBuilder = new QueryBuilder(prisma.progressLog as any, { ...(query as Record<string, string>), sortBy: (query.sortBy as string) || 'loggedAt', sortOrder: (query.sortOrder as "asc" | "desc") || 'desc' })
    .where({ memberId: memberProfile.id })
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await queryBuilder.execute();

  return result;
};

const getTrainerLoggedProgress = async (trainerUserId: string) => {
  const logs = await prisma.progressLog.findMany({
    where: { loggedByUserId: trainerUserId },
    orderBy: { loggedAt: "desc" },
    include: {
      member: {
        include: {
          user: {
            select: { fullName: true, email: true, profileImage: true },
          },
        },
      },
    },
    take: 50,
  });

  return logs.map((log) => ({
    id: log.id,
    memberId: log.memberId,
    memberName: log.member?.user?.fullName || "Member",
    memberEmail: log.member?.user?.email || "",
    memberImage: log.member?.user?.profileImage || null,
    weight: log.weight ? Number(log.weight) : null,
    bmi: log.bmi ? Number(log.bmi) : null,
    measurements: log.measurements,
    workoutLog: log.workoutLog,
    loggedAt: log.loggedAt,
    date: log.loggedAt,
  }));
};

export const ProgressService = {
  createProgressEntry,
  getMemberProgressHistory,
  createSelfProgress,
  getMyProgress,
  getTrainerLoggedProgress,
};
