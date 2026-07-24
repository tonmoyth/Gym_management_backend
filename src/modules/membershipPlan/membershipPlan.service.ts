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

const getMembershipPlan = async (businessId: string, planId: string) => {
    const business = await prisma.business.findUnique({
        where: { id: businessId }
    });

    if (!business) {
        throw new AppError(404, 'Business not found');
    }

    const plan = await prisma.membershipPlan.findFirst({
        where: {
            id: planId,
            businessId,
            status: PlanStatus.ACTIVE
        },
        select: {
            id: true,
            name: true,
            description: true,
            price: true,
            durationDays: true,
            benefits: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            business: {
                select: {
                    id: true,
                    name: true,
                    logo: true
                }
            }
        }
    });

    if (!plan) {
        throw new AppError(404, 'Membership plan not found');
    }

    return plan;
};

const updateMembershipPlan = async (
    businessId: string,
    planId: string,
    ownerId: string,
    payload: {
        name?: string;
        description?: string;
        price?: number;
        durationDays?: number;
        benefits?: string[];
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

    const plan = await prisma.membershipPlan.findUnique({
        where: { id: planId }
    });

    if (!plan) {
        throw new AppError(404, 'Membership plan not found');
    }

    if (plan.businessId !== businessId) {
        throw new AppError(403, 'Forbidden: Membership plan does not belong to this business');
    }

    if (plan.status === PlanStatus.ARCHIVED) {
        throw new AppError(400, 'Archived plans cannot be updated');
    }

    const dataToUpdate: any = {};
    let hasChanges = false;

    if (payload.name !== undefined) {
        const normalizedName = payload.name.trim().toLowerCase();
        
        const existingPlans = await prisma.membershipPlan.findMany({
            where: {
                businessId,
                id: { not: planId }
            },
            select: { name: true }
        });

        const isDuplicate = existingPlans.some(p => p.name.toLowerCase() === normalizedName);
        if (isDuplicate) {
            throw new AppError(409, 'A membership plan with this name already exists in your business');
        }

        if (plan.name !== payload.name.trim()) {
            dataToUpdate.name = payload.name.trim();
            hasChanges = true;
        }
    }

    if (payload.description !== undefined && plan.description !== payload.description?.trim()) {
        dataToUpdate.description = payload.description?.trim();
        hasChanges = true;
    }

    if (payload.price !== undefined) {
        const newPrice = new Prisma.Decimal(payload.price);
        if (!plan.price.equals(newPrice)) {
            dataToUpdate.price = newPrice;
            hasChanges = true;
        }
    }

    if (payload.durationDays !== undefined && plan.durationDays !== payload.durationDays) {
        dataToUpdate.durationDays = payload.durationDays;
        hasChanges = true;
    }

    if (payload.benefits !== undefined) {
        const uniqueBenefits = Array.from(new Set(payload.benefits.map(b => b.trim()).filter(b => b.length > 0)));
        if (JSON.stringify(plan.benefits) !== JSON.stringify(uniqueBenefits)) {
            dataToUpdate.benefits = uniqueBenefits;
            hasChanges = true;
        }
    }

    if (!hasChanges) {
        return await prisma.membershipPlan.findUnique({
            where: { id: planId },
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
    }

    const updatedPlan = await prisma.membershipPlan.update({
        where: { id: planId },
        data: dataToUpdate,
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

    return updatedPlan;
};

const archiveMembershipPlan = async (businessId: string, planId: string, ownerId: string) => {
    const business = await prisma.business.findUnique({
        where: { id: businessId }
    });

    if (!business) {
        throw new AppError(404, 'Business not found');
    }

    if (business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden: You do not own this business');
    }

    const plan = await prisma.membershipPlan.findUnique({
        where: { id: planId }
    });

    if (!plan) {
        throw new AppError(404, 'Membership plan not found');
    }

    if (plan.businessId !== businessId) {
        throw new AppError(403, 'Forbidden: Membership plan does not belong to this business');
    }

    if (plan.status === PlanStatus.ARCHIVED) {
        return {
            id: plan.id,
            businessId: plan.businessId,
            name: plan.name,
            status: plan.status,
            updatedAt: plan.updatedAt
        };
    }

    const archivedPlan = await prisma.membershipPlan.update({
        where: { id: planId },
        data: { status: PlanStatus.ARCHIVED },
        select: {
            id: true,
            businessId: true,
            name: true,
            status: true,
            updatedAt: true
        }
    });

    return archivedPlan;
};

export const MembershipPlanService = {
    createMembershipPlan,
    getMembershipPlans,
    getMembershipPlan,
    updateMembershipPlan,
    archiveMembershipPlan
};
