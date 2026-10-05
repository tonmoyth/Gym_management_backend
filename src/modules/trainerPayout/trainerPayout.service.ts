import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";
import { pushJob } from "../../utils/redisQueue";
import { verifyBusinessAccess } from "../../utils/businessAccess";
import { StaffPermissionRole } from "../../generated/prisma/enums";

interface ICreatePayoutPayload {
  trainerId: string;
  year?: number;
  month: number | string;
  amount: number;
  note?: string;
}

const createOrUpdatePayout = async (
  ownerId: string,
  businessId: string,
  payload: ICreatePayoutPayload
) => {
  // Verify Business & Staff/Owner Access
  await verifyBusinessAccess(businessId, ownerId, [
    StaffPermissionRole.FINANCE,
    StaffPermissionRole.FULL,
  ]);

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

  let year = payload.year;
  let month = typeof payload.month === "number" ? payload.month : parseInt(payload.month, 10);

  if (typeof payload.month === "string" && payload.month.includes("-")) {
    const parts = payload.month.split("-");
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  }

  if (!year || isNaN(year) || !month || isNaN(month)) {
    throw new AppError(400, "Valid year and month are required.");
  }

  // Generate month DateTime (e.g. 1st of the month at midnight)
  const payoutMonthDate = new Date(year, month - 1, 1);

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

const generateDueTrainerPayouts = async (businessId?: string) => {
  try {
    const trainerBusinesses = await prisma.trainerBusiness.findMany({
      where: {
        isActive: true,
        monthlySalary: { gt: 0 },
        ...(businessId ? { businessId } : {}),
      },
    });

    const now = new Date();

    for (const tb of trainerBusinesses) {
      if (!tb.monthlySalary || Number(tb.monthlySalary) <= 0) continue;

      const joinedAt = new Date(tb.joinedAt);

      // Loop through each completed month since joinedAt
      for (let i = 1; ; i++) {
        const dueDate = new Date(joinedAt);
        dueDate.setMonth(dueDate.getMonth() + i);

        // If this 1-month period has not completed yet, stop
        if (dueDate > now) break;

        // Payout cycle month: normalize to 1st of the completed service month
        const payoutCycleMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() - 1, 1);

        // Check if a payout record already exists for this business, trainer, and month
        const existing = await prisma.trainerPayout.findUnique({
          where: {
            businessId_trainerId_month: {
              businessId: tb.businessId,
              trainerId: tb.trainerId,
              month: payoutCycleMonth,
            },
          },
        });

        if (!existing) {
          const monthName = payoutCycleMonth.toLocaleString("default", { month: "long", year: "numeric" });
          await prisma.trainerPayout.create({
            data: {
              businessId: tb.businessId,
              trainerId: tb.trainerId,
              month: payoutCycleMonth,
              amount: tb.monthlySalary,
              status: "PENDING",
              note: `Automated monthly salary payout for ${monthName} (1 month service completed on ${dueDate.toISOString().split("T")[0]}).`,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("Error generating due trainer payouts:", error);
  }
};

const getPayouts = async (
  ownerId: string,
  businessId: string,
  query: any
) => {
  // Verify Business & Staff/Owner Access
  await verifyBusinessAccess(businessId, ownerId, [
    StaffPermissionRole.FINANCE,
    StaffPermissionRole.FULL,
  ]);

  // Synchronize and generate any due pending payouts for this business automatically
  await generateDueTrainerPayouts(businessId);

  // Process month and year filters
  const additionalFilters: any = { businessId };
  if (query.month && query.year) {
    const monthInt = parseInt(query.month, 10);
    const yearInt = parseInt(query.year, 10);
    additionalFilters.month = new Date(yearInt, monthInt - 1, 1);
  } else if (query.month && typeof query.month === "string" && query.month.includes("-")) {
    const parts = query.month.split("-");
    const yearInt = parseInt(parts[0], 10);
    const monthInt = parseInt(parts[1], 10);
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

  if (query.status && query.status !== "ALL") {
    additionalFilters.status = query.status;
  }
  if (query.trainerId && query.trainerId !== "ALL") {
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
          paymentAccounts: {
            where: { status: "ACTIVE" },
            orderBy: { isDefault: "desc" },
          },
        },
      },
    });

  const [payoutsResult, , summaryData, groupedTrainers] = await Promise.all([
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
      paymentAccounts: payout.trainer.paymentAccounts || [],
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
  // Verify Business & Staff/Owner Access
  const { business } = await verifyBusinessAccess(businessId, ownerId, [
    StaffPermissionRole.FINANCE,
    StaffPermissionRole.FULL,
  ]);

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
  generateDueTrainerPayouts,
};
