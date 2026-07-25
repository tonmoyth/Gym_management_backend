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
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        profileImage: true,
                    },
                },
                specializations: {
                    select: {
                        id: true,
                        tag: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
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
        trainer: {
            id: app.trainer.id,
            user: {
                id: app.trainer.user.id,
                name: app.trainer.user.fullName,
                email: app.trainer.user.email,
                profilePhoto: app.trainer.user.profileImage,
            },
            specializations: app.trainer.specializations.map((ts: any) => ts.tag),
        },
    }));

    return {
        meta: result.meta,
        data: mappedData,
    };
};

const approveTrainerApplication = async (ownerId: string, appId: string) => {
    // 1. Find Trainer Application with related Job Post and Business
    const application = await prisma.trainerApplication.findUnique({
        where: { id: appId },
        include: {
            jobPost: {
                include: {
                    business: true,
                },
            },
        },
    });

    if (!application) {
        throw new AppError(404, 'Trainer application not found.');
    }

    const { jobPost } = application;
    const { business } = jobPost;

    // 2. Ownership verification
    if (business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden. You do not have permission to approve this application.');
    }

    // 3. Job Post open verification
    if (!jobPost.isOpen) {
        throw new AppError(400, 'Job post is already closed.');
    }

    // 4. Application status verification
    if (application.status !== 'PENDING') {
        throw new AppError(400, 'Only pending applications can be approved.');
    }

    // 5. Existing TrainerBusiness verification
    const existingRelation = await prisma.trainerBusiness.findUnique({
        where: {
            trainerId_businessId: {
                trainerId: application.trainerId,
                businessId: business.id,
            },
        },
    });

    if (existingRelation) {
        throw new AppError(409, 'Trainer already belongs to this business.');
    }

    // 6. Execute inside Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
        // Step 1: Update current application
        const approvedApplication = await tx.trainerApplication.update({
            where: { id: appId },
            data: {
                status: 'APPROVED',
                reviewedAt: new Date(),
            },
            select: {
                id: true,
                status: true,
                trainer: {
                    select: {
                        id: true,
                        user: {
                            select: {
                                fullName: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        // Step 2: Reject every other pending application for the same Job Post
        await tx.trainerApplication.updateMany({
            where: {
                jobPostId: jobPost.id,
                id: { not: appId },
                status: 'PENDING',
            },
            data: {
                status: 'REJECTED',
                reviewedAt: new Date(),
            },
        });

        // Step 3: Close Job Post
        const closedJobPost = await tx.jobPost.update({
            where: { id: jobPost.id },
            data: { isOpen: false },
            select: {
                id: true,
                title: true,
                isOpen: true,
            },
        });

        // Step 4: Create TrainerBusiness
        await tx.trainerBusiness.create({
            data: {
                trainerId: application.trainerId,
                businessId: business.id,
            },
        });

        return {
            applicationId: approvedApplication.id,
            status: approvedApplication.status,
            trainer: {
                id: approvedApplication.trainer.id,
                name: approvedApplication.trainer.user.fullName,
                email: approvedApplication.trainer.user.email,
            },
            business: {
                id: business.id,
                name: business.name,
            },
            jobPost: {
                id: closedJobPost.id,
                title: closedJobPost.title,
                isOpen: closedJobPost.isOpen,
            },
        };
    });

    return result;
};

export const JobPostService = {
    createJobPost,
    closeJobPost,
    getJobPostApplicants,
    approveTrainerApplication,
};
