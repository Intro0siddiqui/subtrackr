import {
  UserProfile,
  SubscriptionData,
  BillingRecord,
  OAuthError
} from '../../../types/oauth';
import {
  SpotifyErrorCode,
  SpotifyTokenResponse,
  SpotifyUserProfile,
  SpotifySubscriptionData,
  SpotifyBillingData,
  SpotifyApiConfig,
  RateLimitConfig,
  SpotifyApiError,
  SpotifyApiClientStatus,
  SpotifyUtils
} from './SpotifyTypes';

/**
 * Spotify API Client
 *
 * Handles all Spotify API interactions with proper error handling,
 * rate limiting, and response processing
 */
export class SpotifyApiClient {
  private config: SpotifyApiConfig;
  private rateLimitConfig: RateLimitConfig;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private rateLimitResetTime = 0;

  constructor(config: SpotifyApiConfig, rateLimitConfig?: Partial<RateLimitConfig>) {
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
        throw this.createSpotifyError(response.status.toString(), errorData);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createSpotifyError('408', { error: 'timeout', error_description: 'Request timeout' });
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
   * Create Spotify-specific API error
   */
  private createSpotifyError(statusCode: string, errorData: any): SpotifyApiError {
    let errorCode = SpotifyErrorCode.SERVER_ERROR;
    let errorMessage = 'Unknown Spotify API error';

    // Map HTTP status codes to Spotify error codes
    switch (statusCode) {
      case '400':
        errorCode = SpotifyErrorCode.INVALID_REQUEST;
        errorMessage = 'Invalid request parameters';
        break;
      case '401':
        errorCode = SpotifyErrorCode.INVALID_CLIENT;
        errorMessage = 'Invalid client credentials';
        break;
      case '403':
        errorCode = SpotifyErrorCode.ACCESS_DENIED;
        errorMessage = 'Access denied';
        break;
      case '429':
        errorCode = SpotifyErrorCode.RATE_LIMIT_EXCEEDED;
        errorMessage = 'Rate limit exceeded';
        break;
      case '500':
        errorCode = SpotifyErrorCode.SERVER_ERROR;
        errorMessage = 'Spotify server error';
        break;
      case '503':
        errorCode = SpotifyErrorCode.TEMPORARILY_UNAVAILABLE;
        errorMessage = 'Spotify service temporarily unavailable';
        break;
    }

    // Override with specific Spotify error if provided
    if (errorData.error) {
      errorCode = errorData.error;
      errorMessage = errorData.error_description || errorData.error;
    }

    return new SpotifyApiError(errorCode, errorMessage, statusCode, {
      spotifyError: errorData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get user profile from Spotify API
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const profileData: SpotifyUserProfile = await this.executeRequest(
      '/v1/me',
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
      name: profileData.display_name || profileData.id,
      avatar: profileData.images?.[0]?.url,
      metadata: {
        country: profileData.country,
        product: profileData.product,
        followers: profileData.followers?.total,
        externalUrl: profileData.external_urls.spotify,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Get user subscription from Spotify API
   */
  async getSubscription(accessToken: string): Promise<SubscriptionData | null> {
    try {
      const profileData: SpotifyUserProfile = await this.executeRequest(
        '/v1/me',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      // Spotify doesn't have a separate subscription endpoint
      // We derive subscription info from the user profile
      const isPremium = SpotifyUtils.isPremium(profileData.product);
      const amount = isPremium ? SpotifyUtils.getTierAmount(profileData.product) : 0;

      const subscriptionData: SubscriptionData = {
        id: `spotify_${profileData.id}`,
        name: SpotifyUtils.mapTier(profileData.product),
        status: isPremium ? 'active' : 'active', // Free tier is also "active"
        amount: amount,
        currency: 'USD', // Spotify typically uses USD pricing
        billingCycle: isPremium ? 'monthly' : 'none',
        nextBillingDate: isPremium ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined,
        startDate: new Date(), // We don't have exact start date from profile
        endDate: undefined,
        metadata: {
          planId: profileData.product,
          autoRenew: isPremium,
          product: profileData.product,
          country: profileData.country,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      return subscriptionData;
    } catch (error) {
      console.error('Failed to get Spotify subscription:', error);
      return null;
    }
  }

  /**
   * Get user subscriptions from Spotify API
   */
  async getSubscriptions(accessToken: string): Promise<SubscriptionData[]> {
    const subscription = await this.getSubscription(accessToken);
    return subscription ? [subscription] : [];
  }

  /**
   * Get billing history from Spotify API
   * Note: Spotify doesn't provide detailed billing history via API
   */
  async getBillingHistory(
    accessToken: string,
    subscriptionId?: string,
    limit?: number
  ): Promise<BillingRecord[]> {
    // Spotify doesn't provide billing history through their public API
    // Return empty array for now - this could be extended with web scraping
    // or if Spotify adds billing endpoints in the future
    return [];
  }

  /**
   * Validate token with Spotify API
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.executeRequest(
        '/v1/me',
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
      console.error('Failed to validate Spotify token:', error);
      return false;
    }
  }

  /**
   * Get currently playing track (for additional functionality)
   */
  async getCurrentlyPlaying(accessToken: string): Promise<any> {
    try {
      return await this.executeRequest(
        '/v1/me/player',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Failed to get currently playing track:', error);
      return null;
    }
  }

  /**
   * Get recently played tracks (for usage analytics)
   */
  async getRecentlyPlayed(accessToken: string, limit: number = 20): Promise<any> {
    try {
      return await this.executeRequest(
        `/v1/me/player/recently-played?limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Failed to get recently played tracks:', error);
      return null;
    }
  }

  /**
   * Get API client configuration
   */
  getConfig(): SpotifyApiConfig {
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
  getStatus(): SpotifyApiClientStatus {
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