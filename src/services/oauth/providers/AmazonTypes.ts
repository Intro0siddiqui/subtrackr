/**
 * Amazon-specific TypeScript interfaces and types
 *
 * This file contains all Amazon API-related type definitions
 * for better type safety and code organization
 */

import { OAuthSubscription, BillingRecord } from '../../../types/oauth';

/**
 * Amazon API Error codes and handling
 */
export enum AmazonErrorCode {
  INVALID_CLIENT = 'invalid_client',
  INVALID_GRANT = 'invalid_grant',
  INVALID_REQUEST = 'invalid_request',
  UNAUTHORIZED_CLIENT = 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE = 'unsupported_grant_type',
  INVALID_SCOPE = 'invalid_scope',
  ACCESS_DENIED = 'access_denewd',
  SERVER_ERROR = 'server_error',
  TEMPORARILY_UNAVAILABLE = 'temporarily_unavailable',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_CLIENT_SECRET = 'invalid_client_secret',
  REDIRECT_URI_MISMATCH = 'redirect_uri_mismatch'
}

/**
 * Amazon API response interfaces
 */
export interface AmazonTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface AmazonUserProfile {
  user_id: string;
  name: string;
 email: string;
  postal_code?: string;
  country?: string;
}

export interface AmazonSubscriptionData {
  subscription_id: string;
  product_id: string;
  product_name: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FREE_TRIAL';
  amount: number;
  currency: string;
  billing_cycle: 'MONTHLY' | 'YEARLY' | 'NONE';
  next_billing_date?: string;
  start_date: string;
  end_date?: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export interface AmazonBillingData {
  transaction_id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  payment_method: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';
  created_at: string;
}

export interface AmazonUserData {
  user_id: string;
  name: string;
  email: string;
 postal_code?: string;
  country?: string;
}

/**
 * Amazon API Client Configuration
 */
export interface AmazonApiConfig {
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  burstLimit: number;
}

/**
 * Amazon API Client Status
 */
export interface AmazonApiClientStatus {
  config: AmazonApiConfig;
  rateLimitStatus: {
    requestCount: number;
    rateLimitResetTime: number;
    isRateLimited: boolean;
  };
  isHealthy: boolean;
}

/**
 * Amazon Sync Result
 */
export interface AmazonSyncResult {
  subscriptions: OAuthSubscription[];
  billingRecords: BillingRecord[];
  success: boolean;
  errors: string[];
}

/**
 * Amazon Provider Configuration
 */
export interface AmazonProviderConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  endpoints: {
    auth: string;
    token: string;
    api: string;
  };
  apiClient: {
    baseUrl: string;
    timeout: number;
    maxRetries: number;
    retryDelay: number;
  };
  rateLimit: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    burstLimit: number;
  };
}

/**
 * Payment method mapping for Amazon
 */
export const AMAZON_PAYMENT_METHOD_MAP: Record<string, string> = {
  'CREDIT_CARD': 'Credit Card',
  'DEBIT_CARD': 'Debit Card',
  'AMAZON_PAY': 'Amazon Pay',
  'GIFT_CARD': 'Gift Card',
  'BANK_ACCOUNT': 'Bank Account',
  'APPLE_PAY': 'Apple Pay',
  'GOOGLE_PAY': 'Google Pay'
};

/**
 * Status mapping for Amazon subscriptions
 */
export const AMAZON_STATUS_MAP: Record<string, string> = {
  'ACTIVE': 'active',
  'CANCELLED': 'cancelled',
  'EXPIRED': 'expired',
  'FREE_TRIAL': 'active' // Map free trial to active for internal use
};

/**
 * Amazon subscription tier mapping
 */
export const AMAZON_TIER_MAP: Record<string, string> = {
  'PRIME_BASIC': 'Prime Basic',
  'PRIME_PREMIUM': 'Prime Premium',
  'PRIME_STUDENT': 'Prime Student',
  'PRIME_FAMILY': 'Prime Family'
};

/**
 * Amazon API Error class for better error handling
 */
export class AmazonApiError extends Error {
  public readonly code: AmazonErrorCode;
  public readonly statusCode: string;
 public readonly details: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    code: AmazonErrorCode,
    message: string,
    statusCode: string,
    details: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'AmazonApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AmazonApiError);
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [AmazonErrorCode.SERVER_ERROR, AmazonErrorCode.TEMPORARILY_UNAVAILABLE].includes(this.code);
  }

  /**
   * Check if error is rate limiting related
   */
  isRateLimitError(): boolean {
    return this.code === AmazonErrorCode.RATE_LIMIT_EXCEEDED;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case AmazonErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Amazon API rate limit exceeded. Please try again later.';
      case AmazonErrorCode.INVALID_CLIENT:
        return 'Invalid Amazon API credentials.';
      case AmazonErrorCode.ACCESS_DENIED:
        return 'Access to Amazon API denied. Please check your permissions.';
      case AmazonErrorCode.TEMPORARILY_UNAVAILABLE:
        return 'Amazon service is temporarily unavailable. Please try again later.';
      case AmazonErrorCode.INVALID_SCOPE:
        return 'Insufficient Amazon API permissions. Please reconnect your account.';
      default:
        return this.message;
    }
  }
}

/**
 * Amazon API Response wrapper
 */
export interface AmazonApiResponse<T> {
  data: T;
  success: boolean;
  error?: AmazonApiError;
  metadata?: {
    requestId?: string;
    timestamp: string;
    rateLimitRemaining?: number;
    rateLimitReset?: number;
  };
}

/**
 * Amazon subscription validation result
 */
export interface AmazonValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: Partial<AmazonSubscriptionData>;
}

/**
 * Amazon billing validation result
 */
export interface AmazonBillingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: Partial<AmazonBillingData>;
}

/**
 * Amazon sync configuration
 */
export interface AmazonSyncConfig {
  includeBillingHistory?: boolean;
  billingHistoryLimit?: number;
  syncFrequency?: 'manual' | 'hourly' | 'daily' | 'weekly';
  retryOnFailure?: boolean;
  maxRetries?: number;
}

/**
 * Amazon webhook event types (if supported in future)
 */
export enum AmazonWebhookEventType {
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  BILLING_SUCCESS = 'billing.success',
  BILLING_FAILED = 'billing.failed'
}

/**
 * Amazon webhook payload (if supported in future)
 */
export interface AmazonWebhookPayload {
  id: string;
  event_type: AmazonWebhookEventType;
  data: Record<string, any>;
  created_at: string;
  signature?: string;
}

/**
 * Utility type for Amazon API endpoints
 */
export type AmazonApiEndpoint =
  | '/user/profile'
  | '/prime/subscriptions'
  | '/prime/billing-history';

/**
 * Utility type for Amazon subscription status
 */
export type AmazonSubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FREE_TRIAL';

/**
 * Utility type for Amazon billing status
 */
export type AmazonBillingStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';

/**
 * Utility type for Amazon billing cycle
 */
export type AmazonBillingCycle = 'MONTHLY' | 'YEARLY' | 'NONE';

/**
 * Amazon API version
 */
export type AmazonApiVersion = 'v1';

/**
 * Amazon plan information
 */
export interface AmazonPlanInfo {
  id: string;
  name: string;
  displayName: string;
  price: number;
  currency: string;
  billingCycle: AmazonBillingCycle;
  features: string[];
  maxDevices: number;
 isActive: boolean;
}

/**
 * Export utility functions
 */
export const AmazonUtils = {
  /**
   * Validate Amazon subscription data
   */
  validateSubscriptionData(data: Partial<AmazonSubscriptionData>): AmazonValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.subscription_id) {
      errors.push('Subscription ID is required');
    }

    if (!data.product_name) {
      errors.push('Product name is required');
    }

    if (!data.amount || data.amount < 0) {
      errors.push('Valid amount is required');
    }

    if (!data.currency) {
      warnings.push('Currency not specified, defaulting to USD');
    }

    if (data.next_billing_date) {
      const billingDate = new Date(data.next_billing_date);
      if (isNaN(billingDate.getTime())) {
        errors.push('Invalid next billing date format');
      }
    }

    if (!data.start_date) {
      errors.push('Start date is required');
    } else {
      const startDate = new Date(data.start_date);
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date format');
      }
    }

    if (data.end_date) {
      const endDate = new Date(data.end_date);
      if (isNaN(endDate.getTime())) {
        errors.push('Invalid end date format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data
    };
  },

  /**
   * Validate Amazon billing data
   */
  validateBillingData(data: Partial<AmazonBillingData>): AmazonBillingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.transaction_id) {
      errors.push('Transaction ID is required');
    }

    if (!data.subscription_id) {
      errors.push('Subscription ID is required');
    }

    if (!data.amount || data.amount < 0) {
      errors.push('Valid amount is required');
    }

    if (!data.currency) {
      warnings.push('Currency not specified, defaulting to USD');
    }

    if (!data.date) {
      errors.push('Date is required');
    } else {
      const date = new Date(data.date);
      if (isNaN(date.getTime())) {
        errors.push('Invalid date format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data
    };
  },

  /**
   * Normalize billing cycle
   */
  normalizeBillingCycle(cycle: string): AmazonBillingCycle {
    switch (cycle.toUpperCase()) {
      case 'MONTHLY':
      case 'MONTH':
        return 'MONTHLY';
      case 'YEARLY':
      case 'ANNUAL':
      case 'YEAR':
        return 'YEARLY';
      case 'NONE':
      case 'FREE':
        return 'NONE';
      default:
        return 'MONTHLY';
    }
  },

  /**
   * Map payment method
   */
  mapPaymentMethod(paymentMethod: string): string {
    if (paymentMethod in AMAZON_PAYMENT_METHOD_MAP) {
      return AMAZON_PAYMENT_METHOD_MAP[paymentMethod];
    }

    const parts = paymentMethod.split('_');
    if (parts.length > 1) {
      const method = parts[parts.length - 1];
      if (method in AMAZON_PAYMENT_METHOD_MAP) {
        return AMAZON_PAYMENT_METHOD_MAP[method];
      }
    }

    return 'Credit Card';
  },

  /**
   * Map subscription status
   */
  mapStatus(status: string): string {
    return AMAZON_STATUS_MAP[status] || 'unknown';
  },

  /**
   * Map subscription tier
   */
  mapTier(tier: string): string {
    return AMAZON_TIER_MAP[tier] || tier;
  },

  /**
   * Check if user has premium subscription
   */
  isPremium(product: string): boolean {
    return ['PRIME_PREMIUM', 'PRIME_STUDENT', 'PRIME_FAMILY'].includes(product);
  },

  /**
   * Get subscription amount based on tier
   */
  getTierAmount(tier: string, currency: string = 'USD'): number {
    const tierAmounts: Record<string, Record<string, number>> = {
      'PRIME_BASIC': { 'USD': 0, 'EUR': 0, 'GBP': 0 },
      'PRIME_PREMIUM': { 'USD': 14.99, 'EUR': 14.99, 'GBP': 14.99 },
      'PRIME_STUDENT': { 'USD': 7.49, 'EUR': 7.49, 'GBP': 7.49 },
      'PRIME_FAMILY': { 'USD': 20.99, 'EUR': 20.99, 'GBP': 20.99 }
    };

    return tierAmounts[tier]?.[currency] || tierAmounts[tier]?.['USD'] || 0;
  }
};