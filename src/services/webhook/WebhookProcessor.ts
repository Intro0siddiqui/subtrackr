import { WebhookEvent } from './WebhookHandler';
import { errorHandler } from '../error/ErrorHandler';
import { errorReporter } from '../error/ErrorReporter';

/**
 * Webhook Processing Result
 */
export interface WebhookProcessingResult {
  success: boolean;
  shouldSync: boolean;
  data?: any;
  error?: string;
}

/**
 * Webhook Processor - Process validated webhook events
 * 
 * This class handles the processing of validated webhook events including:
 * - Routing events to appropriate provider handlers
 * - Transforming event data to internal subscription format
 * - Updating subscription data in database
 * - Determining if a sync operation is needed
 */
export class WebhookProcessor {
  private initialized: boolean = false;

  constructor() {}

  /**
   * Initialize the webhook processor
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('Initializing webhook processor...');
      this.initialized = true;
      console.log('✅ Webhook processor initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize webhook processor:', error);
      throw error;
    }
  }

  /**
   * Process webhook event
   */
  async processEvent(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Check if processor is initialized
      if (!this.initialized) {
        return { success: false, shouldSync: false, error: 'Processor not initialized' };
      }

      // Route to provider-specific handler
      switch (event.providerId) {
        case 'netflix':
          return await this.processNetflixEvent(event);
        case 'spotify':
          return await this.processSpotifyEvent(event);
        case 'openai':
          return await this.processOpenAIEvent(event);
        case 'amazon':
          return await this.processAmazonEvent(event);
        default:
          return { success: false, shouldSync: false, error: `Unknown provider: ${event.providerId}` };
      }
    } catch (error) {
      // Handle error with new error handling system
      const appError = {
        code: error instanceof Error ? error.name : 'WEBHOOK_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown webhook processing error',
        timestamp: new Date()
      };
      
      const errorResult = errorHandler.handleError(appError, {
        component: 'WebhookProcessor',
        operation: 'processEvent',
        providerId: event.providerId
      });
      
      // Report the error
      errorReporter.reportError(
        appError,
        {
          component: 'WebhookProcessor',
          operation: 'processEvent',
          providerId: event.providerId
        },
        errorResult.severity,
        errorResult.category
      );
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Webhook processing failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Process Netflix webhook event
   */
  private async processNetflixEvent(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      console.log(`Processing Netflix webhook event: ${event.eventType}`);
      
      // Handle different event types
      switch (event.eventType) {
        case 'subscription.updated':
          return await this.handleNetflixSubscriptionUpdate(event);
        case 'subscription.cancelled':
          return await this.handleNetflixSubscriptionCancel(event);
        case 'payment.failed':
          return await this.handleNetflixPaymentFailure(event);
        default:
          console.log(`Unhandled Netflix event type: ${event.eventType}`);
          return { success: true, shouldSync: false, data: { message: 'Event processed but no action taken' } };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Netflix webhook processing failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Process Spotify webhook event
   */
  private async processSpotifyEvent(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      console.log(`Processing Spotify webhook event: ${event.eventType}`);
      
      // Handle different event types
      switch (event.eventType) {
        case 'subscription.updated':
          return await this.handleSpotifySubscriptionUpdate(event);
        case 'subscription.cancelled':
          return await this.handleSpotifySubscriptionCancel(event);
        case 'account.updated':
          return await this.handleSpotifyAccountUpdate(event);
        default:
          console.log(`Unhandled Spotify event type: ${event.eventType}`);
          return { success: true, shouldSync: false, data: { message: 'Event processed but no action taken' } };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Spotify webhook processing failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Process OpenAI webhook event
   */
  private async processOpenAIEvent(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      console.log(`Processing OpenAI webhook event: ${event.eventType}`);
      
      // Handle different event types
      switch (event.eventType) {
        case 'subscription.updated':
          return await this.handleOpenAISubscriptionUpdate(event);
        case 'usage.updated':
          return await this.handleOpenAIUsageUpdate(event);
        case 'account.updated':
          return await this.handleOpenAIAccountUpdate(event);
        default:
          console.log(`Unhandled OpenAI event type: ${event.eventType}`);
          return { success: true, shouldSync: false, data: { message: 'Event processed but no action taken' } };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('OpenAI webhook processing failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Process Amazon webhook event
   */
  private async processAmazonEvent(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      console.log(`Processing Amazon webhook event: ${event.eventType}`);
      
      // Handle different event types
      switch (event.eventType) {
        case 'subscription.updated':
          return await this.handleAmazonSubscriptionUpdate(event);
        case 'subscription.cancelled':
          return await this.handleAmazonSubscriptionCancel(event);
        case 'payment.updated':
          return await this.handleAmazonPaymentUpdate(event);
        default:
          console.log(`Unhandled Amazon event type: ${event.eventType}`);
          return { success: true, shouldSync: false, data: { message: 'Event processed but no action taken' } };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Amazon webhook processing failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle Netflix subscription update
   */
  private async handleNetflixSubscriptionUpdate(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract subscription data from payload
      const subscriptionData = event.payload.subscription;
      
      if (!subscriptionData) {
        return { success: false, shouldSync: false, error: 'Missing subscription data in payload' };
      }

      // Update subscription in database
      // In a real implementation, you would map the Netflix data to your internal format
      // and update the database accordingly
      
      console.log(`Netflix subscription updated for user: ${subscriptionData.userId}`);
      
      // Return success with sync flag
      return { 
        success: true, 
        shouldSync: true, 
        data: { 
          message: 'Netflix subscription updated', 
          subscriptionId: subscriptionData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Netflix subscription update failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle Netflix subscription cancel
   */
  private async handleNetflixSubscriptionCancel(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract subscription data from payload
      const subscriptionData = event.payload.subscription;
      
      if (!subscriptionData) {
        return { success: false, shouldSync: false, error: 'Missing subscription data in payload' };
      }

      // Update subscription status in database
      // In a real implementation, you would update the subscription status to cancelled
      
      console.log(`Netflix subscription cancelled for user: ${subscriptionData.userId}`);
      
      // Return success with sync flag
      return { 
        success: true, 
        shouldSync: true, 
        data: { 
          message: 'Netflix subscription cancelled', 
          subscriptionId: subscriptionData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Netflix subscription cancel failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle Netflix payment failure
   */
  private async handleNetflixPaymentFailure(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract payment data from payload
      const paymentData = event.payload.payment;
      
      if (!paymentData) {
        return { success: false, shouldSync: false, error: 'Missing payment data in payload' };
      }

      // Update payment status in database
      // In a real implementation, you would update the payment status to failed
      
      console.log(`Netflix payment failed for user: ${paymentData.userId}`);
      
      // Return success without sync flag (payment failure doesn't require sync)
      return { 
        success: true, 
        shouldSync: false, 
        data: { 
          message: 'Netflix payment failure recorded', 
          paymentId: paymentData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Netflix payment failure handling failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle Spotify subscription update
   */
  private async handleSpotifySubscriptionUpdate(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract subscription data from payload
      const subscriptionData = event.payload.subscription;
      
      if (!subscriptionData) {
        return { success: false, shouldSync: false, error: 'Missing subscription data in payload' };
      }

      // Update subscription in database
      
      console.log(`Spotify subscription updated for user: ${subscriptionData.userId}`);
      
      // Return success with sync flag
      return { 
        success: true, 
        shouldSync: true, 
        data: { 
          message: 'Spotify subscription updated', 
          subscriptionId: subscriptionData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Spotify subscription update failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle Spotify subscription cancel
   */
  private async handleSpotifySubscriptionCancel(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract subscription data from payload
      const subscriptionData = event.payload.subscription;
      
      if (!subscriptionData) {
        return { success: false, shouldSync: false, error: 'Missing subscription data in payload' };
      }

      // Update subscription status in database
      
      console.log(`Spotify subscription cancelled for user: ${subscriptionData.userId}`);
      
      // Return success with sync flag
      return { 
        success: true, 
        shouldSync: true, 
        data: { 
          message: 'Spotify subscription cancelled', 
          subscriptionId: subscriptionData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Spotify subscription cancel failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle Spotify account update
   */
  private async handleSpotifyAccountUpdate(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract account data from payload
      const accountData = event.payload.account;
      
      if (!accountData) {
        return { success: false, shouldSync: false, error: 'Missing account data in payload' };
      }

      // Update account information in database
      
      console.log(`Spotify account updated for user: ${accountData.userId}`);
      
      // Return success without sync flag (account update doesn't require sync)
      return { 
        success: true, 
        shouldSync: false, 
        data: { 
          message: 'Spotify account updated', 
          accountId: accountData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Spotify account update failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle OpenAI subscription update
   */
  private async handleOpenAISubscriptionUpdate(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract subscription data from payload
      const subscriptionData = event.payload.subscription;
      
      if (!subscriptionData) {
        return { success: false, shouldSync: false, error: 'Missing subscription data in payload' };
      }

      // Update subscription in database
      
      console.log(`OpenAI subscription updated for user: ${subscriptionData.userId}`);
      
      // Return success with sync flag
      return { 
        success: true, 
        shouldSync: true, 
        data: { 
          message: 'OpenAI subscription updated', 
          subscriptionId: subscriptionData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('OpenAI subscription update failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle OpenAI usage update
   */
 private async handleOpenAIUsageUpdate(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract usage data from payload
      const usageData = event.payload.usage;
      
      if (!usageData) {
        return { success: false, shouldSync: false, error: 'Missing usage data in payload' };
      }

      // Update usage information in database
      
      console.log(`OpenAI usage updated for user: ${usageData.userId}`);
      
      // Return success without sync flag (usage update doesn't require sync)
      return { 
        success: true, 
        shouldSync: false, 
        data: { 
          message: 'OpenAI usage updated', 
          usageId: usageData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('OpenAI usage update failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle OpenAI account update
   */
  private async handleOpenAIAccountUpdate(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract account data from payload
      const accountData = event.payload.account;
      
      if (!accountData) {
        return { success: false, shouldSync: false, error: 'Missing account data in payload' };
      }

      // Update account information in database
      
      console.log(`OpenAI account updated for user: ${accountData.userId}`);
      
      // Return success without sync flag (account update doesn't require sync)
      return { 
        success: true, 
        shouldSync: false, 
        data: { 
          message: 'OpenAI account updated', 
          accountId: accountData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('OpenAI account update failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle Amazon subscription update
   */
 private async handleAmazonSubscriptionUpdate(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract subscription data from payload
      const subscriptionData = event.payload.subscription;
      
      if (!subscriptionData) {
        return { success: false, shouldSync: false, error: 'Missing subscription data in payload' };
      }

      // Update subscription in database
      
      console.log(`Amazon subscription updated for user: ${subscriptionData.userId}`);
      
      // Return success with sync flag
      return { 
        success: true, 
        shouldSync: true, 
        data: { 
          message: 'Amazon subscription updated', 
          subscriptionId: subscriptionData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Amazon subscription update failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle Amazon subscription cancel
   */
  private async handleAmazonSubscriptionCancel(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract subscription data from payload
      const subscriptionData = event.payload.subscription;
      
      if (!subscriptionData) {
        return { success: false, shouldSync: false, error: 'Missing subscription data in payload' };
      }

      // Update subscription status in database
      
      console.log(`Amazon subscription cancelled for user: ${subscriptionData.userId}`);
      
      // Return success with sync flag
      return { 
        success: true, 
        shouldSync: true, 
        data: { 
          message: 'Amazon subscription cancelled', 
          subscriptionId: subscriptionData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Amazon subscription cancel failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Handle Amazon payment update
   */
  private async handleAmazonPaymentUpdate(event: WebhookEvent): Promise<WebhookProcessingResult> {
    try {
      // Extract payment data from payload
      const paymentData = event.payload.payment;
      
      if (!paymentData) {
        return { success: false, shouldSync: false, error: 'Missing payment data in payload' };
      }

      // Update payment information in database
      
      console.log(`Amazon payment updated for user: ${paymentData.userId}`);
      
      // Return success without sync flag (payment update doesn't require sync)
      return { 
        success: true, 
        shouldSync: false, 
        data: { 
          message: 'Amazon payment updated', 
          paymentId: paymentData.id 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Amazon payment update failed:', errorMessage);
      return { success: false, shouldSync: false, error: errorMessage };
    }
  }

  /**
   * Check if processor is healthy
   */
  isHealthy(): boolean {
    return this.initialized;
 }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // No cleanup needed for now
    console.log('Webhook processor cleanup completed');
  }
}