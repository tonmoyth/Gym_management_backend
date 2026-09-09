import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import { NotificationType } from '../../../generated/prisma/enums';
import { NotificationService } from '../../../utils/notification.service';
import {
  reviewSearchableFields,
  reviewFilterableFields,
  jobPostSearchableFields,
  jobPostFilterableFields,
} from './content_moderation.constant';
import {
  ISanitizedReviewModerationItem,
  ISanitizedJobPostModerationItem,
} from './content_moderation.interface';

const getModerationReviews = async (query: Record<string, unknown>) => {
  const queryParams: Record<string, unknown> = { ...query };

  const reviewQueryBuilder = new QueryBuilder(
    prisma.review,
    queryParams as any,
    {
      searchableFields: reviewSearchableFields,
      filterableFields: reviewFilterableFields,
    }
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      member: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileImage: true,
              isActive: true,
            },
          },
        },
      },
      business: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      trainer: {
        select: {
          id: true,
          verifiedBadge: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    });

  // If isRemoved filter is not explicitly requested in query, default to active reviews requiring moderation
  if (queryParams.isRemoved === undefined) {
    reviewQueryBuilder.where({ isRemoved: false });
  }

  const result = await reviewQueryBuilder.execute();

  const formattedData: ISanitizedReviewModerationItem[] = result.data.map(
    (review: any) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      isRemoved: review.isRemoved,
      createdAt: review.createdAt,
      reportCount: 0,
      member: review.member
        ? {
            id: review.member.id,
            user: review.member.user
              ? {
                  id: review.member.user.id,
                  fullName: review.member.user.fullName,
                  email: review.member.user.email,
                  profileImage: review.member.user.profileImage,
                  isActive: review.member.user.isActive,
                }
              : null,
          }
        : null,
      business: review.business
        ? {
            id: review.business.id,
            name: review.business.name,
            status: review.business.status,
          }
        : null,
      trainer: review.trainer
        ? {
            id: review.trainer.id,
            verifiedBadge: review.trainer.verifiedBadge,
            user: review.trainer.user
              ? {
                  id: review.trainer.user.id,
                  fullName: review.trainer.user.fullName,
                  email: review.trainer.user.email,
                }
              : null,
          }
        : null,
    })
  );

  return {
    meta: result.meta,
    data: formattedData,
  };
};

const removeReview = async (id: string, adminId: string) => {
  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      member: {
        include: {
          user: true,
        },
      },
      business: true,
    },
  });

  if (!review) {
    throw new AppError(404, 'Review not found');
  }

  if (review.isRemoved) {
    throw new AppError(400, 'Review has already been removed');
  }

  // Soft removal with database transaction
  const updatedReview = await prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id },
      data: { isRemoved: true },
    });

    // If review was for a trainer, recalculate trainer's average rating using remaining active reviews
    if (review.trainerId) {
      const aggregations = await tx.review.aggregate({
        where: {
          trainerId: review.trainerId,
          isRemoved: false,
        },
        _avg: {
          rating: true,
        },
      });

      const avgRating = aggregations._avg.rating || 0;

      await tx.trainerProfile.update({
        where: { id: review.trainerId },
        data: { avgRating },
      });
    }

    return updated;
  });

  // Administrative audit logging
  console.log(
    `[AUDIT] SUPER_ADMIN ${adminId} removed Review ${id} at ${new Date().toISOString()}`
  );

  // In-app notification to review author
  if (review.member?.userId) {
    try {
      await NotificationService.createNotification(
        review.member.userId,
        'Review Removed by Moderation',
        `Your review for "${review.business?.name || 'the business'}" has been removed by platform moderation for violating content guidelines.`,
        NotificationType.SYSTEM,
        {
          reviewId: id,
          businessId: review.businessId,
          action: 'REVIEW_REMOVED',
        }
      );
    } catch (err: any) {
      console.error(
        'Failed to create notification for review removal:',
        err.message
      );
    }
  }

  return {
    id: updatedReview.id,
    isRemoved: updatedReview.isRemoved,
    rating: updatedReview.rating,
    comment: updatedReview.comment,
    businessId: updatedReview.businessId,
    trainerId: updatedReview.trainerId,
    createdAt: updatedReview.createdAt,
  };
};

const getModerationJobPosts = async (query: Record<string, unknown>) => {
  const queryParams: Record<string, unknown> = { ...query };

  const jobPostQueryBuilder = new QueryBuilder(
    prisma.jobPost,
    queryParams as any,
    {
      searchableFields: jobPostSearchableFields,
      filterableFields: jobPostFilterableFields,
    }
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      business: {
        select: {
          id: true,
          name: true,
          status: true,
          address: true,
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      specializationTag: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    });

  const result = await jobPostQueryBuilder.execute();

  const formattedData: ISanitizedJobPostModerationItem[] = result.data.map(
    (job: any) => ({
      id: job.id,
      title: job.title,
      description: job.description,
      isOpen: job.isOpen,
      status: job.isOpen ? 'OPEN' : 'CLOSED',
      createdAt: job.createdAt,
      applicationsCount: job._count?.applications || 0,
      business: job.business
        ? {
            id: job.business.id,
            name: job.business.name,
            status: job.business.status,
            address: job.business.address,
            owner: job.business.owner || null,
          }
        : null,
      specializationTag: job.specializationTag
        ? {
            id: job.specializationTag.id,
            name: job.specializationTag.name,
            slug: job.specializationTag.slug,
          }
        : null,
    })
  );

  return {
    meta: result.meta,
    data: formattedData,
  };
};

const removeJobPost = async (id: string, adminId: string) => {
  const jobPost = await prisma.jobPost.findUnique({
    where: { id },
    include: {
      business: {
        include: {
          owner: true,
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
  });

  if (!jobPost) {
    throw new AppError(404, 'Job post not found');
  }

  if (!jobPost.isOpen) {
    throw new AppError(400, 'Job post has already been removed or closed');
  }

  // Soft removal preserving applications and historical records
  const updatedJobPost = await prisma.jobPost.update({
    where: { id },
    data: {
      isOpen: false,
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          ownerId: true,
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

  // Administrative audit logging
  console.log(
    `[AUDIT] SUPER_ADMIN ${adminId} removed JobPost ${id} at ${new Date().toISOString()}`
  );

  // In-app notification to business owner
  if (jobPost.business?.ownerId) {
    try {
      await NotificationService.createNotification(
        jobPost.business.ownerId,
        'Job Post Removed by Moderation',
        `Your job post "${jobPost.title}" has been removed by platform moderation and is no longer accepting applications.`,
        NotificationType.SYSTEM,
        {
          jobPostId: id,
          businessId: jobPost.businessId,
          action: 'JOB_POST_REMOVED',
        }
      );
    } catch (err: any) {
      console.error(
        'Failed to create notification for job post removal:',
        err.message
      );
    }
  }

  return {
    id: updatedJobPost.id,
    title: updatedJobPost.title,
    description: updatedJobPost.description,
    isOpen: updatedJobPost.isOpen,
    status: 'CLOSED',
    business: updatedJobPost.business,
    specializationTag: updatedJobPost.specializationTag,
    createdAt: updatedJobPost.createdAt,
  };
};

export const ContentModerationService = {
  getModerationReviews,
  removeReview,
  getModerationJobPosts,
  removeJobPost,
};
