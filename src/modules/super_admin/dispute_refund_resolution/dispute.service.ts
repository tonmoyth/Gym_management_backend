import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import {
  DisputeStatus,
  PaymentStatus,
  NotificationType,
} from '../../../generated/prisma/enums';
import { paymentService } from '../../Payment/payment.service';
import { TrainerMemberOversightService } from '../trainer_member_oversight/trainerMemberOversight.service';
import { NotificationService } from '../../../utils/notification.service';
import { pushJob } from '../../../utils/redisQueue';
import {
  disputeSearchableFields,
  disputeFilterableFields,
  DISPUTE_RESOLUTION_TYPE,
} from './dispute.constant';
import {
  IResolveDisputePayload,
  ISanitizedDisputeItem,
} from './dispute.interface';

const parseResolutionDetails = (
  adminReply: string | null,
  status: DisputeStatus
) => {
  let resolutionType: string | null = null;
  let resolutionReason: string | null = adminReply;

  if (adminReply) {
    const match = adminReply.match(/^\[([A-Z_]+)\]\s*(.*)$/s);
    if (match) {
      resolutionType = match[1];
      resolutionReason = match[2];
    }
  }

  if (!resolutionType) {
    if (status === DisputeStatus.DISMISSED) {
      resolutionType = DISPUTE_RESOLUTION_TYPE.DISMISSAL;
    } else if (status === DisputeStatus.RESOLVED) {
      resolutionType = 'RESOLVED';
    }
  }

  return { resolutionType, resolutionReason };
};

const getAllDisputes = async (query: Record<string, unknown>) => {
  const queryParams: Record<string, unknown> = { ...query };

  // Map conceptual status PENDING to OPEN if provided
  if (queryParams.status === 'PENDING') {
    queryParams.status = DisputeStatus.OPEN;
  }

  const disputeQueryBuilder = new QueryBuilder(
    prisma.dispute,
    queryParams as any,
    {
      searchableFields: disputeSearchableFields,
      filterableFields: disputeFilterableFields,
    }
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          profileImage: true,
          isActive: true,
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

  const result = await disputeQueryBuilder.execute();

  // Efficient batch loading of payments for the retrieved disputes to prevent N+1 queries
  const userIds = Array.from(
    new Set(
      result.data
        .map((dispute: any) => dispute.userId)
        .filter((id: string | null | undefined): id is string => Boolean(id))
    )
  );

  let paymentsByUser: Record<string, any[]> = {};
  if (userIds.length > 0) {
    const payments = await prisma.payment.findMany({
      where: {
        payerUserId: { in: userIds },
      },
      include: {
        invoice: {
          select: {
            id: true,
          },
        },
        membership: {
          select: {
            id: true,
            businessId: true,
          },
        },
        subscription: {
          select: {
            id: true,
            businessId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    payments.forEach((payment: any) => {
      if (!paymentsByUser[payment.payerUserId]) {
        paymentsByUser[payment.payerUserId] = [];
      }
      paymentsByUser[payment.payerUserId].push(payment);
    });
  }

  const formattedDisputes: ISanitizedDisputeItem[] = result.data.map(
    (dispute: any) => {
      const { resolutionType, resolutionReason } = parseResolutionDetails(
        dispute.adminReply,
        dispute.status
      );

      // Match payment for this dispute
      const userPayments = paymentsByUser[dispute.userId] || [];
      let matchedPayment: any = null;

      if (dispute.businessId) {
        matchedPayment =
          userPayments.find(
            (p: any) =>
              p.membership?.businessId === dispute.businessId ||
              p.subscription?.businessId === dispute.businessId
          ) || userPayments[0] || null;
      } else {
        matchedPayment = userPayments[0] || null;
      }

      return {
        id: dispute.id,
        subject: dispute.subject,
        description: dispute.description,
        status: dispute.status,
        category: dispute.category,
        adminReply: dispute.adminReply,
        resolvedAt: dispute.resolvedAt,
        resolution: resolutionType,
        resolutionReason,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
        user: dispute.user
          ? {
              id: dispute.user.id,
              fullName: dispute.user.fullName,
              email: dispute.user.email,
              role: dispute.user.role,
              profileImage: dispute.user.profileImage,
              isActive: dispute.user.isActive,
            }
          : null,
        business: dispute.business
          ? {
              id: dispute.business.id,
              name: dispute.business.name,
              status: dispute.business.status,
            }
          : null,
        trainer: dispute.trainer
          ? {
              id: dispute.trainer.id,
              user: dispute.trainer.user
                ? {
                    id: dispute.trainer.user.id,
                    fullName: dispute.trainer.user.fullName,
                    email: dispute.trainer.user.email,
                  }
                : null,
            }
          : null,
        relatedPayment: matchedPayment
          ? {
              id: matchedPayment.id,
              gatewayTransactionId: matchedPayment.gatewayTransactionId,
              amount: Number(matchedPayment.amount),
              currency: matchedPayment.currency,
              status: matchedPayment.status,
              gateway: matchedPayment.gateway,
              purpose: matchedPayment.purpose,
              createdAt: matchedPayment.createdAt,
              invoiceId: matchedPayment.invoice?.id || null,
              membershipId: matchedPayment.membership?.id || null,
              subscriptionId: matchedPayment.subscription?.id || null,
            }
          : null,
      };
    }
  );

  return {
    meta: result.meta,
    data: formattedDisputes,
  };
};

const getDisputeById = async (id: string) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          profileImage: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
        },
      },
      business: {
        select: {
          id: true,
          name: true,
          status: true,
          email: true,
          phone: true,
          address: true,
          createdAt: true,
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
    },
  });

  if (!dispute) {
    throw new AppError(404, 'Dispute not found');
  }

  // Look up related payment
  let matchedPayment: any = null;
  if (dispute.businessId) {
    matchedPayment = await prisma.payment.findFirst({
      where: {
        payerUserId: dispute.userId,
        OR: [
          { membership: { businessId: dispute.businessId } },
          { subscription: { businessId: dispute.businessId } },
        ],
      },
      include: {
        invoice: true,
        membership: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                price: true,
                durationDays: true,
              },
            },
          },
        },
        subscription: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Fallback to latest payment if not found under specific business
  if (!matchedPayment) {
    matchedPayment = await prisma.payment.findFirst({
      where: {
        payerUserId: dispute.userId,
      },
      include: {
        invoice: true,
        membership: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                price: true,
                durationDays: true,
              },
            },
          },
        },
        subscription: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  const { resolutionType, resolutionReason } = parseResolutionDetails(
    dispute.adminReply,
    dispute.status
  );

  return {
    id: dispute.id,
    subject: dispute.subject,
    description: dispute.description,
    status: dispute.status,
    category: dispute.category,
    adminReply: dispute.adminReply,
    resolvedAt: dispute.resolvedAt,
    resolution: resolutionType,
    resolutionReason,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
    member: dispute.user
      ? {
          id: dispute.user.id,
          fullName: dispute.user.fullName,
          email: dispute.user.email,
          role: dispute.user.role,
          profileImage: dispute.user.profileImage,
          isActive: dispute.user.isActive,
          isVerified: dispute.user.isVerified,
          createdAt: dispute.user.createdAt,
        }
      : null,
    business: dispute.business
      ? {
          id: dispute.business.id,
          name: dispute.business.name,
          status: dispute.business.status,
          email: dispute.business.email,
          phone: dispute.business.phone,
          address: dispute.business.address,
        }
      : null,
    trainer: dispute.trainer
      ? {
          id: dispute.trainer.id,
          verifiedBadge: dispute.trainer.verifiedBadge,
          user: dispute.trainer.user
            ? {
                id: dispute.trainer.user.id,
                fullName: dispute.trainer.user.fullName,
                email: dispute.trainer.user.email,
              }
            : null,
        }
      : null,
    relatedPayment: matchedPayment
      ? {
          id: matchedPayment.id,
          gatewayTransactionId: matchedPayment.gatewayTransactionId,
          amount: Number(matchedPayment.amount),
          currency: matchedPayment.currency,
          status: matchedPayment.status,
          gateway: matchedPayment.gateway,
          purpose: matchedPayment.purpose,
          createdAt: matchedPayment.createdAt,
        }
      : null,
    relatedInvoice: matchedPayment?.invoice
      ? {
          id: matchedPayment.invoice.id,
          invoiceNumber: matchedPayment.invoice.invoiceNumber,
          pdfUrl: matchedPayment.invoice.pdfUrl,
          issuedAt: matchedPayment.invoice.issuedAt,
        }
      : null,
    relatedMembership: matchedPayment?.membership
      ? {
          id: matchedPayment.membership.id,
          planName: matchedPayment.membership.plan?.name,
          planPrice: Number(matchedPayment.membership.plan?.price || 0),
          durationDays: matchedPayment.membership.plan?.durationDays,
          status: matchedPayment.membership.status,
        }
      : null,
    relatedSubscription: matchedPayment?.subscription
      ? {
          id: matchedPayment.subscription.id,
          status: matchedPayment.subscription.status,
          nextBillingDate: matchedPayment.subscription.nextBillingDate,
        }
      : null,
  };
};

const resolveDispute = async (
  id: string,
  adminId: string,
  payload: IResolveDisputePayload
) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      user: true,
      business: true,
      trainer: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!dispute) {
    throw new AppError(404, 'Dispute not found');
  }

  // Validate dispute lifecycle state
  if (
    dispute.status === DisputeStatus.RESOLVED ||
    dispute.status === DisputeStatus.DISMISSED
  ) {
    throw new AppError(
      400,
      `Cannot resolve dispute. It has already been ${dispute.status.toLowerCase()}.`
    );
  }

  const trimmedReason = payload.reason.trim();
  let paymentRecord: any = null;

  switch (payload.resolution) {
    case DISPUTE_RESOLUTION_TYPE.REFUND: {
      // 1. Determine payment to refund
      if (payload.paymentId) {
        paymentRecord = await prisma.payment.findUnique({
          where: { id: payload.paymentId },
          include: { membership: true, subscription: true },
        });

        if (!paymentRecord) {
          throw new AppError(404, 'Specified payment not found');
        }

        // Security check: ensure payment belongs to the dispute's user
        if (paymentRecord.payerUserId !== dispute.userId) {
          throw new AppError(
            403,
            'Specified payment does not belong to the user who filed this dispute'
          );
        }

        // If dispute has a business, verify payment association
        if (dispute.businessId) {
          const paymentBusinessId =
            paymentRecord.membership?.businessId ||
            paymentRecord.subscription?.businessId;
          if (paymentBusinessId && paymentBusinessId !== dispute.businessId) {
            throw new AppError(
              400,
              "Specified payment is not associated with this dispute's business"
            );
          }
        }
      } else {
        // Automatic lookup of the relevant payment
        const whereClause = dispute.businessId
          ? {
              payerUserId: dispute.userId,
              OR: [
                { membership: { businessId: dispute.businessId } },
                { subscription: { businessId: dispute.businessId } },
              ],
            }
          : { payerUserId: dispute.userId };

        paymentRecord = await prisma.payment.findFirst({
          where: {
            ...whereClause,
            status: PaymentStatus.SUCCESS,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!paymentRecord) {
          // Check if there was a payment with different status to give clear error
          const anyPayment = await prisma.payment.findFirst({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
          });

          if (anyPayment) {
            paymentRecord = anyPayment;
          } else {
            throw new AppError(
              404,
              'No payment found associated with this dispute to issue a refund'
            );
          }
        }
      }

      // 2. Safety checks against double refund and invalid status
      if (paymentRecord.status === PaymentStatus.REFUNDED) {
        throw new AppError(
          400,
          'This payment has already been refunded. Multiple refunds are prohibited.'
        );
      }

      if (paymentRecord.status !== PaymentStatus.SUCCESS) {
        throw new AppError(
          400,
          `Cannot refund payment with status "${paymentRecord.status}". Only SUCCESS payments can be refunded.`
        );
      }

      // 3. Process refund using the existing gateway/refund infrastructure
      await paymentService.processRefund(paymentRecord.id);

      // 4. Concurrency check & dispute state transition
      const updateResult = await prisma.dispute.updateMany({
        where: {
          id,
          status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_REVIEW] },
        },
        data: {
          status: DisputeStatus.RESOLVED,
          resolvedAt: new Date(),
          adminReply: `[REFUND] ${trimmedReason}`,
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(
          409,
          'Dispute was already resolved or modified by another administrator.'
        );
      }

      // 5. Administrative audit log
      console.log(
        `[AUDIT] SUPER_ADMIN ${adminId} resolved Dispute ${id} with REFUND for Payment ${paymentRecord.id}. Reason: ${trimmedReason}`
      );

      // 6. In-app Notification
      await NotificationService.createNotification(
        dispute.userId,
        'Dispute Resolved - Refund Initiated 💰',
        `Your dispute "${dispute.subject}" has been resolved and a refund of ${paymentRecord.amount} ${paymentRecord.currency} has been processed.`,
        NotificationType.DISPUTE,
        {
          disputeId: dispute.id,
          resolution: 'REFUND',
          paymentId: paymentRecord.id,
          reason: trimmedReason,
        }
      );

      // 7. Enqueue background notification & email via Redis queue
      await pushJob('notification_queue', {
        eventType: 'DISPUTE_RESOLVED',
        disputeId: dispute.id,
        userId: dispute.userId,
        userEmail: dispute.user?.email,
        userName: dispute.user?.fullName || 'Member',
        subject: dispute.subject,
        resolution: 'REFUND',
        reason: trimmedReason,
        paymentId: paymentRecord.id,
        amount: Number(paymentRecord.amount),
        currency: paymentRecord.currency,
      });

      break;
    }

    case DISPUTE_RESOLUTION_TYPE.WARNING: {
      const updateResult = await prisma.dispute.updateMany({
        where: {
          id,
          status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_REVIEW] },
        },
        data: {
          status: DisputeStatus.RESOLVED,
          resolvedAt: new Date(),
          adminReply: `[WARNING] ${trimmedReason}`,
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(
          409,
          'Dispute was already resolved or modified by another administrator.'
        );
      }

      console.log(
        `[AUDIT] SUPER_ADMIN ${adminId} resolved Dispute ${id} with WARNING. Reason: ${trimmedReason}`
      );

      await NotificationService.createNotification(
        dispute.userId,
        'Dispute Update - Administrative Warning ⚠️',
        `Your dispute "${dispute.subject}" has been reviewed and resolved with an official administrative warning.`,
        NotificationType.DISPUTE,
        {
          disputeId: dispute.id,
          resolution: 'WARNING',
          reason: trimmedReason,
        }
      );

      await pushJob('notification_queue', {
        eventType: 'DISPUTE_RESOLVED',
        disputeId: dispute.id,
        userId: dispute.userId,
        userEmail: dispute.user?.email,
        userName: dispute.user?.fullName || 'User',
        subject: dispute.subject,
        resolution: 'WARNING',
        reason: trimmedReason,
      });

      break;
    }

    case DISPUTE_RESOLUTION_TYPE.ACCOUNT_ACTION: {
      let targetUserId = payload.targetUserId || dispute.userId;

      // Ensure client cannot modify arbitrary accounts not associated with this dispute
      if (payload.targetUserId) {
        const associatedUserIds = [
          dispute.userId,
          dispute.trainer?.userId,
          dispute.business?.ownerId,
        ].filter(Boolean);

        if (!associatedUserIds.includes(payload.targetUserId)) {
          throw new AppError(
            403,
            'The target account is not associated with this dispute.'
          );
        }
      }

      const targetAction =
        payload.accountAction === 'ACTIVATE' ? 'ACTIVE' : 'SUSPENDED';

      // Reuse existing account status oversight logic
      await TrainerMemberOversightService.updateAccountStatus(
        targetUserId,
        adminId,
        targetAction
      );

      const updateResult = await prisma.dispute.updateMany({
        where: {
          id,
          status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_REVIEW] },
        },
        data: {
          status: DisputeStatus.RESOLVED,
          resolvedAt: new Date(),
          adminReply: `[ACCOUNT_ACTION] ${trimmedReason}`,
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(
          409,
          'Dispute was already resolved or modified by another administrator.'
        );
      }

      console.log(
        `[AUDIT] SUPER_ADMIN ${adminId} resolved Dispute ${id} with ACCOUNT_ACTION (${targetAction}) on User ${targetUserId}. Reason: ${trimmedReason}`
      );

      await NotificationService.createNotification(
        dispute.userId,
        'Dispute Update - Account Action Taken 🛡️',
        `Following dispute review for "${dispute.subject}", administrative account action was applied.`,
        NotificationType.DISPUTE,
        {
          disputeId: dispute.id,
          resolution: 'ACCOUNT_ACTION',
          targetUserId,
          action: targetAction,
          reason: trimmedReason,
        }
      );

      await pushJob('notification_queue', {
        eventType: 'DISPUTE_RESOLVED',
        disputeId: dispute.id,
        userId: dispute.userId,
        userEmail: dispute.user?.email,
        userName: dispute.user?.fullName || 'User',
        subject: dispute.subject,
        resolution: 'ACCOUNT_ACTION',
        reason: trimmedReason,
      });

      break;
    }

    case DISPUTE_RESOLUTION_TYPE.DISMISSAL: {
      const updateResult = await prisma.dispute.updateMany({
        where: {
          id,
          status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_REVIEW] },
        },
        data: {
          status: DisputeStatus.DISMISSED,
          resolvedAt: new Date(),
          adminReply: `[DISMISSAL] ${trimmedReason}`,
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(
          409,
          'Dispute was already resolved or modified by another administrator.'
        );
      }

      console.log(
        `[AUDIT] SUPER_ADMIN ${adminId} dismissed Dispute ${id}. Reason: ${trimmedReason}`
      );

      await NotificationService.createNotification(
        dispute.userId,
        'Dispute Dismissed ℹ️',
        `Your dispute "${dispute.subject}" has been reviewed and dismissed.`,
        NotificationType.DISPUTE,
        {
          disputeId: dispute.id,
          resolution: 'DISMISSAL',
          reason: trimmedReason,
        }
      );

      await pushJob('notification_queue', {
        eventType: 'DISPUTE_RESOLVED',
        disputeId: dispute.id,
        userId: dispute.userId,
        userEmail: dispute.user?.email,
        userName: dispute.user?.fullName || 'User',
        subject: dispute.subject,
        resolution: 'DISMISSAL',
        reason: trimmedReason,
      });

      break;
    }

    default:
      throw new AppError(400, 'Invalid resolution type specified.');
  }

  // Return fresh resolved dispute details
  const resolvedDispute = await getDisputeById(id);
  return resolvedDispute;
};

export const DisputeRefundResolutionService = {
  getAllDisputes,
  getDisputeById,
  resolveDispute,
};
