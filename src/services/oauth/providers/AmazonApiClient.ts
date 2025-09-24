import {
  UserProfile,
  SubscriptionData,
  BillingRecord,
  OAuthError
} from '../../../types/oauth';
import {
  AmazonErrorCode,
  AmazonTokenResponse,
  AmazonUserProfile,
  AmazonSubscriptionData,
  AmazonBillingData,
  AmazonApiConfig,
  RateLimitConfig,
  AmazonApiError,
  AmazonApiClientStatus,
  AmazonUtils
} from './AmazonTypes';

/**
 * Amazon API Client
 *
 * Handles all Amazon API interactions with proper error handling,
 * rate limiting, and response processing
 */
export class AmazonApiClient {
  private config: AmazonApiConfig;
  private rateLimitConfig: RateLimitConfig;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private rateLimitResetTime = 0;

  constructor(config: AmazonApiConfig, rateLimitConfig?: Partial<RateLimitConfig>) {
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
        throw this.createAmazonError(response.status.toString(), errorData);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createAmazonError('408', { error: 'timeout', error_description: 'Request timeout' });
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
   * Create Amazon-specific API error
   */
  private createAmazonError(statusCode: string, errorData: any): AmazonApiError {
    let errorCode = AmazonErrorCode.SERVER_ERROR;
    let errorMessage = 'Unknown Amazon API error';

    // Map HTTP status codes to Amazon error codes
    switch (statusCode) {
      case '400':
        errorCode = AmazonErrorCode.INVALID_REQUEST;
        errorMessage = 'Invalid request parameters';
        break;
      case '401':
        errorCode = AmazonErrorCode.INVALID_CLIENT;
        errorMessage = 'Invalid client credentials';
        break;
      case '403':
        errorCode = AmazonErrorCode.ACCESS_DENIED;
        errorMessage = 'Access denied';
        break;
      case '429':
        errorCode = AmazonErrorCode.RATE_LIMIT_EXCEEDED;
        errorMessage = 'Rate limit exceeded';
        break;
      case '500':
        errorCode = AmazonErrorCode.SERVER_ERROR;
        errorMessage = 'Amazon server error';
        break;
      case '503':
        errorCode = AmazonErrorCode.TEMPORARILY_UNAVAILABLE;
        errorMessage = 'Amazon service temporarily unavailable';
        break;
    }

    // Override with specific Amazon error if provided
    if (errorData.error) {
      errorCode = errorData.error;
      errorMessage = errorData.error_description || errorData.error;
    }

    return new AmazonApiError(errorCode, errorMessage, statusCode, {
      amazonError: errorData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get user profile from Amazon API
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const profileData: AmazonUserProfile = await this.executeRequest(
      '/user/profile',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    return {
      id: profileData.user_id,
      email: profileData.email,
      name: profileData.name,
      metadata: {
        postalCode: profileData.postal_code,
        country: profileData.country,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Get user subscription from Amazon API
   */
  async getSubscription(accessToken: string): Promise<SubscriptionData | null> {
    try {
      const subscriptionData: AmazonSubscriptionData = await this.executeRequest(
        '/prime/subscriptions',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      // Convert Amazon subscription data to internal format
      const isPremium = AmazonUtils.isPremium(subscriptionData.product_id);
      const amount = isPremium ? AmazonUtils.getTierAmount(subscriptionData.product_id) : 0;

      const subscription: SubscriptionData = {
        id: subscriptionData.subscription_id,
        name: AmazonUtils.mapTier(subscriptionData.product_name),
        status: AmazonUtils.mapStatus(subscriptionData.status),
        amount: amount,
        currency: subscriptionData.currency,
        billingCycle: AmazonUtils.normalizeBillingCycle(subscriptionData.billing_cycle),
        nextBillingDate: subscriptionData.next_billing_date ? new Date(subscriptionData.next_billing_date) : undefined,
        startDate: new Date(subscriptionData.start_date),
        endDate: subscriptionData.end_date ? new Date(subscriptionData.end_date) : undefined,
        metadata: {
          planId: subscriptionData.product_id,
          autoRenew: subscriptionData.auto_renew,
          productId: subscriptionData.product_id,
          productName: subscriptionData.product_name,
          createdAt: subscriptionData.created_at,
          updatedAt: subscriptionData.updated_at
        }
      };

      return subscription;
    } catch (error) {
      console.error('Failed to get Amazon subscription:', error);
      return null;
    }
  }

  /**
   * Get user subscriptions from Amazon API
   */
  async getSubscriptions(accessToken: string): Promise<SubscriptionData[]> {
    const subscription = await this.getSubscription(accessToken);
    return subscription ? [subscription] : [];
  }

  /**
   * Get billing history from Amazon API
   */
  async getBillingHistory(
    accessToken: string,
    subscriptionId?: string,
    limit?: number
  ): Promise<BillingRecord[]> {
    try {
      const billingData: AmazonBillingData[] = await this.executeRequest(
        `/prime/billing-history${subscriptionId ? `?subscription_id=${subscriptionId}` : ''}${limit ? `${subscriptionId ? '&' : '?'}limit=${limit}` : ''}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      return billingData.map(record => ({
        id: record.transaction_id,
        subscriptionId: record.subscription_id,
        amount: record.amount,
        currency: record.currency,
        date: new Date(record.date),
        description: record.description,
        metadata: {
          paymentMethod: AmazonUtils.mapPaymentMethod(record.payment_method),
          status: record.status,
          createdAt: record.created_at,
          provider: 'amazon'
        }
      }));
    } catch (error) {
      console.error('Failed to get Amazon billing history:', error);
      return [];
    }
  }

  /**
   * Validate token with Amazon API
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.executeRequest(
        '/user/profile',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );
      return true;
    } catch (error) {
      console.error('Failed to validate Amazon token:', error);
      return false;
    }
  }

  /**
   * Get API client configuration
   */
  getConfig(): AmazonApiConfig {
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

  /**
   * Get API client status
   */
  getStatus(): AmazonApiClientStatus {
    try {
      return {
        config: this.config,
        rateLimitStatus: this.getRateLimitStatus(),
        isHealthy: true
      };
    } catch (error) {
      return {
        config: this.config,
        rateLimitStatus: {
          requestCount: 0,
          rateLimitResetTime: 0,
          isRateLimited: false
        },
        isHealthy: false
      };
    }
  }
}