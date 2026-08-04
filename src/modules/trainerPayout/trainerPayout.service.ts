import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";
import { pushJob } from "../../utils/redisQueue";

interface ICreatePayoutPayload {
  trainerId: string;
  year: number;
  month: number;
  amount: number;
  note?: string;
}

const createOrUpdatePayout = async (
  ownerId: string,
  businessId: string,
  payload: ICreatePayoutPayload
) => {
  // Verify Business & Ownership
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError(404, "Business not found.");
  }

  if (business.ownerId !== ownerId) {
    throw new AppError(403, "Forbidden. You do not own this business.");
  }

  // Verify Trainer belongs to this business
  const trainerBusiness = await prisma.trainerBusiness.findUnique({
    where: {
      trainerId_businessId: {
        trainerId: payload.trainerId,
        businessId: businessId,
      },
    },
  });

  if (!trainerBusiness) {
    throw new AppError(403, "Trainer is not assigned to this business.");
  }

  // Generate month DateTime (e.g. 1st of the month at midnight)
  const payoutMonthDate = new Date(payload.year, payload.month - 1, 1);

  // Check Existing Monthly Payout
  const existingPayout = await prisma.trainerPayout.findUnique({
    where: {
      businessId_trainerId_month: {
        businessId,
        trainerId: payload.trainerId,
        month: payoutMonthDate,
      },
    },
  });

  if (existingPayout) {
    // Update amount & note
    const updatedPayout = await prisma.trainerPayout.update({
      where: { id: existingPayout.id },
      data: {
        amount: payload.amount,
        note: payload.note,
      },
    });
    return updatedPayout;
  }

  // Create new payout
  const newPayout = await prisma.trainerPayout.create({
    data: {
      businessId,
      trainerId: payload.trainerId,
      month: payoutMonthDate,
      amount: payload.amount,
      note: payload.note,
      status: "PENDING",
    },
  });

  return newPayout;
};

const getPayouts = async (
  ownerId: string,
  businessId: string,
  query: any
) => {
  // Verify Business & Ownership
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError(404, "Business not found.");
  }

  if (business.ownerId !== ownerId) {
    throw new AppError(403, "Forbidden. You do not own this business.");
  }

  // Process month and year filters
  const additionalFilters: any = { businessId };
  if (query.month && query.year) {
    const monthInt = parseInt(query.month, 10);
    const yearInt = parseInt(query.year, 10);
    additionalFilters.month = new Date(yearInt, monthInt - 1, 1);
  } else if (query.year) {
    const yearInt = parseInt(query.year, 10);
    const startDate = new Date(yearInt, 0, 1);
    const endDate = new Date(yearInt + 1, 0, 1);
    additionalFilters.month = {
      gte: startDate,
      lt: endDate,
    };
  }

  if (query.status) {
    additionalFilters.status = query.status;
  }
  if (query.trainerId) {
    additionalFilters.trainerId = query.trainerId;
  }

  // Initialize Query Builder
  const queryBuilder = new QueryBuilder(
    prisma.trainerPayout,
    query,
    {
      searchableFields: ["trainer.user.fullName", "trainer.user.email"],
    }
  )
    .search()
    .filter()
    .where(additionalFilters as any)
    .sort()
    .paginate()
    .include({
      trainer: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileImage: true,
            },
          },
        },
      },
    });

  const [payoutsResult, metaData, summaryData, groupedTrainers] = await Promise.all([
    queryBuilder.execute(),
    queryBuilder.count(),
    prisma.trainerPayout.aggregate({
      where: queryBuilder.getQuery().where,
      _sum: { amount: true },
    }),
    prisma.trainerPayout.groupBy({
      by: ["trainerId"],
      where: queryBuilder.getQuery().where,
    }),
  ]);

  // Aggregate pending and paid separately for summary
  const summaryStatusData = await prisma.trainerPayout.groupBy({
    by: ["status"],
    where: queryBuilder.getQuery().where,
    _sum: { amount: true },
  });

  const totalPayout = summaryData._sum.amount ? Number(summaryData._sum.amount) : 0;
  const totalPaid = summaryStatusData.find(s => s.status === "PAID")?._sum.amount ? Number(summaryStatusData.find(s => s.status === "PAID")?._sum.amount) : 0;
  const totalPending = summaryStatusData.find(s => s.status === "PENDING")?._sum.amount ? Number(summaryStatusData.find(s => s.status === "PENDING")?._sum.amount) : 0;
  const totalTrainers = groupedTrainers.length;

  const summary = {
    totalPayout,
    totalPaid,
    totalPending,
    totalTrainers,
  };

  const formattedData = payoutsResult.data.map((payout: any) => ({
    id: payout.id,
    trainer: {
      id: payout.trainer.id,
      name: payout.trainer.user?.fullName,
      email: payout.trainer.user?.email,
      profilePhoto: payout.trainer.user?.profileImage,
    },
    month: payout.month.getMonth() + 1,
    year: payout.month.getFullYear(),
    amount: Number(payout.amount),
    note: payout.note,
    status: payout.status,
    paidAt: payout.paidAt,
    transactionReference: payout.transactionReference,
  }));

  return { summary, meta: payoutsResult.meta, data: formattedData };
};

const markPaid = async (
  ownerId: string,
  businessId: string,
  payoutId: string,
  transactionReference?: string
) => {
  // Verify Business & Ownership
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError(404, "Business not found.");
  }

  if (business.ownerId !== ownerId) {
    throw new AppError(403, "Forbidden. You do not own this business.");
  }

  // Verify Payout
  const payout = await prisma.trainerPayout.findUnique({
    where: { id: payoutId },
    include: {
      trainer: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!payout) {
    throw new AppError(404, "Payout not found.");
  }

  if (payout.businessId !== businessId) {
    throw new AppError(403, "Payout does not belong to this business.");
  }

  if (payout.status === "PAID") {
    throw new AppError(409, "Payout is already marked as paid.");
  }

  // Prisma Transaction
  const updatedPayout = await prisma.$transaction(async (tx) => {
    return tx.trainerPayout.update({
      where: { id: payoutId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        transactionReference: transactionReference || null,
      },
    });
  });

  // Publish Redis Event for Notification & Email
  pushJob("notification_queue", {
    eventType: "TRAINER_PAYOUT_PAID",
    type: "PAYOUT",
    title: "Trainer Payout Received",
    body: `Your payout for ${payout.month.toLocaleString('default', { month: 'long' })} ${payout.month.getFullYear()} has been marked as paid.`,
    trainerUserId: payout.trainer.user.id,
    trainerEmail: payout.trainer.user.email,
    businessId: businessId,
    businessName: business.name,
    trainerId: payout.trainerId,
    payoutId: updatedPayout.id,
    amount: Number(updatedPayout.amount),
    month: payout.month.getMonth() + 1,
    year: payout.month.getFullYear(),
    paymentDate: updatedPayout.paidAt,
    transactionReference: updatedPayout.transactionReference,
  });

  return updatedPayout;
};

export const TrainerPayoutService = {
  createOrUpdatePayout,
  getPayouts,
  markPaid,
};
