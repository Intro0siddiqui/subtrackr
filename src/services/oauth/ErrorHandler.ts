import { OAuthError, SyncError, SyncType } from '../../types/oauth';
import { oauthDatabase } from '../oauthDatabase';
import { errorHandler as appErrorHandler } from '../error/ErrorHandler';
import { errorReporter } from '../error/ErrorReporter';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error category
 */
export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RATE_LIMIT = 'rate_limit',
  VALIDATION = 'validation',
  PROVIDER_ERROR = 'provider_error',
  SYSTEM_ERROR = 'system_error',
  UNKNOWN = 'unknown'
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * Error handling result
 */
interface ErrorHandlingResult {
  shouldRetry: boolean;
  retryAfter?: number;
  newError?: OAuthError;
  severity: ErrorSeverity;
  category: ErrorCategory;
}

/**
 * Provider-specific error handling and retry logic
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private retryConfigs: Map<string, RetryConfig> = new Map();

  private constructor() {
    this.initializeDefaultRetryConfigs();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Initialize default retry configurations for providers
   */
  private initializeDefaultRetryConfigs(): void {
    const defaultConfig: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      retryableErrors: ['429', '500', '502', '503', '504', 'NETWORK_ERROR', 'TIMEOUT']
    };

    // Provider-specific configurations
    const providerConfigs: Record<string, Partial<RetryConfig>> = {
      netflix: {
        maxRetries: 2,
        retryableErrors: ['429', '500', '503', 'NETWORK_ERROR']
      },
      spotify: {
        maxRetries: 3,
        baseDelay: 2000,
        retryableErrors: ['429', '500', '502', '503', 'NETWORK_ERROR']
      },
      openai: {
        maxRetries: 5,
        baseDelay: 1000,
        maxDelay: 60000,
        retryableErrors: ['429', '500', '502', '503', '504', 'NETWORK_ERROR']
      },
      amazon: {
        maxRetries: 3,
        baseDelay: 1500,
        retryableErrors: ['429', '500', '502', '503', 'NETWORK_ERROR']
      }
    };

    // Set default config for all providers
    this.retryConfigs.set('default', defaultConfig);

    // Set provider-specific configs
    Object.entries(providerConfigs).forEach(([providerId, config]) => {
      this.retryConfigs.set(providerId, { ...defaultConfig, ...config });
    });
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
    const oauthError = this.normalizeError(error);
    const category = this.categorizeError(oauthError);
    const severity = this.assessSeverity(oauthError, category);

    // Use the new error handling system
    // Convert OAuthError to AppError format
    const appError = {
      code: oauthError.code,
      message: oauthError.message,
      details: oauthError.details,
      timestamp: new Date()
    };
    
    const appErrorResult = appErrorHandler.handleError(appError, context);
    
    // Report the error
    errorReporter.reportError(
      appError,
      context,
      appErrorResult.severity,
      appErrorResult.category
    );

    // Log error for monitoring
    this.logError(oauthError, context);

    // Check if error is retryable
    const shouldRetry = this.shouldRetry(oauthError, context);
    const retryAfter = this.calculateRetryDelay(oauthError, context);

    return {
      shouldRetry,
      retryAfter,
      newError: oauthError,
      severity,
      category
    };
  }

  /**
   * Handle sync error specifically
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
    const syncError = this.normalizeSyncError(error, context);
    const category = this.categorizeError(syncError);
    const severity = this.assessSeverity(syncError, category);

    // Log sync error
    this.logSyncError(syncError, context);

    // Check if error is retryable
    const shouldRetry = this.shouldRetry(syncError, context);
    const retryAfter = this.calculateRetryDelay(syncError, context);

    return {
      shouldRetry,
      retryAfter,
      newError: syncError,
      severity,
      category
    };
  }

  /**
   * Normalize error to OAuthError format
   */
  private normalizeError(error: OAuthError | Error): OAuthError {
    if ('code' in error && 'message' in error && 'provider' in error) {
      return error as OAuthError;
    }

    const err = error as Error;
    return {
      code: err.name || 'UNKNOWN_ERROR',
      message: err.message || 'An unknown error occurred',
      details: {
        originalError: err,
        stack: err.stack
      }
    };
  }

  /**
   * Normalize error to SyncError format
   */
  private normalizeSyncError(
    error: SyncError | Error,
    context: any
  ): SyncError {
    if ('syncType' in error) {
      return error as SyncError;
    }

    const oauthError = this.normalizeError(error);
    return {
      ...oauthError,
      syncType: context.syncType,
      recordsAffected: context.recordsAffected
    };
  }

  /**
   * Categorize error
   */
  private categorizeError(error: OAuthError): ErrorCategory {
    const code = error.code.toLowerCase();
    const message = error.message.toLowerCase();

    if (code === '401' || message.includes('unauthorized') || message.includes('invalid token')) {
      return ErrorCategory.AUTHENTICATION;
    }

    if (code === '403' || message.includes('forbidden') || message.includes('insufficient')) {
      return ErrorCategory.AUTHORIZATION;
    }

    if (code === '429' || message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorCategory.RATE_LIMIT;
    }

    if (code === '400' || message.includes('bad request') || message.includes('validation')) {
      return ErrorCategory.VALIDATION;
    }

    if (['500', '502', '503', '504'].includes(code) || message.includes('server error')) {
      return ErrorCategory.PROVIDER_ERROR;
    }

    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    }

    if (message.includes('system') || message.includes('internal error')) {
      return ErrorCategory.SYSTEM_ERROR;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Assess error severity
   */
  private assessSeverity(error: OAuthError, category: ErrorCategory): ErrorSeverity {
    const code = error.code;

    // Critical errors
    if (category === ErrorCategory.AUTHENTICATION && code !== '401') {
      return ErrorSeverity.CRITICAL;
    }

    if (category === ErrorCategory.AUTHORIZATION) {
      return ErrorSeverity.CRITICAL;
    }

    if (category === ErrorCategory.SYSTEM_ERROR) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (category === ErrorCategory.PROVIDER_ERROR && ['500', '503'].includes(code)) {
      return ErrorSeverity.HIGH;
    }

    if (category === ErrorCategory.RATE_LIMIT) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (category === ErrorCategory.NETWORK) {
      return ErrorSeverity.MEDIUM;
    }

    if (category === ErrorCategory.VALIDATION) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity errors
    return ErrorSeverity.LOW;
  }

  /**
   * Check if error should be retried
   */
  private shouldRetry(
    error: OAuthError,
    context?: { providerId?: string; retryCount?: number }
  ): boolean {
    const config = this.getRetryConfig(context?.providerId);
    const retryCount = context?.retryCount || 0;

    // Check retry count
    if (retryCount >= config.maxRetries) {
      return false;
    }

    // Check if error code is retryable
    return config.retryableErrors.includes(error.code);
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(
    error: OAuthError,
    context?: { providerId?: string; retryCount?: number }
  ): number | undefined {
    if (!this.shouldRetry(error, context)) {
      return undefined;
    }

    const config = this.getRetryConfig(context?.providerId);
    const retryCount = context?.retryCount || 0;

    // Exponential backoff
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, retryCount);

    // Cap at max delay
    delay = Math.min(delay, config.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    delay += jitter;

    // Special handling for rate limits
    if (error.code === '429' && error.details?.retryAfter) {
      return Math.max(delay, error.details.retryAfter * 1000);
    }

    return Math.round(delay);
  }

  /**
   * Get retry configuration for provider
   */
  private getRetryConfig(providerId?: string): RetryConfig {
    if (providerId && this.retryConfigs.has(providerId)) {
      return this.retryConfigs.get(providerId)!;
    }
    return this.retryConfigs.get('default')!;
  }

  /**
   * Log error for monitoring
   */
  private async logError(
    error: OAuthError,
    context?: {
      providerId?: string;
      userId?: string;
      connectionId?: string;
      operation?: string;
    }
  ): Promise<void> {
    try {
      // Log to security events table for audit purposes
      // Note: This method doesn't exist in the current database service
      /*
      await oauthDatabase.createSecurityEvent({
        userId: context?.userId || '',
        eventType: 'auth_failed',
        providerId: context?.providerId,
        connectionId: context?.connectionId,
        metadata: {
          error: {
            code: error.code,
            message: error.message,
            category: this.categorizeError(error),
            severity: this.assessSeverity(error, this.categorizeError(error))
          },
          operation: context?.operation,
          timestamp: new Date().toISOString()
        }
      });
      */

      console.error('OAuth Error:', {
        provider: context?.providerId,
        operation: context?.operation,
        error: error.message,
        code: error.code,
        category: this.categorizeError(error)
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Log sync error
   */
  private async logSyncError(
    error: SyncError,
    context: {
      syncType: SyncType;
      connectionId: string;
      providerId: string;
      userId: string;
      recordsAffected?: number;
    }
  ): Promise<void> {
    try {
      // Log to sync logs table
      await oauthDatabase.createSyncLog({
        connectionId: context.connectionId,
        syncType: context.syncType,
        status: 'failed' as any,
        recordsProcessed: context.recordsAffected || 0,
        errors: {
          code: error.code,
          message: error.message,
          category: this.categorizeError(error),
          severity: this.assessSeverity(error, this.categorizeError(error))
        },
        metadata: {
          providerId: context.providerId,
          userId: context.userId,
          operation: 'sync'
        },
        startedAt: new Date(),
        completedAt: new Date()
      });

      console.error('Sync Error:', {
        provider: context.providerId,
        syncType: context.syncType,
        error: error.message,
        code: error.code,
        recordsAffected: context.recordsAffected
      });
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }
  }

  /**
   * Get error recovery suggestions
   */
  getRecoverySuggestions(error: OAuthError): string[] {
    const suggestions: string[] = [];
    const category = this.categorizeError(error);

    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        suggestions.push('Check if OAuth credentials are valid');
        suggestions.push('Re-authenticate with the provider');
        suggestions.push('Verify token scopes and permissions');
        break;

      case ErrorCategory.AUTHORIZATION:
        suggestions.push('Check required permissions and scopes');
        suggestions.push('Verify API access level');
        suggestions.push('Contact provider for access permissions');
        break;

      case ErrorCategory.RATE_LIMIT:
        suggestions.push('Reduce API call frequency');
        suggestions.push('Implement exponential backoff');
        suggestions.push('Check rate limit quotas');
        break;

      case ErrorCategory.NETWORK:
        suggestions.push('Check internet connection');
        suggestions.push('Verify provider API status');
        suggestions.push('Try again in a few minutes');
        break;

      case ErrorCategory.VALIDATION:
        suggestions.push('Check request parameters');
        suggestions.push('Verify data format requirements');
        suggestions.push('Review API documentation');
        break;

      case ErrorCategory.PROVIDER_ERROR:
        suggestions.push('Check provider status page');
        suggestions.push('Try again later');
        suggestions.push('Contact provider support if issue persists');
        break;

      default:
        suggestions.push('Check error details and try again');
        suggestions.push('Contact support if issue persists');
    }

    return suggestions;
  }

  /**
   * Update retry configuration for provider
   */
  updateRetryConfig(providerId: string, config: Partial<RetryConfig>): void {
    const currentConfig = this.retryConfigs.get(providerId) || this.retryConfigs.get('default')!;
    this.retryConfigs.set(providerId, { ...currentConfig, ...config });
  }

  /**
   * Get error statistics
   */
  async getErrorStatistics(): Promise<{
    totalErrors: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    topErrors: Array<{ code: string; count: number; message: string }>;
  }> {
    // This would typically query the database for error statistics
    // For now, return mock data
    return {
      totalErrors: 0,
      byCategory: {
        [ErrorCategory.NETWORK]: 0,
        [ErrorCategory.AUTHENTICATION]: 0,
        [ErrorCategory.AUTHORIZATION]: 0,
        [ErrorCategory.RATE_LIMIT]: 0,
        [ErrorCategory.VALIDATION]: 0,
        [ErrorCategory.PROVIDER_ERROR]: 0,
        [ErrorCategory.SYSTEM_ERROR]: 0,
        [ErrorCategory.UNKNOWN]: 0
      },
      bySeverity: {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0
      },
      topErrors: []
    };
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();