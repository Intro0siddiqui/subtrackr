/**
 * Webhook Service Layer - Main Entry Point
 *
 * This module provides a complete webhook processing system with:
 * - Multi-provider support (Netflix, Spotify, ChatGPT, Amazon Prime)
 * - Secure validation of webhook signatures and payloads
 * - Queue management for webhook events
 * - Processing of validated webhook events
 * - Reporting and analytics for webhook operations
 *
 * @example
 * ```typescript
 * import { webhookHandler, webhookValidator, webhookProcessor } from '@/services/webhook';
 *
 * // Initialize the webhook service
 * await webhookHandler.initialize();
 *
 * // Handle incoming webhook
 * const result = await webhookHandler.handleWebhook(
 *   'netflix',
 *   'subscription.updated',
 *   payload,
 *   signature,
 *   headers
 * );
 * ```
 */

// Core Components
export { WebhookHandler, webhookHandler } from './WebhookHandler';
export { WebhookValidator } from './WebhookValidator';
export { WebhookProcessor } from './WebhookProcessor';
export { WebhookQueue } from './WebhookQueue';
export { WebhookReporter } from './WebhookReporter';

// Types
export type { WebhookEvent } from './WebhookHandler';
export type { WebhookValidationResult } from './WebhookValidator';
export type { WebhookProcessingResult } from './WebhookProcessor';
export type { WebhookReportEntry } from './WebhookReporter';

import { webhookHandler } from './WebhookHandler';

// Main Service Class
export class WebhookService {
  private static instance: WebhookService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  /**
   * Initialize the webhook service
   */
  async initialize(): Promise<void> {
    return await webhookHandler.initialize();
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(
    providerId: string,
    eventType: string,
    payload: any,
    signature?: string,
    headers?: Record<string, string>
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    return await webhookHandler.handleWebhook(providerId, eventType, payload, signature, headers);
  }

  /**
   * Process webhook events
   */
  async processWebhooks(): Promise<void> {
    return await webhookHandler.processWebhooks();
  }

  /**
   * Get webhook service status
   */
  getStatus() {
    return webhookHandler.getStatus();
  }

  /**
   * Health check
   */
  async healthCheck() {
    return await webhookHandler.healthCheck();
  }

  /**
   * Shutdown the webhook service
   */
  async shutdown(): Promise<void> {
    return await webhookHandler.shutdown();
  }
}

// Export singleton instance
export const webhookService = WebhookService.getInstance();

// Default export
export default webhookService;