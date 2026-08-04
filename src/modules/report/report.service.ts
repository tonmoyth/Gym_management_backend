import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { QueryBuilder } from "../../utils/queryBuilder";
import { BookingStatus, PaymentStatus, PaymentPurpose, PayoutStatus } from "../../generated/prisma/client";

// Helpers for period calculation
const getDateRange = (period: string, year: number, month?: number, quarter?: number) => {
    let startDate: Date;
    let endDate: Date;

    if (period === 'year') {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year + 1, 0, 1);
    } else if (period === 'quarter') {
        const q = quarter || Math.floor(new Date().getMonth() / 3) + 1;
        const startMonth = (q - 1) * 3;
        startDate = new Date(year, startMonth, 1);
        endDate = new Date(year, startMonth + 3, 1);
    } else {
        // month
        const m = month ? month - 1 : new Date().getMonth();
        startDate = new Date(year, m, 1);
        endDate = new Date(year, m + 1, 1);
    }
    return { startDate, endDate };
}

const verifyBusinessOwnership = async (businessId: string, userId: string) => {
    const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true }
    });
    if (!business) {
        throw new AppError(httpStatus.NOT_FOUND, "Business not found");
    }
    if (business.ownerId !== userId) {
        throw new AppError(httpStatus.FORBIDDEN, "You do not own this business");
    }
};

const getRevenueReport = async (userId: string, businessId: string, query: any) => {
    await verifyBusinessOwnership(businessId, userId);

    const period = query.period || 'month';
    const year = query.year ? parseInt(query.year as string) : new Date().getFullYear();
    const month = query.month ? parseInt(query.month as string) : new Date().getMonth() + 1;
    const quarter = query.quarter ? parseInt(query.quarter as string) : Math.floor(new Date().getMonth() / 3) + 1;

    const { startDate, endDate } = getDateRange(period, year, month, quarter);

    // Get previous period dates for growth calculation
    let prevYear = year;
    let prevMonth = month;
    let prevQuarter = quarter;

    if (period === 'year') prevYear -= 1;
    else if (period === 'quarter') {
        if (quarter === 1) { prevQuarter = 4; prevYear -= 1; }
        else { prevQuarter -= 1; }
    } else {
        if (month === 1) { prevMonth = 12; prevYear -= 1; }
        else { prevMonth -= 1; }
    }
    
    const { startDate: prevStartDate, endDate: prevEndDate } = getDateRange(period, prevYear, prevMonth, prevQuarter);

    // Queries
    const whereConditions = {
        membership: {
            businessId,
            status: {
                in: [BookingStatus.ACTIVE, BookingStatus.EXPIRED] 
            }
        },
        status: PaymentStatus.SUCCESS,
        purpose: PaymentPurpose.MEMBERSHIP,
    };

    const currentPeriodQuery = prisma.payment.aggregate({
        where: {
            ...whereConditions,
            createdAt: { gte: startDate, lt: endDate }
        },
        _sum: { amount: true },
        _count: { id: true }
    });

    const prevPeriodQuery = prisma.payment.aggregate({
        where: {
            ...whereConditions,
            createdAt: { gte: prevStartDate, lt: prevEndDate }
        },
        _sum: { amount: true }
    });

    const paymentsForChart = prisma.payment.findMany({
        where: { ...whereConditions, createdAt: { gte: startDate, lt: endDate } },
        select: { amount: true, createdAt: true, membership: { select: { planId: true, plan: { select: { name: true } } } } }
    });

    const [currentStats, prevStats, payments] = await Promise.all([currentPeriodQuery, prevPeriodQuery, paymentsForChart]);

    const totalRevenue = Number(currentStats._sum.amount || 0);
    const totalMemberships = currentStats._count.id;
    const prevRevenue = Number(prevStats._sum.amount || 0);

    let growthPercentage = 0;
    if (prevRevenue > 0) {
        growthPercentage = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
    } else if (totalRevenue > 0) {
        growthPercentage = 100;
    }

    // Chart processing
    const chartMap = new Map<string, number>();
    const topPlansMap = new Map<string, { planId: string; planName: string; totalSales: number; revenue: number }>();

    for (const p of payments) {
        const amt = Number(p.amount);
        let label = "";
        
        if (period === 'month') {
            // Group by week
            const date = p.createdAt.getDate();
            const week = Math.ceil(date / 7);
            label = `Week ${week > 4 ? 4 : week}`;
        } else if (period === 'year' || period === 'quarter') {
            // Group by month
            label = p.createdAt.toLocaleString('default', { month: 'short' });
        }

        chartMap.set(label, (chartMap.get(label) || 0) + amt);

        // Top plans
        if (p.membership && p.membership.plan) {
            const planId = p.membership.planId;
            const planName = p.membership.plan.name;
            if (!topPlansMap.has(planId)) {
                topPlansMap.set(planId, { planId, planName, totalSales: 0, revenue: 0 });
            }
            const planStats = topPlansMap.get(planId)!;
            planStats.totalSales += 1;
            planStats.revenue += amt;
        }
    }

    const chart = Array.from(chartMap.entries()).map(([label, revenue]) => ({ label, revenue }));
    const topPlans = Array.from(topPlansMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
        summary: {
            totalRevenue,
            totalMemberships,
            averageMembershipValue: totalMemberships > 0 ? Number((totalRevenue / totalMemberships).toFixed(2)) : 0,
            growthPercentage: Number(growthPercentage.toFixed(2))
        },
        chart,
        topPlans
    };
};

const getPayoutReport = async (userId: string, businessId: string, query: any) => {
    await verifyBusinessOwnership(businessId, userId);

    const whereConditions: any = { businessId };
    
    if (query.status) {
        whereConditions.status = query.status;
    }
    if (query.trainerId) {
        whereConditions.trainerId = query.trainerId;
    }
    if (query.from || query.to) {
        whereConditions.month = {};
        if (query.from) whereConditions.month.gte = new Date(query.from);
        if (query.to) whereConditions.month.lte = new Date(query.to);
    }

    const config = {
        searchableFields: ["trainer.user.fullName", "trainer.user.email"],
        filterableFields: ["status"],
    };

    const payoutQuery = new QueryBuilder(prisma.trainerPayout, { ...query, sortBy: query.sortBy || 'createdAt', sortOrder: query.sortOrder || 'desc' }, config)
        .search()
        .filter()
        .sort()
        .paginate()
        .where(whereConditions);

    const queryArgs = payoutQuery.getQuery();
    delete queryArgs.include; 
    queryArgs.select = {
        id: true,
        amount: true,
        status: true,
        paidAt: true,
        trainer: {
            select: {
                id: true,
                user: {
                    select: {
                        fullName: true,
                        email: true,
                        profileImage: true
                    }
                }
            }
        }
    };

    const summaryQuery = prisma.trainerPayout.groupBy({
        by: ['status'],
        where: { businessId },
        _sum: { amount: true },
        _count: { id: true }
    });

    const [total, data, summaryData] = await Promise.all([
        payoutQuery.count(),
        prisma.trainerPayout.findMany(queryArgs as any),
        summaryQuery
    ]);

    let totalPaid = 0;
    let pendingAmount = 0;
    let failedAmount = 0; 
    let totalPayouts = 0;

    summaryData.forEach((item: any) => {
        const amt = Number(item._sum.amount || 0);
        totalPayouts += item._count.id;
        
        if (item.status === PayoutStatus.PAID) {
            totalPaid += amt;
        } else if (item.status === PayoutStatus.PENDING) {
            pendingAmount += amt;
        }
    });

    const formattedData = data.map((item: any) => ({
        id: item.id,
        trainer: {
            id: item.trainer.id,
            name: item.trainer.user?.fullName || "",
            email: item.trainer.user?.email || "",
            profilePhoto: item.trainer.user?.profileImage || ""
        },
        amount: Number(item.amount),
        status: item.status,
        paymentDate: item.paidAt,
        reference: `TXN${item.id.substring(0, 8).toUpperCase()}` 
    }));

    return {
        meta: {
            page: Number(query.page) || 1,
            limit: Number(query.limit) || 10,
            total,
            totalPages: Math.ceil(total / (Number(query.limit) || 10)),
        },
        data: {
            summary: {
                totalPaid,
                pendingAmount,
                failedAmount,
                totalPayouts
            },
            payouts: formattedData
        }
    };
};

export const ReportService = {
    getRevenueReport,
    getPayoutReport
};
