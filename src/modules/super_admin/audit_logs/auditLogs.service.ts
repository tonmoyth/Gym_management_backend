import { prisma } from '../../../lib/prisma';
import { QueryBuilder } from '../../../utils/queryBuilder';
import {
  auditLogSearchableFields,
  auditLogFilterableFields,
} from './auditLogs.constant';
import { sanitizeMetadata } from '../../../utils/auditLogger';

const getAuditLogs = async (queryParams: Record<string, any>) => {
  const {
    actorId,
    action,
    resource,
    businessId,
    startDate,
    endDate,
    ...restQuery
  } = queryParams;

  const whereConditions: Record<string, any> = {};

  if (actorId) whereConditions.actorId = actorId;
  if (action) whereConditions.action = action;
  if (resource) whereConditions.resource = resource;
  if (businessId) whereConditions.businessId = businessId;

  if (startDate || endDate) {
    whereConditions.createdAt = {};

    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) {
        whereConditions.createdAt.gte = parsedStart;
      }
    }

    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd.getTime())) {
        // If string is YYYY-MM-DD without time, include full end of day
        if (typeof endDate === 'string' && !endDate.includes('T')) {
          parsedEnd.setUTCHours(23, 59, 59, 999);
        }
        whereConditions.createdAt.lte = parsedEnd;
      }
    }
  }

  const queryBuilder = new QueryBuilder(prisma.auditLog, restQuery, {
    searchableFields: auditLogSearchableFields,
    filterableFields: auditLogFilterableFields,
  })
    .where(whereConditions)
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      actor: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    });

  const result = await queryBuilder.execute();

  // Sanitize any metadata in returned logs
  const sanitizedData = result.data.map((log: any) => ({
    id: log.id,
    actor: log.actor
      ? {
          id: log.actor.id,
          name: log.actor.fullName,
          email: log.actor.email,
          role: log.actor.role,
        }
      : null,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    business: log.business
      ? {
          id: log.business.id,
          name: log.business.name,
        }
      : null,
    details: log.details,
    metadata: log.metadata ? sanitizeMetadata(log.metadata) : null,
    ipAddress: log.ipAddress,
    createdAt: log.createdAt,
  }));

  return {
    meta: result.meta,
    data: sanitizedData,
  };
};

export const AuditLogsService = {
  getAuditLogs,
};
