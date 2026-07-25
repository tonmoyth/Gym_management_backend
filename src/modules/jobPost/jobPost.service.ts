import { prisma } from '../../lib/prisma';
import AppError from '../../errors/AppError';
import { QueryBuilder } from '../../utils/queryBuilder';

interface ICreateJobPostPayload {
    title: string;
    description: string;
    specializationTagId: string;
}

const createJobPost = async (ownerId: string, payload: ICreateJobPostPayload) => {
    // 1. Find Business by authenticated owner
    const business = await prisma.business.findUnique({
        where: { ownerId },
    });

    if (!business) {
        throw new AppError(404, 'Business not found. You must create a business first.');
    }

    // 2. Business approval verification
    if (business.status !== 'ACTIVE') {
        throw new AppError(403, 'Your business must be approved to create job posts.');
    }

    // 3. Verify SpecializationTag exists
    const tag = await prisma.specializationTag.findUnique({
        where: { id: payload.specializationTagId },
    });

    if (!tag) {
        throw new AppError(404, 'SpecializationTag not found.');
    }

    // 4. Create JobPost with forced isOpen = true
    const jobPost = await prisma.jobPost.create({
        data: {
            title: payload.title,
            description: payload.description,
            specializationTagId: payload.specializationTagId,
            businessId: business.id,
            isOpen: true,
        },
        select: {
            id: true,
            businessId: true,
            title: true,
            description: true,
            isOpen: true,
            createdAt: true,
            specializationTag: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                }
            }
        }
    });

    return jobPost;
};

const closeJobPost = async (ownerId: string, jobPostId: string) => {
    // 1. Find Job Post with associated Business to verify ownership
    const jobPost = await prisma.jobPost.findUnique({
        where: { id: jobPostId },
        include: {
            business: {
                select: {
                    ownerId: true,
                },
            },
        },
    });

    // Rule 1: Job Post must exist
    if (!jobPost) {
        throw new AppError(404, 'Job post not found.');
    }

    // Rule 2: Job Post must belong to the authenticated Business Owner
    if (jobPost.business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden. You do not have permission to close this job post.');
    }

    // Rule 4: Already closed check
    if (!jobPost.isOpen) {
        return {
            id: jobPost.id,
            title: jobPost.title,
            isOpen: jobPost.isOpen,
            createdAt: jobPost.createdAt,
        };
    }

    // Rule 3, 5, 6, 7: Update isOpen = false
    const updatedJobPost = await prisma.jobPost.update({
        where: { id: jobPostId },
        data: {
            isOpen: false,
        },
        select: {
            id: true,
            title: true,
            isOpen: true,
            createdAt: true,
        },
    });

    return updatedJobPost;
};

const getJobPostApplicants = async (ownerId: string, jobPostId: string, query: any) => {
    // 1. Find Job Post with associated Business to verify ownership
    const jobPost = await prisma.jobPost.findUnique({
        where: { id: jobPostId },
        include: {
            business: {
                select: {
                    ownerId: true,
                },
            },
        },
    });

    if (!jobPost) {
        throw new AppError(404, 'Job post not found.');
    }

    if (jobPost.business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden. You do not have permission to view these applicants.');
    }

    // 2. Map query parameters to match database fields and QueryBuilder format
    const queryParams = { ...query };

    if (queryParams.applicationStatus) {
        queryParams.status = queryParams.applicationStatus;
        delete queryParams.applicationStatus;
    }

    if (queryParams.sort) {
        if (queryParams.sort.startsWith('-')) {
            queryParams.sortBy = queryParams.sort.substring(1);
            queryParams.sortOrder = 'desc';
        } else {
            queryParams.sortBy = queryParams.sort;
            queryParams.sortOrder = 'asc';
        }
        delete queryParams.sort;
    }

    // Default sorting / mapping for TrainerApplication
    if (!queryParams.sortBy || queryParams.sortBy === 'createdAt') {
        queryParams.sortBy = 'appliedAt';
    }
    if (!queryParams.sortOrder) {
        queryParams.sortOrder = 'desc';
    }

    // 3. Initialize QueryBuilder
    const queryBuilder = new QueryBuilder(prisma.trainerApplication, queryParams, {
        searchableFields: ['trainer.user.name', 'trainer.user.email', 'trainer.user.phone'],
        filterableFields: ['status', 'trainer.experience'],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    // 4. Force jobPostId and override select
    queryBuilder.where({ jobPostId });
    
    const qbQuery = queryBuilder.getQuery();
    delete qbQuery.include;
    qbQuery.select = {
        id: true,
        status: true,
        appliedAt: true,
        trainer: {
            select: {
                id: true,
                experience: true,
                hourlyRate: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        profilePhoto: true,
                    },
                },
                specializations: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        },
    };

    // 5. Execute
    const result = await queryBuilder.execute();

    // 6. Map results to match requested output format
    const mappedData = result.data.map((app: any) => ({
        id: app.id,
        applicationStatus: app.status,
        createdAt: app.appliedAt,
        trainer: app.trainer,
    }));

    return {
        meta: result.meta,
        data: mappedData,
    };
};

export const JobPostService = {
    createJobPost,
    closeJobPost,
    getJobPostApplicants,
};
