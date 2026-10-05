import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import {
  BusinessStatus,
  SubscriptionPaymentStatus,
} from '../../../generated/prisma/enums';
import { SubscriptionPaymentService } from '../subscription_payment/subscriptionPayment.service';
import { pushJob } from '../../../utils/redisQueue';
import { auditLogger } from '../../../utils/auditLogger';
import {
  businessSearchableFields,
  businessFilterableFields,
} from './businessManagement.constant';

const getPendingBusinesses = async (query: Record<string, unknown>) => {
  const businessQueryBuilder = new QueryBuilder(
    prisma.business,
    query as any,
    {
      searchableFields: businessSearchableFields,
      filterableFields: businessFilterableFields,
    }
  )
    .search()
    .filter()
    .paginate();

  // If sort is not provided in query, default to createdAt asc
  if (!query.sort && !query.sortBy) {
    businessQueryBuilder.where({
      status: BusinessStatus.PENDING_APPROVAL,
    });
  }

  // Force status to PENDING_APPROVAL
  businessQueryBuilder.where({
    status: BusinessStatus.PENDING_APPROVAL,
  });

  // Apply sort if any, or fallback
  businessQueryBuilder.sort();

  businessQueryBuilder.include({
    owner: {
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImage: true,
      },
    },
    subscriptionPayments: {
      orderBy: { createdAt: 'desc' },
      include: {
        paymentAccount: {
          select: {
            id: true,
            accountType: true,
            accountNumber: true,
            bankName: true,
            branchName: true,
            accountName: true,
          },
        },
        subscriptionPlan: {
          select: {
            id: true,
            name: true,
            price: true,
            billingCycle: true,
            durationDays: true,
          },
        },
      },
    },
    businessSubscription: true,
  });

  const result = await businessQueryBuilder.execute();
  return result;
};

const approveBusiness = async (id: string, adminId: string) => {
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      owner: true,
      subscriptionPayments: {
        where: { status: SubscriptionPaymentStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!business) {
    throw new AppError(404, 'Business not found');
  }

  if (business.status !== BusinessStatus.PENDING_APPROVAL) {
    throw new AppError(
      400,
      `Cannot approve business. Current status is ${business.status}`
    );
  }

  // If gym owner submitted a pending subscription payment, approve it through SubscriptionPaymentService
  if (business.subscriptionPayments && business.subscriptionPayments.length > 0) {
    const pendingPayment = business.subscriptionPayments[0];
    await SubscriptionPaymentService.approvePayment(pendingPayment.id, adminId);
  } else {
    // If no pending payment (e.g. exempted or direct registration), activate business directly
    await prisma.business.update({
      where: { id },
      data: {
        status: BusinessStatus.ACTIVE,
      },
    });
  }

  const updatedBusiness = await prisma.business.findUnique({
    where: { id },
    include: { owner: true, businessSubscription: true },
  });

  // Enqueue notification and email send via Redis worker
  await pushJob('notification_queue', {
    eventType: 'BUSINESS_APPROVED',
    businessId: updatedBusiness!.id,
    businessName: updatedBusiness!.name,
    ownerId: updatedBusiness!.ownerId,
    ownerEmail: updatedBusiness!.owner?.email,
    ownerName: updatedBusiness!.owner?.fullName || 'Business Owner',
  });

  // Audit log
  await auditLogger.record({
    actorId: adminId,
    action: 'BUSINESS_APPROVED',
    resource: 'BUSINESS',
    resourceId: updatedBusiness!.id,
    businessId: updatedBusiness!.id,
    details: `Approved business: ${updatedBusiness!.name}`,
  });

  return updatedBusiness;
};

const rejectBusiness = async (id: string, adminId: string, reason?: string) => {
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      owner: true,
      subscriptionPayments: {
        where: { status: SubscriptionPaymentStatus.PENDING },
      },
    },
  });

  if (!business) {
    throw new AppError(404, 'Business not found');
  }

  if (business.status !== BusinessStatus.PENDING_APPROVAL) {
    throw new AppError(
      400,
      `Cannot reject business. Current status is ${business.status}`
    );
  }

  const updatedBusiness = await prisma.$transaction(async (tx) => {
    // If pending payments exist, reject them as well
    if (business.subscriptionPayments && business.subscriptionPayments.length > 0) {
      await tx.subscriptionPayment.updateMany({
        where: {
          businessId: id,
          status: SubscriptionPaymentStatus.PENDING,
        },
        data: {
          status: SubscriptionPaymentStatus.REJECTED,
          rejectionReason: reason || 'Business registration rejected',
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
        },
      });
    }

    return await tx.business.update({
      where: { id },
      data: {
        status: BusinessStatus.REJECTED,
      },
      include: { owner: true },
    });
  });

  // Enqueue notification and email send via Redis worker
  await pushJob('notification_queue', {
    eventType: 'BUSINESS_REJECTED',
    businessId: updatedBusiness.id,
    businessName: updatedBusiness.name,
    ownerId: updatedBusiness.ownerId,
    ownerEmail: updatedBusiness.owner?.email,
    ownerName: updatedBusiness.owner?.fullName || 'Business Owner',
    reason,
  });

  // Audit log
  await auditLogger.record({
    actorId: adminId,
    action: 'BUSINESS_REJECTED',
    resource: 'BUSINESS',
    resourceId: updatedBusiness.id,
    businessId: updatedBusiness.id,
    details: `Rejected business: ${updatedBusiness.name}${reason ? ` (${reason})` : ''}`,
    metadata: { reason },
  });

  return updatedBusiness;
};

const suspendBusiness = async (id: string, adminId: string, reason?: string) => {
  const business = await prisma.business.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!business) {
    throw new AppError(404, 'Business not found');
  }

  if (business.status !== BusinessStatus.ACTIVE) {
    throw new AppError(
      400,
      `Cannot suspend business. Current status is ${business.status}`
    );
  }

  const updatedBusiness = await prisma.business.update({
    where: { id },
    data: {
      status: BusinessStatus.SUSPENDED,
    },
    include: { owner: true },
  });

  // Enqueue notification and email send via Redis worker
  await pushJob('notification_queue', {
    eventType: 'BUSINESS_SUSPENDED',
    businessId: updatedBusiness.id,
    businessName: updatedBusiness.name,
    ownerId: updatedBusiness.ownerId,
    ownerEmail: updatedBusiness.owner?.email,
    ownerName: updatedBusiness.owner?.fullName || 'Business Owner',
    reason,
  });

  // Audit log
  await auditLogger.record({
    actorId: adminId,
    action: 'BUSINESS_SUSPENDED',
    resource: 'BUSINESS',
    resourceId: updatedBusiness.id,
    businessId: updatedBusiness.id,
    details: `Suspended business: ${updatedBusiness.name}${reason ? ` (${reason})` : ''}`,
    metadata: { reason },
  });

  return updatedBusiness;
};

const getAllBusinesses = async (query: Record<string, unknown>) => {
  const businessQueryBuilder = new QueryBuilder(
    prisma.business,
    query as any,
    {
      searchableFields: businessSearchableFields,
      filterableFields: businessFilterableFields,
    }
  )
    .search()
    .filter()
    .paginate()
    .fields();

  if (!query.sort && !query.sortBy) {
    query.sortBy = 'createdAt';
    query.sortOrder = 'desc';
  }
  
  businessQueryBuilder.sort();

  businessQueryBuilder.include({
    owner: {
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImage: true,
      },
    },
    businessSubscription: true,
  });

  const result = await businessQueryBuilder.execute();
  return result;
};

export const BusinessManagementService = {
  getPendingBusinesses,
  approveBusiness,
  rejectBusiness,
  suspendBusiness,
  getAllBusinesses,
};
