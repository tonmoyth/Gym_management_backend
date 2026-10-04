import { Role } from '../../../generated/prisma/enums';

export type UserAccountStatus = 'ACTIVE' | 'SUSPENDED';

export interface IGetUsersQuery {
  search?: string;
  searchTerm?: string;
  role?: Role | 'MEMBER' | 'TRAINER' | 'BUSINESS_OWNER' | 'STAFF' | 'ADMIN' | 'SUPER_ADMIN';
  status?: UserAccountStatus;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

export interface IUpdateAccountStatusPayload {
  status?: UserAccountStatus;
  isActive?: boolean;
}
