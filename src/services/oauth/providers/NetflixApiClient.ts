import {
  UserProfile,
  SubscriptionData,
  BillingRecord,
  OAuthError
} from '../../../types/oauth';
import {
  NetflixErrorCode,
  NetflixTokenResponse,
  NetflixUserProfile,
  NetflixSubscriptionData,
  NetflixBillingData,
  NetflixApiConfig,
  RateLimitConfig,
  NetflixApiError
} from './NetflixTypes';

/**
 * Netflix API Client interfaces (using shared types from NetflixTypes.ts)
 */
interface NetflixSubscription {
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

interface NetflixBillingRecord {
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

/**
 * Netflix API Client
 *
 * Handles all Netflix API interactions with proper error handling,
 * rate limiting, and response processing
 */
export class NetflixApiClient {
  private config: NetflixApiConfig;
  private rateLimitConfig: RateLimitConfig;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private rateLimitResetTime = 0;

  constructor(config: NetflixApiConfig, rateLimitConfig?: Partial<RateLimitConfig>) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };

    this.rateLimitConfig = {
      requestsPerSecond: 5,
      requestsPerMinute: 100,
      burstLimit: 10,
      ...rateLimitConfig
    };
  }

  /**
   * Execute API request with rate limiting and retry logic
   */
  private async executeRequest<T>(
    endpoint: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<T> {
    // Apply rate limiting
    await this.enforceRateLimit();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle rate limiting response
      if (response.status === 429) {
        const retryAfter = this.parseRetryAfter(response.headers.get('Retry-After'));
        await this.handleRateLimit(retryAfter);
        return this.executeRequest<T>(endpoint, options, retryCount);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createNetflixError(response.status.toString(), errorData);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createNetflixError('408', { error: 'timeout', error_description: 'Request timeout' });
      }

      // Retry logic for transient errors
      if (retryCount < this.config.maxRetries! && this.isRetryableError(error)) {
        await this.delay(this.config.retryDelay! * Math.pow(2, retryCount));
        return this.executeRequest<T>(endpoint, options, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset counters if rate limit window has passed
    if (now > this.rateLimitResetTime) {
      this.requestCount = 0;
      this.rateLimitResetTime = now + 60000; // 1 minute window
    }

    // Check if we're exceeding rate limits
    if (this.requestCount >= this.rateLimitConfig.requestsPerMinute) {
      const waitTime = this.rateLimitResetTime - now;
      await this.delay(waitTime);
      return this.enforceRateLimit();
    }

    // Simple burst control
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.rateLimitConfig.requestsPerSecond;

    if (timeSinceLastRequest < minInterval) {
      await this.delay(minInterval - timeSinceLastRequest);
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Handle rate limit response
   */
  private async handleRateLimit(retryAfterSeconds?: number): Promise<void> {
    const waitTime = (retryAfterSeconds || 60) * 1000;
    await this.delay(waitTime);
  }

  /**
   * Parse Retry-After header
   */
  private parseRetryAfter(retryAfter: string | null): number {
    if (!retryAfter) return 60;

    const seconds = parseInt(retryAfter, 10);
    return isNaN(seconds) ? 60 : seconds;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof Error && 'code' in error) {
      const oauthError = error as OAuthError;
      return ['server_error', 'temporarily_unavailable'].includes(oauthError.code);
    }
    return false;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create Netflix-specific API error
   */
  private createNetflixError(statusCode: string, errorData: any): NetflixApiError {
    let errorCode = NetflixErrorCode.SERVER_ERROR;
    let errorMessage = 'Unknown Netflix API error';

    // Map HTTP status codes to Netflix error codes
    switch (statusCode) {
      case '400':
        errorCode = NetflixErrorCode.INVALID_REQUEST;
        errorMessage = 'Invalid request parameters';
        break;
      case '401':
        errorCode = NetflixErrorCode.INVALID_CLIENT;
        errorMessage = 'Invalid client credentials';
        break;
      case '403':
        errorCode = NetflixErrorCode.ACCESS_DENIED;
        errorMessage = 'Access denied';
        break;
      case '429':
        errorCode = NetflixErrorCode.RATE_LIMIT_EXCEEDED;
        errorMessage = 'Rate limit exceeded';
        break;
      case '500':
        errorCode = NetflixErrorCode.SERVER_ERROR;
        errorMessage = 'Netflix server error';
        break;
      case '503':
        errorCode = NetflixErrorCode.TEMPORARILY_UNAVAILABLE;
        errorMessage = 'Netflix service temporarily unavailable';
        break;
    }

    // Override with specific Netflix error if provided
    if (errorData.error) {
      errorCode = errorData.error;
      errorMessage = errorData.error_description || errorData.error;
    }

    return new NetflixApiError(errorCode, errorMessage, statusCode, {
      netflixError: errorData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get user profile from Netflix API
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const profileData: NetflixUserProfile = await this.executeRequest(
      '/v1/profiles/me',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    return {
      id: profileData.id,
      email: profileData.email,
      name: profileData.name,
      avatar: profileData.avatar,
      metadata: {
        country: profileData.country,
        language: profileData.language,
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at
      }
    };
  }

  /**
   * Get user subscriptions from Netflix API
   */
  async getSubscriptions(accessToken: string): Promise<SubscriptionData[]> {
    const subscriptionsData: NetflixSubscription[] = await this.executeRequest(
      '/v1/subscriptions',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    return subscriptionsData.map(sub => ({
      id: sub.id,
      name: sub.plan_name,
      status: sub.status,
      amount: sub.amount,
      currency: sub.currency,
      billingCycle: sub.billing_cycle,
      nextBillingDate: new Date(sub.next_billing_date),
      startDate: new Date(sub.start_date),
      endDate: sub.end_date ? new Date(sub.end_date) : undefined,
      metadata: {
        planId: sub.plan_id,
        autoRenew: sub.auto_renew,
        createdAt: sub.created_at,
        updatedAt: sub.updated_at
      }
    }));
  }

  /**
   * Get billing history from Netflix API
   */
  async getBillingHistory(
    accessToken: string,
    subscriptionId?: string,
    limit?: number
  ): Promise<BillingRecord[]> {
    let endpoint = '/v1/billing/history';
    const params = new URLSearchParams();

    if (subscriptionId) {
      params.append('subscription_id', subscriptionId);
    }

    if (limit) {
      params.append('limit', limit.toString());
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const billingData: NetflixBillingRecord[] = await this.executeRequest(
      endpoint,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    return billingData.map(record => ({
      id: record.id,
      subscriptionId: record.subscription_id,
      amount: record.amount,
      currency: record.currency,
      date: new Date(record.date),
      description: record.description,
      metadata: {
        paymentMethod: record.payment_method,
        status: record.status,
        createdAt: record.created_at
      }
    }));
  }

  /**
   * Validate token with Netflix API
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.executeRequest(
        '/v1/oauth/validate',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );
      return true;
    } catch (error) {
      console.error('Failed to validate Netflix token:', error);
      return false;
    }
  }

  /**
   * Get API client configuration
   */
  getConfig(): NetflixApiConfig {
    return { ...this.config };
  }

  /**
   * Update rate limiting configuration
   */
  updateRateLimitConfig(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config };
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    requestCount: number;
    rateLimitResetTime: number;
    isRateLimited: boolean;
  } {
    const now = Date.now();
    return {
      requestCount: this.requestCount,
      rateLimitResetTime: this.rateLimitResetTime,
      isRateLimited: this.requestCount >= this.rateLimitConfig.requestsPerMinute
    };
  }
}