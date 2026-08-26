import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import httpStatus from "http-status";
import { QueryBuilder } from "../../utils/queryBuilder";

const setFitnessGoal = async (userId: string, fitnessGoalTagId: string) => {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Check if member profile already exists (which means onboarding is already done)
  const existingProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (existingProfile) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Fitness goal has already been set."
    );
  }

  // Check if specialization tag exists
  const tag = await prisma.specializationTag.findUnique({
    where: { id: fitnessGoalTagId },
    select: { id: true },
  });

  if (!tag) {
    throw new AppError(httpStatus.NOT_FOUND, "Fitness Goal not found");
  }

  // Create member profile within a transaction
  const [newProfile] = await prisma.$transaction([
    prisma.memberProfile.create({
      data: { userId, fitnessGoalTagId },
      select: {
        id: true,
        fitnessGoalTag: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        updatedAt: true,
      },
    }),
  ]);

  // Format response to match required return data structure
  return {
    id: newProfile.id,
    fitnessGoal: newProfile.fitnessGoalTag,
    updatedAt: newProfile.updatedAt,
  };
};

const getProfile = async (userId: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      user: {
        select: {
          fullName: true,
          email: true,
          profileImage: true,
        },
      },
      fitnessGoalTag: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          favorites: true,
          classBookings: {
            where: {
              status: "CONFIRMED",
            },
          },
        },
      },
      memberships: {
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
          business: { select: { name: true } },
          plan: { select: { name: true } },
          endDate: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!memberProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Member Profile not found");
  }

  const activeMembership = memberProfile.memberships[0] ? {
    id: memberProfile.memberships[0].id,
    businessName: memberProfile.memberships[0].business.name,
    planName: memberProfile.memberships[0].plan.name,
    expiresAt: memberProfile.memberships[0].endDate,
  } : null;

  return {
    id: memberProfile.id,
    name: memberProfile.user?.fullName,
    email: memberProfile.user?.email,
    profilePhoto: memberProfile.user?.profileImage,
    fitnessGoal: memberProfile.fitnessGoalTag,
    membership: activeMembership,
    stats: {
      favoriteGyms: memberProfile._count.favorites,
      activeBookings: memberProfile._count.classBookings,
    },
  };
};

const getRecommendations = async (userId: string, queryParams: any) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { 
      fitnessGoalTagId: true,
      fitnessGoalTag: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!memberProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Member Profile not found");
  }

  const fitnessGoalTagId = memberProfile.fitnessGoalTagId;
  
  if (!fitnessGoalTagId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Fitness Goal not set");
  }

  const trainerConfig = {
    searchableFields: ["user.fullName", "bio"],
    filterableFields: ["gender", "avgRating"],
  };

  const trainerQuery = new QueryBuilder(prisma.trainerProfile, { ...queryParams, sortBy: queryParams.sortBy || "avgRating", sortOrder: queryParams.sortOrder || "desc" }, trainerConfig)
    .search()
    .filter()
    .sort()
    .paginate()
    .where({
      verifiedBadge: true,
      specializations: { some: { tagId: fitnessGoalTagId } },
    });

  const businessConfig = {
    searchableFields: ["name", "address", "description"],
    filterableFields: ["amenities", "address"],
  };

  const businessQuery = new QueryBuilder(prisma.business, { ...queryParams, sortBy: queryParams.sortBy || "createdAt", sortOrder: queryParams.sortOrder || "desc" }, businessConfig)
    .search()
    .filter()
    .sort()
    .paginate()
    .where({
      status: "ACTIVE",
      trainers: { some: { trainer: { specializations: { some: { tagId: fitnessGoalTagId } } } } },
    });

  const planConfig = {
    searchableFields: ["name", "description"],
    filterableFields: ["price", "durationDays"],
  };

  const planQuery = new QueryBuilder(prisma.membershipPlan, { ...queryParams, sortBy: queryParams.sortBy || "price", sortOrder: queryParams.sortOrder || "asc" }, planConfig)
    .search()
    .filter()
    .sort()
    .paginate()
    .where({
      status: "ACTIVE",
      business: { trainers: { some: { trainer: { specializations: { some: { tagId: fitnessGoalTagId } } } } } },
    });

  const trainerArgs = trainerQuery.getQuery();
  const businessArgs = businessQuery.getQuery();
  const planArgs = planQuery.getQuery();

  // Remove empty include to avoid Prisma conflicts with select
  delete trainerArgs.include;
  delete businessArgs.include;
  delete planArgs.include;

  // Enforce max 10
  trainerArgs.take = Math.min(trainerArgs.take || 10, 10);
  businessArgs.take = Math.min(businessArgs.take || 10, 10);
  planArgs.take = Math.min(planArgs.take || 10, 10);

  trainerArgs.select = {
    id: true,
    user: { select: { fullName: true, profileImage: true } },
    avgRating: true,
    verifiedBadge: true,
  };

  businessArgs.select = {
    id: true,
    name: true,
    logo: true,
    address: true,
  };

  planArgs.select = {
    id: true,
    name: true,
    price: true,
    durationDays: true,
  };

  const [trainers, businesses, plans] = await Promise.all([
    prisma.trainerProfile.findMany(trainerArgs as any),
    prisma.business.findMany(businessArgs as any),
    prisma.membershipPlan.findMany(planArgs as any),
  ]);

  return {
    fitnessGoal: memberProfile.fitnessGoalTag,
    recommendedTrainers: trainers.map((t: any) => ({
      id: t.id,
      name: t.user?.fullName,
      profilePhoto: t.user?.profileImage,
      avgRating: Number(t.avgRating || 0),
      verifiedBadge: t.verifiedBadge,
    })),
    recommendedBusinesses: businesses,
    recommendedPlans: plans.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price || 0),
      durationDays: p.durationDays,
    })),
  };
};

const getDashboard = async (userId: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profileImage: true,
        },
      },
    },
  });

  if (!memberProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Member Profile not found");
  }

  const memberId = memberProfile.id;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    memberships,
    totalAttendanceCount,
    thisMonthAttendanceCount,
    todayAttendance,
    recentAttendance,
    upcomingClasses
  ] = await Promise.all([
    // Membership
    prisma.membership.findMany({
      where: { memberId, status: "ACTIVE" },
      orderBy: { endDate: "desc" },
      take: 1,
      include: {
        business: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, price: true, durationDays: true } },
      }
    }),

    // Attendance stats
    prisma.attendanceLog.count({ where: { memberId, attendanceType: "CHECK_IN" } }),
    prisma.attendanceLog.count({ 
      where: { 
        memberId, 
        attendanceTime: { gte: startOfMonth },
        attendanceType: "CHECK_IN"
      } 
    }),

    // Today's attendance
    prisma.attendanceLog.findMany({
      where: { memberId, attendanceTime: { gte: todayStart, lte: todayEnd } },
      orderBy: { attendanceTime: "asc" }
    }),

    // Recent attendance
    prisma.attendanceLog.findMany({
      where: { memberId },
      orderBy: { attendanceTime: "desc" },
      take: 5
    }),

    // Upcoming classes
    prisma.classBooking.findMany({
      where: {
        memberId,
        status: "CONFIRMED",
        classSchedule: {
          startTime: { gte: new Date() }
        }
      },
      include: {
        classSchedule: {
          include: {
            trainer: { include: { user: { select: { fullName: true } } } },
            business: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: {
        classSchedule: { startTime: "asc" }
      },
      take: 5
    })
  ]);

  const activeMembership = memberships[0];
  let membershipData = null;

  if (activeMembership) {
    let daysRemaining = 0;
    if (activeMembership.endDate) {
      daysRemaining = Math.ceil((new Date(activeMembership.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    }
    
    membershipData = {
      id: activeMembership.id,
      status: activeMembership.status,
      business: activeMembership.business,
      plan: {
        id: activeMembership.plan.id,
        name: activeMembership.plan.name,
        price: Number(activeMembership.plan.price),
        durationDays: activeMembership.plan.durationDays
      },
      startDate: activeMembership.startDate,
      renewalDate: activeMembership.endDate,
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0
    };
  }

  let checkedIn = false;
  let checkInTime = null;
  let checkOutTime = null;

  for (const log of todayAttendance) {
    if (log.attendanceType === "CHECK_IN" && !checkInTime) {
      checkedIn = true;
      checkInTime = log.attendanceTime;
    }
    if (log.attendanceType === "CHECK_OUT") {
      checkOutTime = log.attendanceTime;
    }
  }

  return {
    member: {
      id: memberProfile.id,
      userId: memberProfile.user?.id,
      name: memberProfile.user?.fullName,
      email: memberProfile.user?.email,
      profileImage: memberProfile.user?.profileImage,
    },
    membership: membershipData,
    attendance: {
      total: totalAttendanceCount,
      thisMonth: thisMonthAttendanceCount,
      today: {
        checkedIn,
        checkInTime,
        checkOutTime,
      },
      recent: recentAttendance.map((log: any) => ({
        date: log.attendanceTime,
        type: log.attendanceType,
        method: log.verifyMethod,
        timestamp: log.attendanceTime,
      })),
    },
    upcomingClasses: upcomingClasses.map((booking: any) => ({
      id: booking.classSchedule.id,
      title: booking.classSchedule.title,
      startTime: booking.classSchedule.startTime,
      endTime: booking.classSchedule.endTime,
      trainer: booking.classSchedule.trainer ? {
        id: booking.classSchedule.trainer.id,
        name: booking.classSchedule.trainer.user?.fullName,
      } : null,
      business: booking.classSchedule.business,
    })),
  };
};

export const memberProfileService = {
  setFitnessGoal,
  getProfile,
  getRecommendations,
  getDashboard,
};
