import AppError from '../../errors/AppError';
import { prisma } from '../../lib/prisma';
import { BusinessStatus, PlanStatus } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { QueryBuilder } from '../../utils/queryBuilder';

const createMembershipPlan = async (
    businessId: string,
    ownerId: string,
    payload: {
        name: string;
        description?: string;
        price: number;
        durationDays: number;
        benefits: string[];
    }
) => {
    const business = await prisma.business.findUnique({
        where: { id: businessId }
    });

    if (!business) {
        throw new AppError(404, 'Business not found');
    }

    if (business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden: You do not own this business');
    }

    if (business.status !== BusinessStatus.ACTIVE) {
        throw new AppError(400, 'Only approved businesses can publish membership plans');
    }

    const normalizedName = payload.name.trim().toLowerCase();

    // Check for duplicate plan names case-insensitively
    const existingPlans = await prisma.membershipPlan.findMany({
        where: { businessId },
        select: { name: true }
    });

    const isDuplicate = existingPlans.some(plan => plan.name.toLowerCase() === normalizedName);

    if (isDuplicate) {
        throw new AppError(409, 'A membership plan with this name already exists in your business');
    }

    // Filter empty strings, trim, and remove duplicates
    const uniqueBenefits = Array.from(new Set(payload.benefits.map(b => b.trim()).filter(b => b.length > 0)));

    const newPlan = await prisma.membershipPlan.create({
        data: {
            businessId,
            name: payload.name.trim(),
            description: payload.description?.trim(),
            price: new Prisma.Decimal(payload.price),
            durationDays: payload.durationDays,
            benefits: uniqueBenefits,
            status: PlanStatus.ACTIVE
        },
        select: {
            id: true,
            businessId: true,
            name: true,
            description: true,
            price: true,
            durationDays: true,
            benefits: true,
            status: true,
            createdAt: true,
            updatedAt: true
        }
    });

    return newPlan;
};

const getMembershipPlans = async (businessId: string, queryParams: any) => {
    const business = await prisma.business.findUnique({
        where: { id: businessId }
    });

    if (!business) {
        throw new AppError(404, 'Business not found');
    }

    const { minPrice, maxPrice, ...restQuery } = queryParams;

    const queryBuilder = new QueryBuilder(prisma.membershipPlan, restQuery, {
        searchableFields: ['name', 'description'],
        filterableFields: ['durationDays', 'price']
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .where({ businessId, status: PlanStatus.ACTIVE });

    if (minPrice !== undefined || maxPrice !== undefined) {
        const priceFilter: any = {};
        if (minPrice !== undefined) priceFilter.gte = Number(minPrice);
        if (maxPrice !== undefined) priceFilter.lte = Number(maxPrice);
        queryBuilder.where({ price: priceFilter });
    }

    // Use fields() if requested, otherwise select necessary fields
    if (queryParams.fields) {
        queryBuilder.fields();
    } else {
        queryBuilder.getQuery().select = {
            id: true,
            businessId: true,
            name: true,
            description: true,
            price: true,
            durationDays: true,
            benefits: true,
            status: true,
            createdAt: true,
            updatedAt: true
        };
        delete queryBuilder.getQuery().include;
    }

    return await queryBuilder.execute();
};

export const MembershipPlanService = {
    createMembershipPlan,
    getMembershipPlans
};
