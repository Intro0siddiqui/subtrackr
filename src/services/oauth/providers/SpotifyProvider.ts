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
import { SpotifyApiClient } from './SpotifyApiClient';
import { SpotifyDataMapper } from './SpotifyDataMapper';
import {
  SpotifyErrorCode,
  SpotifyTokenResponse,
  SpotifyUserData,
  SpotifySyncResult,
  SpotifyProviderConfig
} from './SpotifyTypes';

/**
 * Spotify OAuth Provider Configuration
 */
const SPOTIFY_PROVIDER_CONFIG: OAuthProviderInterface = {
  id: 'spotify',
  name: 'spotify',
  displayName: 'Spotify',
  logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/spotify/spotify-original.svg',
  type: OAuthProviderType.OAUTH2,
  supportedFlows: [OAuthFlowType.AUTHORIZATION_CODE],
  authUrl: 'https://accounts.spotify.com/authorize',
  tokenUrl: 'https://accounts.spotify.com/api/token',
  apiBaseUrl: 'https://api.spotify.com',
  scopes: ['user-read-private', 'user-read-email', 'user-read-playback-state'],
  features: {
    subscriptionSync: true,
    webhookSupport: false,
    realTimeUpdates: false
  },
  category: 'music',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

/**
 * Spotify-specific error codes and handling
 */
enum SpotifyErrorCodeEnum {
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
 * Spotify OAuth Provider Implementation
 *
 * Handles Spotify-specific OAuth flows, token management, and API interactions
 */
export class SpotifyProvider extends OAuthProvider {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiClient: SpotifyApiClient;
  private dataMapper: typeof SpotifyDataMapper;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    super(SPOTIFY_PROVIDER_CONFIG);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;

    // Initialize API client and data mapper
    this.apiClient = new SpotifyApiClient({
      baseUrl: this.provider.apiBaseUrl
    });
    this.dataMapper = SpotifyDataMapper;
  }

  /**
   * Get authorization URL for Spotify OAuth flow
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
        throw this.createSpotifyError(response.status.toString(), errorData);
      }

      const tokenData: SpotifyTokenResponse = await response.json();
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
        throw this.createSpotifyError(response.status.toString(), errorData);
      }

      const tokenData: SpotifyTokenResponse = await response.json();
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
      // Spotify doesn't have a token revocation endpoint in their public API
      // We'll return true for now as there's no way to revoke tokens
      console.warn('Spotify does not support token revocation via public API');
      return true;

    } catch (error) {
      console.error('Failed to revoke Spotify tokens:', error);
      return false;
    }
  }

  /**
   * Get user profile from Spotify API
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    return await this.apiClient.getUserProfile(accessToken);
  }

  /**
   * Get user subscriptions from Spotify API
   */
  async getSubscriptions(accessToken: string): Promise<SubscriptionData[]> {
    return await this.apiClient.getSubscriptions(accessToken);
  }

  /**
   * Get billing history from Spotify API
   */
  async getBillingHistory(
    accessToken: string,
    subscriptionId?: string,
    limit?: number
  ): Promise<BillingRecord[]> {
    return await this.apiClient.getBillingHistory(accessToken, subscriptionId, limit);
  }

  /**
   * Validate token with Spotify API
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
        display_name: userProfile.metadata?.display_name || '',
        country: userProfile.metadata?.country || '',
        product: userProfile.metadata?.product || 'free',
        images: userProfile.metadata?.images,
        followers: userProfile.metadata?.followers,
        external_urls: userProfile.metadata?.external_urls
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
        display_name: userProfile.metadata?.display_name || '',
        country: userProfile.metadata?.country || '',
        product: userProfile.metadata?.product || 'free',
        images: userProfile.metadata?.images,
        followers: userProfile.metadata?.followers,
        external_urls: userProfile.metadata?.external_urls
      });

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw OAuthError
      }
      throw this.handleApiError(error);
    }
  }

  /**
   * Sync Spotify subscription data to internal format
   */
  async syncSubscriptionData(accessToken: string): Promise<SpotifySyncResult> {
    const result: SpotifySyncResult = {
      subscriptions: [],
      billingRecords: [],
      success: true,
      errors: []
    };

    try {
      // Get subscriptions and user profile
      const subscriptions = await this.apiClient.getSubscriptions(accessToken);
      const userProfile = await this.apiClient.getUserProfile(accessToken);

      // Map subscriptions to internal format
      result.subscriptions = this.dataMapper.mapMultipleSubscriptions(subscriptions as any, {
        id: userProfile.id,
        email: userProfile.email || '',
        display_name: userProfile.metadata?.display_name || '',
        country: userProfile.metadata?.country || '',
        product: userProfile.metadata?.product || 'free',
        images: userProfile.metadata?.images,
        followers: userProfile.metadata?.followers,
        external_urls: userProfile.metadata?.external_urls
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
      result.errors.push(`Failed to sync Spotify data: ${errorMessage}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Get API client instance for advanced usage
   */
  getApiClient(): SpotifyApiClient {
    return this.apiClient;
  }

  /**
   * Get data mapper class for custom transformations
   */
  getDataMapper(): typeof SpotifyDataMapper {
    return this.dataMapper;
  }

  /**
   * Create Spotify-specific OAuth error
   */
  private createSpotifyError(statusCode: string, errorData: any): OAuthError {
    let errorCode = SpotifyErrorCodeEnum.SERVER_ERROR;
    let errorMessage = 'Unknown Spotify API error';

    // Map HTTP status codes to Spotify error codes
    switch (statusCode) {
      case '400':
        errorCode = SpotifyErrorCodeEnum.INVALID_REQUEST;
        errorMessage = 'Invalid request parameters';
        break;
      case '401':
        errorCode = SpotifyErrorCodeEnum.INVALID_CLIENT;
        errorMessage = 'Invalid client credentials';
        break;
      case '403':
        errorCode = SpotifyErrorCodeEnum.ACCESS_DENIED;
        errorMessage = 'Access denied';
        break;
      case '429':
        errorCode = SpotifyErrorCodeEnum.RATE_LIMIT_EXCEEDED;
        errorMessage = 'Rate limit exceeded';
        break;
      case '500':
        errorCode = SpotifyErrorCodeEnum.SERVER_ERROR;
        errorMessage = 'Spotify server error';
        break;
      case '503':
        errorCode = SpotifyErrorCodeEnum.TEMPORARILY_UNAVAILABLE;
        errorMessage = 'Spotify service temporarily unavailable';
        break;
    }

    // Override with specific Spotify error if provided
    if (errorData.error) {
      errorCode = errorData.error;
      errorMessage = errorData.error_description || errorData.error;
    }

    return this.createError(errorCode, errorMessage, {
      statusCode,
      spotifyError: errorData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Parse Spotify token response
   */
  protected parseTokenResponse(tokenData: SpotifyTokenResponse): OAuthTokens {
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
   * Get Spotify-specific configuration
   */
  getConfig(): SpotifyProviderConfig {
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
   * Get supported Spotify API versions
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
      // Note: This would require extending SpotifyApiClient to support runtime config updates
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

  /**
   * Get currently playing track (Spotify-specific feature)
   */
  async getCurrentlyPlaying(accessToken: string): Promise<any> {
    return await this.apiClient.getCurrentlyPlaying(accessToken);
  }

  /**
   * Get recently played tracks (Spotify-specific feature)
   */
  async getRecentlyPlayed(accessToken: string, limit: number = 20): Promise<any> {
    return await this.apiClient.getRecentlyPlayed(accessToken, limit);
  }
}