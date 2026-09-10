import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import { BusinessStatus } from '../../../generated/prisma/enums';
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
    .paginate()
    .fields();

  // If sort is not provided in query, default to createdAt asc
  if (!query.sort && !query.sortBy) {
    businessQueryBuilder.where({
      status: BusinessStatus.PENDING_APPROVAL,
    });
    // QueryBuilder's sort method might have already run, so we need to manually adjust if needed,
    // but the best way is to let QueryBuilder handle it if we modify the query object beforehand.
  }

  // Force status to PENDING_APPROVAL
  businessQueryBuilder.where({
    status: BusinessStatus.PENDING_APPROVAL,
  });

  // Apply sort if any, or fallback
  businessQueryBuilder.sort();

  const result = await businessQueryBuilder.execute();
  return result;
};

const approveBusiness = async (id: string, adminId: string) => {
  const business = await prisma.business.findUnique({
    where: { id },
    include: { owner: true },
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

  const updatedBusiness = await prisma.business.update({
    where: { id },
    data: {
      status: BusinessStatus.ACTIVE,
    },
    include: { owner: true },
  });

  // Enqueue notification and email send via Redis worker
  await pushJob('notification_queue', {
    eventType: 'BUSINESS_APPROVED',
    businessId: updatedBusiness.id,
    businessName: updatedBusiness.name,
    ownerId: updatedBusiness.ownerId,
    ownerEmail: updatedBusiness.owner?.email,
    ownerName: updatedBusiness.owner?.fullName || 'Business Owner',
  });

  // Audit log
  await auditLogger.record({
    actorId: adminId,
    action: 'BUSINESS_APPROVED',
    resource: 'BUSINESS',
    resourceId: updatedBusiness.id,
    businessId: updatedBusiness.id,
    details: `Approved business: ${updatedBusiness.name}`,
  });

  return updatedBusiness;
};

const rejectBusiness = async (id: string, adminId: string, reason?: string) => {
  const business = await prisma.business.findUnique({
    where: { id },
    include: { owner: true },
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

  const updatedBusiness = await prisma.business.update({
    where: { id },
    data: {
      status: BusinessStatus.REJECTED,
    },
    include: { owner: true },
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
