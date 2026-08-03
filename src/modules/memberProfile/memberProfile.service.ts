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

export const memberProfileService = {
  setFitnessGoal,
  getProfile,
  getRecommendations,
};
