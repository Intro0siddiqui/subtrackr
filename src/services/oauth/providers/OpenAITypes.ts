/**
 * OpenAI API Types and Interfaces
 */

import {
  OAuthError,
  OAuthProvider,
  OAuthTokens,
  UserProfile,
  SubscriptionData,
  BillingRecord,
  OAuthProviderType,
  OAuthFlowType
} from '../../../types/oauth';

/**
 * OpenAI Provider Configuration
 */
export const OPENAI_PROVIDER_CONFIG: OAuthProvider = {
  id: 'openai',
  name: 'openai',
  displayName: 'OpenAI',
  logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/openai/openai-original.svg',
  type: OAuthProviderType.API_KEY,
  supportedFlows: [],
  authUrl: '',
  tokenUrl: '',
  apiBaseUrl: 'https://api.openai.com/v1',
  scopes: ['read:user', 'read:subscription'],
  features: {
    subscriptionSync: true,
    webhookSupport: false,
    realTimeUpdates: false
  },
  category: 'ai',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

/**
 * OpenAI API Error Response
 */
export interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

/**
 * OpenAI API Client Configuration
 */
export interface OpenAIApiConfig {
  baseUrl: string;
  timeout?: number;
 maxRetries?: number;
  retryDelay?: number;
  apiKey?: string;
  organization?: string;
}

/**
 * OpenAI User Profile Response
 */
export interface OpenAIUser {
  id: string;
  object: string;
  created: number;
  name: string;
 email: string;
  picture?: string;
  role: string;
  is_verified: boolean;
  has_payment_method: boolean;
}

/**
 * OpenAI Subscription Response
 */
export interface OpenAISubscription {
  id: string;
  object: string;
  created: number;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{
      id: string;
      object: string;
      created: number;
      price: {
        id: string;
        object: string;
        active: boolean;
        billing_scheme: string;
        created: number;
        currency: string;
        livemode: boolean;
        lookup_key: string | null;
        metadata: Record<string, any>;
        nickname: string;
        product: string;
        recurring: {
          aggregate_usage: string | null;
          interval: 'day' | 'week' | 'month' | 'year';
          interval_count: number;
          usage_type: string;
        };
        tax_behavior: string;
        tiers_mode: string | null;
        transform_quantity: string | null;
        type: 'recurring' | 'one_time';
        unit_amount: number;
        unit_amount_decimal: string;
      };
      quantity: number;
      subscription: string;
      metadata: Record<string, any>;
    }>;
  };
  latest_invoice: string;
  metadata: Record<string, any>;
  trial_end: number | null;
  trial_start: number | null;
}

/**
 * OpenAI Billing History Response
 */
export interface OpenAIBillingRecord {
  id: string;
  object: string;
 amount: number;
  currency: string;
  created: number;
 description: string;
  invoice_id: string;
  status: 'paid' | 'pending' | 'failed' | 'void';
  subscription_id?: string;
  metadata?: Record<string, any>;
}

/**
 * OpenAI API Client Status
 */
export interface OpenAIClientStatus {
  config: OpenAIApiConfig;
  isHealthy: boolean;
}

/**
 * OpenAI-specific error codes
 */
export enum OpenAIErrorCode {
  INVALID_API_KEY = 'invalid_api_key',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  AUTHENTICATION_FAILED = 'authentication_failed',
  PERMISSION_DENIED = 'permission_denied',
  SERVER_ERROR = 'server_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * OpenAI API Error Class
 */
export class OpenAIApiError extends Error implements OAuthError {
  code: string;
  provider: string;
  details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.provider = 'openai';
    this.details = details;
  }
}

/**
 * OpenAI Utility Functions
 */
export class OpenAIUtils {
  /**
   * Map OpenAI user data to internal UserProfile format
   */
  static mapUserToProfile(user: OpenAIUser): UserProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.picture,
      metadata: {
        role: user.role,
        isVerified: user.is_verified,
        hasPaymentMethod: user.has_payment_method,
        createdAt: new Date(user.created * 1000).toISOString()
      }
    };
  }

  /**
   * Map OpenAI subscription data to internal SubscriptionData format
   */
  static mapSubscriptionToData(subscription: OpenAISubscription): SubscriptionData {
    // Get the first item (most likely the main subscription)
    const item = subscription.items.data[0];
    
    // Determine billing cycle from price recurring settings
    let billingCycle: string;
    if (item?.price?.recurring?.interval === 'month') {
      billingCycle = 'monthly';
    } else if (item?.price?.recurring?.interval === 'year') {
      billingCycle = 'yearly';
    } else {
      billingCycle = 'unknown';
    }

    // Calculate amount from price unit_amount (in cents)
    const amount = item?.price?.unit_amount ? item.price.unit_amount / 100 : 0;

    return {
      id: subscription.id,
      name: item?.price?.nickname || 'OpenAI Subscription',
      status: subscription.status,
      amount: amount,
      currency: item?.price?.currency || 'usd',
      billingCycle: billingCycle,
      nextBillingDate: new Date(subscription.current_period_end * 1000),
      startDate: new Date(subscription.current_period_start * 1000),
      endDate: subscription.cancel_at_period_end ? new Date(subscription.current_period_end * 1000) : undefined,
      metadata: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        items: subscription.items.data,
        latestInvoice: subscription.latest_invoice,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : undefined,
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : undefined,
        createdAt: new Date(subscription.created * 1000).toISOString()
      }
    };
  }

  /**
   * Map OpenAI billing record to internal BillingRecord format
   */
  static mapBillingRecordToData(record: OpenAIBillingRecord): BillingRecord {
    return {
      id: record.id,
      subscriptionId: record.subscription_id || '',
      amount: record.amount / 100, // Convert cents to dollars
      currency: record.currency,
      date: new Date(record.created * 1000),
      description: record.description,
      metadata: {
        status: record.status,
        invoiceId: record.invoice_id,
        ...record.metadata
      }
    };
  }

  /**
   * Validate OpenAI API key format
   */
  static isValidApiKey(apiKey: string): boolean {
    if (!apiKey) return false;
    return /^sk-(?:[a-zA-Z0-9]{20,}|[a-zA-Z0-9]{48})$/.test(apiKey.trim());
  }

  /**
   * Extract organization ID from API key
   */
  static extractOrganizationId(apiKey: string): string | null {
    const match = apiKey.match(/org-(.+?)_/);
    return match ? match[1] : null;
  }
}