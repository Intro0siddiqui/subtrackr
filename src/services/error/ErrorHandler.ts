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
 * Generic application error
 */
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  timestamp: Date;
}

/**
 * Error context for tracking
 */
export interface ErrorContext {
  userId?: string;
  connectionId?: string;
  providerId?: string;
  operation?: string;
  component?: string;
  retryCount?: number;
  [key: string]: any;
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
  shouldRetry: boolean;
  retryAfter?: number;
  newError?: AppError;
  severity: ErrorSeverity;
  category: ErrorCategory;
}

/**
 * Centralized error handling service
 */
export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

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
   * Handle application error
   */
  handleError(
    error: AppError | Error,
    context?: ErrorContext
  ): ErrorHandlingResult {
    const appError = this.normalizeError(error);
    const category = this.categorizeError(appError);
    const severity = this.assessSeverity(appError, category);

    // Log error for monitoring
    this.logError(appError, context);

    // Check if error is retryable
    const shouldRetry = this.shouldRetry(appError, context);
    const retryAfter = this.calculateRetryDelay(appError, context);

    return {
      shouldRetry,
      retryAfter,
      newError: appError,
      severity,
      category
    };
  }

  /**
   * Normalize error to AppError format
   */
  private normalizeError(error: AppError | Error): AppError {
    if ('code' in error && 'message' in error && 'timestamp' in error) {
      return error as AppError;
    }

    const err = error as Error;
    return {
      code: err.name || 'UNKNOWN_ERROR',
      message: err.message || 'An unknown error occurred',
      details: {
        originalError: err,
        stack: err.stack
      },
      timestamp: new Date()
    };
  }

  /**
   * Categorize error
   */
  private categorizeError(error: AppError): ErrorCategory {
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
  private assessSeverity(error: AppError, category: ErrorCategory): ErrorSeverity {
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
    error: AppError,
    context?: ErrorContext
  ): boolean {
    const category = this.categorizeError(error);
    
    // Don't retry critical errors
    if (this.assessSeverity(error, category) === ErrorSeverity.CRITICAL) {
      return false;
    }

    // Retry count check
    const retryCount = context?.retryCount || 0;
    if (retryCount >= 3) {
      return false;
    }

    // Retryable categories
    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.PROVIDER_ERROR,
      ErrorCategory.RATE_LIMIT
    ];

    return retryableCategories.includes(category);
  }

 /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(
    error: AppError,
    context?: ErrorContext
  ): number | undefined {
    if (!this.shouldRetry(error, context)) {
      return undefined;
    }

    const retryCount = context?.retryCount || 0;
    
    // Base delay of 1 second with exponential backoff
    let delay = 1000 * Math.pow(2, retryCount);
    
    // Cap at 30 seconds
    delay = Math.min(delay, 30000);
    
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
   * Log error for monitoring
   */
  private async logError(
    error: AppError,
    context?: ErrorContext
  ): Promise<void> {
    try {
      console.error('Application Error:', {
        error: error.message,
        code: error.code,
        context,
        timestamp: error.timestamp,
        category: this.categorizeError(error),
        severity: this.assessSeverity(error, this.categorizeError(error))
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Get error recovery suggestions
   */
  getRecoverySuggestions(error: AppError): string[] {
    const suggestions: string[] = [];
    const category = this.categorizeError(error);

    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        suggestions.push('Check if credentials are valid');
        suggestions.push('Re-authenticate with the service');
        suggestions.push('Verify token scopes and permissions');
        break;

      case ErrorCategory.AUTHORIZATION:
        suggestions.push('Check required permissions and scopes');
        suggestions.push('Verify API access level');
        suggestions.push('Contact support for access permissions');
        break;

      case ErrorCategory.RATE_LIMIT:
        suggestions.push('Reduce API call frequency');
        suggestions.push('Implement exponential backoff');
        suggestions.push('Check rate limit quotas');
        break;

      case ErrorCategory.NETWORK:
        suggestions.push('Check internet connection');
        suggestions.push('Verify service API status');
        suggestions.push('Try again in a few minutes');
        break;

      case ErrorCategory.VALIDATION:
        suggestions.push('Check request parameters');
        suggestions.push('Verify data format requirements');
        suggestions.push('Review API documentation');
        break;

      case ErrorCategory.PROVIDER_ERROR:
        suggestions.push('Check service status page');
        suggestions.push('Try again later');
        suggestions.push('Contact service support if issue persists');
        break;

      default:
        suggestions.push('Check error details and try again');
        suggestions.push('Contact support if issue persists');
    }

    return suggestions;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();