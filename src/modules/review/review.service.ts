import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { QueryBuilder } from "../../utils/queryBuilder";

const getTrainerReviews = async (trainerId: string, query: Record<string, unknown>) => {
  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
  });

  if (!trainer) {
    throw new AppError(httpStatus.NOT_FOUND, "Trainer not found");
  }

  const queryBuilder = new QueryBuilder(prisma.review as any, query as any, {
    searchableFields: ["comment"],
    filterableFields: ["rating"],
  })
    .where({ trainerId, isRemoved: false })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      member: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },
        },
      },
    })
    .fields();

  const result = await queryBuilder.execute();
  return result;
};

const createReview = async (userId: string, payload: any) => {
  const member = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!member) {
    throw new AppError(httpStatus.NOT_FOUND, "Member not found");
  }

  const business = await prisma.business.findUnique({
    where: { id: payload.businessId },
  });

  if (!business) {
    throw new AppError(httpStatus.NOT_FOUND, "Business not found");
  }

  if (payload.trainerId) {
    const trainer = await prisma.trainerProfile.findUnique({
      where: { id: payload.trainerId },
    });
    if (!trainer) {
      throw new AppError(httpStatus.NOT_FOUND, "Trainer not found");
    }

    const trainerBusiness = await prisma.trainerBusiness.findUnique({
      where: {
        trainerId_businessId: { trainerId: payload.trainerId, businessId: payload.businessId }
      },
    });
    if (!trainerBusiness) {
      throw new AppError(httpStatus.BAD_REQUEST, "Trainer is not associated with this business");
    }

    const hasBooking = await prisma.classBooking.findFirst({
      where: {
        memberId: member.id,
        status: "CONFIRMED",
        classSchedule: {
          trainerId: payload.trainerId,
          businessId: payload.businessId,
        },
      },
    });

    if (!hasBooking) {
      throw new AppError(httpStatus.FORBIDDEN, "You are not eligible to review this trainer because you haven't booked any class with them.");
    }
  } else {
    const hasMembership = await prisma.membership.findFirst({
      where: {
        memberId: member.id,
        businessId: payload.businessId,
      },
    });

    if (!hasMembership) {
      throw new AppError(httpStatus.FORBIDDEN, "You are not eligible to review this business because you do not have any membership with them.");
    }
  }

  const existingReview = await prisma.review.findFirst({
    where: {
      memberId: member.id,
      businessId: payload.businessId,
      trainerId: payload.trainerId || null,
    },
  });

  if (existingReview) {
    throw new AppError(httpStatus.CONFLICT, "You have already submitted a review for this target.");
  }

  const review = await prisma.$transaction(async (tx) => {
    const newReview = await tx.review.create({
      data: {
        memberId: member.id,
        businessId: payload.businessId,
        trainerId: payload.trainerId || null,
        rating: payload.rating,
        comment: payload.comment || null,
      },
    });

    if (payload.trainerId) {
      const aggregations = await tx.review.aggregate({
        where: {
          trainerId: payload.trainerId,
          isRemoved: false,
        },
        _avg: {
          rating: true,
        },
      });

      const avgRating = aggregations._avg.rating || 0;

      await tx.trainerProfile.update({
        where: { id: payload.trainerId },
        data: { avgRating: avgRating },
      });
    }

    return newReview;
  });

  return review;
};

const getBusinessReviews = async (businessId: string, query: Record<string, unknown>) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError(httpStatus.NOT_FOUND, "Business not found");
  }

  const queryBuilder = new QueryBuilder(prisma.review as any, query as any, {
    searchableFields: ["comment"],
    filterableFields: ["rating"],
  })
    .where({ businessId, isRemoved: false })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      member: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },
        },
      },
      trainer: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },
        },
      },
    })
    .fields();

  const result = await queryBuilder.execute();
  return result;
};

export const ReviewService = {
  getTrainerReviews,
  createReview,
  getBusinessReviews,
};
