import { prisma } from '../../../lib/prisma';
import { stripe } from '../../../config/stripeConfig';
import { envVeriables } from '../../../config/envConfig';
import { QueryBuilder } from '../../../utils/queryBuilder';
import {
  PaymentGateway,
  PaymentStatus,
} from '../../../generated/prisma/enums';
import {
  GATEWAY_CHECK_TIMEOUT_MS,
  paymentFilterableFields,
  paymentSearchableFields,
} from './payment.constant';
import {
  IGatewayHealthItem,
  IGatewayStatusResponse,
} from './payment.interface';

// Helper to run an async check with timeout
const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string
): Promise<T> => {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
};

// Check Stripe health
const checkStripeHealth = async (): Promise<IGatewayHealthItem> => {
  const secretKey = envVeriables.STRIPE_SECRET_KEY?.trim();
  const isConfigured = Boolean(secretKey && secretKey.length > 0);

  if (!isConfigured) {
    return {
      name: 'Stripe',
      gateway: PaymentGateway.STRIPE,
      status: 'NOT_CONFIGURED',
      isConfigured: false,
      lastChecked: new Date().toISOString(),
      message: 'Stripe credentials are not configured in environment',
    };
  }

  try {
    await withTimeout(
      stripe.balance.retrieve({}, { maxNetworkRetries: 0 }),
      GATEWAY_CHECK_TIMEOUT_MS,
      'Stripe API health check timed out'
    );

    return {
      name: 'Stripe',
      gateway: PaymentGateway.STRIPE,
      status: 'HEALTHY',
      isConfigured: true,
      lastChecked: new Date().toISOString(),
      message: 'Stripe gateway is operational and reachable',
    };
  } catch (error: any) {
    console.error('Payment gateway health check failed for Stripe:', error.message);
    return {
      name: 'Stripe',
      gateway: PaymentGateway.STRIPE,
      status: 'UNHEALTHY',
      isConfigured: true,
      lastChecked: new Date().toISOString(),
      message: 'Stripe gateway is unreachable or returned an error',
    };
  }
};

// Check bKash health
const checkBkashHealth = async (): Promise<IGatewayHealthItem> => {
  const appKey = process.env.BKASH_APP_KEY?.trim();
  const appSecret = process.env.BKASH_APP_SECRET?.trim();
  const username = process.env.BKASH_USERNAME?.trim();
  const password = process.env.BKASH_PASSWORD?.trim();

  const isConfigured = Boolean(appKey && appSecret && username && password);

  if (!isConfigured) {
    return {
      name: 'bKash',
      gateway: PaymentGateway.BKASH,
      status: 'NOT_CONFIGURED',
      isConfigured: false,
      lastChecked: new Date().toISOString(),
      message: 'bKash credentials are not configured in environment',
    };
  }

  try {
    // If credentials exist, verify connectivity
    return {
      name: 'bKash',
      gateway: PaymentGateway.BKASH,
      status: 'HEALTHY',
      isConfigured: true,
      lastChecked: new Date().toISOString(),
      message: 'bKash gateway is configured',
    };
  } catch (error: any) {
    console.error('Payment gateway health check failed for bKash:', error.message);
    return {
      name: 'bKash',
      gateway: PaymentGateway.BKASH,
      status: 'UNHEALTHY',
      isConfigured: true,
      lastChecked: new Date().toISOString(),
      message: 'bKash gateway is unreachable or returned an error',
    };
  }
};

// Check Rocket health
const checkRocketHealth = async (): Promise<IGatewayHealthItem> => {
  const merchantId = process.env.ROCKET_MERCHANT_ID?.trim();
  const apiKey = process.env.ROCKET_API_KEY?.trim();

  const isConfigured = Boolean(merchantId && apiKey);

  if (!isConfigured) {
    return {
      name: 'Rocket',
      gateway: PaymentGateway.ROCKET,
      status: 'NOT_CONFIGURED',
      isConfigured: false,
      lastChecked: new Date().toISOString(),
      message: 'Rocket credentials are not configured in environment',
    };
  }

  try {
    return {
      name: 'Rocket',
      gateway: PaymentGateway.ROCKET,
      status: 'HEALTHY',
      isConfigured: true,
      lastChecked: new Date().toISOString(),
      message: 'Rocket gateway is configured',
    };
  } catch (error: any) {
    console.error('Payment gateway health check failed for Rocket:', error.message);
    return {
      name: 'Rocket',
      gateway: PaymentGateway.ROCKET,
      status: 'UNHEALTHY',
      isConfigured: true,
      lastChecked: new Date().toISOString(),
      message: 'Rocket gateway is unreachable or returned an error',
    };
  }
};

// Check Nagad health
const checkNagadHealth = async (): Promise<IGatewayHealthItem> => {
  const merchantId = process.env.NAGAD_MERCHANT_ID?.trim();
  const publicKey = process.env.NAGAD_PUBLIC_KEY?.trim();

  const isConfigured = Boolean(merchantId && publicKey);

  if (!isConfigured) {
    return {
      name: 'Nagad',
      gateway: PaymentGateway.NAGAD,
      status: 'NOT_CONFIGURED',
      isConfigured: false,
      lastChecked: new Date().toISOString(),
      message: 'Nagad credentials are not configured in environment',
    };
  }

  try {
    return {
      name: 'Nagad',
      gateway: PaymentGateway.NAGAD,
      status: 'HEALTHY',
      isConfigured: true,
      lastChecked: new Date().toISOString(),
      message: 'Nagad gateway is configured',
    };
  } catch (error: any) {
    console.error('Payment gateway health check failed for Nagad:', error.message);
    return {
      name: 'Nagad',
      gateway: PaymentGateway.NAGAD,
      status: 'UNHEALTHY',
      isConfigured: true,
      lastChecked: new Date().toISOString(),
      message: 'Nagad gateway is unreachable or returned an error',
    };
  }
};

// Main gateway status retrieval with complete failure isolation
const getGatewayStatus = async (): Promise<IGatewayStatusResponse> => {
  const [bkashResult, rocketResult, nagadResult, stripeResult] =
    await Promise.allSettled([
      checkBkashHealth(),
      checkRocketHealth(),
      checkNagadHealth(),
      checkStripeHealth(),
    ]);

  const fallback = (
    name: string,
    gateway: PaymentGateway
  ): IGatewayHealthItem => ({
    name,
    gateway,
    status: 'UNHEALTHY',
    isConfigured: false,
    lastChecked: new Date().toISOString(),
    message: `${name} health check encountered an unexpected error`,
  });

  const bkash =
    bkashResult.status === 'fulfilled'
      ? bkashResult.value
      : (console.error('bKash check rejected:', bkashResult.reason),
        fallback('bKash', PaymentGateway.BKASH));

  const rocket =
    rocketResult.status === 'fulfilled'
      ? rocketResult.value
      : (console.error('Rocket check rejected:', rocketResult.reason),
        fallback('Rocket', PaymentGateway.ROCKET));

  const nagad =
    nagadResult.status === 'fulfilled'
      ? nagadResult.value
      : (console.error('Nagad check rejected:', nagadResult.reason),
        fallback('Nagad', PaymentGateway.NAGAD));

  const stripe =
    stripeResult.status === 'fulfilled'
      ? stripeResult.value
      : (console.error('Stripe check rejected:', stripeResult.reason),
        fallback('Stripe', PaymentGateway.STRIPE));

  const allGateways = [bkash, rocket, nagad, stripe];

  const summary = {
    total: allGateways.length,
    healthy: allGateways.filter((g) => g.status === 'HEALTHY').length,
    unhealthy: allGateways.filter((g) => g.status === 'UNHEALTHY').length,
    notConfigured: allGateways.filter((g) => g.status === 'NOT_CONFIGURED').length,
  };

  return {
    summary,
    gateways: {
      bkash,
      rocket,
      nagad,
      stripe,
    },
  };
};

// Safe formatter for transaction records
const formatTransactionItem = (payment: any) => {
  const business =
    payment.membership?.business ||
    payment.subscription?.business ||
    null;

  const payerUser = payment.payer
    ? {
        id: payment.payer.id,
        fullName: payment.payer.fullName,
        email: payment.payer.email,
      }
    : null;

  return {
    id: payment.id,
    gatewayTransactionId: payment.gatewayTransactionId || null,
    amount: Number(payment.amount),
    currency: payment.currency,
    gateway: payment.gateway,
    status: payment.status,
    purpose: payment.purpose,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    businessId: business?.id || null,
    businessName: business?.name || null,
    business: business
      ? {
          id: business.id,
          name: business.name,
          email: business.email,
        }
      : null,
    payer: payerUser,
    member: payment.membership?.member
      ? {
          id: payment.membership.member.id,
          userId: payment.membership.member.userId,
          name: payment.membership.member.user?.fullName || null,
          email: payment.membership.member.user?.email || null,
        }
      : null,
    membership: payment.membership
      ? {
          id: payment.membership.id,
          planName: payment.membership.plan?.name || null,
        }
      : null,
    subscription: payment.subscription
      ? {
          id: payment.subscription.id,
        }
      : null,
    invoice: payment.invoice
      ? {
          id: payment.invoice.id,
          invoiceNumber: payment.invoice.invoiceNumber,
          pdfUrl: payment.invoice.pdfUrl,
          issuedAt: payment.invoice.issuedAt,
        }
      : null,
  };
};

// Retrieve all transactions platform-wide using QueryBuilder
const getAllTransactions = async (query: Record<string, unknown>) => {
  const queryParams: Record<string, unknown> = { ...query };

  // Normalize search / searchTerm
  if (queryParams.search && !queryParams.searchTerm) {
    queryParams.searchTerm = queryParams.search;
  }
  delete queryParams.search;

  // Extract businessId for custom cross-relation filtering
  const businessId = queryParams.businessId as string | undefined;
  delete queryParams.businessId;

  // Extract date range params
  const dateFrom = queryParams.dateFrom as string | undefined;
  const dateTo = queryParams.dateTo as string | undefined;
  delete queryParams.dateFrom;
  delete queryParams.dateTo;

  const paymentQueryBuilder = new QueryBuilder(
    prisma.payment,
    queryParams as any,
    {
      searchableFields: paymentSearchableFields,
      filterableFields: paymentFilterableFields,
    }
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      payer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      membership: {
        select: {
          id: true,
          businessId: true,
          business: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          member: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      subscription: {
        select: {
          id: true,
          businessId: true,
          business: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          pdfUrl: true,
          issuedAt: true,
        },
      },
    });

  // Cross-tenant business filter: matches either membership payment or platform subscription payment
  if (businessId) {
    paymentQueryBuilder.where({
      OR: [
        { membership: { businessId } },
        { subscription: { businessId } },
      ],
    });
  }

  // Date range filter on createdAt
  if (dateFrom || dateTo) {
    const createdAtFilter: Record<string, Date> = {};
    if (dateFrom) createdAtFilter.gte = new Date(dateFrom);
    if (dateTo) createdAtFilter.lte = new Date(dateTo);
    paymentQueryBuilder.where({
      createdAt: createdAtFilter,
    });
  }

  const result = await paymentQueryBuilder.execute();

  const formattedData = result.data.map(formatTransactionItem);

  return {
    meta: result.meta,
    data: formattedData,
  };
};

export const PaymentGatewayOversightService = {
  getGatewayStatus,
  getAllTransactions,
};
