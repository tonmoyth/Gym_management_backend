import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { QueryBuilder } from "../../utils/queryBuilder";

const addFavorite = async (userId: string, businessId: string) => {
  let member = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!member) {
    member = await prisma.memberProfile.create({
      data: { userId },
    });
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
    include: {
      business: {
        select: {
          id: true,
          name: true,
          logo: true,
          photos: true,
          address: true,
          description: true,
          amenities: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  return newFavorite;
};

const getMyFavorites = async (userId: string, query: Record<string, unknown>) => {
  let member = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!member) {
    return {
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      data: [],
    };
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
          photos: true,
          address: true,
          description: true,
          amenities: true,
          phone: true,
          email: true,
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
