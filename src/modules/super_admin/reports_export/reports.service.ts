import { prisma } from '../../../lib/prisma';
import {
  PaymentStatus,
  PaymentPurpose,
  BusinessStatus,
  BookingStatus,
  Role,
} from '../../../generated/prisma/enums';
import {
  IReportFilterQuery,
  IPlatformReportData,
} from './reports.interface';

const getPlatformReport = async (
  query: IReportFilterQuery
): Promise<IPlatformReportData> => {
  const { startDate, endDate } = query;

  const dateFilter: Record<string, any> = {};
  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!isNaN(parsedStart.getTime())) {
      dateFilter.gte = parsedStart;
    }
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!isNaN(parsedEnd.getTime())) {
      if (typeof endDate === 'string' && !endDate.includes('T')) {
        parsedEnd.setUTCHours(23, 59, 59, 999);
      }
      dateFilter.lte = parsedEnd;
    }
  }

  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const paymentDateClause = hasDateFilter ? { createdAt: dateFilter } : {};
  const creationDateClause = hasDateFilter ? { createdAt: dateFilter } : {};
  const attendanceDateClause = hasDateFilter ? { checkInAt: dateFilter } : {};

  // Execute database aggregations efficiently in parallel
  const [
    totalRevenueAgg,
    refundedAmountAgg,
    membershipRevenueAgg,
    subscriptionRevenueAgg,
    successfulTransactionsCount,
    failedTransactionsCount,
    pendingTransactionsCount,
    totalBusinesses,
    activeBusinesses,
    suspendedBusinesses,
    pendingBusinesses,
    totalUsers,
    totalMembers,
    totalTrainers,
    totalStaff,
    totalBusinessOwners,
    activeMemberships,
    totalClasses,
    attendanceCount,
  ] = await Promise.all([
    // 1. Financial aggregations
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.SUCCESS,
        ...paymentDateClause,
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.REFUNDED,
        ...paymentDateClause,
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.SUCCESS,
        purpose: PaymentPurpose.MEMBERSHIP,
        ...paymentDateClause,
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.SUCCESS,
        purpose: PaymentPurpose.PLATFORM_SUBSCRIPTION,
        ...paymentDateClause,
      },
    }),
    prisma.payment.count({
      where: {
        status: PaymentStatus.SUCCESS,
        ...paymentDateClause,
      },
    }),
    prisma.payment.count({
      where: {
        status: PaymentStatus.FAILED,
        ...paymentDateClause,
      },
    }),
    prisma.payment.count({
      where: {
        status: PaymentStatus.PENDING,
        ...paymentDateClause,
      },
    }),

    // 2. Business usage aggregations
    prisma.business.count({ where: creationDateClause }),
    prisma.business.count({
      where: {
        status: BusinessStatus.ACTIVE,
        ...creationDateClause,
      },
    }),
    prisma.business.count({
      where: {
        status: BusinessStatus.SUSPENDED,
        ...creationDateClause,
      },
    }),
    prisma.business.count({
      where: {
        status: BusinessStatus.PENDING_APPROVAL,
        ...creationDateClause,
      },
    }),

    // 3. User usage aggregations
    prisma.user.count({ where: creationDateClause }),
    prisma.user.count({
      where: {
        role: Role.MEMBER,
        ...creationDateClause,
      },
    }),
    prisma.user.count({
      where: {
        role: Role.TRAINER,
        ...creationDateClause,
      },
    }),
    prisma.user.count({
      where: {
        role: { in: [Role.ADMIN, Role.STAFF] },
        ...creationDateClause,
      },
    }),
    prisma.user.count({
      where: {
        role: Role.BUSINESS_OWNER,
        ...creationDateClause,
      },
    }),

    // 4. Membership, Class, and Attendance metrics
    prisma.membership.count({
      where: {
        status: BookingStatus.ACTIVE,
        ...creationDateClause,
      },
    }),
    prisma.classSchedule.count({ where: creationDateClause }),
    prisma.attendance.count({ where: attendanceDateClause }),
  ]);

  const totalRevenue = Number(totalRevenueAgg._sum.amount || 0);
  const refundedAmount = Number(refundedAmountAgg._sum.amount || 0);
  const membershipRevenue = Number(membershipRevenueAgg._sum.amount || 0);
  const subscriptionRevenue = Number(subscriptionRevenueAgg._sum.amount || 0);
  const netRevenue = totalRevenue - refundedAmount;
  const totalTransactions =
    successfulTransactionsCount +
    failedTransactionsCount +
    pendingTransactionsCount;

  return {
    period: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    financial: {
      totalRevenue,
      refundedAmount,
      netRevenue,
      membershipRevenue,
      subscriptionRevenue,
      successfulTransactions: successfulTransactionsCount,
      failedTransactions: failedTransactionsCount,
      pendingTransactions: pendingTransactionsCount,
      totalTransactions,
    },
    usage: {
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      pendingBusinesses,
      totalUsers,
      totalMembers,
      totalTrainers,
      totalStaff,
      totalBusinessOwners,
      activeMemberships,
      totalClasses,
      attendanceCount,
    },
  };
};

export const ReportsService = {
  getPlatformReport,
};
