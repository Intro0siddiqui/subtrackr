import { WebhookEvent } from './WebhookHandler';
import { WebhookProcessingResult } from './WebhookProcessor';
import { errorHandler } from '../error/ErrorHandler';
import { errorReporter } from '../error/ErrorReporter';

/**
 * Webhook Report Entry
 */
export interface WebhookReportEntry {
  id: string;
  eventId: string;
  eventType: string;
  providerId: string;
  status: 'received' | 'processed' | 'failed' | 'retry';
  message?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Webhook Reporter - Reporting and analytics for webhook operations
 * 
 * This class handles reporting and analytics for webhook operations including:
 * - Logging webhook events and their outcomes
 * - Tracking processing metrics
 * - Generating reports and analytics
 * - Monitoring system health
 */
export class WebhookReporter {
  private initialized: boolean = false;
  private reportBuffer: WebhookReportEntry[] = [];
  private bufferSize: number = 100;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {}

  /**
   * Initialize the webhook reporter
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('Initializing webhook reporter...');
      
      // Set up periodic flushing of report buffer
      this.flushInterval = setInterval(() => {
        this.flushBuffer().catch(error => {
          console.error('Failed to flush report buffer:', error);
        });
      }, 30000); // Flush every 30 seconds
      
      this.initialized = true;
      console.log('✅ Webhook reporter initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize webhook reporter:', error);
      throw error;
    }
  }

  /**
   * Log event received
   */
  async logEventReceived(event: WebhookEvent): Promise<void> {
    const reportEntry: WebhookReportEntry = {
      id: this.generateId(),
      eventId: event.id,
      eventType: event.eventType,
      providerId: event.providerId,
      status: 'received',
      timestamp: new Date(),
      metadata: {
        connectionId: event.connectionId,
        payloadSize: JSON.stringify(event.payload).length
      }
    };

    await this.addReportEntry(reportEntry);
    console.log(`Webhook event received: ${event.id} (${event.providerId}:${event.eventType})`);
  }

  /**
   * Log event processed
   */
  async logEventProcessed(event: WebhookEvent, result: WebhookProcessingResult): Promise<void> {
    const reportEntry: WebhookReportEntry = {
      id: this.generateId(),
      eventId: event.id,
      eventType: event.eventType,
      providerId: event.providerId,
      status: 'processed',
      message: result.data?.message || 'Event processed successfully',
      timestamp: new Date(),
      metadata: {
        connectionId: event.connectionId,
        shouldSync: result.shouldSync,
        processingTime: Date.now() - event.timestamp.getTime()
      }
    };

    await this.addReportEntry(reportEntry);
    console.log(`Webhook event processed: ${event.id} (${event.providerId}:${event.eventType})`);
  }

  /**
   * Log event failed
   */
  async logEventFailed(event: WebhookEvent, error: string): Promise<void> {
    const reportEntry: WebhookReportEntry = {
      id: this.generateId(),
      eventId: event.id,
      eventType: event.eventType,
      providerId: event.providerId,
      status: 'failed',
      message: error,
      timestamp: new Date(),
      metadata: {
        connectionId: event.connectionId,
        attempts: event.attempts
      }
    };

    // Report the error using the new error handling system
    const appError = {
      code: 'WEBHOOK_EVENT_FAILED',
      message: `Webhook event failed: ${event.id} (${event.providerId}:${event.eventType}) - ${error}`,
      timestamp: new Date()
    };
    
    const errorResult = errorHandler.handleError(appError, {
      component: 'WebhookReporter',
      operation: 'logEventFailed',
      providerId: event.providerId,
      eventId: event.id
    });
    
    errorReporter.reportError(
      appError,
      {
        component: 'WebhookReporter',
        operation: 'logEventFailed',
        providerId: event.providerId,
        eventId: event.id
      },
      errorResult.severity,
      errorResult.category
    );

    await this.addReportEntry(reportEntry);
    console.error(`Webhook event failed: ${event.id} (${event.providerId}:${event.eventType}) - ${error}`);
  }

  /**
   * Log event retry
   */
  async logEventRetry(event: WebhookEvent, error: string): Promise<void> {
    const reportEntry: WebhookReportEntry = {
      id: this.generateId(),
      eventId: event.id,
      eventType: event.eventType,
      providerId: event.providerId,
      status: 'retry',
      message: error,
      timestamp: new Date(),
      metadata: {
        connectionId: event.connectionId,
        attempts: event.attempts
      }
    };

    await this.addReportEntry(reportEntry);
    console.warn(`Webhook event retry: ${event.id} (${event.providerId}:${event.eventType}) - ${error}`);
  }

  /**
   * Log validation error
   */
  async logValidationError(event: WebhookEvent, error: string): Promise<void> {
    const reportEntry: WebhookReportEntry = {
      id: this.generateId(),
      eventId: event.id,
      eventType: event.eventType,
      providerId: event.providerId,
      status: 'failed',
      message: `Validation error: ${error}`,
      timestamp: new Date(),
      metadata: {
        connectionId: event.connectionId
      }
    };

    await this.addReportEntry(reportEntry);
    console.error(`Webhook validation error: ${event.id} (${event.providerId}:${event.eventType}) - ${error}`);
  }

  /**
   * Log queue error
   */
  async logQueueError(event: WebhookEvent, error: string): Promise<void> {
    const reportEntry: WebhookReportEntry = {
      id: this.generateId(),
      eventId: event.id,
      eventType: event.eventType,
      providerId: event.providerId,
      status: 'failed',
      message: `Queue error: ${error}`,
      timestamp: new Date(),
      metadata: {
        connectionId: event.connectionId
      }
    };

    await this.addReportEntry(reportEntry);
    console.error(`Webhook queue error: ${event.id} (${event.providerId}:${event.eventType}) - ${error}`);
  }

  /**
   * Add report entry to buffer
   */
  private async addReportEntry(entry: WebhookReportEntry): Promise<void> {
    this.reportBuffer.push(entry);
    
    // Flush buffer if it's full
    if (this.reportBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  /**
   * Flush report buffer to database
   */
  private async flushBuffer(): Promise<void> {
    if (this.reportBuffer.length === 0) {
      return;
    }

    try {
      // In a real implementation, you would store these reports in a database
      // For now, we'll just log them
      console.log(`Flushing ${this.reportBuffer.length} report entries`);
      
      // Clear buffer
      this.reportBuffer = [];
    } catch (error) {
      console.error('Failed to flush report buffer:', error);
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
   * Get processing statistics
   */
  async getStatistics(): Promise<{
    totalEvents: number;
    processedEvents: number;
    failedEvents: number;
    retryEvents: number;
    successRate: number;
    averageProcessingTime: number;
    providerStats: Record<string, {
      total: number;
      processed: number;
      failed: number;
      successRate: number;
    }>;
  }> {
    try {
      // In a real implementation, you would query the database for statistics
      // For now, we'll return mock data
      return {
        totalEvents: 0,
        processedEvents: 0,
        failedEvents: 0,
        retryEvents: 0,
        successRate: 0,
        averageProcessingTime: 0,
        providerStats: {}
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        totalEvents: 0,
        processedEvents: 0,
        failedEvents: 0,
        retryEvents: 0,
        successRate: 0,
        averageProcessingTime: 0,
        providerStats: {}
      };
    }
  }

  /**
   * Get recent reports
   */
  async getRecentReports(): Promise<WebhookReportEntry[]> {
    try {
      // In a real implementation, you would query the database for recent reports
      // For now, we'll return empty array
      return [];
    } catch (error) {
      console.error('Failed to get recent reports:', error);
      return [];
    }
  }

  /**
   * Get reports by provider
   */
  async getReportsByProvider(providerId: string): Promise<WebhookReportEntry[]> {
    try {
      // In a real implementation, you would query the database for provider-specific reports
      // For now, we'll return empty array
      return [];
    } catch (error) {
      console.error(`Failed to get reports for provider ${providerId}:`, error);
      return [];
    }
  }

  /**
   * Get reports by status
   */
  async getReportsByStatus(status: WebhookReportEntry['status']): Promise<WebhookReportEntry[]> {
    try {
      // In a real implementation, you would query the database for status-specific reports
      // For now, we'll return empty array
      return [];
    } catch (error) {
      console.error(`Failed to get reports with status ${status}:`, error);
      return [];
    }
  }

  /**
   * Check if reporter is healthy
   */
  isHealthy(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Flush any remaining reports
    if (this.reportBuffer.length > 0) {
      await this.flushBuffer();
    }
    
    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    console.log('Webhook reporter cleanup completed');
  }
}