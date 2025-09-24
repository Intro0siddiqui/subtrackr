/**
 * OpenAI API Client
 *
 * Handles all OpenAI API interactions with proper error handling,
 * rate limiting, and response processing
 */

import {
  UserProfile,
  SubscriptionData,
  BillingRecord,
  OAuthError
} from '../../../types/oauth';

import {
  OpenAIApiConfig,
  OpenAIUser,
  OpenAISubscription,
  OpenAIBillingRecord,
  OpenAIApiError,
  OpenAIErrorCode,
  OpenAIUtils,
  OpenAIErrorResponse
} from './OpenAITypes';

/**
 * OpenAI API Client
 */
export class OpenAIApiClient {
  private config: OpenAIApiConfig;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private rateLimitResetTime = 0;

  constructor(config: OpenAIApiConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
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
        const errorData: OpenAIErrorResponse = await response.json().catch(() => ({ error: { message: 'Unknown error', type: 'unknown' } }));
        throw this.createOpenAIError(response.status.toString(), errorData);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createOpenAIError('408', { error: { message: 'Request timeout', type: 'timeout' } });
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
    if (error instanceof OpenAIApiError) {
      return [
        OpenAIErrorCode.RATE_LIMIT_EXCEEDED,
        OpenAIErrorCode.SERVER_ERROR
      ].includes(error.code as OpenAIErrorCode);
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
   * Create OpenAI-specific API error
   */
  private createOpenAIError(statusCode: string, errorData: OpenAIErrorResponse): OpenAIApiError {
    let errorCode = OpenAIErrorCode.UNKNOWN_ERROR;
    let errorMessage = errorData.error?.message || 'Unknown OpenAI API error';

    // Map HTTP status codes to OpenAI error codes
    switch (statusCode) {
      case '401':
        errorCode = OpenAIErrorCode.INVALID_API_KEY;
        errorMessage = 'Invalid API key';
        break;
      case '403':
        errorCode = OpenAIErrorCode.PERMISSION_DENIED;
        errorMessage = 'Permission denied';
        break;
      case '429':
        errorCode = OpenAIErrorCode.RATE_LIMIT_EXCEEDED;
        errorMessage = 'Rate limit exceeded';
        break;
      case '500':
        errorCode = OpenAIErrorCode.SERVER_ERROR;
        errorMessage = 'OpenAI server error';
        break;
    }

    // Override with specific OpenAI error if provided
    if (errorData.error?.code) {
      errorCode = errorData.error.code as OpenAIErrorCode;
    }

    return new OpenAIApiError(errorCode, errorMessage, {
      statusCode,
      openAIError: errorData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get user profile from OpenAI API
   */
  async getUserProfile(apiKey: string, organization?: string): Promise<UserProfile> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    if (organization) {
      headers['OpenAI-Organization'] = organization;
    }

    const userData: OpenAIUser = await this.executeRequest(
      '/users/me',
      {
        method: 'GET',
        headers
      }
    );

    return OpenAIUtils.mapUserToProfile(userData);
  }

  /**
   * Get user subscription from OpenAI API
   */
  async getSubscription(apiKey: string, organization?: string): Promise<SubscriptionData | null> {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      if (organization) {
        headers['OpenAI-Organization'] = organization;
      }

      const subscriptionData: OpenAISubscription = await this.executeRequest(
        '/subscriptions',
        {
          method: 'GET',
          headers
        }
      );

      return OpenAIUtils.mapSubscriptionToData(subscriptionData);
    } catch (error) {
      console.error('Failed to get OpenAI subscription:', error);
      return null;
    }
  }

  /**
   * Get user subscriptions from OpenAI API
   */
  async getSubscriptions(apiKey: string, organization?: string): Promise<SubscriptionData[]> {
    const subscription = await this.getSubscription(apiKey, organization);
    return subscription ? [subscription] : [];
  }

  /**
   * Get billing history from OpenAI API
   */
  async getBillingHistory(
    apiKey: string,
    organization?: string,
    subscriptionId?: string,
    limit?: number
  ): Promise<BillingRecord[]> {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      if (organization) {
        headers['OpenAI-Organization'] = organization;
      }

      // Note: OpenAI's actual billing endpoint might be different
      // This is a placeholder implementation
      const billingData: OpenAIBillingRecord[] = await this.executeRequest(
        '/billing/history',
        {
          method: 'GET',
          headers
        }
      );

      return billingData.map(record => OpenAIUtils.mapBillingRecordToData(record));
    } catch (error) {
      console.error('Failed to get OpenAI billing history:', error);
      return [];
    }
  }

  /**
   * Validate API key with OpenAI API
   */
  async validateApiKey(apiKey: string, organization?: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      if (organization) {
        headers['OpenAI-Organization'] = organization;
      }

      await this.executeRequest(
        '/models',
        {
          method: 'GET',
          headers
        }
      );

      return true;
    } catch (error) {
      console.error('Failed to validate OpenAI API key:', error);
      return false;
    }
  }

  /**
   * Get API client configuration
   */
  getConfig(): OpenAIApiConfig {
    return { ...this.config };
  }

  /**
   * Get API client status
   */
  getStatus(): {
    config: OpenAIApiConfig;
    isHealthy: boolean;
  } {
    try {
      return {
        config: this.config,
        isHealthy: true
      };
    } catch (error) {
      return {
        config: this.config,
        isHealthy: false
      };
    }
 }
}