/**
 * OAuth Service Layer - Main Entry Point
 *
 * This module provides a complete OAuth service layer foundation with:
 * - Provider abstraction and registry
 * - Secure token management with encryption
 * - PKCE-enabled OAuth flows
 * - Dynamic HTTP client factory
 * - Comprehensive error handling and retry logic
 *
 * @example
 * ```typescript
 * import { oauthService, providerRegistry, tokenManager } from '@/services/oauth';
 *
 * // Initialize the service
 * await oauthService.initialize();
 *
 * // Get a provider
 * const provider = providerRegistry.getProvider('netflix');
 *
 * // Start OAuth flow
 * const authUrl = await oauthFlow.initiateFlow(provider, userId, redirectUri);
 * ```
 */

// Core Components
export { OAuthProvider } from './OAuthProvider';
export { ProviderRegistry, providerRegistry } from './ProviderRegistry';
export { TokenManager, tokenManager } from './TokenManager';
export { OAuthFlow, oauthFlow } from './OAuthFlow';
export { ApiClient, apiClient } from './ApiClient';
export { ErrorHandler, errorHandler } from './ErrorHandler';

// Import required types and instances
import { OAuthProvider } from './OAuthProvider';
import { providerRegistry } from './ProviderRegistry';
import { tokenManager } from './TokenManager';
import { oauthFlow } from './OAuthFlow';
import { apiClient } from './ApiClient';
import { errorHandler } from './ErrorHandler';
import { oauthDatabase } from '../oauthDatabase';

// Import Netflix provider
import { createNetflixProvider } from './providers';
import { netflixConfig } from '../../config/oauthProviders';

// Import Spotify provider
import { createSpotifyProvider } from './providers';
import { spotifyConfig } from '../../config/oauthProviders';

// Import Amazon provider
import { createAmazonProvider } from './providers';
import { amazonConfig } from '../../config/oauthProviders';

// Import types from oauth types
import {
  OAuthTokens,
  OAuthConnection,
  OAuthError,
  SyncError,
  SyncType
} from '../../types/oauth';

// Local type definitions
interface AuthorizationUrlResult {
  url: string;
  state: string;
  codeVerifier?: string;
}

interface ErrorHandlingResult {
  shouldRetry: boolean;
  retryAfter?: number;
  newError?: OAuthError;
  severity: string;
  category: string;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  success: boolean;
}

interface ExtendedRequestConfig {
  requiresAuth?: boolean;
  userId?: string;
  providerId?: string;
  [key: string]: any;
}

// Enums and Types
export { ErrorSeverity, ErrorCategory } from './ErrorHandler';
export { OAuthFlowType } from './OAuthFlow';

// Main Service Class
export class OAuthService {
  private static instance: OAuthService;
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  /**
   * Initialize the OAuth service layer
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('OAuth service already initialized');
      return;
    }

    try {
      console.log('Initializing OAuth service layer...');

      // Initialize provider registry
      await providerRegistry.initialize();

      // Initialize token manager
      await tokenManager.cleanupExpiredTokens();

      // Initialize error handler
      // Error handler is already initialized as singleton

      // Register Netflix provider
      try {
        const netflixProvider = createNetflixProvider(
          netflixConfig.clientId,
          netflixConfig.clientSecret,
          netflixConfig.redirectUri
        );
        this.registerProvider(netflixProvider);
        console.log('✅ Netflix provider registered successfully');
      } catch (error) {
        console.warn('⚠️ Failed to register Netflix provider:', error);
      }

      // Register Spotify provider
      try {
        const spotifyProvider = createSpotifyProvider(
          spotifyConfig.clientId,
          spotifyConfig.clientSecret,
          spotifyConfig.redirectUri
        );
        this.registerProvider(spotifyProvider);
        console.log('✅ Spotify provider registered successfully');
      } catch (error) {
        console.warn('⚠️ Failed to register Spotify provider:', error);
      }

      // Register Amazon provider
      try {
        const amazonProvider = createAmazonProvider(
          amazonConfig.clientId,
          amazonConfig.clientSecret,
          amazonConfig.redirectUri
        );
        this.registerProvider(amazonProvider);
        console.log('✅ Amazon provider registered successfully');
      } catch (error) {
        console.warn('⚠️ Failed to register Amazon provider:', error);
      }

      this.initialized = true;
      console.log('✅ OAuth service layer initialized successfully');

      // Log service statistics
      const stats = providerRegistry.getStatistics();
      console.log('📊 Provider Statistics:', stats);

    } catch (error) {
      console.error('❌ Failed to initialize OAuth service layer:', error);
      throw error;
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    providerCount: number;
    providers: string[];
    categories: string[];
  } {
    return {
      initialized: this.initialized,
      providerCount: providerRegistry.getProviderIds().length,
      providers: providerRegistry.getProviderIds(),
      categories: providerRegistry.getCategories()
    };
  }

  /**
   * Register a new provider
   */
  registerProvider(provider: OAuthProvider): void {
    providerRegistry.registerProvider(provider);
    console.log(`✅ Registered provider: ${provider.getDisplayName()}`);
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): OAuthProvider | null {
    return providerRegistry.getProvider(id);
  }

  /**
   * Get all providers
   */
  getAllProviders(): OAuthProvider[] {
    return providerRegistry.getAllProviders();
  }

  /**
   * Get providers by category
   */
  getProvidersByCategory(category: string): OAuthProvider[] {
    return providerRegistry.getProvidersByCategory(category);
  }

  /**
   * Get subscription sync providers
   */
  getSubscriptionSyncProviders(): OAuthProvider[] {
    return providerRegistry.getSubscriptionSyncProviders();
  }

  /**
   * Create OAuth connection for user
   */
  async createConnection(
    userId: string,
    providerId: string,
    tokens: OAuthTokens
  ): Promise<OAuthConnection> {
    return await tokenManager.storeTokens(userId, providerId, tokens);
  }

  /**
   * Get user connections
   */
  async getUserConnections(userId: string): Promise<OAuthConnection[]> {
    return await tokenManager.getUserConnections(userId);
  }

  /**
   * Check if user has active connection
   */
  async hasActiveConnection(userId: string, providerId: string): Promise<boolean> {
    return await tokenManager.hasActiveConnection(userId, providerId);
  }

  /**
   * Revoke user connection
   */
  async revokeConnection(userId: string, providerId: string): Promise<boolean> {
    return await tokenManager.revokeTokens(userId, providerId);
  }

  /**
   * Get valid tokens for user and provider
   */
  async getValidTokens(userId: string, providerId: string): Promise<OAuthTokens | null> {
    return await tokenManager.getValidTokens(userId, providerId);
  }

  /**
   * Initiate OAuth flow
   */
  async initiateOAuthFlow(
    providerId: string,
    userId: string,
    redirectUri: string,
    options: {
      scopes?: string[];
      usePKCE?: boolean;
      customState?: string;
    } = {}
  ): Promise<AuthorizationUrlResult> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return await oauthFlow.initiateFlow(provider, userId, redirectUri, options);
  }

  /**
   * Complete OAuth flow
   */
  async completeOAuthFlow(
    providerId: string,
    userId: string,
    callbackUrl: string,
    expectedState: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return await oauthFlow.completeFlow(provider, userId, callbackUrl, expectedState, codeVerifier);
  }

  /**
   * Handle OAuth error
   */
  handleError(
    error: OAuthError | Error,
    context?: {
      providerId?: string;
      userId?: string;
      connectionId?: string;
      operation?: string;
      retryCount?: number;
    }
  ): ErrorHandlingResult {
    return errorHandler.handleError(error, context);
  }

  /**
   * Handle sync error
   */
  handleSyncError(
    error: SyncError | Error,
    context: {
      syncType: SyncType;
      connectionId: string;
      providerId: string;
      userId: string;
      recordsAffected?: number;
    }
  ): ErrorHandlingResult {
    return errorHandler.handleSyncError(error, context);
  }

  /**
   * Get error recovery suggestions
   */
  getErrorRecoverySuggestions(error: OAuthError): string[] {
    return errorHandler.getRecoverySuggestions(error);
  }

  /**
   * Make API request
   */
  async makeApiRequest<T = any>(
    providerId: string,
    config: ExtendedRequestConfig
  ): Promise<ApiResponse<T>> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return await apiClient.request<T>(provider, config);
  }

  /**
   * Make GET request
   */
  async get<T = any>(
    providerId: string,
    url: string,
    config: ExtendedRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return await apiClient.get<T>(provider, url, config);
  }

  /**
   * Make POST request
   */
  async post<T = any>(
    providerId: string,
    url: string,
    data?: any,
    config: ExtendedRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return await apiClient.post<T>(provider, url, data, config);
  }

  /**
   * Make PUT request
   */
  async put<T = any>(
    providerId: string,
    url: string,
    data?: any,
    config: ExtendedRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return await apiClient.put<T>(provider, url, data, config);
  }

  /**
   * Make PATCH request
   */
  async patch<T = any>(
    providerId: string,
    url: string,
    data?: any,
    config: ExtendedRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return await apiClient.patch<T>(provider, url, data, config);
  }

  /**
   * Make DELETE request
   */
  async delete<T = any>(
    providerId: string,
    url: string,
    config: ExtendedRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return await apiClient.delete<T>(provider, url, config);
  }

  /**
   * Cleanup expired tokens
   */
  async cleanup(): Promise<number> {
    return await tokenManager.cleanupExpiredTokens();
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    apiClient.clearCache();
    console.log('Cleared OAuth service caches');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      database: boolean;
      providers: boolean;
      tokens: boolean;
    };
    details?: string;
  }> {
    const checks = {
      database: false,
      providers: false,
      tokens: false
    };

    try {
      // Check database connectivity
      await oauthDatabase.getAllProviders();
      checks.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Check providers
    try {
      const providers = providerRegistry.getAllProviders();
      checks.providers = providers.length > 0;
    } catch (error) {
      console.error('Providers health check failed:', error);
    }

    // Check token manager
    try {
      await tokenManager.cleanupExpiredTokens();
      checks.tokens = true;
    } catch (error) {
      console.error('Token manager health check failed:', error);
    }

    const allHealthy = Object.values(checks).every(check => check);
    const anyHealthy = Object.values(checks).some(check => check);

    return {
      status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
      checks,
      details: !allHealthy ? 'Some components are not functioning properly' : undefined
    };
  }
}

// Re-export types for convenience
export type {
  OAuthProvider as OAuthProviderInterface,
  OAuthTokens,
  OAuthConnection,
  OAuthConnectionStatus,
  SubscriptionData,
  UserProfile,
  BillingRecord,
  SyncResult,
  SyncStatusInfo,
  OAuthError,
  SyncError,
  PKCEPair
} from '../../types/oauth';

// Export local types
export type {
  AuthorizationUrlResult,
  ErrorHandlingResult,
  ApiResponse,
  ExtendedRequestConfig
};

// Export singleton instance
export const oauthService = OAuthService.getInstance();

// Default export
export default oauthService;