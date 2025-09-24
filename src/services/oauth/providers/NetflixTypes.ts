/**
 * Netflix-specific TypeScript interfaces and types
 *
 * This file contains all Netflix API-related type definitions
 * for better type safety and code organization
 */

import { OAuthSubscription, BillingRecord } from '../../../types/oauth';

/**
 * Netflix API Error codes and handling
 */
export enum NetflixErrorCode {
  INVALID_CLIENT = 'invalid_client',
  INVALID_GRANT = 'invalid_grant',
  INVALID_REQUEST = 'invalid_request',
  UNAUTHORIZED_CLIENT = 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE = 'unsupported_grant_type',
  INVALID_SCOPE = 'invalid_scope',
  ACCESS_DENIED = 'access_denied',
  SERVER_ERROR = 'server_error',
  TEMPORARILY_UNAVAILABLE = 'temporarily_unavailable',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded'
}

/**
 * Netflix API response interfaces
 */
export interface NetflixTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface NetflixUserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  country: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface NetflixSubscriptionData {
  id: string;
  plan_id: string;
  plan_name: string;
  status: 'active' | 'cancelled' | 'paused' | 'expired';
  amount: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  next_billing_date: string;
  start_date: string;
  end_date?: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export interface NetflixBillingData {
  id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  payment_method: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  created_at: string;
}

export interface NetflixUserData {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  country: string;
  language: string;
  created_at: string;
  updated_at: string;
}

/**
 * Netflix API Client Configuration
 */
export interface NetflixApiConfig {
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
 * Netflix API Client Status
 */
export interface NetflixApiClientStatus {
  config: NetflixApiConfig;
  rateLimitStatus: {
    requestCount: number;
    rateLimitResetTime: number;
    isRateLimited: boolean;
  };
  isHealthy: boolean;
}

/**
 * Netflix Sync Result
 */
export interface NetflixSyncResult {
  subscriptions: OAuthSubscription[];
  billingRecords: BillingRecord[];
  success: boolean;
  errors: string[];
}

/**
 * Netflix Provider Configuration
 */
export interface NetflixProviderConfig {
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
 * Payment method mapping for Netflix
 */
export const NETFLIX_PAYMENT_METHOD_MAP: Record<string, string> = {
  'credit_card': 'Credit Card',
  'debit_card': 'Debit Card',
  'paypal': 'PayPal',
  'gift_card': 'Gift Card',
  'bank_account': 'Bank Account',
  'apple_pay': 'Apple Pay',
  'google_pay': 'Google Pay',
  'amazon_pay': 'Amazon Pay'
};

/**
 * Status mapping for Netflix subscriptions
 */
export const NETFLIX_STATUS_MAP: Record<string, string> = {
  'active': 'active',
  'cancelled': 'cancelled',
  'paused': 'paused',
  'expired': 'expired'
};

/**
 * Netflix API Error class for better error handling
 */
export class NetflixApiError extends Error {
  public readonly code: NetflixErrorCode;
  public readonly statusCode: string;
  public readonly details: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    code: NetflixErrorCode,
    message: string,
    statusCode: string,
    details: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'NetflixApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NetflixApiError);
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [NetflixErrorCode.SERVER_ERROR, NetflixErrorCode.TEMPORARILY_UNAVAILABLE].includes(this.code);
  }

  /**
   * Check if error is rate limiting related
   */
  isRateLimitError(): boolean {
    return this.code === NetflixErrorCode.RATE_LIMIT_EXCEEDED;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case NetflixErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Netflix API rate limit exceeded. Please try again later.';
      case NetflixErrorCode.INVALID_CLIENT:
        return 'Invalid Netflix API credentials.';
      case NetflixErrorCode.ACCESS_DENIED:
        return 'Access to Netflix API denied. Please check your permissions.';
      case NetflixErrorCode.TEMPORARILY_UNAVAILABLE:
        return 'Netflix service is temporarily unavailable. Please try again later.';
      default:
        return this.message;
    }
  }
}

/**
 * Netflix API Response wrapper
 */
export interface NetflixApiResponse<T> {
  data: T;
  success: boolean;
  error?: NetflixApiError;
  metadata?: {
    requestId?: string;
    timestamp: string;
    rateLimitRemaining?: number;
    rateLimitReset?: number;
  };
}

/**
 * Netflix subscription validation result
 */
export interface NetflixValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: Partial<NetflixSubscriptionData>;
}

/**
 * Netflix billing validation result
 */
export interface NetflixBillingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: Partial<NetflixBillingData>;
}

/**
 * Netflix sync configuration
 */
export interface NetflixSyncConfig {
  includeBillingHistory?: boolean;
  billingHistoryLimit?: number;
  syncFrequency?: 'manual' | 'hourly' | 'daily' | 'weekly';
  retryOnFailure?: boolean;
  maxRetries?: number;
}

/**
 * Netflix webhook event types
 */
export enum NetflixWebhookEventType {
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_PAUSED = 'subscription.paused',
  SUBSCRIPTION_RESUMED = 'subscription.resumed',
  BILLING_SUCCESS = 'billing.success',
  BILLING_FAILED = 'billing.failed',
  PAYMENT_METHOD_UPDATED = 'payment_method.updated'
}

/**
 * Netflix webhook payload
 */
export interface NetflixWebhookPayload {
  id: string;
  event_type: NetflixWebhookEventType;
  data: Record<string, any>;
  created_at: string;
  signature?: string;
}

/**
 * Utility type for Netflix API endpoints
 */
export type NetflixApiEndpoint =
  | '/v1/profiles/me'
  | '/v1/subscriptions'
  | '/v1/billing/history'
  | '/v1/oauth/validate';

/**
 * Utility type for Netflix subscription status
 */
export type NetflixSubscriptionStatus = 'active' | 'cancelled' | 'paused' | 'expired';

/**
 * Utility type for Netflix billing status
 */
export type NetflixBillingStatus = 'completed' | 'pending' | 'failed' | 'refunded';

/**
 * Utility type for Netflix billing cycle
 */
export type NetflixBillingCycle = 'monthly' | 'yearly';

/**
 * Netflix API version
 */
export type NetflixApiVersion = 'v1';

/**
 * Netflix plan information
 */
export interface NetflixPlanInfo {
  id: string;
  name: string;
  displayName: string;
  price: number;
  currency: string;
  billingCycle: NetflixBillingCycle;
  features: string[];
  maxDevices: number;
  maxProfiles: number;
  videoQuality: 'SD' | 'HD' | '4K';
  isActive: boolean;
}

/**
 * Netflix usage statistics
 */
export interface NetflixUsageStats {
  totalWatchTime: number; // in minutes
  devicesUsed: number;
  profilesUsed: number;
  mostWatchedGenre: string;
  averageSessionLength: number; // in minutes
  lastActivityDate: string;
}

/**
 * Export utility functions
 */
export const NetflixUtils = {
  /**
   * Validate Netflix subscription data
   */
  validateSubscriptionData(data: Partial<NetflixSubscriptionData>): NetflixValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.id) {
      errors.push('Subscription ID is required');
    }

    if (!data.plan_name) {
      errors.push('Plan name is required');
    }

    if (!data.amount || data.amount <= 0) {
      errors.push('Valid amount is required');
    }

    if (!data.currency) {
      warnings.push('Currency not specified, defaulting to USD');
    }

    if (!data.next_billing_date) {
      errors.push('Next billing date is required');
    } else {
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
   * Validate Netflix billing data
   */
  validateBillingData(data: Partial<NetflixBillingData>): NetflixBillingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.id) {
      errors.push('Billing record ID is required');
    }

    if (!data.subscription_id) {
      errors.push('Subscription ID is required');
    }

    if (!data.amount || data.amount <= 0) {
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
  normalizeBillingCycle(cycle: string): NetflixBillingCycle {
    switch (cycle.toLowerCase()) {
      case 'monthly':
      case 'month':
        return 'monthly';
      case 'yearly':
      case 'annual':
      case 'year':
        return 'yearly';
      default:
        return 'monthly';
    }
  },

  /**
   * Map payment method
   */
  mapPaymentMethod(paymentMethod: string): string {
    if (paymentMethod in NETFLIX_PAYMENT_METHOD_MAP) {
      return NETFLIX_PAYMENT_METHOD_MAP[paymentMethod];
    }

    const parts = paymentMethod.split('_');
    if (parts.length > 1) {
      const method = parts[parts.length - 1];
      if (method in NETFLIX_PAYMENT_METHOD_MAP) {
        return NETFLIX_PAYMENT_METHOD_MAP[method];
      }
    }

    return 'Credit Card';
  },

  /**
   * Map subscription status
   */
  mapStatus(status: string): string {
    return NETFLIX_STATUS_MAP[status] || 'unknown';
  }
};