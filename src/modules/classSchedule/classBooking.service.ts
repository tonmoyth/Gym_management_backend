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

  if (classSchedule.business.status === "SUSPENDED") {
    throw new AppError(403, "This business is currently suspended.");
  }

  // const now = new Date();
  // if (classSchedule.endTime <= now) {
  //   throw new AppError(400, "Class has already ended.");
  // }

  const activeMembership = await prisma.membership.findFirst({
    where: {
      memberId: memberProfile.id,
      businessId: classSchedule.businessId,
      status: "ACTIVE",
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } }
      ]
    }
  });

  if (!activeMembership) {
    throw new AppError(400, "You do not have an active membership for this business.");
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

const getMyBookings = async (userId: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId }
  });

  if (!memberProfile) {
    return [];
  }

  const bookings = await prisma.classBooking.findMany({
    where: {
      memberId: memberProfile.id,
    },
    include: {
      classSchedule: {
        include: {
          trainers: {
            include: {
              trainer: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      profileImage: true,
                    }
                  }
                }
              }
            }
          },
          trainer: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  profileImage: true,
                }
              }
            }
          },
          business: {
            select: {
              id: true,
              name: true,
              logo: true,
              address: true,
            }
          }
        }
      }
    },
    orderBy: {
      bookedAt: 'desc'
    }
  });

  return bookings.map((b: any) => {
    const cs = b.classSchedule;
    if (!cs) return b;

    const trainersList = (cs.trainers && cs.trainers.length > 0)
      ? cs.trainers.map((st: any) => ({
          id: st.trainer.id,
          name: st.trainer.user?.fullName || "Trainer",
          profileImage: st.trainer.user?.profileImage || null,
        }))
      : (cs.trainer ? [{
          id: cs.trainer.id,
          name: cs.trainer.user?.fullName || "Trainer",
          profileImage: cs.trainer.user?.profileImage || null,
        }] : []);

    const timeSlotDisplay = cs.timeSlot || (cs.startTimeStr && cs.endTimeStr ? `${cs.startTimeStr} - ${cs.endTimeStr}` : `${new Date(cs.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(cs.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

    return {
      ...b,
      classSchedule: {
        ...cs,
        trainers: trainersList,
        trainer: trainersList[0] || null,
        timeSlot: timeSlotDisplay,
        daysOfWeek: cs.daysOfWeek || [],
      }
    };
  });
};

const cancelBooking = async (userId: string, bookingId: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId }
  });

  if (!memberProfile) {
    throw new AppError(404, "Member profile not found.");
  }

  const booking = await prisma.classBooking.findFirst({
    where: {
      id: bookingId,
      memberId: memberProfile.id,
    }
  });

  if (!booking) {
    throw new AppError(404, "Class booking not found.");
  }

  if (booking.status === "CANCELLED") {
    throw new AppError(400, "Booking is already cancelled.");
  }

  const updatedBooking = await prisma.classBooking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED"
    }
  });

  return updatedBooking;
};

export const ClassBookingService = {
  bookClass,
  getMyBookings,
  cancelBooking,
};
