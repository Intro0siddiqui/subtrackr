import { ErrorCategory } from './ErrorHandler';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableCategories: ErrorCategory[];
}

/**
 * Retry state
 */
export interface RetryState {
  attempt: number;
  lastAttemptTime: Date;
  totalDelay: number;
}

/**
 * Manage retry logic with exponential backoff
 */
export class RetryManager {
  private static instance: RetryManager;
  private retryConfigs: Map<string, RetryConfig> = new Map();
  private retryStates: Map<string, RetryState> = new Map();

  private constructor() {
    this.initializeDefaultRetryConfigs();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager();
    }
    return RetryManager.instance;
  }

  /**
   * Initialize default retry configurations
   */
  private initializeDefaultRetryConfigs(): void {
    const defaultConfig: RetryConfig = {
      maxRetries: 3,
      baseDelay: 100, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      retryableCategories: [
        ErrorCategory.NETWORK,
        ErrorCategory.PROVIDER_ERROR,
        ErrorCategory.RATE_LIMIT
      ]
    };

    // Service-specific configurations
    const serviceConfigs: Record<string, Partial<RetryConfig>> = {
      oauth: {
        maxRetries: 3,
        baseDelay: 1000,
        retryableCategories: [
          ErrorCategory.NETWORK,
          ErrorCategory.PROVIDER_ERROR,
          ErrorCategory.RATE_LIMIT
        ]
      },
      sync: {
        maxRetries: 3,
        baseDelay: 2000,
        retryableCategories: [
          ErrorCategory.NETWORK,
          ErrorCategory.PROVIDER_ERROR,
          ErrorCategory.RATE_LIMIT
        ]
      },
      webhook: {
        maxRetries: 2,
        baseDelay: 1500,
        retryableCategories: [
          ErrorCategory.NETWORK,
          ErrorCategory.PROVIDER_ERROR
        ]
      }
    };

    // Set default config
    this.retryConfigs.set('default', defaultConfig);

    // Set service-specific configs
    Object.entries(serviceConfigs).forEach(([service, config]) => {
      this.retryConfigs.set(service, { ...defaultConfig, ...config });
    });
  }

  /**
   * Check if operation should be retried
   */
  shouldRetry(
    service: string,
    category: ErrorCategory,
    contextKey?: string
  ): boolean {
    const config = this.getRetryConfig(service);
    const state = contextKey ? this.getRetryState(contextKey) : null;

    // Check retry count
    if (state && state.attempt >= config.maxRetries) {
      return false;
    }

    // Check if error category is retryable
    return config.retryableCategories.includes(category);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(
    service: string,
    contextKey?: string
  ): number {
    const config = this.getRetryConfig(service);
    const state = contextKey ? this.getRetryState(contextKey) : null;
    const attempt = state ? state.attempt : 0;

    // Exponential backoff
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);

    // Cap at max delay
    delay = Math.min(delay, config.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    delay += jitter;

    return Math.round(delay);
  }

  /**
   * Update retry state for a context
   */
  updateRetryState(
    contextKey: string,
    delay: number
  ): void {
    const state = this.retryStates.get(contextKey) || {
      attempt: 0,
      lastAttemptTime: new Date(),
      totalDelay: 0
    };

    state.attempt += 1;
    state.lastAttemptTime = new Date();
    state.totalDelay += delay;

    this.retryStates.set(contextKey, state);
  }

  /**
   * Reset retry state for a context
   */
  resetRetryState(contextKey: string): void {
    this.retryStates.delete(contextKey);
  }

  /**
   * Get retry configuration for service
   */
  private getRetryConfig(service: string): RetryConfig {
    if (this.retryConfigs.has(service)) {
      return this.retryConfigs.get(service)!;
    }
    return this.retryConfigs.get('default')!;
  }

  /**
   * Get retry state for context
   */
 private getRetryState(contextKey: string): RetryState | null {
    return this.retryStates.get(contextKey) || null;
 }

  /**
   * Get retry statistics
   */
  getRetryStatistics(): {
    totalRetries: number;
    averageDelay: number;
    services: Record<string, number>;
  } {
    const serviceStats: Record<string, number> = {};
    
    // Count retries by service from retry states
    this.retryStates.forEach((state, key) => {
      const service = key.split(':')[0] || 'unknown';
      serviceStats[service] = (serviceStats[service] || 0) + state.attempt;
    });

    const totalRetries = Object.values(serviceStats).reduce((sum, count) => sum + count, 0);
    const averageDelay = totalRetries > 0 
      ? Array.from(this.retryStates.values()).reduce((sum, state) => sum + state.totalDelay, 0) / totalRetries
      : 0;

    return {
      totalRetries,
      averageDelay,
      services: serviceStats
    };
  }

  /**
   * Update retry configuration for service
   */
  updateRetryConfig(service: string, config: Partial<RetryConfig>): void {
    const currentConfig = this.retryConfigs.get(service) || this.retryConfigs.get('default')!;
    this.retryConfigs.set(service, { ...currentConfig, ...config });
  }
}

// Export singleton instance
export const retryManager = RetryManager.getInstance();