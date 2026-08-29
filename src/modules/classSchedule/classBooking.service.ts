import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { pushJob } from "../../utils/redisQueue";

const bookClass = async (userId: string, classScheduleId: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId }
  });
  console.log("member", memberProfile)

  if (!memberProfile) {
    throw new AppError(404, "Member profile not found.");
  }

  const classSchedule = await prisma.classSchedule.findUnique({
    where: { id: classScheduleId },
    include: { business: true }
  });

  console.log(classSchedule)

  if (!classSchedule) {
    throw new AppError(404, "Class not found.");
  }

  // const now = new Date();
  // if (classSchedule.endTime <= now) {
  //   throw new AppError(400, "Class has already ended.");
  // }

  const activeMembership = await prisma.membership.findFirst({
    where: {
      id: memberProfile.id,
      businessId: classSchedule.businessId,
      status: "ACTIVE",
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: classSchedule.startTime } }
          ]
        },
        {
          OR: [
            { startDate: null },
            { startDate: { lte: classSchedule.startTime } }
          ]
        }
      ]
    }
  });

  if (!activeMembership) {
    throw new AppError(400, "You do not have an active membership for this business valid at the class time.");
  }

  const existingBooking = await prisma.classBooking.findUnique({
    where: {
      classScheduleId_memberId: {
        classScheduleId,
        memberId: memberProfile.id,
      }
    }
  });

  if (existingBooking && existingBooking.status === "CONFIRMED") {
    throw new AppError(409, "You have already booked this class.");
  }

  const booking = await prisma.$transaction(async (tx) => {
    const currentBookings = await tx.classBooking.count({
      where: { classScheduleId, status: "CONFIRMED" }
    });

    if (currentBookings >= classSchedule.capacity) {
      throw new AppError(409, "Class is fully booked.");
    }

    const newBooking = await tx.classBooking.upsert({
      where: {
        classScheduleId_memberId: {
          classScheduleId,
          memberId: memberProfile.id
        }
      },
      update: {
        status: "CONFIRMED",
        bookedAt: new Date()
      },
      create: {
        classScheduleId,
        memberId: memberProfile.id,
        status: "CONFIRMED"
      }
    });

    return newBooking;
  });

  pushJob("notification_queue", {
    eventType: "CLASS_BOOKING",
    type: "BOOKING",
    title: "Class Booking Confirmed",
    body: `Your booking for "${classSchedule.title}" has been confirmed.`,
    businessId: classSchedule.businessId,
    businessName: classSchedule.business.name,
    targetUserId: userId,
    metadata: {
      bookingId: booking.id,
      classScheduleId: classSchedule.id,
      businessId: classSchedule.businessId
    }
  });

  return {
    booking: {
      id: booking.id,
      status: booking.status,
      classScheduleId: booking.classScheduleId,
      memberId: booking.memberId,
      createdAt: booking.bookedAt
    }
  };
};

export const ClassBookingService = {
  bookClass,
};
