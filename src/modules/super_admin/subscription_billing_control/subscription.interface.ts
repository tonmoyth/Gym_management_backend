import { SubscriptionStatus } from '../../../generated/prisma/enums';

export interface ISubscriptionFilterRequest {
  search?: string;
  searchTerm?: string;
  status?: SubscriptionStatus;
  businessId?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

export interface IUpdateSubscriptionStatusPayload {
  status: SubscriptionStatus;
}
