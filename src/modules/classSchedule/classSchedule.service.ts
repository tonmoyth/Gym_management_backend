import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";
import { pushJob } from "../../utils/redisQueue";
import { verifyBusinessAccess } from "../../utils/businessAccess";
import { StaffPermissionRole } from "../../generated/prisma/enums";

const createClassSchedule = async (ownerId: string, businessId: string, payload: any) => {
  await verifyBusinessAccess(businessId, ownerId, [
    StaffPermissionRole.TRAINER_MANAGER,
    StaffPermissionRole.FULL,
  ]);

  // Resolve trainers: can be trainerIds array or single trainerId
  const rawTrainerIds: string[] = payload.trainerIds && Array.isArray(payload.trainerIds) && payload.trainerIds.length > 0
    ? payload.trainerIds
    : (payload.trainerId ? [payload.trainerId] : []);

  // Filter out duplicates
  const trainerIds = Array.from(new Set(rawTrainerIds));

  // Validate that all assigned trainers belong to this business and are active
  for (const tId of trainerIds) {
    const trainerProfile = await prisma.trainerProfile.findUnique({ where: { id: tId } });
    if (!trainerProfile) throw new AppError(404, `Trainer with ID ${tId} not found.`);

    const trainerBusiness = await prisma.trainerBusiness.findUnique({
      where: {
        trainerId_businessId: {
          trainerId: tId,
          businessId: businessId,
        }
      }
    });
    if (!trainerBusiness || !trainerBusiness.isActive) {
      throw new AppError(403, `One or more selected trainers do not belong to this business or are inactive.`);
    }
  }

  // Handle dates/times
  const startTimeStr = payload.startTimeStr || payload.startTime || "08:00";
  const endTimeStr = payload.endTimeStr || payload.endTime || "09:00";
  const timeSlot = payload.timeSlot || `${startTimeStr} - ${endTimeStr}`;
  const daysOfWeek = Array.isArray(payload.daysOfWeek) && payload.daysOfWeek.length > 0
    ? payload.daysOfWeek
    : ["Monday", "Wednesday", "Friday"];

  let startDate: Date;
  let endDate: Date;

  if (payload.startTime && !isNaN(Date.parse(payload.startTime)) && payload.startTime.includes('-')) {
    startDate = new Date(payload.startTime);
  } else {
    startDate = new Date();
    const parts = startTimeStr.split(':');
    if (parts[0]) startDate.setHours(parseInt(parts[0], 10), parseInt(parts[1] || '0', 10), 0, 0);
  }

  if (payload.endTime && !isNaN(Date.parse(payload.endTime)) && payload.endTime.includes('-')) {
    endDate = new Date(payload.endTime);
  } else {
    endDate = new Date();
    const parts = endTimeStr.split(':');
    if (parts[0]) endDate.setHours(parseInt(parts[0], 10), parseInt(parts[1] || '0', 10), 0, 0);
  }

  const classSchedule = await prisma.classSchedule.create({
    data: {
      businessId,
      trainerId: trainerIds[0] || null, // Primary trainer for compatibility
      title: payload.title,
      description: payload.description || null,
      daysOfWeek,
      timeSlot,
      startTimeStr,
      endTimeStr,
      startTime: startDate,
      endTime: endDate,
      capacity: Number(payload.capacity),
      trainers: {
        create: trainerIds.map((tId) => ({
          trainerId: tId,
        }))
      }
    },
    include: {
      trainers: {
        include: {
          trainer: {
            include: {
              user: { select: { id: true, fullName: true, profileImage: true } }
            }
          }
        }
      },
      trainer: {
        include: {
          user: { select: { id: true, fullName: true, profileImage: true } }
        }
      },
      business: { select: { id: true, name: true, address: true } }
    }
  });

  return classSchedule;
};

const getClassSchedules = async (userId: string, role: string, businessId: string, query: any) => {
  if (role === "MEMBER") {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new AppError(404, "Business not found.");
    if (business.status === "SUSPENDED") {
      throw new AppError(403, "This business is currently suspended.");
    }
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

  if (query.trainerId) {
    additionalFilters.OR = [
      { trainerId: query.trainerId },
      { trainers: { some: { trainerId: query.trainerId } } }
    ];
  }

  const queryBuilder = new QueryBuilder(prisma.classSchedule, query, {
    searchableFields: ["title", "description"]
  })
    .search()
    .filter()
    .where(additionalFilters)
    .sort()
    .paginate();

  queryBuilder.include({
    trainers: {
      include: {
        trainer: {
          include: {
            user: { select: { id: true, fullName: true, profileImage: true } }
          }
        }
      }
    },
    trainer: { select: { id: true, user: { select: { fullName: true, profileImage: true } } } },
    business: { select: { id: true, name: true, address: true } },
    _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
  });

  const [total, result] = await Promise.all([
    queryBuilder.count(),
    queryBuilder.execute(),
  ]);

  const formattedData = result.data.map((schedule: any) => {
    const bookedCount = schedule._count?.bookings || 0;
    const availableSlots = Math.max(0, (schedule.capacity || 0) - bookedCount);

    const trainersList = (schedule.trainers && schedule.trainers.length > 0)
      ? schedule.trainers.map((st: any) => ({
          id: st.trainer.id,
          name: st.trainer.user?.fullName || "Trainer",
          profileImage: st.trainer.user?.profileImage || null,
        }))
      : (schedule.trainer ? [{
          id: schedule.trainer.id,
          name: schedule.trainer.user?.fullName || "Trainer",
          profileImage: schedule.trainer.user?.profileImage || null,
        }] : []);

    const timeSlotDisplay = schedule.timeSlot || (schedule.startTimeStr && schedule.endTimeStr ? `${schedule.startTimeStr} - ${schedule.endTimeStr}` : `${new Date(schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(schedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

    return {
      id: schedule.id,
      businessId: schedule.businessId,
      title: schedule.title,
      description: schedule.description,
      daysOfWeek: schedule.daysOfWeek || [],
      timeSlot: timeSlotDisplay,
      startTimeStr: schedule.startTimeStr,
      endTimeStr: schedule.endTimeStr,
      trainers: trainersList,
      trainer: trainersList[0] || null,
      business: schedule.business,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      capacity: schedule.capacity,
      bookedCount,
      availableSlots,
      _count: schedule._count,
    };
  });

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

const getClassScheduleDetails = async (userId: string, role: string, businessId: string, id: string) => {
  if (role === "MEMBER") {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new AppError(404, "Business not found.");
    if (business.status === "SUSPENDED") {
      throw new AppError(403, "This business is currently suspended.");
    }
  } else if (role === "TRAINER") {
    const assignedTrainer = await prisma.trainerBusiness.findFirst({
      where: { trainer: { userId }, businessId, isActive: true },
    });
    if (!assignedTrainer) throw new AppError(403, "Forbidden. You are not assigned to this business.");
  } else if (role === "BUSINESS_OWNER" || role === "STAFF") {
    await verifyBusinessAccess(businessId, userId, [
      StaffPermissionRole.TRAINER_MANAGER,
      StaffPermissionRole.FRONT_DESK,
      StaffPermissionRole.FULL,
    ]);
  } else {
    throw new AppError(403, "Forbidden. Invalid role for accessing class schedules.");
  }

  const classSchedule = await prisma.classSchedule.findUnique({
    where: { id, businessId },
    include: {
      trainers: {
        include: {
          trainer: {
            include: {
              user: { select: { id: true, fullName: true, profileImage: true } }
            }
          }
        }
      },
      trainer: { select: { id: true, user: { select: { fullName: true, profileImage: true } } } },
      business: { select: { id: true, name: true, address: true } },
      _count: {
        select: {
          bookings: { where: { status: "CONFIRMED" } }
        }
      }
    }
  });

  if (!classSchedule) throw new AppError(404, "Class schedule not found.");

  const bookedCount = classSchedule._count.bookings || 0;
  const availableSlots = Math.max(0, classSchedule.capacity - bookedCount);

  const trainersList = (classSchedule.trainers && classSchedule.trainers.length > 0)
    ? classSchedule.trainers.map((st: any) => ({
        id: st.trainer.id,
        name: st.trainer.user?.fullName || "Trainer",
        profileImage: st.trainer.user?.profileImage || null,
      }))
    : (classSchedule.trainer ? [{
        id: classSchedule.trainer.id,
        name: classSchedule.trainer.user?.fullName || "Trainer",
        profileImage: classSchedule.trainer.user?.profileImage || null,
      }] : []);

  const timeSlotDisplay = classSchedule.timeSlot || (classSchedule.startTimeStr && classSchedule.endTimeStr ? `${classSchedule.startTimeStr} - ${classSchedule.endTimeStr}` : `${new Date(classSchedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(classSchedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

  return {
    id: classSchedule.id,
    businessId: classSchedule.businessId,
    title: classSchedule.title,
    description: classSchedule.description,
    daysOfWeek: classSchedule.daysOfWeek || [],
    timeSlot: timeSlotDisplay,
    startTimeStr: classSchedule.startTimeStr,
    endTimeStr: classSchedule.endTimeStr,
    trainers: trainersList,
    trainer: trainersList[0] || null,
    business: classSchedule.business,
    startTime: classSchedule.startTime,
    endTime: classSchedule.endTime,
    capacity: classSchedule.capacity,
    bookedCount,
    availableSlots,
    bookedSlotCount: bookedCount,
  };
};

const updateClassSchedule = async (ownerId: string, businessId: string, id: string, payload: any) => {
  await verifyBusinessAccess(businessId, ownerId, [
    StaffPermissionRole.TRAINER_MANAGER,
    StaffPermissionRole.FULL,
  ]);

  const classSchedule = await prisma.classSchedule.findUnique({
    where: { id },
    include: {
      trainers: true,
      _count: {
        select: {
          bookings: { where: { status: "CONFIRMED" } }
        }
      }
    }
  });
  if (!classSchedule) throw new AppError(404, "Class schedule not found.");
  if (classSchedule.businessId !== businessId) throw new AppError(403, "Class does not belong to this business.");

  const updateData: any = {};
  if (payload.title !== undefined) updateData.title = payload.title;
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.daysOfWeek !== undefined && Array.isArray(payload.daysOfWeek)) updateData.daysOfWeek = payload.daysOfWeek;
  if (payload.capacity !== undefined) updateData.capacity = Number(payload.capacity);

  // Time handling
  const startTimeStr = payload.startTimeStr || (payload.startTime && !payload.startTime.includes('T') ? payload.startTime : undefined);
  const endTimeStr = payload.endTimeStr || (payload.endTime && !payload.endTime.includes('T') ? payload.endTime : undefined);

  if (startTimeStr) {
    updateData.startTimeStr = startTimeStr;
    const startDate = new Date(classSchedule.startTime);
    const parts = startTimeStr.split(':');
    if (parts[0]) startDate.setHours(parseInt(parts[0], 10), parseInt(parts[1] || '0', 10), 0, 0);
    updateData.startTime = startDate;
  } else if (payload.startTime && !isNaN(Date.parse(payload.startTime)) && payload.startTime.includes('-')) {
    updateData.startTime = new Date(payload.startTime);
  }

  if (endTimeStr) {
    updateData.endTimeStr = endTimeStr;
    const endDate = new Date(classSchedule.endTime);
    const parts = endTimeStr.split(':');
    if (parts[0]) endDate.setHours(parseInt(parts[0], 10), parseInt(parts[1] || '0', 10), 0, 0);
    updateData.endTime = endDate;
  } else if (payload.endTime && !isNaN(Date.parse(payload.endTime)) && payload.endTime.includes('-')) {
    updateData.endTime = new Date(payload.endTime);
  }

  const effectiveStart = updateData.startTimeStr || classSchedule.startTimeStr || (updateData.startTime ? new Date(updateData.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "08:00");
  const effectiveEnd = updateData.endTimeStr || classSchedule.endTimeStr || (updateData.endTime ? new Date(updateData.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "09:00");

  if (payload.timeSlot !== undefined) {
    updateData.timeSlot = payload.timeSlot;
  } else if (payload.startTimeStr || payload.startTime || payload.endTimeStr || payload.endTime) {
    updateData.timeSlot = `${effectiveStart} - ${effectiveEnd}`;
  }

  // Sync trainers if trainerIds or trainerId provided
  if (payload.trainerIds !== undefined) {
    const rawTrainerIds: string[] = Array.isArray(payload.trainerIds) ? payload.trainerIds : [];
    const trainerIds = Array.from(new Set(rawTrainerIds));

    // Validate that all assigned trainers belong to this business and are active
    for (const tId of trainerIds) {
      const trainerProfile = await prisma.trainerProfile.findUnique({ where: { id: tId } });
      if (!trainerProfile) throw new AppError(404, `Trainer with ID ${tId} not found.`);

      const trainerBusiness = await prisma.trainerBusiness.findUnique({
        where: {
          trainerId_businessId: {
            trainerId: tId,
            businessId: businessId,
          }
        }
      });
      if (!trainerBusiness || !trainerBusiness.isActive) {
        throw new AppError(403, `One or more selected trainers do not belong to this business or are inactive.`);
      }
    }

    await prisma.classScheduleTrainer.deleteMany({
      where: { classScheduleId: id }
    });

    if (trainerIds.length > 0) {
      await prisma.classScheduleTrainer.createMany({
        data: trainerIds.map((tId: string) => ({
          classScheduleId: id,
          trainerId: tId
        }))
      });
      updateData.trainerId = trainerIds[0];
    } else {
      updateData.trainerId = null;
    }
  } else if (payload.trainerId !== undefined) {
    if (payload.trainerId) {
      const trainerProfile = await prisma.trainerProfile.findUnique({ where: { id: payload.trainerId } });
      if (!trainerProfile) throw new AppError(404, `Trainer with ID ${payload.trainerId} not found.`);

      const trainerBusiness = await prisma.trainerBusiness.findUnique({
        where: {
          trainerId_businessId: {
            trainerId: payload.trainerId,
            businessId: businessId,
          }
        }
      });
      if (!trainerBusiness || !trainerBusiness.isActive) {
        throw new AppError(403, `Trainer does not belong to this business or is inactive.`);
      }

      await prisma.classScheduleTrainer.deleteMany({
        where: { classScheduleId: id }
      });
      await prisma.classScheduleTrainer.create({
        data: {
          classScheduleId: id,
          trainerId: payload.trainerId
        }
      });
      updateData.trainerId = payload.trainerId;
    } else {
      await prisma.classScheduleTrainer.deleteMany({
        where: { classScheduleId: id }
      });
      updateData.trainerId = null;
    }
  }

  const updatedClass = await prisma.classSchedule.update({
    where: { id },
    data: updateData,
    include: {
      trainers: {
        include: {
          trainer: {
            include: {
              user: { select: { id: true, fullName: true, profileImage: true } }
            }
          }
        }
      },
      trainer: {
        select: { id: true, user: { select: { fullName: true, profileImage: true } } }
      },
      business: { select: { id: true, name: true, address: true } },
      _count: {
        select: {
          bookings: { where: { status: "CONFIRMED" } }
        }
      }
    }
  });

  const bookedCount = updatedClass._count?.bookings || 0;
  const availableSlots = Math.max(0, updatedClass.capacity - bookedCount);

  const trainersList = (updatedClass.trainers && updatedClass.trainers.length > 0)
    ? updatedClass.trainers.map((st: any) => ({
        id: st.trainer.id,
        name: st.trainer.user?.fullName || "Trainer",
        profileImage: st.trainer.user?.profileImage || null,
      }))
    : (updatedClass.trainer ? [{
        id: updatedClass.trainer.id,
        name: updatedClass.trainer.user?.fullName || "Trainer",
        profileImage: updatedClass.trainer.user?.profileImage || null,
      }] : []);

  const timeSlotDisplay = updatedClass.timeSlot || (updatedClass.startTimeStr && updatedClass.endTimeStr ? `${updatedClass.startTimeStr} - ${updatedClass.endTimeStr}` : `${new Date(updatedClass.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(updatedClass.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

  return {
    id: updatedClass.id,
    businessId: updatedClass.businessId,
    title: updatedClass.title,
    description: updatedClass.description,
    daysOfWeek: updatedClass.daysOfWeek || [],
    timeSlot: timeSlotDisplay,
    startTimeStr: updatedClass.startTimeStr,
    endTimeStr: updatedClass.endTimeStr,
    trainers: trainersList,
    trainer: trainersList[0] || null,
    business: updatedClass.business,
    startTime: updatedClass.startTime,
    endTime: updatedClass.endTime,
    capacity: updatedClass.capacity,
    bookedCount,
    availableSlots,
    bookedSlotCount: bookedCount,
  };
};

const cancelClassSchedule = async (ownerId: string, businessId: string, id: string) => {
  const { business } = await verifyBusinessAccess(businessId, ownerId, [
    StaffPermissionRole.TRAINER_MANAGER,
    StaffPermissionRole.FULL,
  ]);

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
  getClassScheduleDetails,
  updateClassSchedule,
  cancelClassSchedule,
};
