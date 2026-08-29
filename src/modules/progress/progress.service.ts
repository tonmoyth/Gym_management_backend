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

  const isAssigned = await prisma.classBooking.findFirst({
    where: {
      memberId: memberProfile.id,
      classSchedule: {
        trainerId: trainerProfile.id,
      },
    },
  });

  if (!isAssigned) {
    throw new AppError(403, "Trainer is not assigned to this member.");
  }

  return { trainerProfile, memberProfile };
};

const createProgressEntry = async (trainerUserId: string, payload: ICreateProgressPayload) => {
  const { memberProfile } = await verifyTrainerMemberAssignment(trainerUserId, payload.memberId);

  const progressEntry = await prisma.progressLog.create({
    data: {
      memberId: memberProfile.id,
      source: ProgressSource.TRAINER,
      loggedByUserId: trainerUserId,
      weight: payload.weight,
      bmi: payload.bmi,
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

const createSelfProgress = async (userId: string, payload: ICreateProgressPayload) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!memberProfile) {
    throw new AppError(404, "Member not found.");
  }

  const progressEntry = await prisma.progressLog.create({
    data: {
      memberId: memberProfile.id,
      source: ProgressSource.SELF,
      loggedByUserId: userId,
      weight: payload.weight,
      bmi: payload.bmi,
      measurements: payload.measurements,
      workoutLog: payload.workoutLog,
      loggedAt: payload.loggedAt || new Date(),
    },
  });

  return progressEntry;
};

const getMyProgress = async (userId: string, query: Record<string, unknown>) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!memberProfile) {
    throw new AppError(404, "Member not found.");
  }

  const queryBuilder = new QueryBuilder(prisma.progressLog as any, { ...(query as Record<string, string>), sortBy: (query.sortBy as string) || 'loggedAt', sortOrder: (query.sortOrder as "asc" | "desc") || 'desc' })
    .where({ memberId: memberProfile.id })
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await queryBuilder.execute();

  return result;
};

export const ProgressService = {
  createProgressEntry,
  getMemberProgressHistory,
  createSelfProgress,
  getMyProgress,
};
