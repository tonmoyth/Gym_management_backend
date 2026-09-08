import { Role } from '../../../generated/prisma/enums';

export const userSearchableFields = ['fullName', 'email'];

export const userFilterableFields = ['role', 'isActive'];

export const allowedOversightRoles: readonly Role[] = [Role.MEMBER, Role.TRAINER];
