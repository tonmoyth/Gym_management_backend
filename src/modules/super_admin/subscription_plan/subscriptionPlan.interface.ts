import { BillingCycle, SubscriptionPlanStatus } from '../../../generated/prisma/enums';

export interface ICreateSubscriptionPlanPayload {
  name: string;
  description?: string;
  price: number;
  billingCycle: BillingCycle;
  durationDays?: number;
  features: string[];
  status?: SubscriptionPlanStatus;
}

export interface IUpdateSubscriptionPlanPayload {
  name?: string;
  description?: string;
  price?: number;
  billingCycle?: BillingCycle;
  durationDays?: number;
  features?: string[];
  status?: SubscriptionPlanStatus;
}

export interface ISubscriptionPlanFilter {
  billingCycle?: BillingCycle;
  status?: SubscriptionPlanStatus;
  searchTerm?: string;
}
