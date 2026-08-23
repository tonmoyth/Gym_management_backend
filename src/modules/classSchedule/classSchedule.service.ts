import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";
import { pushJob } from "../../utils/redisQueue";

const createClassSchedule = async (ownerId: string, businessId: string, payload: any) => {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new AppError(404, "Business not found.");
  if (business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not own this business.");

  const trainerProfile = await prisma.trainerProfile.findUnique({ where: { id: payload.trainerId } });
  if (!trainerProfile) throw new AppError(404, "Trainer not found.");

  const trainerBusiness = await prisma.trainerBusiness.findUnique({
    where: {
      trainerId_businessId: {
        trainerId: payload.trainerId,
        businessId: businessId,
      }
    }
  });
  if (!trainerBusiness || !trainerBusiness.isActive) {
    throw new AppError(403, "Trainer does not belong to this business or is not active.");
  }

  const overlappingClass = await prisma.classSchedule.findFirst({
    where: {
      trainerId: payload.trainerId,
      startTime: { lt: new Date(payload.endTime) },
      endTime: { gt: new Date(payload.startTime) }
    }
  });

  if (overlappingClass) {
    throw new AppError(409, "Trainer schedule conflict. The trainer already has a class scheduled during this time.");
  }

  const classSchedule = await prisma.classSchedule.create({
    data: {
      businessId,
      trainerId: payload.trainerId,
      title: payload.title,
      startTime: new Date(payload.startTime),
      endTime: new Date(payload.endTime),
      capacity: payload.capacity,
    }
  });

  return classSchedule;
};

const getClassSchedules = async (userId: string, role: string, businessId: string, query: any) => {
  if (role === "MEMBER") {
    const activeMembership = await prisma.membership.findFirst({
      where: { member: { userId }, businessId, status: "ACTIVE" },
    });
    if (!activeMembership) throw new AppError(403, "Forbidden. You do not have an active membership in this business.");
  } else if (role === "TRAINER") {
    const assignedTrainer = await prisma.trainerBusiness.findFirst({
      where: { trainer: { userId }, businessId, isActive: true },
    });
    if (!assignedTrainer) throw new AppError(403, "Forbidden. You are not assigned to this business.");
  } else if (role === "BUSINESS_OWNER") {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business || business.ownerId !== userId) {
      throw new AppError(403, "Forbidden. You do not own this business.");
    }
  } else {
    throw new AppError(403, "Forbidden. Invalid role for accessing class schedules.");
  }

  const additionalFilters: any = { businessId };

  if (query.trainerId) additionalFilters.trainerId = query.trainerId;
  
  if (query.date) {
    const startOfDay = new Date(query.date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(query.date);
    endOfDay.setUTCHours(23, 59, 59, 999);
    additionalFilters.startTime = { gte: startOfDay, lte: endOfDay };
  } else if (query.from || query.to) {
    additionalFilters.startTime = {};
    if (query.from) additionalFilters.startTime.gte = new Date(query.from);
    if (query.to) additionalFilters.startTime.lte = new Date(query.to);
  }

  const queryBuilder = new QueryBuilder(prisma.classSchedule, query, {
    searchableFields: ["title"]
  })
    .search()
    .filter()
    .where(additionalFilters)
    .sort()
    .paginate();

  queryBuilder.include({
    trainer: { select: { id: true, user: { select: { fullName: true } } } },
  });

  const [total, result] = await Promise.all([
    queryBuilder.count(),
    queryBuilder.execute(),
  ]);

  const formattedData = result.data.map((schedule: any) => ({
    id: schedule.id,
    title: schedule.title,
    trainer: schedule.trainer ? {
      id: schedule.trainer.id,
      name: schedule.trainer.user?.fullName || "",
    } : null,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    capacity: schedule.capacity,
  }));

  return {
    meta: {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 10,
      total,
      totalPages: Math.ceil(total / (Number(query.limit) || 10)),
    },
    data: formattedData,
  };
};

const updateClassSchedule = async (ownerId: string, businessId: string, id: string, payload: any) => {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new AppError(404, "Business not found.");
  if (business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not own this business.");

  const classSchedule = await prisma.classSchedule.findUnique({ where: { id } });
  if (!classSchedule) throw new AppError(404, "Class not found.");
  if (classSchedule.businessId !== businessId) throw new AppError(403, "Class does not belong to this business.");

  const newTrainerId = payload.trainerId || classSchedule.trainerId;
  const newStartTime = payload.startTime ? new Date(payload.startTime) : classSchedule.startTime;
  const newEndTime = payload.endTime ? new Date(payload.endTime) : classSchedule.endTime;

  if (payload.trainerId) {
    const trainerProfile = await prisma.trainerProfile.findUnique({ where: { id: payload.trainerId } });
    if (!trainerProfile) throw new AppError(404, "Trainer not found.");

    const trainerBusiness = await prisma.trainerBusiness.findUnique({
      where: {
        trainerId_businessId: { trainerId: payload.trainerId, businessId }
      }
    });
    if (!trainerBusiness || !trainerBusiness.isActive) {
      throw new AppError(403, "Trainer does not belong to this business or is not active.");
    }
  }

  if (payload.startTime || payload.endTime || payload.trainerId) {
    if (newTrainerId) {
      const overlappingClass = await prisma.classSchedule.findFirst({
        where: {
          trainerId: newTrainerId,
          id: { not: id },
          startTime: { lt: newEndTime },
          endTime: { gt: newStartTime }
        }
      });
  
      if (overlappingClass) {
        throw new AppError(409, "Trainer schedule conflict. The trainer already has a class scheduled during this time.");
      }
    }
  }

  const updateData: any = {};
  if (payload.title) updateData.title = payload.title;
  if (payload.trainerId) updateData.trainerId = payload.trainerId;
  if (payload.startTime) updateData.startTime = new Date(payload.startTime);
  if (payload.endTime) updateData.endTime = new Date(payload.endTime);
  if (payload.capacity) updateData.capacity = payload.capacity;

  const updatedClass = await prisma.classSchedule.update({
    where: { id },
    data: updateData
  });

  return updatedClass;
};

const cancelClassSchedule = async (ownerId: string, businessId: string, id: string) => {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new AppError(404, "Business not found.");
  if (business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not own this business.");

  const classSchedule = await prisma.classSchedule.findUnique({ 
    where: { id },
    include: { bookings: { include: { member: { include: { user: true } } } } }
  });
  if (!classSchedule) throw new AppError(404, "Class not found.");
  if (classSchedule.businessId !== businessId) throw new AppError(403, "Class does not belong to this business.");

  await prisma.$transaction(async (tx) => {
    if (classSchedule.bookings && classSchedule.bookings.length > 0) {
      await tx.classBooking.updateMany({
        where: { classScheduleId: id },
        data: { status: "CANCELLED" }
      });
    }

    await tx.classSchedule.delete({
      where: { id }
    });
  });

  if (classSchedule.bookings && classSchedule.bookings.length > 0) {
    const activeBookings = classSchedule.bookings.filter(b => b.status === "CONFIRMED");
    for (const booking of activeBookings) {
      pushJob("notification_queue", {
        eventType: "CLASS_CANCELLED",
        type: "ANNOUNCEMENT",
        title: `Class Cancelled: ${classSchedule.title}`,
        body: `The class "${classSchedule.title}" scheduled for ${classSchedule.startTime.toISOString()} has been cancelled by the business.`,
        businessId: business.id,
        businessName: business.name,
        targetUserId: booking.member.userId,
      });
    }
  }

  return { id };
};

export const ClassScheduleService = {
  createClassSchedule,
  getClassSchedules,
  updateClassSchedule,
  cancelClassSchedule,
};
