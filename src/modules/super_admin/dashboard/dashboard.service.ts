import { prisma } from '../../../lib/prisma';
import { BusinessStatus, PaymentStatus } from '../../../generated/prisma/enums';

export const dashboardService = {
  getGlobalMetrics: async () => {
    // Current date calculations
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Parallel aggregate queries
    const [
      // Businesses
      totalBusinesses,
      activeBusinesses,
      currentMonthBusinesses,
      previousMonthBusinesses,

      // Trainers
      totalTrainers,
      activeTrainers,
      currentMonthTrainers,
      previousMonthTrainers,

      // Members
      totalMembers,
      activeMembers,
      currentMonthMembers,
      previousMonthMembers,

      // Revenue
      revenueData,
      currentMonthRevenueData,
      previousMonthRevenueData,
    ] = await Promise.all([
      // Businesses
      prisma.business.count(),
      prisma.business.count({ where: { status: 'ACTIVE' } }),
      prisma.business.count({ where: { createdAt: { gte: currentMonthStart } } }),
      prisma.business.count({
        where: {
          createdAt: {
            gte: previousMonthStart,
            lt: currentMonthStart,
          },
        },
      }),

      // Trainers
      prisma.trainerProfile.count(),
      prisma.trainerProfile.count({ where: { user: { isActive: true } } }),
      prisma.trainerProfile.count({ where: { createdAt: { gte: currentMonthStart } } }),
      prisma.trainerProfile.count({
        where: {
          createdAt: {
            gte: previousMonthStart,
            lt: currentMonthStart,
          },
        },
      }),

      // Members
      prisma.memberProfile.count(),
      prisma.memberProfile.count({ where: { user: { isActive: true } } }),
      prisma.memberProfile.count({ where: { createdAt: { gte: currentMonthStart } } }),
      prisma.memberProfile.count({
        where: {
          createdAt: {
            gte: previousMonthStart,
            lt: currentMonthStart,
          },
        },
      }),

      // Revenue
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'SUCCESS',
          createdAt: { gte: currentMonthStart },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'SUCCESS',
          createdAt: {
            gte: previousMonthStart,
            lt: currentMonthStart,
          },
        },
      }),
    ]);

    // Parse revenue values
    const totalRevenue = Number(revenueData._sum.amount || 0);
    const currentMonthRevenue = Number(currentMonthRevenueData._sum.amount || 0);
    const previousMonthRevenue = Number(previousMonthRevenueData._sum.amount || 0);

    // Calculate growth percentages safely
    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(2));
    };

    return {
      businesses: {
        total: totalBusinesses,
        active: activeBusinesses,
        inactive: totalBusinesses - activeBusinesses,
      },
      trainers: {
        total: totalTrainers,
        active: activeTrainers,
        inactive: totalTrainers - activeTrainers,
      },
      members: {
        total: totalMembers,
        active: activeMembers,
        inactive: totalMembers - activeMembers,
      },
      revenue: {
        total: totalRevenue,
      },
      growth: {
        businesses: {
          current: currentMonthBusinesses,
          previous: previousMonthBusinesses,
          percentage: calculateGrowth(currentMonthBusinesses, previousMonthBusinesses),
        },
        trainers: {
          current: currentMonthTrainers,
          previous: previousMonthTrainers,
          percentage: calculateGrowth(currentMonthTrainers, previousMonthTrainers),
        },
        members: {
          current: currentMonthMembers,
          previous: previousMonthMembers,
          percentage: calculateGrowth(currentMonthMembers, previousMonthMembers),
        },
        revenue: {
          current: currentMonthRevenue,
          previous: previousMonthRevenue,
          percentage: calculateGrowth(currentMonthRevenue, previousMonthRevenue),
        },
      },
    };
  },
};
