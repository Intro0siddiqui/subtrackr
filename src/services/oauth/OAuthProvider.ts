import {
  OAuthProvider as OAuthProviderInterface,
  OAuthTokens,
  SubscriptionData,
  UserProfile,
  BillingRecord,
  OAuthError,
  SyncResult
} from '../../types/oauth';

/**
 * Abstract base class for all OAuth providers
 * Provides common functionality and enforces interface compliance
 */
export abstract class OAuthProvider {
  protected provider: OAuthProviderInterface;

  constructor(provider: OAuthProviderInterface) {
    this.provider = provider;
  }

  /**
   * Get provider configuration
   */
  getProvider(): OAuthProviderInterface {
    return this.provider;
  }

  /**
   * Get provider ID
   */
  getId(): string {
    return this.provider.id;
  }

  /**
   * Get provider display name
   */
  getDisplayName(): string {
    return this.provider.displayName;
  }

  /**
   * Check if provider supports subscription sync
   */
  supportsSubscriptionSync(): boolean {
    return this.provider.features.subscriptionSync;
  }

  /**
   * Check if provider supports webhooks
   */
  supportsWebhooks(): boolean {
    return this.provider.features.webhookSupport;
  }

  /**
   * Check if provider supports real-time updates
   */
  supportsRealTimeUpdates(): boolean {
    return this.provider.features.realTimeUpdates;
  }

  /**
   * Get authorization URL for OAuth flow
   */
  abstract getAuthorizationUrl(state: string, codeChallenge?: string): string;

  /**
   * Exchange authorization code for tokens
   */
  abstract exchangeCodeForTokens(
    code: string,
    codeVerifier?: string,
    redirectUri?: string
  ): Promise<OAuthTokens>;

  /**
   * Refresh access token
   */
  abstract refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;

  /**
   * Revoke tokens
   */
  abstract revokeTokens(accessToken: string, refreshToken?: string): Promise<boolean>;

  /**
   * Get user profile
   */
  abstract getUserProfile(accessToken: string): Promise<UserProfile>;

  /**
   * Get subscriptions
   */
  abstract getSubscriptions(accessToken: string): Promise<SubscriptionData[]>;

  /**
   * Get billing history
   */
  abstract getBillingHistory(
    accessToken: string,
    subscriptionId?: string,
    limit?: number
  ): Promise<BillingRecord[]>;

  /**
   * Validate token
   */
  abstract validateToken(accessToken: string): Promise<boolean>;

  /**
   * Get API base URL
   */
  getApiBaseUrl(): string {
    return this.provider.apiBaseUrl;
  }

  /**
   * Get required scopes
   */
  getScopes(): string[] {
    return this.provider.scopes;
  }

  /**
   * Get supported OAuth flows
   */
  getSupportedFlows(): string[] {
    return this.provider.supportedFlows.map(flow => flow.toString());
  }

  /**
   * Create OAuth error
   */
  protected createError(
    code: string,
    message: string,
    details?: Record<string, any>
  ): OAuthError {
    return {
      code,
      message,
      provider: this.provider.id,
      details
    };
  }

  /**
   * Handle API errors
   */
  protected handleApiError(error: any): OAuthError {
    const errorCode = error.response?.status?.toString() || 'UNKNOWN_ERROR';
    const errorMessage = error.response?.data?.error_description ||
                        error.response?.data?.error ||
                        error.message ||
                        'Unknown API error';

    return this.createError(errorCode, errorMessage, {
      status: error.response?.status,
      data: error.response?.data,
      originalError: error.message
    });
  }

  /**
   * Validate required scopes
   */
  protected validateScopes(grantedScopes: string[]): boolean {
    const requiredScopes = this.provider.scopes;
    return requiredScopes.every(scope => grantedScopes.includes(scope));
  }

  /**
   * Parse token response
   */
  protected parseTokenResponse(response: any): OAuthTokens {
    const expiresAt = response.expires_in
      ? new Date(Date.now() + (response.expires_in * 1000))
      : undefined;

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt,
      tokenType: response.token_type || 'Bearer',
      scope: response.scope || ''
    };
  }

  /**
   * Check if token is expired
   */
  protected isTokenExpired(expiresAt?: Date): boolean {
    if (!expiresAt) return false;
    return expiresAt <= new Date();
  }

  /**
   * Get token expiration buffer (5 minutes)
   */
  protected getExpirationBuffer(): number {
    return 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Check if token needs refresh
   */
  protected shouldRefreshToken(expiresAt?: Date): boolean {
    if (!expiresAt) return false;
    const buffer = this.getExpirationBuffer();
    return expiresAt.getTime() - Date.now() <= buffer;
  }
}