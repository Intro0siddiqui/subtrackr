import { ScheduleEvent } from './types';
import { WebhookProcessor } from '../webhook/WebhookProcessor';
import { WebhookEvent } from '../webhook/WebhookHandler';

/**
 * Webhook Integration Service for Scheduler
 * 
 * Integrates scheduler events with the webhook system with:
 * - Event forwarding to webhook processor
 * - Webhook event logging
 * - Error handling
 */
export class SchedulerWebhookService {
  private webhookProcessor: WebhookProcessor;
  private initialized: boolean = false;

  constructor(webhookProcessor: WebhookProcessor) {
    this.webhookProcessor = webhookProcessor;
  }

  /**
   * Initialize the webhook service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Any initialization logic here
      this.initialized = true;
      console.log('SchedulerWebhookService: Initialized successfully');
    } catch (error) {
      console.error('SchedulerWebhookService: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Process schedule event through webhook system
   */
  async processScheduleEvent(event: ScheduleEvent): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('SchedulerWebhookService not initialized');
    }

    try {
      // Create webhook event from schedule event
      const webhookEvent: WebhookEvent = {
        id: `webhook_${event.scheduleId}_${Date.now()}`,
        connectionId: event.connectionId,
        providerId: event.providerId,
        eventType: this.mapScheduleEventTypeToWebhook(event.type),
        payload: {
          scheduleId: event.scheduleId,
          userId: event.userId,
          providerId: event.providerId,
          eventType: event.type,
          data: event.data,
          timestamp: event.timestamp
        },
        signature: '', // Would be generated in a real implementation
        timestamp: new Date(),
        processed: false,
        attempts: 0,
        maxAttempts: 3
      };

      // Process through webhook processor
      const result = await this.webhookProcessor.processEvent(webhookEvent);
      
      if (result.success) {
        console.log(`SchedulerWebhookService: Successfully processed schedule event ${event.scheduleId}`);
        return true;
      } else {
        console.error(`SchedulerWebhookService: Failed to process schedule event ${event.scheduleId}: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error('SchedulerWebhookService: Error processing schedule event:', error);
      return false;
    }
  }

  /**
   * Map schedule event type to webhook event type
   */
 private mapScheduleEventTypeToWebhook(scheduleEventType: string): string {
    switch (scheduleEventType) {
      case 'schedule_created':
        return 'sync.schedule.created';
      case 'schedule_updated':
        return 'sync.schedule.updated';
      case 'schedule_deleted':
        return 'sync.schedule.deleted';
      case 'schedule_executed':
        return 'sync.schedule.executed';
      case 'schedule_failed':
        return 'sync.schedule.failed';
      case 'conflict_detected':
        return 'sync.schedule.conflict';
      default:
        return `sync.schedule.${scheduleEventType}`;
    }
  }

  /**
   * Log schedule event to webhook system
   */
  async logScheduleEvent(event: ScheduleEvent): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('SchedulerWebhookService not initialized');
    }

    try {
      // In a real implementation, this would save the event to the webhook_events table
      console.log(`SchedulerWebhookService: Logging schedule event ${event.scheduleId} of type ${event.type}`);
      return true;
    } catch (error) {
      console.error('SchedulerWebhookService: Error logging schedule event:', error);
      return false;
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // No cleanup needed for now
    console.log('SchedulerWebhookService: Cleanup completed');
  }
}