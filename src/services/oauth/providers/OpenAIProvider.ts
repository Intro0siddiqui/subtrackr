/**
 * OpenAI OAuth Provider
 *
 * Handles OpenAI API key authentication and subscription data synchronization
 */

import { OAuthProvider } from '../OAuthProvider';
import {
  OAuthTokens,
  UserProfile,
  SubscriptionData,
  BillingRecord,
  OAuthError,
  OAuthProviderType,
  OAuthSubscription
} from '../../../types/oauth';

import { OpenAIApiClient } from './OpenAIApiClient';
import { OpenAIDataMapper } from './OpenAIDataMapper';
import { OPENAI_PROVIDER_CONFIG, OpenAIApiConfig, OpenAIUtils } from './OpenAITypes';

/**
 * OpenAI OAuth Provider Implementation
 *
 * Handles OpenAI API key authentication and subscription data synchronization
 */
export class OpenAIProvider extends OAuthProvider {
  private apiKey: string;
  private organization?: string;
  private apiClient: OpenAIApiClient;
  private dataMapper: typeof OpenAIDataMapper;

  constructor(apiKey: string, organization?: string) {
    super(OPENAI_PROVIDER_CONFIG);
    this.apiKey = apiKey;
    this.organization = organization;

    // Initialize API client and data mapper
    this.apiClient = new OpenAIApiClient({
      baseUrl: this.provider.apiBaseUrl,
      apiKey: this.apiKey,
      organization: this.organization
    });
    this.dataMapper = OpenAIDataMapper;
  }

  /**
   * Get authorization URL - Not applicable for API key authentication
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string {
    // OpenAI uses API key authentication, not OAuth flow
    throw new Error('OpenAI uses API key authentication, not OAuth flow');
  }

  /**
   * Exchange authorization code for tokens - Not applicable for API key authentication
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier?: string,
    redirectUri?: string
  ): Promise<OAuthTokens> {
    // OpenAI uses API key authentication, not OAuth flow
    throw new Error('OpenAI uses API key authentication, not OAuth flow');
  }

  /**
   * Refresh access token - Not applicable for API key authentication
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    // OpenAI uses API key authentication, not OAuth flow
    throw new Error('OpenAI uses API key authentication, not OAuth flow');
  }

  /**
   * Revoke tokens - Not applicable for API key authentication
   */
  async revokeTokens(accessToken: string, refreshToken?: string): Promise<boolean> {
    // OpenAI uses API key authentication, not OAuth flow
    // To "revoke" an API key, the user must do so in their OpenAI dashboard
    console.warn('OpenAI API keys must be revoked manually in the OpenAI dashboard');
    return true;
  }

  /**
   * Get user profile from OpenAI API
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    return await this.apiClient.getUserProfile(this.apiKey, this.organization);
  }

  /**
   * Get user subscriptions from OpenAI API
   */
  async getSubscriptions(accessToken: string): Promise<SubscriptionData[]> {
    return await this.apiClient.getSubscriptions(this.apiKey, this.organization);
  }

  /**
   * Get billing history from OpenAI API
   */
  async getBillingHistory(
    accessToken: string,
    subscriptionId?: string,
    limit?: number
  ): Promise<BillingRecord[]> {
    return await this.apiClient.getBillingHistory(
      this.apiKey,
      this.organization,
      subscriptionId,
      limit
    );
  }

  /**
   * Validate API key with OpenAI API
   */
  async validateToken(accessToken: string): Promise<boolean> {
    return await this.apiClient.validateApiKey(this.apiKey, this.organization);
  }

  /**
   * Get user subscriptions with data mapping to internal format
   */
  async getMappedSubscriptions(accessToken: string): Promise<OAuthSubscription[]> {
    try {
      const subscriptions = await this.apiClient.getSubscriptions(this.apiKey, this.organization);
      const userProfile = await this.apiClient.getUserProfile(this.apiKey, this.organization);

      return this.dataMapper.mapMultipleSubscriptions(subscriptions, {
        id: userProfile.id,
        email: userProfile.email || '',
        name: userProfile.name || '',
        avatar: userProfile.avatar,
        metadata: userProfile.metadata
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
      const subscriptions = await this.apiClient.getSubscriptions(this.apiKey, this.organization);
      const userProfile = await this.apiClient.getUserProfile(this.apiKey, this.organization);

      const subscription = subscriptions.find(sub => sub.id === subscriptionId);
      if (!subscription) {
        return null;
      }

      return this.dataMapper.mapToInternalSubscription(subscription, {
        id: userProfile.id,
        email: userProfile.email || '',
        name: userProfile.name || '',
        avatar: userProfile.avatar,
        metadata: userProfile.metadata
      });

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw OAuthError
      }
      throw this.handleApiError(error);
    }
  }

  /**
   * Sync OpenAI subscription data to internal format
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
      const subscriptions = await this.apiClient.getSubscriptions(this.apiKey, this.organization);
      const userProfile = await this.apiClient.getUserProfile(this.apiKey, this.organization);

      // Map subscriptions to internal format
      result.subscriptions = this.dataMapper.mapMultipleSubscriptions(subscriptions, {
        id: userProfile.id,
        email: userProfile.email || '',
        name: userProfile.name || '',
        avatar: userProfile.avatar,
        metadata: userProfile.metadata
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
            this.apiKey,
            this.organization,
            subscription.externalId,
            50 // Limit to last 50 records
          );

          const mappedBilling = this.dataMapper.mapToInternalBilling(
            billingRecords.map(record => ({
              id: record.id,
              subscriptionId: record.subscriptionId,
              amount: record.amount,
              currency: record.currency,
              date: record.date,
              description: record.description || '',
              metadata: record.metadata
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
      result.errors.push(`Failed to sync OpenAI data: ${errorMessage}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Get API client instance for advanced usage
   */
  getApiClient(): OpenAIApiClient {
    return this.apiClient;
  }

  /**
   * Get data mapper class for custom transformations
   */
  getDataMapper(): typeof OpenAIDataMapper {
    return this.dataMapper;
  }

  /**
   * Validate API key format
   */
  validateApiKeyFormat(apiKey: string): boolean {
    return OpenAIUtils.isValidApiKey(apiKey);
 }

  /**
   * Get OpenAI-specific configuration
   */
  getConfig(): {
    apiKey: string;
    organization?: string;
    apiClient: OpenAIApiConfig;
  } {
    return {
      apiKey: this.apiKey,
      organization: this.organization,
      apiClient: this.apiClient.getConfig()
    };
  }

  /**
   * Check if the provider supports a specific scope
   */
  supportsScope(scope: string): boolean {
    return this.provider.scopes.includes(scope);
  }

  /**
   * Get supported OpenAI API versions
   */
  getSupportedApiVersions(): string[] {
    return ['v1'];
  }

  /**
   * Get current API client status
   */
  getApiClientStatus(): {
    config: any;
    isHealthy: boolean;
  } {
    try {
      return {
        config: this.apiClient.getConfig(),
        isHealthy: true
      };
    } catch (error) {
      return {
        config: null,
        isHealthy: false
      };
    }
  }
}