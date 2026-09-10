import { prisma } from '../lib/prisma';

export interface IRecordAuditLogPayload {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  businessId?: string | null;
  details?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'secret',
  'apikey',
  'creditcard',
  'auth'
]);

export const sanitizeMetadata = (obj: Record<string, any>): Record<string, any> => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

export const auditLogger = {
  record: async (payload: IRecordAuditLogPayload) => {
    try {
      const sanitizedMeta = payload.metadata
        ? sanitizeMetadata(payload.metadata)
        : undefined;

      return await prisma.auditLog.create({
        data: {
          actorId: payload.actorId || undefined,
          action: payload.action,
          resource: payload.resource,
          resourceId: payload.resourceId || undefined,
          businessId: payload.businessId || undefined,
          details: payload.details || undefined,
          metadata: sanitizedMeta,
          ipAddress: payload.ipAddress || undefined,
          userAgent: payload.userAgent || undefined,
        },
      });
    } catch (error) {
      console.error('[AUDIT_LOGGER_ERROR]', error);
      // Non-blocking: audit failure should not break main flow
      return null;
    }
  },
};
