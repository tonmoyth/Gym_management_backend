import { prisma } from '../lib/prisma';
import AppError from '../errors/AppError';
import { StaffPermissionRole } from '../generated/prisma/enums';

export interface BusinessAccessResult {
  isOwner: boolean;
  role: 'OWNER' | StaffPermissionRole;
  business: {
    id: string;
    ownerId: string;
    name: string;
  };
}

/**
 * Verifies if a user has access to a specific gym business.
 * - Business Owners have full unrestricted access to their own business.
 * - Staff members with `FULL` role have operational access.
 * - Staff members with role matching any in `allowedRoles` have access.
 * - Otherwise, throws 403 Forbidden.
 */
export const verifyBusinessAccess = async (
  businessId: string,
  userId: string,
  allowedRoles?: StaffPermissionRole[]
): Promise<BusinessAccessResult> => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, name: true }
  });

  if (!business) {
    throw new AppError(404, 'Business not found');
  }

  // 1. Business Owner has full access
  if (business.ownerId === userId) {
    return { isOwner: true, role: 'OWNER', business };
  }

  // 2. Check if user is an active staff member in this business
  const staff = await prisma.businessStaff.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId
      }
    }
  });

  if (!staff) {
    throw new AppError(403, 'Forbidden: You do not have access to this gym business');
  }

  // 3. FULL staff permission grants all operational access
  if (staff.permissionRole === StaffPermissionRole.FULL) {
    return { isOwner: false, role: staff.permissionRole, business };
  }

  // 4. Check specific allowed roles if specified
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(staff.permissionRole)) {
      throw new AppError(
        403,
        `Forbidden: Your staff role (${staff.permissionRole}) does not have permission for this action`
      );
    }
  }

  return { isOwner: false, role: staff.permissionRole, business };
};
