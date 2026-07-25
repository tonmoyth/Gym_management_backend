import { prisma } from '../../lib/prisma';
import AppError from '../../errors/AppError';
import { QueryBuilder } from '../../utils/queryBuilder';

const getPendingBookings = async (
    businessId: string,
    ownerId: string,
    query: Record<string, unknown>
) => {
    // 1. Validate business & Ownership check
    const business = await prisma.business.findUnique({
        where: { id: businessId },
    });

    if (!business) {
        throw new AppError(404, 'Business not found');
    }

    if (business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden. You do not have access to this business\'s bookings.');
    }

    // 2. Adapt query parameters for QueryBuilder
    const prismaQuery = { ...query };

    // Handle sort mapping (?sort=-createdAt)
    if (prismaQuery.sort && typeof prismaQuery.sort === 'string') {
        if (prismaQuery.sort.startsWith('-')) {
            prismaQuery.sortBy = prismaQuery.sort.substring(1);
            prismaQuery.sortOrder = 'desc';
        } else {
            prismaQuery.sortBy = prismaQuery.sort;
            prismaQuery.sortOrder = 'asc';
        }
        delete prismaQuery.sort;
    }

    // Default sorting if not provided
    if (!prismaQuery.sortBy) {
        prismaQuery.sortBy = 'createdAt';
        prismaQuery.sortOrder = 'desc';
    }

    // Map sort fields to Prisma schema
    if (prismaQuery.sortBy === 'member.name') {
        prismaQuery.sortBy = 'member.user.fullName';
    } else if (prismaQuery.sortBy === 'bookingDate') {
        prismaQuery.sortBy = 'requestedAt';
    }

    // Map filters to Prisma schema fields
    if (prismaQuery.membershipPlanId) {
        prismaQuery.planId = prismaQuery.membershipPlanId;
        delete prismaQuery.membershipPlanId;
    }

    if (prismaQuery.bookingDate) {
        prismaQuery.requestedAt = prismaQuery.bookingDate;
        delete prismaQuery.bookingDate;
    }

    // 3. Create Query Builder
    const bookingQueryBuilder = new QueryBuilder(prisma.membership as any, prismaQuery as any, {
        searchableFields: ['plan.name'], 
        filterableFields: ['planId', 'requestedAt', 'createdAt']
    });

    // Apply strict requirements
    bookingQueryBuilder
        .where({
            businessId,
            status: 'PENDING_APPROVAL',
        });

    // Manually add search conditions for nested objects since QueryBuilder's .search() 
    // does not properly handle 1:1 deeply nested relations
    if (prismaQuery.searchTerm) {
        const searchTerm = prismaQuery.searchTerm as string;
        const searchConditions = [
            { plan: { name: { contains: searchTerm, mode: 'insensitive' as const } } },
            { member: { user: { fullName: { contains: searchTerm, mode: 'insensitive' as const } } } },
            { member: { user: { email: { contains: searchTerm, mode: 'insensitive' as const } } } },
        ];
        
        // Append custom search to existing where
        const currentWhere = bookingQueryBuilder.getQuery().where || {};
        bookingQueryBuilder.where({
            ...currentWhere,
            OR: searchConditions
        });
        
        // Remove searchTerm to prevent QueryBuilder from overriding our custom OR
        delete prismaQuery.searchTerm;
    }

    // Apply the rest of QueryBuilder functions
    bookingQueryBuilder
        .filter()
        .search() // Will be a no-op if searchTerm was deleted
        .sort()
        .paginate()
        .include({
            member: {
                select: {
                    id: true,
                    user: {
                        select: {
                            fullName: true,
                            email: true,
                            profileImage: true,
                        }
                    }
                }
            },
            plan: {
                select: {
                    id: true,
                    name: true,
                    price: true,
                    durationDays: true,
                }
            }
        });

    const result = await bookingQueryBuilder.execute();

    // 4. Format return data
    const formattedData = result.data.map((booking: any) => ({
        id: booking.id,
        status: 'PENDING',
        bookingDate: booking.requestedAt || booking.createdAt,
        createdAt: booking.createdAt,
        member: {
            id: booking.member.id,
            name: booking.member.user?.fullName || "",
            email: booking.member.user?.email || "",
            phone: "", // Not available in schema
            profilePhoto: booking.member.user?.profileImage || "",
        },
        membershipPlan: booking.plan ? {
            id: booking.plan.id,
            name: booking.plan.name,
            price: booking.plan.price ? booking.plan.price.toString() : "0.00",
            durationDays: booking.plan.durationDays,
        } : null
    }));

    return {
        meta: result.meta,
        data: formattedData,
    };
};

export const BookingService = {
    getPendingBookings,
};
