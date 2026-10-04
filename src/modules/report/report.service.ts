import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { QueryBuilder } from "../../utils/queryBuilder";
import { BookingStatus, PaymentStatus, PaymentPurpose, PayoutStatus, StaffPermissionRole } from "../../generated/prisma/client";
import { verifyBusinessAccess } from "../../utils/businessAccess";

// Helpers for period calculation
const getDateRange = (period: string, year: number, month?: number, quarter?: number) => {
    let startDate: Date;
    let endDate: Date;

    if (period === 'year') {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year + 1, 0, 1);
    } else if (period === 'quarter') {
        const qStart = quarter ? (quarter - 1) * 3 : 0;
        startDate = new Date(year, qStart, 1);
        endDate = new Date(year, qStart + 3, 1);
    } else {
        // month
        const m = month ? month - 1 : new Date().getMonth();
        startDate = new Date(year, m, 1);
        endDate = new Date(year, m + 1, 1);
    }
    return { startDate, endDate };
}

const verifyBusinessOwnership = async (businessId: string, userId: string) => {
    await verifyBusinessAccess(businessId, userId, [
        StaffPermissionRole.FINANCE,
        StaffPermissionRole.FULL,
    ]);
};

const getRevenueReport = async (userId: string, businessId: string, query: any) => {
    await verifyBusinessOwnership(businessId, userId);

    const period = query.period || 'month';
    const year = query.year ? parseInt(query.year as string) : new Date().getFullYear();
    const month = query.month ? parseInt(query.month as string) : new Date().getMonth() + 1;
    const quarter = query.quarter ? parseInt(query.quarter as string) : Math.floor(new Date().getMonth() / 3) + 1;

    let startDate: Date;
    let endDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;

    const fromDateStr = query.from || query.dateFrom;
    const toDateStr = query.to || query.dateTo;

    if (fromDateStr || toDateStr) {
        startDate = fromDateStr ? new Date(fromDateStr) : new Date(0);
        if (toDateStr) {
            const d = new Date(toDateStr);
            d.setHours(23, 59, 59, 999);
            endDate = d;
        } else {
            endDate = new Date();
        }
        const diff = endDate.getTime() - startDate.getTime();
        prevStartDate = new Date(startDate.getTime() - diff);
        prevEndDate = new Date(startDate.getTime());
    } else if (period === 'all') {
        startDate = new Date(0);
        endDate = new Date();
        prevStartDate = new Date(0);
        prevEndDate = new Date(0);
    } else {
        const range = getDateRange(period, year, month, quarter);
        startDate = range.startDate;
        endDate = range.endDate;

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
        const prevRange = getDateRange(period, prevYear, prevMonth, prevQuarter);
        prevStartDate = prevRange.startDate;
        prevEndDate = prevRange.endDate;
    }

    // Successful membership payments for this business
    const whereConditions: any = {
        membership: {
            businessId,
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
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            amount: true,
            currency: true,
            gateway: true,
            gatewayTransactionId: true,
            createdAt: true,
            payer: {
                select: {
                    fullName: true,
                    email: true,
                    profileImage: true,
                }
            },
            membership: {
                select: {
                    planId: true,
                    plan: { select: { name: true, price: true } }
                }
            }
        }
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

    // Chart processing & groupings
    const chartMap = new Map<string, number>();
    const topPlansMap = new Map<string, { planId: string; planName: string; totalSales: number; revenue: number }>();
    const gatewayMap = new Map<string, { gateway: string; count: number; amount: number }>();

    for (const p of payments) {
        const amt = Number(p.amount);
        let label = "";

        if (period === 'month' || fromDateStr) {
            const d = new Date(p.createdAt);
            const date = d.getDate();
            const week = Math.ceil(date / 7);
            label = `Week ${week > 4 ? 4 : week}`;
        } else if (period === 'year' || period === 'quarter') {
            label = new Date(p.createdAt).toLocaleString('default', { month: 'short' });
        } else {
            label = new Date(p.createdAt).toLocaleDateString('default', { month: 'short', day: 'numeric' });
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

        // Gateway breakdown
        const gw = p.gateway || 'OTHER';
        if (!gatewayMap.has(gw)) {
            gatewayMap.set(gw, { gateway: gw, count: 0, amount: 0 });
        }
        const gwStats = gatewayMap.get(gw)!;
        gwStats.count += 1;
        gwStats.amount += amt;
    }

    const chart = Array.from(chartMap.entries()).map(([label, revenue]) => ({ label, revenue }));
    const topPlans = Array.from(topPlansMap.values()).sort((a, b) => b.revenue - a.revenue);
    const gatewayBreakdown = Array.from(gatewayMap.values()).sort((a, b) => b.amount - a.amount);

    const breakdown = topPlans.map((item) => ({
        planName: item.planName,
        count: item.totalSales,
        amount: item.revenue,
    }));

    const recentTransactions = payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        gateway: p.gateway,
        transactionId: p.gatewayTransactionId || p.id.substring(0, 10),
        createdAt: p.createdAt,
        payer: {
            name: p.payer?.fullName || 'Gym Member',
            email: p.payer?.email || '',
            image: p.payer?.profileImage || '',
        },
        planName: p.membership?.plan?.name || 'Membership Plan',
    }));

    const summary = {
        totalRevenue,
        totalMemberships,
        averageMembershipValue: totalMemberships > 0 ? Number((totalRevenue / totalMemberships).toFixed(2)) : 0,
        growthPercentage: Number(growthPercentage.toFixed(2))
    };

    return {
        summary,
        chart,
        topPlans,
        gatewayBreakdown,
        recentTransactions,
        // Top-level aliases for robust compatibility
        totalRevenue: summary.totalRevenue,
        totalTransactions: summary.totalMemberships,
        averageTicket: summary.averageMembershipValue,
        total: summary.totalRevenue,
        count: summary.totalMemberships,
        breakdown,
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
    
    const fromVal = query.from || query.dateFrom;
    const toVal = query.to || query.dateTo;
    if (fromVal || toVal) {
        whereConditions.month = {};
        if (fromVal) whereConditions.month.gte = new Date(fromVal);
        if (toVal) {
            const d = new Date(toVal);
            d.setHours(23, 59, 59, 999);
            whereConditions.month.lte = d;
        }
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
        month: true,
        createdAt: true,
        transactionReference: true,
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
        month: item.month,
        createdAt: item.createdAt,
        paymentDate: item.paidAt,
        reference: item.transactionReference || `TXN${item.id.substring(0, 8).toUpperCase()}` 
    }));

    const summary = {
        totalPaid,
        pendingAmount,
        failedAmount,
        totalPayouts
    };

    const trainers = formattedData.map((item: any) => ({
        id: item.id,
        trainerName: item.trainer.name,
        email: item.trainer.email,
        profilePhoto: item.trainer.profilePhoto,
        status: item.status,
        totalPayout: item.amount,
        paymentDate: item.paymentDate,
        reference: item.reference,
        monthsCount: 1,
    }));

    return {
        meta: {
            page: Number(query.page) || 1,
            limit: Number(query.limit) || 10,
            total,
            totalPages: Math.ceil(total / (Number(query.limit) || 10)),
        },
        data: {
            summary,
            totalPaid,
            pendingAmount,
            totalAmount: totalPaid,
            payouts: formattedData,
            trainers,
        }
    };
};

export const ReportService = {
    getRevenueReport,
    getPayoutReport
};
