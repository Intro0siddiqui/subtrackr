/**
 * Spotify-specific TypeScript interfaces and types
 *
 * This file contains all Spotify API-related type definitions
 * for better type safety and code organization
 */

import { OAuthSubscription, BillingRecord } from '../../../types/oauth';

/**
 * Spotify API Error codes and handling
 */
export enum SpotifyErrorCode {
  INVALID_CLIENT = 'invalid_client',
  INVALID_GRANT = 'invalid_grant',
  INVALID_REQUEST = 'invalid_request',
  UNAUTHORIZED_CLIENT = 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE = 'unsupported_grant_type',
  INVALID_SCOPE = 'invalid_scope',
  ACCESS_DENIED = 'access_denied',
  SERVER_ERROR = 'server_error',
  TEMPORARILY_UNAVAILABLE = 'temporarily_unavailable',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_CLIENT_SECRET = 'invalid_client_secret',
  REDIRECT_URI_MISMATCH = 'redirect_uri_mismatch'
}

/**
 * Spotify API response interfaces
 */
export interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface SpotifyUserProfile {
  id: string;
  display_name?: string;
  email: string;
  images?: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  country: string;
  product: string; // subscription tier: free, premium, etc.
  followers?: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
}

export interface SpotifySubscriptionData {
  id: string;
  plan_id: string;
  plan_name: string;
  status: 'active' | 'cancelled' | 'expired' | 'free_trial';
  amount: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly' | 'none';
  next_billing_date?: string;
  start_date: string;
  end_date?: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpotifyBillingData {
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

export interface SpotifyUserData {
  id: string;
  email: string;
  display_name?: string;
  country: string;
  product: string;
  images?: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  followers?: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
}

/**
 * Spotify API Client Configuration
 */
export interface SpotifyApiConfig {
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
 * Spotify API Client Status
 */
export interface SpotifyApiClientStatus {
  config: SpotifyApiConfig;
  rateLimitStatus: {
    requestCount: number;
    rateLimitResetTime: number;
    isRateLimited: boolean;
  };
  isHealthy: boolean;
}

/**
 * Spotify Sync Result
 */
export interface SpotifySyncResult {
  subscriptions: OAuthSubscription[];
  billingRecords: BillingRecord[];
  success: boolean;
  errors: string[];
}

/**
 * Spotify Provider Configuration
 */
export interface SpotifyProviderConfig {
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
 * Payment method mapping for Spotify
 */
export const SPOTIFY_PAYMENT_METHOD_MAP: Record<string, string> = {
  'credit_card': 'Credit Card',
  'debit_card': 'Debit Card',
  'paypal': 'PayPal',
  'gift_card': 'Gift Card',
  'bank_account': 'Bank Account',
  'apple_pay': 'Apple Pay',
  'google_pay': 'Google Pay',
  'amazon_pay': 'Amazon Pay',
  'spotify_card': 'Spotify Gift Card'
};

/**
 * Status mapping for Spotify subscriptions
 */
export const SPOTIFY_STATUS_MAP: Record<string, string> = {
  'active': 'active',
  'cancelled': 'cancelled',
  'expired': 'expired',
  'free_trial': 'active', // Map free trial to active for internal use
  'free': 'active' // Map free tier to active
};

/**
 * Spotify subscription tier mapping
 */
export const SPOTIFY_TIER_MAP: Record<string, string> = {
  'free': 'Free',
  'premium': 'Premium',
  'premium_family': 'Premium Family',
  'premium_student': 'Premium Student',
  'premium_duo': 'Premium Duo'
};

/**
 * Spotify API Error class for better error handling
 */
export class SpotifyApiError extends Error {
  public readonly code: SpotifyErrorCode;
  public readonly statusCode: string;
  public readonly details: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    code: SpotifyErrorCode,
    message: string,
    statusCode: string,
    details: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'SpotifyApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SpotifyApiError);
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [SpotifyErrorCode.SERVER_ERROR, SpotifyErrorCode.TEMPORARILY_UNAVAILABLE].includes(this.code);
  }

  /**
   * Check if error is rate limiting related
   */
  isRateLimitError(): boolean {
    return this.code === SpotifyErrorCode.RATE_LIMIT_EXCEEDED;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case SpotifyErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Spotify API rate limit exceeded. Please try again later.';
      case SpotifyErrorCode.INVALID_CLIENT:
        return 'Invalid Spotify API credentials.';
      case SpotifyErrorCode.ACCESS_DENIED:
        return 'Access to Spotify API denied. Please check your permissions.';
      case SpotifyErrorCode.TEMPORARILY_UNAVAILABLE:
        return 'Spotify service is temporarily unavailable. Please try again later.';
      case SpotifyErrorCode.INVALID_SCOPE:
        return 'Insufficient Spotify API permissions. Please reconnect your account.';
      default:
        return this.message;
    }
  }
}

/**
 * Spotify API Response wrapper
 */
export interface SpotifyApiResponse<T> {
  data: T;
  success: boolean;
  error?: SpotifyApiError;
  metadata?: {
    requestId?: string;
    timestamp: string;
    rateLimitRemaining?: number;
    rateLimitReset?: number;
  };
}

/**
 * Spotify subscription validation result
 */
export interface SpotifyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: Partial<SpotifySubscriptionData>;
}

/**
 * Spotify billing validation result
 */
export interface SpotifyBillingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: Partial<SpotifyBillingData>;
}

/**
 * Spotify sync configuration
 */
export interface SpotifySyncConfig {
  includeBillingHistory?: boolean;
  billingHistoryLimit?: number;
  syncFrequency?: 'manual' | 'hourly' | 'daily' | 'weekly';
  retryOnFailure?: boolean;
  maxRetries?: number;
}

/**
 * Spotify webhook event types (if supported in future)
 */
export enum SpotifyWebhookEventType {
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  BILLING_SUCCESS = 'billing.success',
  BILLING_FAILED = 'billing.failed'
}

/**
 * Spotify webhook payload (if supported in future)
 */
export interface SpotifyWebhookPayload {
  id: string;
  event_type: SpotifyWebhookEventType;
  data: Record<string, any>;
  created_at: string;
  signature?: string;
}

/**
 * Utility type for Spotify API endpoints
 */
export type SpotifyApiEndpoint =
  | '/v1/me'
  | '/v1/me/subscription'
  | '/v1/me/player'
  | '/v1/me/player/recently-played';

/**
 * Utility type for Spotify subscription status
 */
export type SpotifySubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'free_trial';

/**
 * Utility type for Spotify billing status
 */
export type SpotifyBillingStatus = 'completed' | 'pending' | 'failed' | 'refunded';

/**
 * Utility type for Spotify billing cycle
 */
export type SpotifyBillingCycle = 'monthly' | 'yearly' | 'none';

/**
 * Spotify API version
 */
export type SpotifyApiVersion = 'v1';

/**
 * Spotify plan information
 */
export interface SpotifyPlanInfo {
  id: string;
  name: string;
  displayName: string;
  price: number;
  currency: string;
  billingCycle: SpotifyBillingCycle;
  features: string[];
  maxDevices: number;
  isActive: boolean;
}

/**
 * Spotify usage statistics
 */
export interface SpotifyUsageStats {
  totalListeningTime: number; // in minutes
  topGenres: string[];
  topArtists: string[];
  averageSessionLength: number; // in minutes
  lastActivityDate: string;
  totalTracksPlayed: number;
}

/**
 * Export utility functions
 */
export const SpotifyUtils = {
  /**
   * Validate Spotify subscription data
   */
  validateSubscriptionData(data: Partial<SpotifySubscriptionData>): SpotifyValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.id) {
      errors.push('Subscription ID is required');
    }

    if (!data.plan_name) {
      errors.push('Plan name is required');
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
   * Validate Spotify billing data
   */
  validateBillingData(data: Partial<SpotifyBillingData>): SpotifyBillingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.id) {
      errors.push('Billing record ID is required');
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
  normalizeBillingCycle(cycle: string): SpotifyBillingCycle {
    switch (cycle.toLowerCase()) {
      case 'monthly':
      case 'month':
        return 'monthly';
      case 'yearly':
      case 'annual':
      case 'year':
        return 'yearly';
      case 'none':
      case 'free':
        return 'none';
      default:
        return 'monthly';
    }
  },

  /**
   * Map payment method
   */
  mapPaymentMethod(paymentMethod: string): string {
    if (paymentMethod in SPOTIFY_PAYMENT_METHOD_MAP) {
      return SPOTIFY_PAYMENT_METHOD_MAP[paymentMethod];
    }

    const parts = paymentMethod.split('_');
    if (parts.length > 1) {
      const method = parts[parts.length - 1];
      if (method in SPOTIFY_PAYMENT_METHOD_MAP) {
        return SPOTIFY_PAYMENT_METHOD_MAP[method];
      }
    }

    return 'Credit Card';
  },

  /**
   * Map subscription status
   */
  mapStatus(status: string): string {
    return SPOTIFY_STATUS_MAP[status] || 'unknown';
  },

  /**
   * Map subscription tier
   */
  mapTier(tier: string): string {
    return SPOTIFY_TIER_MAP[tier] || tier;
  },

  /**
   * Check if user has premium subscription
   */
  isPremium(product: string): boolean {
    return ['premium', 'premium_family', 'premium_student', 'premium_duo'].includes(product);
  },

  /**
   * Get subscription amount based on tier
   */
  getTierAmount(tier: string, currency: string = 'USD'): number {
    const tierAmounts: Record<string, Record<string, number>> = {
      'free': { 'USD': 0, 'EUR': 0, 'GBP': 0 },
      'premium': { 'USD': 9.99, 'EUR': 9.99, 'GBP': 9.99 },
      'premium_family': { 'USD': 14.99, 'EUR': 14.99, 'GBP': 14.99 },
      'premium_student': { 'USD': 4.99, 'EUR': 4.99, 'GBP': 4.99 },
      'premium_duo': { 'USD': 12.99, 'EUR': 12.99, 'GBP': 12.99 }
    };

    return tierAmounts[tier]?.[currency] || tierAmounts[tier]?.['USD'] || 0;
  }
};