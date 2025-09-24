import { AppError, ErrorContext } from './ErrorHandler';
import { ErrorSeverity, ErrorCategory } from './ErrorHandler';

/**
 * Error report entry
 */
export interface ErrorReport {
  id: string;
  error: AppError;
  context?: ErrorContext;
 severity: ErrorSeverity;
  category: ErrorCategory;
  timestamp: Date;
  resolved: boolean;
}

/**
 * Error statistics
 */
export interface ErrorStatistics {
  totalErrors: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  byService: Record<string, number>;
  topErrors: Array<{ code: string; count: number; message: string }>;
}

/**
 * Report errors to monitoring services
 */
export class ErrorReporter {
  private static instance: ErrorReporter;
  private errorReports: ErrorReport[] = [];
  private bufferSize: number = 100;
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Set up periodic flushing of error reports
    this.flushInterval = setInterval(() => {
      this.flushReports().catch(error => {
        console.error('Failed to flush error reports:', error);
      });
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  /**
   * Report an error
   */
  async reportError(
    error: AppError,
    context?: ErrorContext,
    severity?: ErrorSeverity,
    category?: ErrorCategory
  ): Promise<void> {
    const report: ErrorReport = {
      id: this.generateId(),
      error,
      context,
      severity: severity || ErrorSeverity.MEDIUM,
      category: category || ErrorCategory.UNKNOWN,
      timestamp: new Date(),
      resolved: false
    };

    this.errorReports.push(report);

    // Log to console
    console.error('Error Report:', {
      id: report.id,
      error: report.error.message,
      code: report.error.code,
      context: report.context,
      severity: report.severity,
      category: report.category,
      timestamp: report.timestamp
    });

    // Flush buffer if it's full
    if (this.errorReports.length >= this.bufferSize) {
      await this.flushReports();
    }
  }

  /**
   * Mark error as resolved
   */
  resolveError(reportId: string): boolean {
    const report = this.errorReports.find(r => r.id === reportId);
    if (report) {
      report.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): ErrorStatistics {
    const stats: ErrorStatistics = {
      totalErrors: this.errorReports.length,
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
      byService: {},
      topErrors: []
    };

    // Calculate category and severity counts
    this.errorReports.forEach(report => {
      stats.byCategory[report.category] = (stats.byCategory[report.category] || 0) + 1;
      stats.bySeverity[report.severity] = (stats.bySeverity[report.severity] || 0) + 1;
      
      if (report.context?.providerId) {
        const service = report.context.providerId;
        stats.byService[service] = (stats.byService[service] || 0) + 1;
      }
    });

    // Calculate top errors
    const errorCounts: Record<string, { count: number; message: string }> = {};
    this.errorReports.forEach(report => {
      const key = `${report.error.code}:${report.error.message}`;
      if (!errorCounts[key]) {
        errorCounts[key] = { count: 0, message: report.error.message };
      }
      errorCounts[key].count += 1;
    });

    stats.topErrors = Object.entries(errorCounts)
      .map(([code, { count, message }]) => ({ code: code.split(':')[0], count, message }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  /**
   * Get recent error reports
   */
  getRecentReports(limit: number = 50): ErrorReport[] {
    return this.errorReports
      .slice()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get unresolved error reports
   */
  getUnresolvedReports(): ErrorReport[] {
    return this.errorReports.filter(report => !report.resolved);
  }

  /**
   * Get reports by service
   */
  getReportsByService(service: string): ErrorReport[] {
    return this.errorReports.filter(report => report.context?.providerId === service);
  }

  /**
   * Get reports by severity
   */
  getReportsBySeverity(severity: ErrorSeverity): ErrorReport[] {
    return this.errorReports.filter(report => report.severity === severity);
  }

  /**
   * Get reports by category
   */
  getReportsByCategory(category: ErrorCategory): ErrorReport[] {
    return this.errorReports.filter(report => report.category === category);
  }

  /**
   * Flush error reports to external monitoring service
   */
  private async flushReports(): Promise<void> {
    if (this.errorReports.length === 0) {
      return;
    }

    try {
      // In a real implementation, you would send these reports to an external monitoring service
      // For now, we'll just log them
      console.log(`Flushing ${this.errorReports.length} error reports`);
      
      // Clear buffer
      this.errorReports = [];
    } catch (error) {
      console.error('Failed to flush error reports:', error);
      // Don't clear buffer on error, try again later
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Cleanup resources
   */
 async cleanup(): Promise<void> {
    // Flush any remaining reports
    if (this.errorReports.length > 0) {
      await this.flushReports();
    }
    
    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

// Export singleton instance
export const errorReporter = ErrorReporter.getInstance();