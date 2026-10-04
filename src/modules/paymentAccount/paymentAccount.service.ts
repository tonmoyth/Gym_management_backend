import { prisma } from '../../lib/prisma';
import AppError from '../../errors/AppError';
import { QueryBuilder } from '../../utils/queryBuilder';
import { Role } from '../../generated/prisma/enums';
import { auditLogger } from '../../utils/auditLogger';
import {
  ICreatePaymentAccountPayload,
  IUpdatePaymentAccountPayload,
} from './paymentAccount.interface';
import {
  paymentAccountSearchableFields,
  paymentAccountFilterableFields,
} from './paymentAccount.constant';

interface IUserContext {
  id: string;
  role: Role;
}

interface IOwnershipScope {
  userId?: string | null;
  businessId?: string | null;
  trainerId?: string | null;
}

/**
 * Resolve server-side ownership scope from authenticated user.
 * Never trusts client-supplied owner identifiers.
 */
const resolveOwnershipScope = async (
  user: IUserContext
): Promise<{ scopeWhere: any; scopeData: any; businessIdForAudit?: string }> => {
  if (user.role === Role.SUPER_ADMIN) {
    return {
      scopeWhere: {
        userId: user.id,
        businessId: null,
        trainerId: null,
      },
      scopeData: {
        userId: user.id,
        businessId: null,
        trainerId: null,
      },
    };
  }

  if (user.role === Role.BUSINESS_OWNER) {
    const business = await prisma.business.findUnique({
      where: { ownerId: user.id },
    });

    if (!business) {
      throw new AppError(
        404,
        'Business profile not found. Please complete business setup first.'
      );
    }

    return {
      scopeWhere: {
        businessId: business.id,
      },
      scopeData: {
        businessId: business.id,
        userId: user.id,
        trainerId: null,
      },
      businessIdForAudit: business.id,
    };
  }

  if (user.role === Role.TRAINER) {
    const trainer = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!trainer) {
      throw new AppError(404, 'Trainer profile not found.');
    }

    return {
      scopeWhere: {
        trainerId: trainer.id,
      },
      scopeData: {
        trainerId: trainer.id,
        userId: user.id,
        businessId: null,
      },
    };
  }

  throw new AppError(
    403,
    'Forbidden: You do not have access to payment account management.'
  );
};

/**
 * Verify that the account exists and belongs strictly to the authenticated user's scope.
 */
const verifyAccountOwnership = async (id: string, user: IUserContext) => {
  const { scopeWhere } = await resolveOwnershipScope(user);

  const account = await prisma.paymentAccount.findFirst({
    where: {
      id,
      ...scopeWhere,
    },
  });

  if (!account) {
    // Check if account exists under another owner to return explicit 403 vs 404
    const existsElsewhere = await prisma.paymentAccount.findUnique({
      where: { id },
    });

    if (existsElsewhere) {
      throw new AppError(
        403,
        'Forbidden: You do not have permission to access or modify this payment account.'
      );
    }

    throw new AppError(404, 'Payment account not found.');
  }

  return account;
};

const createPaymentAccount = async (
  user: IUserContext,
  payload: ICreatePaymentAccountPayload
) => {
  const { scopeWhere, scopeData, businessIdForAudit } =
    await resolveOwnershipScope(user);

  // Check how many accounts currently exist in this scope
  const existingCount = await prisma.paymentAccount.count({
    where: scopeWhere,
  });

  // If this is the first account, it should automatically be default
  const shouldBeDefault = payload.isDefault !== undefined ? payload.isDefault : existingCount === 0;

  const result = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      // Clear any existing default account in this owner's scope
      await tx.paymentAccount.updateMany({
        where: {
          ...scopeWhere,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const createdAccount = await tx.paymentAccount.create({
      data: {
        ...scopeData,
        accountType: payload.accountType,
        accountName: payload.accountName.trim(),
        accountNumber: payload.accountNumber.trim(),
        bankName:
          payload.accountType === 'BANK' ? payload.bankName?.trim() : null,
        branchName:
          payload.accountType === 'BANK' ? payload.branchName?.trim() : null,
        routingNumber:
          payload.accountType === 'BANK' ? payload.routingNumber?.trim() : null,
        isDefault: shouldBeDefault,
        status: payload.status || 'ACTIVE',
      },
    });

    return createdAccount;
  });

  // Record Audit Log
  await auditLogger.record({
    actorId: user.id,
    action: 'PAYMENT_ACCOUNT_CREATED',
    resource: 'PAYMENT_ACCOUNT',
    resourceId: result.id,
    businessId: businessIdForAudit || undefined,
    details: `Created ${result.accountType} account (${result.accountName})`,
    metadata: {
      accountType: result.accountType,
      isDefault: result.isDefault,
    },
  });

  return result;
};

const getPaymentAccounts = async (
  user: IUserContext,
  query: Record<string, unknown>
) => {
  const { scopeWhere } = await resolveOwnershipScope(user);

  const queryParams = { ...query };
  if (queryParams.search && !queryParams.searchTerm) {
    queryParams.searchTerm = queryParams.search;
  }
  delete queryParams.search;

  const queryBuilder = new QueryBuilder(
    prisma.paymentAccount,
    queryParams as any,
    {
      searchableFields: paymentAccountSearchableFields,
      filterableFields: paymentAccountFilterableFields,
    }
  )
    .where(scopeWhere)
    .search()
    .filter()
    .sort()
    .paginate();

  const [total, result] = await Promise.all([
    queryBuilder.count(),
    queryBuilder.execute(),
  ]);

  return {
    meta: {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 10,
      total,
      totalPages: Math.ceil(total / (Number(query.limit) || 10)),
    },
    data: result.data,
  };
};

const getPaymentAccountById = async (id: string, user: IUserContext) => {
  return await verifyAccountOwnership(id, user);
};

const updatePaymentAccount = async (
  id: string,
  user: IUserContext,
  payload: IUpdatePaymentAccountPayload
) => {
  const existingAccount = await verifyAccountOwnership(id, user);
  const { scopeWhere, businessIdForAudit } = await resolveOwnershipScope(user);

  const finalAccountType = payload.accountType || existingAccount.accountType;

  const result = await prisma.$transaction(async (tx) => {
    // If setting as default, unset other defaults in the same scope
    if (payload.isDefault === true) {
      await tx.paymentAccount.updateMany({
        where: {
          ...scopeWhere,
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });
    }

    const updated = await tx.paymentAccount.update({
      where: { id },
      data: {
        accountType: payload.accountType,
        accountName: payload.accountName?.trim(),
        accountNumber: payload.accountNumber?.trim(),
        bankName:
          finalAccountType === 'BANK'
            ? payload.bankName !== undefined
              ? payload.bankName.trim()
              : existingAccount.bankName
            : null,
        branchName:
          finalAccountType === 'BANK'
            ? payload.branchName !== undefined
              ? payload.branchName?.trim()
              : existingAccount.branchName
            : null,
        routingNumber:
          finalAccountType === 'BANK'
            ? payload.routingNumber !== undefined
              ? payload.routingNumber?.trim()
              : existingAccount.routingNumber
            : null,
        isDefault: payload.isDefault,
        status: payload.status,
      },
    });

    return updated;
  });

  // Record Audit Log
  await auditLogger.record({
    actorId: user.id,
    action: 'PAYMENT_ACCOUNT_UPDATED',
    resource: 'PAYMENT_ACCOUNT',
    resourceId: result.id,
    businessId: businessIdForAudit || undefined,
    details: `Updated ${result.accountType} payment account (${result.accountName})`,
    metadata: {
      accountType: result.accountType,
      isDefault: result.isDefault,
      status: result.status,
    },
  });

  return result;
};

const deletePaymentAccount = async (id: string, user: IUserContext) => {
  const existingAccount = await verifyAccountOwnership(id, user);
  const { scopeWhere, businessIdForAudit } = await resolveOwnershipScope(user);

  // Check if account is referenced by subscription payments
  const referencedPaymentsCount = await prisma.subscriptionPayment.count({
    where: { paymentAccountId: id },
  });

  let deletedResult: any;

  if (referencedPaymentsCount > 0) {
    // Safe archival: do not break historical financial audit records
    deletedResult = await prisma.paymentAccount.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        isDefault: false,
      },
    });
  } else {
    // Completely unreferenced: delete cleanly
    deletedResult = await prisma.$transaction(async (tx) => {
      const deleted = await tx.paymentAccount.delete({
        where: { id },
      });

      // If the deleted account was default, elect another active account if available
      if (existingAccount.isDefault) {
        const nextAccount = await tx.paymentAccount.findFirst({
          where: {
            ...scopeWhere,
            status: 'ACTIVE',
          },
          orderBy: { createdAt: 'asc' },
        });

        if (nextAccount) {
          await tx.paymentAccount.update({
            where: { id: nextAccount.id },
            data: { isDefault: true },
          });
        }
      }

      return deleted;
    });
  }

  // Record Audit Log
  await auditLogger.record({
    actorId: user.id,
    action: 'PAYMENT_ACCOUNT_DELETED',
    resource: 'PAYMENT_ACCOUNT',
    resourceId: id,
    businessId: businessIdForAudit || undefined,
    details: `Removed payment account (${existingAccount.accountName})`,
  });

  return deletedResult;
};

const getBusinessPaymentAccounts = async (businessId: string) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, logo: true },
  });

  if (!business) {
    throw new AppError(404, 'Business not found');
  }

  const accounts = await prisma.paymentAccount.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  return accounts;
};

const getPlanPaymentAccounts = async (planId: string) => {
  const plan = await prisma.membershipPlan.findUnique({
    where: { id: planId },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          logo: true,
          address: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!plan) {
    throw new AppError(404, 'Membership plan not found');
  }

  const paymentAccounts = await prisma.paymentAccount.findMany({
    where: {
      businessId: plan.businessId,
      status: 'ACTIVE',
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  return {
    plan,
    business: plan.business,
    paymentAccounts,
  };
};

export const PaymentAccountService = {
  createPaymentAccount,
  getPaymentAccounts,
  getPaymentAccountById,
  updatePaymentAccount,
  deletePaymentAccount,
  getBusinessPaymentAccounts,
  getPlanPaymentAccounts,
};
