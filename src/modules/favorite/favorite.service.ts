import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { QueryBuilder } from "../../utils/queryBuilder";

const addFavorite = async (userId: string, businessId: string) => {
  const member = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!member) {
    throw new AppError(httpStatus.NOT_FOUND, "Member not found");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError(httpStatus.NOT_FOUND, "Business not found");
  }

  const existingFavorite = await prisma.favorite.findUnique({
    where: {
      memberId_businessId: {
        memberId: member.id,
        businessId,
      },
    },
  });

  if (existingFavorite) {
    throw new AppError(httpStatus.CONFLICT, "Business is already in favorites");
  }

  const newFavorite = await prisma.favorite.create({
    data: {
      memberId: member.id,
      businessId,
    },
  });

  return newFavorite;
};

const getMyFavorites = async (userId: string, query: Record<string, unknown>) => {
  const member = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!member) {
    throw new AppError(httpStatus.NOT_FOUND, "Member not found");
  }

  const queryBuilder = new QueryBuilder(prisma.favorite as any, query as any, {
    searchableFields: [],
    filterableFields: [],
  })
    .where({ memberId: member.id })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      business: {
        select: {
          id: true,
          name: true,
          logo: true,
          address: true,
          status: true,
          createdAt: true,
        },
      },
    })
    .fields();

  const result = await queryBuilder.execute();
  return result;
};

const removeFavorite = async (userId: string, businessId: string) => {
  const member = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!member) {
    throw new AppError(httpStatus.NOT_FOUND, "Member not found");
  }

  const existingFavorite = await prisma.favorite.findUnique({
    where: {
      memberId_businessId: {
        memberId: member.id,
        businessId,
      },
    },
  });

  if (!existingFavorite) {
    throw new AppError(httpStatus.NOT_FOUND, "Favorite not found");
  }

  const deletedFavorite = await prisma.favorite.delete({
    where: {
      id: existingFavorite.id,
    },
  });

  return deletedFavorite;
};

export const FavoriteService = {
  addFavorite,
  getMyFavorites,
  removeFavorite,
};
