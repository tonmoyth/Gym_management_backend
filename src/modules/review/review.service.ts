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

export const ReviewService = {
  getTrainerReviews,
};
