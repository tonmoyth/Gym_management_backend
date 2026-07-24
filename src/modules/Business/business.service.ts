import AppError from "../../errors/AppError";
import { BookingStatus, BusinessStatus, PlanStatus } from "../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/queryBuilder";
import {
  businessSearchableFields,
  businessFilterableFields,
} from "./business.constant";
import { calculateHaversineDistance } from "../../utils/geo";
import { uploadToCloudinary } from "../../utils/cloudinary";

const createBusiness = async (ownerId: string, payload: any) => {
  // Check duplicate business
  const existingBusiness = await prisma.business.findUnique({
    where: { ownerId },
  });

  if (existingBusiness) {
    throw new AppError(409, "Business Owner can own only one Business");
  }

  const amenities = payload.amenities || [];
  const photos = payload.photos || [];

  const businessPayload = {
    ...payload,
    ownerId,
    status: BusinessStatus.PENDING_APPROVAL,
    amenities,
    photos,
  };

  const newBusiness = await prisma.business.create({
    data: businessPayload,
  });

  return newBusiness;
};

const getAllBusinesses = async (query: Record<string, unknown>) => {
  const { latitude, longitude, radius, amenities, ...restQuery } = query;

  if (amenities) {
    if (typeof amenities === "string") {
      const amenitiesList = amenities.split(",").map((a) => a.trim());
      restQuery["amenities"] = { hasSome: amenitiesList };
    } else if (Array.isArray(amenities)) {
      restQuery["amenities"] = { hasSome: amenities };
    }
  }

  const businessQueryBuilder = new QueryBuilder(
    prisma.business,
    restQuery as any,
    {
      searchableFields: businessSearchableFields,
      filterableFields: businessFilterableFields,
    },
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .fields();

  businessQueryBuilder.where({
    status: BusinessStatus.ACTIVE,
  });

  const result = await businessQueryBuilder.execute();

  let businesses = result.data as any[];

  if (
    latitude !== undefined &&
    longitude !== undefined &&
    radius !== undefined
  ) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const rad = Number(radius);

    businesses = businesses.filter((business) => {
      if (business.latitude == null || business.longitude == null) return false;
      const distance = calculateHaversineDistance(
        lat,
        lng,
        business.latitude,
        business.longitude,
      );

      if (distance <= rad) {
        business.distance = distance;
        return true;
      }
      return false;
    });
  }

  const sensitiveFields = [
    "ownerId",
    "email",
    "phone",
    "whatsapp",
    "status",
    "updatedAt",
  ];
  const mappedBusinesses = businesses.map((business) => {
    const cleanedBusiness = { ...business };
    sensitiveFields.forEach((field) => delete cleanedBusiness[field]);
    return cleanedBusiness;
  });

  return {
    meta: result.meta,
    data: mappedBusinesses,
  };
};

const getBusinessById = async (id: string) => {
  const business = await prisma.business.findFirst({
    where: {
      id,
      status: BusinessStatus.ACTIVE,
    },
    select: {
      id: true,
      name: true,
      description: true,
      address: true,
      latitude: true,
      longitude: true,
      amenities: true,
      photos: true,
      email: true,
      phone: true,
      whatsapp: true,
      membershipPlans: {
        where: {
          status: PlanStatus.ACTIVE,
        },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          durationDays: true,
          benefits: true,
        },
      },
      reviews: {
        where: {
          isRemoved: false,
        },
        select: {
          rating: true,
        },
      },
      _count: {
        select: {
          trainers: {
            where: {
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!business) {
    throw new AppError(404, "Business not found");
  }

  let averageRating = 0;
  if (business.reviews.length > 0) {
    const totalRating = business.reviews.reduce(
      (acc, curr) => acc + curr.rating,
      0,
    );
    averageRating = Number((totalRating / business.reviews.length).toFixed(1));
  }

  const { reviews, _count, phone, whatsapp, ...publicProfile } = business;

  return {
    ...publicProfile,
    phone,
    whatsapp,
    averageRating,
    totalReviews: reviews.length,
    trainerCount: _count.trainers,
  };
};

const updateBusiness = async (
  id: string,
  ownerId: string,
  payload: any,
  files: any
) => {
  const business = await prisma.business.findUnique({
    where: { id },
  });

  if (!business) {
    throw new AppError(404, "Business not found");
  }

  if (business.ownerId !== ownerId) {
    throw new AppError(403, "Forbidden: You do not own this business");
  }

  // Handle files
  let updatedLogoUrl = business.logo;
  const updatedPhotosUrls = [...business.photos];

  if (files?.logo && files.logo.length > 0) {
    const logoFile = files.logo[0];
    updatedLogoUrl = await uploadToCloudinary(
      logoFile.path,
      "gym-management/business/logo"
    );
  }

  if (files?.photos && files.photos.length > 0) {
    for (const photo of files.photos) {
      const url = await uploadToCloudinary(
        photo.path,
        "gym-management/business/photos"
      );
      updatedPhotosUrls.push(url);
    }
  }

  // Parse fields
  let {
    id: _id,
    ownerId: _ownerId,
    status: _status,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    latitude,
    longitude,
    amenities,
    ...updateData
  } = payload;

  if (latitude !== undefined) {
    updateData.latitude = latitude;
  }

  if (longitude !== undefined) {
    updateData.longitude = longitude;
  }

  if (amenities !== undefined) {
    updateData.amenities = amenities;
  }

  updateData.logo = updatedLogoUrl;
  updateData.photos = updatedPhotosUrls;

  const updatedBusiness = await prisma.business.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      description: true,
      logo: true,
      email: true,
      phone: true,
      whatsapp: true,
      address: true,
      latitude: true,
      longitude: true,
      amenities: true,
      photos: true,
    }
  });

  return updatedBusiness;
};

const getMyBusiness = async (ownerId: string) => {
  const business = await prisma.business.findUnique({
    where: {
      ownerId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      logo: true,
      email: true,
      phone: true,
      whatsapp: true,
      address: true,
      latitude: true,
      longitude: true,
      amenities: true,
      photos: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      subscription: {
        select: {
          status: true,
          nextBillingDate: true,
        },
      },
      reviews: {
        where: {
          isRemoved: false,
        },
        select: {
          rating: true,
        },
      },
      _count: {
        select: {
          membershipPlans: true,
          trainers: {
            where: {
              isActive: true,
            },
          },
          memberships: {
            where: {
              status: BookingStatus.ACTIVE,
            },
          },
        },
      },
    },
  });

  if (!business) {
    throw new AppError(404, "Business not found");
  }

  let averageRating = 0;
  if (business.reviews.length > 0) {
    const totalRating = business.reviews.reduce(
      (acc, curr) => acc + curr.rating,
      0
    );
    averageRating = Number((totalRating / business.reviews.length).toFixed(1));
  }

  const { reviews, _count, subscription, ...profile } = business;

  return {
    ...profile,
    subscription,
    averageRating,
    totalReviews: reviews.length,
    membershipPlansCount: _count.membershipPlans,
    trainerCount: _count.trainers,
    memberCount: _count.memberships,
  };
};

const getBusinessDashboard = async (id: string, ownerId: string) => {
  const business = await prisma.business.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      name: true,
      logo: true,
      status: true,
      createdAt: true,
    },
  });

  if (!business) {
    throw new AppError(404, "Business not found");
  }

  if (business.ownerId !== ownerId) {
    throw new AppError(403, "Forbidden: You do not own this business");
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const [
    membershipGroup,
    trainerGroup,
    trainerAppCount,
    membershipPlanGroup,
    attendanceTodayGroup,
    attendanceMonthCount,
    totalRevAgg,
    yearlyRevAgg,
    monthlyRevAgg,
    todayRevAgg,
    payoutGroup,
    reviewAggregate,
    todayClassesCount,
    ongoingClassesCount,
    equipmentGroup,
    subscription,
    newMembersMonthCount,
    newTrainersMonthCount,
    newReviewsMonthCount,
  ] = await Promise.all([
    prisma.membership.groupBy({
      by: ["status"],
      where: { businessId: id },
      _count: { _all: true },
    }),
    prisma.trainerBusiness.groupBy({
      by: ["isActive"],
      where: { businessId: id },
      _count: { _all: true },
    }),
    prisma.trainerApplication.count({
      where: {
        status: "PENDING",
        jobPost: { businessId: id },
      },
    }),
    prisma.membershipPlan.groupBy({
      by: ["status"],
      where: { businessId: id },
      _count: { _all: true },
    }),
    prisma.attendance.groupBy({
      by: ["type"],
      where: {
        businessId: id,
        checkInAt: { gte: startOfToday },
      },
      _count: { _all: true },
    }),
    prisma.attendance.count({
      where: {
        businessId: id,
        checkInAt: { gte: startOfMonth },
      },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS", membership: { businessId: id } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS", membership: { businessId: id }, createdAt: { gte: startOfYear } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS", membership: { businessId: id }, createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS", membership: { businessId: id }, createdAt: { gte: startOfToday } },
      _sum: { amount: true },
    }),
    prisma.trainerPayout.groupBy({
      by: ["status"],
      where: { businessId: id },
      _sum: { amount: true },
    }),
    prisma.review.aggregate({
      where: { businessId: id, isRemoved: false },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.classSchedule.count({
      where: {
        businessId: id,
        startTime: { gte: startOfToday, lt: endOfToday },
      },
    }),
    prisma.classSchedule.count({
      where: {
        businessId: id,
        startTime: { lte: now },
        endTime: { gte: now },
      },
    }),
    prisma.equipment.groupBy({
      by: ["condition"],
      where: { businessId: id },
      _count: { _all: true },
    }),
    prisma.platformSubscription.findUnique({
      where: { businessId: id },
      select: { status: true, nextBillingDate: true, createdAt: true },
    }),
    prisma.membership.count({
      where: { businessId: id, createdAt: { gte: startOfMonth } },
    }),
    prisma.trainerBusiness.count({
      where: { businessId: id, joinedAt: { gte: startOfMonth } },
    }),
    prisma.review.count({
      where: { businessId: id, createdAt: { gte: startOfMonth } },
    }),
  ]);

  // Aggregate processing
  const members = {
    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0,
    pendingMembers: 0,
  };
  membershipGroup.forEach((g) => {
    members.totalMembers += g._count._all;
    if (g.status === BookingStatus.ACTIVE) members.activeMembers += g._count._all;
    if (g.status === BookingStatus.EXPIRED) members.expiredMembers += g._count._all;
    if (g.status === BookingStatus.PENDING_APPROVAL) members.pendingMembers += g._count._all;
  });

  const trainers = {
    totalTrainers: 0,
    activeTrainers: 0,
    verifiedTrainers: 0,
    pendingTrainerApplications: trainerAppCount,
  };
  trainerGroup.forEach((g) => {
    trainers.totalTrainers += g._count._all;
    if (g.isActive) trainers.activeTrainers += g._count._all;
  });

  const membership = {
    totalMembershipPlans: 0,
    activeMembershipPlans: 0,
    archivedMembershipPlans: 0,
  };
  membershipPlanGroup.forEach((g) => {
    membership.totalMembershipPlans += g._count._all;
    if (g.status === PlanStatus.ACTIVE) membership.activeMembershipPlans += g._count._all;
    if (g.status === PlanStatus.ARCHIVED) membership.archivedMembershipPlans += g._count._all;
  });

  const attendance = {
    todayAttendance: 0,
    todayMemberAttendance: 0,
    todayTrainerAttendance: 0,
    thisMonthAttendance: attendanceMonthCount,
  };
  attendanceTodayGroup.forEach((g) => {
    attendance.todayAttendance += g._count._all;
    if (g.type === "MEMBER") attendance.todayMemberAttendance += g._count._all;
    if (g.type === "TRAINER") attendance.todayTrainerAttendance += g._count._all;
  });

  const revenue = {
    todayRevenue: todayRevAgg._sum.amount ? Number(todayRevAgg._sum.amount) : 0,
    monthlyRevenue: monthlyRevAgg._sum.amount ? Number(monthlyRevAgg._sum.amount) : 0,
    yearlyRevenue: yearlyRevAgg._sum.amount ? Number(yearlyRevAgg._sum.amount) : 0,
    totalRevenue: totalRevAgg._sum.amount ? Number(totalRevAgg._sum.amount) : 0,
  };

  const trainerPayout = {
    monthlyPayout: 0,
    pendingPayout: 0,
    paidPayout: 0,
  };
  payoutGroup.forEach((g) => {
    const amount = g._sum.amount ? Number(g._sum.amount) : 0;
    if (g.status === "PENDING") trainerPayout.pendingPayout += amount;
    if (g.status === "PAID") trainerPayout.paidPayout += amount;
  });
  trainerPayout.monthlyPayout = trainerPayout.pendingPayout + trainerPayout.paidPayout;

  const equipment = {
    totalEquipment: 0,
    maintenanceRequired: 0,
    lowStockEquipment: 0,
  };
  equipmentGroup.forEach((g) => {
    equipment.totalEquipment += g._count._all;
    if (g.condition === "NEEDS_REPAIR" || g.condition === "OUT_OF_SERVICE") {
      equipment.maintenanceRequired += g._count._all;
    }
  });

  return {
    business: {
      businessId: business.id,
      businessName: business.name,
      logo: business.logo,
      status: business.status,
      createdAt: business.createdAt,
    },
    members,
    trainers,
    membership,
    attendance,
    revenue,
    trainerPayout,
    pendingActions: {
      pendingBookingRequests: members.pendingMembers,
      pendingTrainerApplications: trainerAppCount,
    },
    ratings: {
      averageRating: reviewAggregate._avg.rating ? Number(reviewAggregate._avg.rating.toFixed(1)) : 0,
      totalReviews: reviewAggregate._count._all,
    },
    classes: {
      todayClasses: todayClassesCount,
      ongoingClasses: ongoingClassesCount,
    },
    equipment,
    subscription: subscription ? {
      subscriptionStatus: subscription.status,
      nextBillingDate: subscription.nextBillingDate,
      subscriptionExpireDate: subscription.nextBillingDate, // Fallback if no separate expire date
    } : null,
    quickStats: {
      newMembersThisMonth: newMembersMonthCount,
      newTrainersThisMonth: newTrainersMonthCount,
      newReviewsThisMonth: newReviewsMonthCount,
      newRevenueThisMonth: revenue.monthlyRevenue,
    },
  };
};

export const BusinessService = {
  createBusiness,
  getAllBusinesses,
  getBusinessById,
  updateBusiness,
  getMyBusiness,
  getBusinessDashboard,
};
