import { DisputeResolutionType } from './dispute.constant';
import { DisputeCategory, DisputeStatus } from '../../../generated/prisma/enums';

export interface IResolveDisputePayload {
  resolution: DisputeResolutionType;
  reason: string;
  paymentId?: string;
  accountAction?: 'SUSPEND' | 'ACTIVATE';
  targetUserId?: string;
}

export interface IDisputeQueryFilters {
  status?: DisputeStatus | string;
  category?: DisputeCategory;
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  searchTerm?: string;
  search?: string;
  userId?: string;
  businessId?: string;
  trainerId?: string;
}

export interface ISanitizedDisputeItem {
  id: string;
  subject: string;
  description: string;
  status: DisputeStatus;
  category: DisputeCategory;
  adminReply: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  resolutionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    fullName: string | null;
    email: string;
    role: string;
    profileImage: string | null;
    isActive: boolean;
  } | null;
  business?: {
    id: string;
    name: string;
    status: string;
  } | null;
  trainer?: {
    id: string;
    user?: {
      id: string;
      fullName: string | null;
      email: string;
    } | null;
  } | null;
  relatedPayment?: {
    id: string;
    gatewayTransactionId: string | null;
    amount: number | string;
    currency: string;
    status: string;
    gateway: string;
    purpose: string;
    createdAt: Date;
    invoiceId?: string | null;
    membershipId?: string | null;
    subscriptionId?: string | null;
  } | null;
}
