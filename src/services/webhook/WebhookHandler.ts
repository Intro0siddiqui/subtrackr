import { WebhookValidator } from './WebhookValidator';
import { WebhookQueue } from './WebhookQueue';
import { WebhookProcessor } from './WebhookProcessor';
import { WebhookReporter } from './WebhookReporter';
import { oauthService } from '../oauth';
import { syncManager } from '../sync';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Webhook Event Interface
 */
export interface WebhookEvent {
  id: string;
  connectionId: string;
  providerId: string;
  eventType: string;
 payload: any;
  signature?: string;
  timestamp: Date;
  processed: boolean;
  processedAt?: Date;
  attempts: number;
  maxAttempts: number;
  error?: string;
}

/**
 * Webhook Handler Configuration
 */
export interface WebhookHandlerConfig {
  maxRetries: number;
  retryDelay: number;
  maxQueueSize: number;
  rateLimit: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
}

/**
 * Webhook Handler - Main webhook processing engine
 * 
 * This class handles the complete webhook processing flow:
 * 1. Receive incoming webhook HTTP requests
 * 2. Validate signatures and payloads
 * 3. Queue validated events for processing
 * 4. Process events with provider-specific handlers
 * 5. Transform event data to internal subscription format
 * 6. Store updated subscription data in database
 * 7. Report webhook results and update status
 */
export class WebhookHandler {
  private static instance: WebhookHandler;
  private validator: WebhookValidator;
  private queue: WebhookQueue;
  private processor: WebhookProcessor;
  private reporter: WebhookReporter;
  private config: WebhookHandlerConfig;
  private initialized: boolean = false;

  private constructor(config?: Partial<WebhookHandlerConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
      maxQueueSize: config?.maxQueueSize ?? 1000,
      rateLimit: {
        requestsPerSecond: config?.rateLimit?.requestsPerSecond ?? 10,
        requestsPerMinute: config?.rateLimit?.requestsPerMinute ?? 100
      }
    };

    this.validator = new WebhookValidator();
    this.queue = new WebhookQueue(this.config.maxQueueSize);
    this.processor = new WebhookProcessor();
    this.reporter = new WebhookReporter();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<WebhookHandlerConfig>): WebhookHandler {
    if (!WebhookHandler.instance) {
      WebhookHandler.instance = new WebhookHandler(config);
    }
    return WebhookHandler.instance;
  }

  /**
   * Initialize the webhook handler
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('Webhook handler already initialized');
      return;
    }

    try {
      console.log('Initializing webhook handler...');
      
      // Initialize components
      await this.validator.initialize();
      await this.queue.initialize();
      await this.processor.initialize();
      await this.reporter.initialize();
      
      this.initialized = true;
      console.log('✅ Webhook handler initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize webhook handler:', error);
      throw error;
    }
  }

  /**
   * Handle incoming webhook request
   */
  async handleWebhook(
    providerId: string,
    eventType: string,
    payload: any,
    signature?: string,
    headers?: Record<string, string>
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      // Create webhook event
      const event: WebhookEvent = {
        id: uuidv4(),
        connectionId: payload.connection_id || payload.connectionId || '',
        providerId,
        eventType,
        payload,
        signature,
        timestamp: new Date(),
        processed: false,
        attempts: 0,
        maxAttempts: this.config.maxRetries
      };

      // Validate webhook
      const validation = await this.validator.validateWebhook(event, headers);
      if (!validation.isValid) {
        await this.reporter.logValidationError(event, validation.error || 'Validation failed');
        return { success: false, error: validation.error };
      }

      // Store event in database
      await this.storeWebhookEvent(event);
      
      // Add to processing queue
      const queued = await this.queue.enqueue(event);
      if (!queued) {
        await this.reporter.logQueueError(event, 'Failed to enqueue event');
        return { success: false, error: 'Failed to queue event' };
      }

      // Report successful receipt
      await this.reporter.logEventReceived(event);
      
      return { success: true, eventId: event.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to handle webhook:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Process webhook events from queue
   */
  async processWebhooks(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Webhook handler not initialized');
    }

    const events = await this.queue.dequeueBatch(10); // Process up to 10 events at a time
    if (events.length === 0) {
      return;
    }

    console.log(`Processing ${events.length} webhook events`);

    // Process events concurrently with rate limiting
    const promises = events.map(event => this.processSingleEvent(event));
    await Promise.all(promises);
  }

  /**
   * Process a single webhook event
   */
  private async processSingleEvent(event: WebhookEvent): Promise<void> {
    try {
      event.attempts++;
      
      // Process the event
      const result = await this.processor.processEvent(event);
      
      if (result.success) {
        // Mark as processed
        event.processed = true;
        event.processedAt = new Date();
        
        // Update database
        await this.updateWebhookEvent(event);
        
        // Trigger sync if needed
        if (result.shouldSync) {
          await this.triggerSync(event);
        }
        
        // Report success
        await this.reporter.logEventProcessed(event, result);
      } else {
        // Handle retry logic
        if (event.attempts < event.maxAttempts) {
          // Requeue with delay
          await this.requeueEvent(event);
          await this.reporter.logEventRetry(event, result.error || 'Processing failed');
        } else {
          // Mark as failed
          event.error = result.error;
          await this.updateWebhookEvent(event);
          await this.reporter.logEventFailed(event, result.error || 'Max retries exceeded');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      event.error = errorMessage;
      
      if (event.attempts < event.maxAttempts) {
        await this.requeueEvent(event);
        await this.reporter.logEventRetry(event, errorMessage);
      } else {
        await this.updateWebhookEvent(event);
        await this.reporter.logEventFailed(event, errorMessage);
      }
    }
  }

  /**
   * Trigger sync for a webhook event
   */
  private async triggerSync(event: WebhookEvent): Promise<void> {
    try {
      // Get connection details
      const connection = await this.getConnection(event.connectionId);
      if (!connection) {
        console.warn(`No connection found for webhook event ${event.id}`);
        return;
      }

      // Trigger sync
      await syncManager.startWebhookSync(connection.userId, event.providerId, event.eventType, event.payload, {
        connectionId: event.connectionId
      });

      console.log(`Triggered sync for webhook event ${event.id}`);
    } catch (error) {
      console.error(`Failed to trigger sync for webhook event ${event.id}:`, error);
    }
  }

  /**
   * Get connection details
   */
  private async getConnection(connectionId: string): Promise<any> {
    try {
      const { data, error } = await db
        .from('oauth_connections')
        .select('id, user_id, provider_id')
        .eq('id', connectionId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get connection:', error);
      return null;
    }
  }

  /**
   * Store webhook event in database
   */
  private async storeWebhookEvent(event: WebhookEvent): Promise<void> {
    try {
      const { error } = await db.from('webhook_events').insert({
        id: event.id,
        connection_id: event.connectionId,
        provider_id: event.providerId,
        event_type: event.eventType,
        payload: event.payload,
        signature: event.signature,
        processed: event.processed,
        created_at: event.timestamp.toISOString()
      });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to store webhook event:', error);
      throw error;
    }
  }

  /**
   * Update webhook event in database
   */
  private async updateWebhookEvent(event: WebhookEvent): Promise<void> {
    try {
      const { error } = await db.from('webhook_events').update({
        processed: event.processed,
        processed_at: event.processedAt?.toISOString(),
        attempts: event.attempts,
        error: event.error
      }).eq('id', event.id);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update webhook event:', error);
      throw error;
    }
  }

  /**
   * Requeue event with exponential backoff
   */
  private async requeueEvent(event: WebhookEvent): Promise<void> {
    // Calculate delay with exponential backoff
    const delay = this.config.retryDelay * Math.pow(2, event.attempts - 1);
    
    // Add a random jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    
    setTimeout(async () => {
      try {
        await this.queue.enqueue(event);
      } catch (error) {
        console.error(`Failed to requeue event ${event.id}:`, error);
      }
    }, delay + jitter);
  }

  /**
   * Get webhook handler status
   */
  getStatus(): {
    initialized: boolean;
    queueSize: number;
    config: WebhookHandlerConfig;
  } {
    return {
      initialized: this.initialized,
      queueSize: this.queue.size(),
      config: { ...this.config }
    };
 }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      database: boolean;
      queue: boolean;
      validator: boolean;
    };
    details?: string;
  }> {
    const checks = {
      database: false,
      queue: false,
      validator: false
    };

    try {
      // Check database connectivity by querying webhook events table
      const { error } = await db.from('webhook_events').select('id').limit(1);
      checks.database = !error;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    try {
      // Check queue health
      checks.queue = this.queue.isHealthy();
    } catch (error) {
      console.error('Queue health check failed:', error);
    }

    try {
      // Check validator health
      checks.validator = this.validator.isHealthy();
    } catch (error) {
      console.error('Validator health check failed:', error);
    }

    const allHealthy = Object.values(checks).every(check => check);
    const anyHealthy = Object.values(checks).some(check => check);

    return {
      status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
      checks,
      details: !allHealthy ? 'Some components are not functioning properly' : undefined
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // No cleanup needed for now
    console.log('Webhook handler cleanup completed');
  }

  /**
   * Shutdown the webhook handler
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    
    console.log('Shutting down webhook handler...');
    await this.cleanup();
    this.initialized = false;
    console.log('Webhook handler shutdown completed');
  }
}

// Export singleton instance
export const webhookHandler = WebhookHandler.getInstance();

export default webhookHandler;