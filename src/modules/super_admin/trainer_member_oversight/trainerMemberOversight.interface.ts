import { Role } from '../../../generated/prisma/enums';

export type UserAccountStatus = 'ACTIVE' | 'SUSPENDED';

export interface IGetUsersQuery {
  search?: string;
  searchTerm?: string;
  role?: 'MEMBER' | 'TRAINER';
  status?: UserAccountStatus;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

export interface IUpdateAccountStatusPayload {
  status: UserAccountStatus;
}
