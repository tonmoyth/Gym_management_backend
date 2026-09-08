import {
  PaymentGateway,
  PaymentPurpose,
  PaymentStatus,
} from '../../../generated/prisma/enums';

export type GatewayHealthStatus = 'HEALTHY' | 'UNHEALTHY' | 'NOT_CONFIGURED';

export interface IGatewayHealthItem {
  name: string;
  gateway: PaymentGateway;
  status: GatewayHealthStatus;
  isConfigured: boolean;
  lastChecked: string;
  message?: string;
}

export interface IGatewayStatusResponse {
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    notConfigured: number;
  };
  gateways: {
    bkash: IGatewayHealthItem;
    rocket: IGatewayHealthItem;
    nagad: IGatewayHealthItem;
    stripe: IGatewayHealthItem;
  };
}

export interface ITransactionFilterRequest {
  search?: string;
  searchTerm?: string;
  status?: PaymentStatus;
  gateway?: PaymentGateway;
  purpose?: PaymentPurpose;
  businessId?: string;
  payerUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}
