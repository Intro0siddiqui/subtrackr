import { OAuthProvider } from '../OAuthProvider';
import {
  OAuthProvider as OAuthProviderInterface,
  OAuthTokens,
  UserProfile,
  SubscriptionData,
  BillingRecord,
  OAuthError,
  OAuthFlowType,
  OAuthProviderType,
  OAuthSubscription
} from '../../../types/oauth';
import { NetflixApiClient } from './NetflixApiClient';
import { NetflixDataMapper } from './NetflixDataMapper';

/**
 * Netflix OAuth Provider Configuration
 */
const NETFLIX_PROVIDER_CONFIG: OAuthProviderInterface = {
  id: 'netflix',
  name: 'netflix',
  displayName: 'Netflix',
  logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/netflix/netflix-original.svg',
  type: OAuthProviderType.OAUTH2,
  supportedFlows: [OAuthFlowType.AUTHORIZATION_CODE],
  authUrl: 'https://www.netflix.com/oauth/authorize',
  tokenUrl: 'https://api.netflix.com/oauth/token',
  apiBaseUrl: 'https://api.netflix.com',
  scopes: ['profile', 'subscription', 'billing'],
  features: {
    subscriptionSync: true,
    webhookSupport: false,
    realTimeUpdates: false
  },
  category: 'streaming',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

/**
 * Netflix-specific error codes and handling
 */
enum NetflixErrorCode {
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
interface NetflixTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface NetflixUserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  country: string;
  language: string;
  created_at: string;
  updated_at: string;
}

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
 * Netflix OAuth Provider Implementation
 *
 * Handles Netflix-specific OAuth flows, token management, and API interactions
 */
export class NetflixProvider extends OAuthProvider {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiClient: NetflixApiClient;
  private dataMapper: typeof NetflixDataMapper;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    super(NETFLIX_PROVIDER_CONFIG);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;

    // Initialize API client and data mapper
    this.apiClient = new NetflixApiClient({
      baseUrl: this.provider.apiBaseUrl
    });
    this.dataMapper = NetflixDataMapper;
  }

  /**
   * Get authorization URL for Netflix OAuth flow
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string {
    const url = new URL(this.provider.authUrl);

    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', this.provider.scopes.join(' '));

    // Add PKCE parameters if provided
    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }

    return url.toString();
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier?: string,
    redirectUri?: string
  ): Promise<OAuthTokens> {
    try {
      const tokenUrl = this.provider.tokenUrl;
      const requestBody = new URLSearchParams();

      requestBody.append('grant_type', 'authorization_code');
      requestBody.append('client_id', this.clientId);
      requestBody.append('client_secret', this.clientSecret);
      requestBody.append('code', code);
      requestBody.append('redirect_uri', redirectUri || this.redirectUri);

      // Add PKCE verifier if provided
      if (codeVerifier) {
        requestBody.append('code_verifier', codeVerifier);
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: requestBody.toString()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createNetflixError(response.status.toString(), errorData);
      }

      const tokenData: NetflixTokenResponse = await response.json();
      return this.parseTokenResponse(tokenData);

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw OAuthError
      }
      throw this.handleApiError(error);
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    try {
      const tokenUrl = this.provider.tokenUrl;
      const requestBody = new URLSearchParams();

      requestBody.append('grant_type', 'refresh_token');
      requestBody.append('client_id', this.clientId);
      requestBody.append('client_secret', this.clientSecret);
      requestBody.append('refresh_token', refreshToken);

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: requestBody.toString()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createNetflixError(response.status.toString(), errorData);
      }

      const tokenData: NetflixTokenResponse = await response.json();
      return this.parseTokenResponse(tokenData);

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw OAuthError
      }
      throw this.handleApiError(error);
    }
  }

  /**
   * Revoke tokens
   */
  async revokeTokens(accessToken: string, refreshToken?: string): Promise<boolean> {
    try {
      const revokeUrl = `${this.provider.apiBaseUrl}/oauth/revoke`;
      const requestBody = new URLSearchParams();

      requestBody.append('token', accessToken);
      requestBody.append('token_type_hint', 'access_token');

      if (refreshToken) {
        requestBody.append('refresh_token', refreshToken);
      }

      const response = await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${accessToken}`
        },
        body: requestBody.toString()
      });

      // Netflix returns 200 for successful revocation
      return response.ok;

    } catch (error) {
      console.error('Failed to revoke Netflix tokens:', error);
      return false;
    }
  }

  /**
   * Get user profile from Netflix API
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    return await this.apiClient.getUserProfile(accessToken);
  }

  /**
   * Get user subscriptions from Netflix API
   */
  async getSubscriptions(accessToken: string): Promise<SubscriptionData[]> {
    return await this.apiClient.getSubscriptions(accessToken);
  }

  /**
   * Get billing history from Netflix API
   */
  async getBillingHistory(
    accessToken: string,
    subscriptionId?: string,
    limit?: number
  ): Promise<BillingRecord[]> {
    return await this.apiClient.getBillingHistory(accessToken, subscriptionId, limit);
  }

  /**
   * Validate token with Netflix API
   */
  async validateToken(accessToken: string): Promise<boolean> {
    return await this.apiClient.validateToken(accessToken);
  }

  /**
   * Get user subscriptions with data mapping to internal format
   */
  async getMappedSubscriptions(accessToken: string): Promise<OAuthSubscription[]> {
    try {
      const subscriptions = await this.apiClient.getSubscriptions(accessToken);
      const userProfile = await this.apiClient.getUserProfile(accessToken);

      return this.dataMapper.mapMultipleSubscriptions(subscriptions as any, {
        id: userProfile.id,
        email: userProfile.email || '',
        name: userProfile.name || '',
        avatar: userProfile.avatar,
        country: userProfile.metadata?.country || '',
        language: userProfile.metadata?.language || '',
        created_at: userProfile.metadata?.createdAt || '',
        updated_at: userProfile.metadata?.updatedAt || ''
      });

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw OAuthError
      }
      throw this.handleApiError(error);
    }
  }

  /**
   * Get single subscription with data mapping to internal format
   */
  async getMappedSubscription(accessToken: string, subscriptionId: string): Promise<OAuthSubscription | null> {
    try {
      const subscriptions = await this.apiClient.getSubscriptions(accessToken);
      const userProfile = await this.apiClient.getUserProfile(accessToken);

      const subscription = subscriptions.find(sub => sub.id === subscriptionId);
      if (!subscription) {
        return null;
      }

      return this.dataMapper.mapToInternalSubscription(subscription as any, {
        id: userProfile.id,
        email: userProfile.email || '',
        name: userProfile.name || '',
        avatar: userProfile.avatar,
        country: userProfile.metadata?.country || '',
        language: userProfile.metadata?.language || '',
        created_at: userProfile.metadata?.createdAt || '',
        updated_at: userProfile.metadata?.updatedAt || ''
      });

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw OAuthError
      }
      throw this.handleApiError(error);
    }
  }

  /**
   * Sync Netflix subscription data to internal format
   */
  async syncSubscriptionData(accessToken: string): Promise<{
    subscriptions: OAuthSubscription[];
    billingRecords: BillingRecord[];
    success: boolean;
    errors: string[];
  }> {
    const result = {
      subscriptions: [] as OAuthSubscription[],
      billingRecords: [] as BillingRecord[],
      success: true,
      errors: [] as string[]
    };

    try {
      // Get subscriptions and user profile
      const subscriptions = await this.apiClient.getSubscriptions(accessToken);
      const userProfile = await this.apiClient.getUserProfile(accessToken);

      // Map subscriptions to internal format
      result.subscriptions = this.dataMapper.mapMultipleSubscriptions(subscriptions as any, {
        id: userProfile.id,
        email: userProfile.email || '',
        name: userProfile.name || '',
        avatar: userProfile.avatar,
        country: userProfile.metadata?.country || '',
        language: userProfile.metadata?.language || '',
        created_at: userProfile.metadata?.createdAt || '',
        updated_at: userProfile.metadata?.updatedAt || ''
      });

      // Get billing history for all subscriptions
      const subscriptionMap = new Map<string, string>();
      result.subscriptions.forEach(sub => {
        if (sub.externalId) {
          subscriptionMap.set(sub.externalId, sub.id);
        }
      });

      // Get billing records for each subscription
      for (const subscription of result.subscriptions) {
        try {
          const billingRecords = await this.apiClient.getBillingHistory(
            accessToken,
            subscription.externalId,
            50 // Limit to last 50 records
          );

          const mappedBilling = this.dataMapper.mapToInternalBilling(
            billingRecords.map(record => ({
              id: record.id,
              subscription_id: record.subscriptionId,
              amount: record.amount,
              currency: record.currency,
              date: record.date.toISOString(),
              description: record.description || '',
              payment_method: record.metadata?.paymentMethod || 'credit_card',
              status: record.metadata?.status || 'completed',
              created_at: record.metadata?.createdAt || ''
            })),
            subscriptionMap
          );

          result.billingRecords.push(...mappedBilling);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to get billing history for subscription ${subscription.id}: ${errorMessage}`);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to sync Netflix data: ${errorMessage}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Get API client instance for advanced usage
   */
  getApiClient(): NetflixApiClient {
    return this.apiClient;
  }

  /**
   * Get data mapper class for custom transformations
   */
  getDataMapper(): typeof NetflixDataMapper {
    return this.dataMapper;
  }

  /**
   * Create Netflix-specific OAuth error
   */
  private createNetflixError(statusCode: string, errorData: any): OAuthError {
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

    return this.createError(errorCode, errorMessage, {
      statusCode,
      netflixError: errorData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Parse Netflix token response
   */
  protected parseTokenResponse(tokenData: NetflixTokenResponse): OAuthTokens {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      tokenType: tokenData.token_type || 'Bearer',
      scope: tokenData.scope || this.provider.scopes.join(' ')
    };
  }

  /**
   * Get Netflix-specific configuration
   */
  getConfig(): {
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
  } {
    return {
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      scopes: this.provider.scopes,
      endpoints: {
        auth: this.provider.authUrl,
        token: this.provider.tokenUrl,
        api: this.provider.apiBaseUrl
      },
      apiClient: {
        baseUrl: this.apiClient.getConfig().baseUrl,
        timeout: this.apiClient.getConfig().timeout || 30000,
        maxRetries: this.apiClient.getConfig().maxRetries || 3,
        retryDelay: this.apiClient.getConfig().retryDelay || 1000
      },
      rateLimit: {
        requestsPerSecond: 5,
        requestsPerMinute: 100,
        burstLimit: 10
      }
    };
  }

  /**
   * Check if the provider supports a specific scope
   */
  supportsScope(scope: string): boolean {
    return this.provider.scopes.includes(scope);
  }

  /**
   * Get supported Netflix API versions
   */
  getSupportedApiVersions(): string[] {
    return ['v1'];
  }

  /**
   * Update API client configuration
   */
  updateApiClientConfig(config: {
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    rateLimit?: {
      requestsPerSecond?: number;
      requestsPerMinute?: number;
      burstLimit?: number;
    };
  }): void {
    if (config.timeout || config.maxRetries || config.retryDelay) {
      // Note: This would require extending NetflixApiClient to support runtime config updates
      console.warn('API client configuration updates not yet implemented');
    }

    if (config.rateLimit) {
      this.apiClient.updateRateLimitConfig(config.rateLimit);
    }
  }

  /**
   * Get current API client status
   */
  getApiClientStatus(): {
    config: any;
    rateLimitStatus: any;
    isHealthy: boolean;
  } {
    try {
      return {
        config: this.apiClient.getConfig(),
        rateLimitStatus: this.apiClient.getRateLimitStatus(),
        isHealthy: true
      };
    } catch (error) {
      return {
        config: null,
        rateLimitStatus: null,
        isHealthy: false
      };
    }
  }
}