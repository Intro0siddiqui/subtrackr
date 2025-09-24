import { OAuthProvider } from './OAuthProvider';
import { OAuthProvider as OAuthProviderInterface } from '../../types/oauth';
import { oauthDatabase } from '../oauthDatabase';

/**
 * Centralized registry for OAuth providers
 * Manages provider configurations and instances
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, OAuthProvider> = new Map();
  private providerConfigs: Map<string, OAuthProviderInterface> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Register a provider
   */
  registerProvider(provider: OAuthProvider): void {
    this.providers.set(provider.getId(), provider);
    this.providerConfigs.set(provider.getId(), provider.getProvider());
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): OAuthProvider | null {
    return this.providers.get(id) || null;
  }

  /**
   * Get provider configuration by ID
   */
  getProviderConfig(id: string): OAuthProviderInterface | null {
    return this.providerConfigs.get(id) || null;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): OAuthProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all provider configurations
   */
  getAllProviderConfigs(): OAuthProviderInterface[] {
    return Array.from(this.providerConfigs.values());
  }

  /**
   * Get providers by category
   */
  getProvidersByCategory(category: string): OAuthProvider[] {
    return this.getAllProviders().filter(provider =>
      provider.getProvider().category === category
    );
  }

  /**
   * Check if provider is registered
   */
  isProviderRegistered(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * Get providers that support subscription sync
   */
  getSubscriptionSyncProviders(): OAuthProvider[] {
    return this.getAllProviders().filter(provider =>
      provider.supportsSubscriptionSync()
    );
  }

  /**
   * Get providers that support webhooks
   */
  getWebhookProviders(): OAuthProvider[] {
    return this.getAllProviders().filter(provider =>
      provider.supportsWebhooks()
    );
  }

  /**
   * Get providers that support real-time updates
   */
  getRealTimeProviders(): OAuthProvider[] {
    return this.getAllProviders().filter(provider =>
      provider.supportsRealTimeUpdates()
    );
  }

  /**
   * Load providers from database
   */
  async loadProvidersFromDatabase(): Promise<void> {
    try {
      const configs = await oauthDatabase.getAllProviders();

      // Clear existing providers
      this.providers.clear();
      this.providerConfigs.clear();

      // Register each provider configuration
      // Note: Actual provider instances would be created by specific implementations
      configs.forEach(config => {
        this.providerConfigs.set(config.id, config);
      });

      console.log(`Loaded ${configs.length} provider configurations from database`);
    } catch (error) {
      console.error('Failed to load providers from database:', error);
      throw error;
    }
  }

  /**
   * Initialize registry with default providers
   */
  async initialize(): Promise<void> {
    try {
      await this.loadProvidersFromDatabase();
      console.log('Provider registry initialized successfully');
    } catch (error) {
      console.error('Failed to initialize provider registry:', error);
      throw error;
    }
  }

  /**
   * Get provider statistics
   */
  getStatistics(): {
    total: number;
    byCategory: Record<string, number>;
    subscriptionSync: number;
    webhooks: number;
    realTime: number;
  } {
    const providers = this.getAllProviders();
    const byCategory: Record<string, number> = {};

    providers.forEach(provider => {
      const category = provider.getProvider().category;
      byCategory[category] = (byCategory[category] || 0) + 1;
    });

    return {
      total: providers.length,
      byCategory,
      subscriptionSync: this.getSubscriptionSyncProviders().length,
      webhooks: this.getWebhookProviders().length,
      realTime: this.getRealTimeProviders().length
    };
  }

  /**
   * Validate provider configuration
   */
  validateProviderConfig(config: OAuthProviderInterface): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.id) {
      errors.push('Provider ID is required');
    }

    if (!config.name) {
      errors.push('Provider name is required');
    }

    if (!config.displayName) {
      errors.push('Provider display name is required');
    }

    if (!config.authUrl && config.type !== 'api_key') {
      errors.push('Authorization URL is required for OAuth providers');
    }

    if (!config.tokenUrl && config.type !== 'api_key') {
      errors.push('Token URL is required for OAuth providers');
    }

    if (!config.apiBaseUrl) {
      errors.push('API base URL is required');
    }

    if (!config.scopes || config.scopes.length === 0) {
      errors.push('At least one scope is required');
    }

    if (!config.supportedFlows || config.supportedFlows.length === 0) {
      errors.push('At least one OAuth flow must be supported');
    }

    if (!config.category) {
      errors.push('Provider category is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear();
    this.providerConfigs.clear();
  }

  /**
   * Get provider IDs
   */
  getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.getAllProviders().forEach(provider => {
      categories.add(provider.getProvider().category);
    });
    return Array.from(categories);
  }
}

// Export singleton instance
export const providerRegistry = ProviderRegistry.getInstance();