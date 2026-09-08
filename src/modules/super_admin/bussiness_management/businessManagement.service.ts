import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import { BusinessStatus } from '../../../generated/prisma/enums';
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
  });

  // Depending on whether audit tracking exists, we might insert an audit log here.
  // Since there's no generic audit table, we just return the updated business.
  return updatedBusiness;
};

const rejectBusiness = async (id: string, adminId: string) => {
  const business = await prisma.business.findUnique({
    where: { id },
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
  });

  return updatedBusiness;
};

const suspendBusiness = async (id: string, adminId: string) => {
  const business = await prisma.business.findUnique({
    where: { id },
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
