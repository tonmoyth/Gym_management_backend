import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";
import httpStatus from "http-status";

const getMyTrainerPayouts = async (userId: string, query: Record<string, unknown>) => {
  // Resolve TrainerProfile
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId },
  });

  if (!trainerProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Trainer profile not found.");
  }

  // Base Condition: Only this trainer's payouts
  const baseCondition: any = {
    trainerId: trainerProfile.id,
  };

  // Process month and year filters
  if (query.month && query.year) {
    const monthInt = parseInt(query.month as string, 10);
    const yearInt = parseInt(query.year as string, 10);
    baseCondition.month = new Date(yearInt, monthInt - 1, 1);
  } else if (query.year) {
    const yearInt = parseInt(query.year as string, 10);
    const startDate = new Date(yearInt, 0, 1);
    const endDate = new Date(yearInt + 1, 0, 1);
    baseCondition.month = {
      gte: startDate,
      lt: endDate,
    };
  } else if (query.month) {
    // If only month is provided, we expect it to be "YYYY-MM"
    const monthStr = query.month as string;
    if (monthStr.includes('-')) {
        const [year, month] = monthStr.split('-');
        baseCondition.month = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    }
  }

  const queryConfig = {
    searchableFields: ["note", "transactionReference"],
    filterableFields: ["status", "businessId"],
  };

  const payoutQuery = new QueryBuilder(prisma.trainerPayout, query as any, queryConfig)
    .search()
    .filter()
    .sort()
    .paginate()
    .where(baseCondition)
    .include({
        business: {
            select: {
                id: true,
                name: true,
                logo: true,
            }
        }
    });
    
  if (!query.sortBy && !query.sortOrder) {
      // Default sorting: Newest payout/month first
      payoutQuery.getQuery().orderBy = { month: 'desc' };
  }

  const [total, result] = await Promise.all([
    payoutQuery.count(),
    payoutQuery.execute(),
  ]);

  const formattedData = result.data.map((payout: any) => ({
    id: payout.id,
    amount: Number(payout.amount),
    status: payout.status,
    month: payout.month,
    note: payout.note,
    transactionReference: payout.transactionReference,
    paidAt: payout.paidAt,
    createdAt: payout.createdAt,
    business: payout.business
  }));

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

export const PayoutService = {
  getMyTrainerPayouts,
};
