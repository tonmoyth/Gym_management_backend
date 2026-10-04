import {
  PaymentAccountType,
  SubscriptionPaymentStatus,
} from '../../../generated/prisma/enums';

export interface ISubscriptionPaymentFilter {
  status?: SubscriptionPaymentStatus;
  paymentMethod?: PaymentAccountType;
  businessId?: string;
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
}

export interface IRejectPaymentPayload {
  rejectionReason: string;
}
