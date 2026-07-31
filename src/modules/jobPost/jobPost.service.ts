import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { pushJob } from "../../utils/redisQueue";
import { QueryBuilder } from "../../utils/queryBuilder";

interface ICreateJobPostPayload {
  title: string;
  description: string;
  specializationTagId: string;
}

const createJobPost = async (
  ownerId: string,
  payload: ICreateJobPostPayload,
) => {
  // 1. Find Business by authenticated owner
  const business = await prisma.business.findUnique({
    where: { ownerId },
  });

  if (!business) {
    throw new AppError(
      404,
      "Business not found. You must create a business first.",
    );
  }

  // 2. Business approval verification
  if (business.status !== "ACTIVE") {
    throw new AppError(
      403,
      "Your business must be approved to create job posts.",
    );
  }

  // 3. Verify SpecializationTag exists
  const tag = await prisma.specializationTag.findUnique({
    where: { id: payload.specializationTagId },
  });

  if (!tag) {
    throw new AppError(404, "SpecializationTag not found.");
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
        },
      },
    },
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
    throw new AppError(404, "Job post not found.");
  }

  // Rule 2: Job Post must belong to the authenticated Business Owner
  if (jobPost.business.ownerId !== ownerId) {
    throw new AppError(
      403,
      "Forbidden. You do not have permission to close this job post.",
    );
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

const getJobPostApplicants = async (
  ownerId: string,
  jobPostId: string,
  query: any,
) => {
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
    throw new AppError(404, "Job post not found.");
  }

  if (jobPost.business.ownerId !== ownerId) {
    throw new AppError(
      403,
      "Forbidden. You do not have permission to view these applicants.",
    );
  }

  // 2. Map query parameters to match database fields and QueryBuilder format
  const queryParams = { ...query };

  if (queryParams.applicationStatus) {
    queryParams.status = queryParams.applicationStatus;
    delete queryParams.applicationStatus;
  }

  if (queryParams.sort) {
    if (queryParams.sort.startsWith("-")) {
      queryParams.sortBy = queryParams.sort.substring(1);
      queryParams.sortOrder = "desc";
    } else {
      queryParams.sortBy = queryParams.sort;
      queryParams.sortOrder = "asc";
    }
    delete queryParams.sort;
  }

  // Default sorting / mapping for TrainerApplication
  if (!queryParams.sortBy || queryParams.sortBy === "createdAt") {
    queryParams.sortBy = "appliedAt";
  }
  if (!queryParams.sortOrder) {
    queryParams.sortOrder = "desc";
  }

  // 3. Initialize QueryBuilder
  const queryBuilder = new QueryBuilder(
    prisma.trainerApplication,
    queryParams,
    {
      searchableFields: [
        "trainer.user.name",
        "trainer.user.email",
        "trainer.user.phone",
      ],
      filterableFields: ["status", "trainer.experience"],
    },
  )
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
      experience: app.trainer.experience,
      
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
    throw new AppError(404, "Trainer application not found.");
  }

  const { jobPost } = application;
  const { business } = jobPost;

  // 2. Ownership verification
  if (business.ownerId !== ownerId) {
    throw new AppError(
      403,
      "Forbidden. You do not have permission to approve this application.",
    );
  }

  // 3. Job Post open verification
  // if (!jobPost.isOpen) {
  //     throw new AppError(400, 'Job post is already closed.');
  // }

  // 4. Application status verification
  if (application.status !== "PENDING") {
    throw new AppError(400, "Only pending applications can be approved.");
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
    throw new AppError(409, "Trainer already belongs to this business.");
  }

  // 6. Execute inside Prisma Transaction
  const result = await prisma.$transaction(async (tx) => {
    // Step 1: Update current application
    const approvedApplication = await tx.trainerApplication.update({
      where: { id: appId },
      data: {
        status: "APPROVED",
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
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Step 2: Reject every other pending application for the same Job Post
    // await tx.trainerApplication.updateMany({
    //   where: {
    //     jobPostId: jobPost.id,
    //     id: { not: appId },
    //     status: "PENDING",
    //   },
    //   data: {
    //     status: "REJECTED",
    //     reviewedAt: new Date(),
    //   },
    // });

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
    const trainerBusiness = await tx.trainerBusiness.create({
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
        userId: approvedApplication.trainer.user.id,
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
      trainerBusinessId: trainerBusiness.id,
    };
  });

  // 7. Background Processing (Notifications & Email)
  pushJob("job_application_queue", {
    eventType: "APPROVED",
    applicationId: result.applicationId,
    trainerUserId: result.trainer.userId,
    trainerName: result.trainer.name,
    trainerEmail: result.trainer.email,
    businessId: result.business.id,
    businessName: result.business.name,
    jobPostId: result.jobPost.id,
    jobPostTitle: result.jobPost.title,
    trainerBusinessId: result.trainerBusinessId,
  });

  // Clean up result for the response, removing internal data we just used for background processing
  const responseData = {
    applicationId: result.applicationId,
    status: result.status,
    trainer: {
      id: result.trainer.id,
      name: result.trainer.name,
      email: result.trainer.email,
    },
    business: result.business,
    jobPost: result.jobPost,
  };

  return responseData;
};

const rejectTrainerApplication = async (ownerId: string, appId: string) => {
  // 1. Find Trainer Application with related Job Post and Business
  const application = await prisma.trainerApplication.findUnique({
    where: { id: appId },
    include: {
      jobPost: {
        include: {
          business: true,
        },
      },
      trainer: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!application) {
    throw new AppError(404, "Trainer application not found.");
  }

  const { jobPost } = application;
  const { business } = jobPost;

  // 2. Ownership verification
  if (business.ownerId !== ownerId) {
    throw new AppError(
      403,
      "Forbidden. You do not have permission to reject this application.",
    );
  }

  // 3. Application status verification
  if (application.status !== "PENDING") {
    throw new AppError(400, "Only pending applications can be rejected.");
  }

  // 4. Execute Update
  const rejectedApplication = await prisma.trainerApplication.update({
    where: { id: appId },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
    },
  });

  // 5. Background Processing (Notifications & Email)
  pushJob("job_application_queue", {
    eventType: "REJECTED",
    applicationId: application.id,
    trainerUserId: application.trainer.user.id,
    trainerName: application.trainer.user.fullName,
    trainerEmail: application.trainer.user.email,
    businessId: business.id,
    businessName: business.name,
    jobPostId: jobPost.id,
    jobPostTitle: jobPost.title,
  });

  return {
    applicationId: rejectedApplication.id,
    status: rejectedApplication.status,
  };
};

const getOpenJobPosts = async (trainerUserId: string, query: any) => {
  // 1. Get TrainerProfile ID for this user
  const trainerProfile = await prisma.user.findUnique({
    where: { id: trainerUserId },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  // 2. Map query parameters to match database fields and QueryBuilder format
  const queryParams = { ...query };

  // 3. Set default sort if not provided
  if (!queryParams.sort) {
    queryParams.sort = "-createdAt";
  }

  if (queryParams.sort) {
    if (queryParams.sort.startsWith("-")) {
      queryParams.sortBy = queryParams.sort.substring(1);
      queryParams.sortOrder = "desc";
    } else {
      queryParams.sortBy = queryParams.sort;
      queryParams.sortOrder = "asc";
    }
    delete queryParams.sort;
  }

  // 4. Initialize QueryBuilder
  const queryBuilder = new QueryBuilder(prisma.jobPost, queryParams, {
    searchableFields: [
      "title",
      "description",
      "business.name",
      "specializationTag.name",
    ],
    filterableFields: ["specializationTagId", "businessId"],
  })
    .search()
    .filter()
    .sort()
    .paginate();

  // 5. Apply forced business rules
  queryBuilder.where({
    isOpen: true,
    business: {
      status: "ACTIVE",
    },
    // Exclude jobs already applied to by the trainer
    NOT: {
      applications: {
        some: {
          trainerId: trainerProfile.id,
        },
      },
    },
  });

  // 6. Define Select Fields
  const qbQuery = queryBuilder.getQuery();
  delete qbQuery.include;
  qbQuery.select = {
    id: true,
    title: true,
    description: true,
    createdAt: true,
    business: {
      select: {
        id: true,
        name: true,
        logo: true,
        address: true,
      },
    },
    specializationTag: {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    },
  };

  // 7. Execute Query
  const result = await queryBuilder.execute();

  // 8. Map to match expected response output exactly
  const mappedData = result.data.map((job: any) => ({
    id: job.id,
    title: job.title,
    description: job.description,
    business: {
      id: job.business.id,
      name: job.business.name,
      logo: job.business.logo,
      address: job.business.address,
    },
    specialization: {
      id: job.specializationTag.id,
      name: job.specializationTag.name,
      slug: job.specializationTag.slug,
    },
    createdAt: job.createdAt,
  }));

  return {
    meta: result.meta,
    data: mappedData,
  };
};

const getJobPostDetail = async (jobPostId: string) => {
  const jobPost = await prisma.jobPost.findUnique({
    where: {
      id: jobPostId,
      isOpen: true,
      business: {
        status: "ACTIVE",
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      isOpen: true,
      createdAt: true,
      _count: {
        select: {
          applications: true,
        },
      },
      business: {
        select: {
          id: true,
          name: true,
          logo: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      },
      specializationTag: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!jobPost) {
    throw new AppError(404, "Job post not found or it is no longer available.");
  }

  const postedDaysAgo = Math.floor(
    (Date.now() - jobPost.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    id: jobPost.id,
    title: jobPost.title,
    description: jobPost.description,
    isOpen: jobPost.isOpen,
    isAcceptingApplications: jobPost.isOpen,
    postedDaysAgo: postedDaysAgo >= 0 ? postedDaysAgo : 0,
    applicationCount: jobPost._count.applications,
    business: jobPost.business,
    specialization: {
      id: jobPost.specializationTag.id,
      name: jobPost.specializationTag.name,
      slug: jobPost.specializationTag.slug,
    },
    createdAt: jobPost.createdAt,
  };
};

const applyToJobPost = async (trainerUserId: string, jobPostId: string) => {
  // 1. Find Trainer Profile
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId: trainerUserId },
    include: { certifications: true },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  if (!trainerProfile.verifiedBadge) {
    throw new AppError(
      403,
      "You must have a verified badge to apply for jobs.",
    );
  }

  const hasVerifiedCertification = trainerProfile.certifications.some(
    (cert) => cert.status === "VERIFIED",
  );

  if (!hasVerifiedCertification) {
    throw new AppError(
      403,
      "You must have at least one verified certification to apply for jobs.",
    );
  }

  // 2. Profile Completion Rule
  if (trainerProfile.profileCompletionPercent < 80) {
    throw new AppError(
      403,
      "Complete at least 80% of your trainer profile before applying for jobs.",
    );
  }

  // 3. Find Job Post (must be open and business approved)
  const jobPost = await prisma.jobPost.findUnique({
    where: {
      id: jobPostId,
      isOpen: true,
      business: {
        status: "ACTIVE", // APPROVED status in Prisma enum
      },
    },
    include: {
      business: true,
    },
  });

  if (!jobPost) {
    throw new AppError(
      404,
      "Job post not found, closed, or business is not approved.",
    );
  }

  // 4. Check duplicate application
  const existingApplication = await prisma.trainerApplication.findUnique({
    where: {
      jobPostId_trainerId: {
        jobPostId: jobPost.id,
        trainerId: trainerProfile.id,
      },
    },
  });

  if (existingApplication) {
    throw new AppError(409, "You have already applied to this job post.");
  }

  // 5. Check if Trainer is already attached to this Business
  const existingTrainerBusiness = await prisma.trainerBusiness.findUnique({
    where: {
      trainerId_businessId: {
        trainerId: trainerProfile.id,
        businessId: jobPost.businessId,
      },
    },
  });

  if (existingTrainerBusiness) {
    throw new AppError(
      409,
      "You cannot apply to a job post for a business you are already working in.",
    );
  }

  // 6. Create Application using Prisma Transaction
  const application = await prisma.$transaction(async (tx) => {
    return await tx.trainerApplication.create({
      data: {
        jobPostId: jobPost.id,
        trainerId: trainerProfile.id,
        status: "PENDING",
      },
      select: {
        id: true,
        status: true,
      },
    });
  });

  // 7. Publish Redis Event
  pushJob("job_application_queue", {
    eventType: "TRAINER_JOB_APPLIED",
    applicationId: application.id,
    trainerId: trainerProfile.id,
    jobPostId: jobPost.id,
    businessId: jobPost.businessId,
    // Add additional info for notification payload if needed by the worker
    trainerUserId: trainerUserId,
  });

  return {
    applicationId: application.id,
    status: application.status,
  };
};

const getMyApplications = async (trainerUserId: string, query: any) => {
  // 1. Get Trainer Profile
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId: trainerUserId },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  // 2. Map query parameters to match database fields and QueryBuilder format
  const queryParams = { ...query };

  if (queryParams.specializationId) {
    queryParams["jobPost.specializationTagId"] = queryParams.specializationId;
    delete queryParams.specializationId;
  }

  if (queryParams.businessId) {
    queryParams["jobPost.businessId"] = queryParams.businessId;
    delete queryParams.businessId;
  }

  // 3. Set default sort if not provided
  if (!queryParams.sort) {
    queryParams.sort = "-createdAt";
  }

  if (queryParams.sort) {
    if (queryParams.sort.startsWith("-")) {
      queryParams.sortBy = queryParams.sort.substring(1);
      queryParams.sortOrder = "desc";
    } else {
      queryParams.sortBy = queryParams.sort;
      queryParams.sortOrder = "asc";
    }
    delete queryParams.sort;
  }

  if (queryParams.sortBy === "createdAt") {
    queryParams.sortBy = "appliedAt";
  }

  // 4. Initialize QueryBuilder
  const queryBuilder = new QueryBuilder(
    prisma.trainerApplication,
    queryParams,
    {
      searchableFields: [
        "jobPost.title",
        "jobPost.business.name",
        "jobPost.specializationTag.name",
      ],
      filterableFields: [
        "status",
        "jobPost.specializationTagId",
        "jobPost.businessId",
      ],
    },
  )
    .search()
    .filter()
    .sort()
    .paginate();

  // 5. Enforce filter to only this trainer's applications
  queryBuilder.where({
    trainerId: trainerProfile.id,
  });

  // 6. Define Select Fields
  const qbQuery = queryBuilder.getQuery();
  delete qbQuery.include;
  qbQuery.select = {
    id: true,
    status: true,
    appliedAt: true,
    jobPost: {
      select: {
        id: true,
        title: true,
        description: true,
        business: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        specializationTag: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
  };

  // 7. Execute Query
  const result = await queryBuilder.execute();

  // 8. Map to requested format
  const mappedData = result.data.map((app: any) => ({
    id: app.id,
    status: app.status,
    createdAt: app.appliedAt,
    jobPost: {
      id: app.jobPost.id,
      title: app.jobPost.title,
      description: app.jobPost.description,
    },
    business: {
      id: app.jobPost.business.id,
      name: app.jobPost.business.name,
      logo: app.jobPost.business.logo,
    },
    specialization: {
      id: app.jobPost.specializationTag.id,
      name: app.jobPost.specializationTag.name,
    },
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
  approveTrainerApplication,
  rejectTrainerApplication,
  getOpenJobPosts,
  getJobPostDetail,
  applyToJobPost,
  getMyApplications,
};
