import { WebhookEvent } from './WebhookHandler';
import { oauthService } from '../oauth';
import crypto from 'crypto';

/**
 * Webhook Validation Result
 */
export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Webhook Validator - Validate webhook signatures and payloads
 * 
 * This class handles validation of incoming webhook requests including:
 * - Signature verification using provider-specific algorithms
 * - Payload integrity checks
 * - Timestamp validation to prevent replay attacks
 * - Provider-specific validation rules
 */
export class WebhookValidator {
  private initialized: boolean = false;
  private providerSecrets: Map<string, string> = new Map();

  constructor() {}

  /**
   * Initialize the webhook validator
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('Initializing webhook validator...');
      
      // Load provider secrets from configuration
      // In a real implementation, these would come from secure storage
      this.providerSecrets.set('netflix', process.env.NETFLIX_WEBHOOK_SECRET || '');
      this.providerSecrets.set('spotify', process.env.SPOTIFY_WEBHOOK_SECRET || '');
      this.providerSecrets.set('openai', process.env.OPENAI_WEBHOOK_SECRET || '');
      this.providerSecrets.set('amazon', process.env.AMAZON_WEBHOOK_SECRET || '');
      
      this.initialized = true;
      console.log('✅ Webhook validator initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize webhook validator:', error);
      throw error;
    }
  }

  /**
   * Validate webhook event
   */
  async validateWebhook(
    event: WebhookEvent,
    headers?: Record<string, string>
  ): Promise<WebhookValidationResult> {
    try {
      // Check if validator is initialized
      if (!this.initialized) {
        return { isValid: false, error: 'Validator not initialized' };
      }

      // Validate provider
      if (!event.providerId) {
        return { isValid: false, error: 'Missing provider ID' };
      }

      // Validate payload
      if (!event.payload) {
        return { isValid: false, error: 'Missing payload' };
      }

      // Validate timestamp (prevent old events)
      const eventAge = Date.now() - event.timestamp.getTime();
      if (eventAge > 300000) { // 5 minutes
        return { isValid: false, error: 'Event too old' };
      }

      // Validate signature if provided
      if (event.signature && headers) {
        const signatureValid = await this.validateSignature(event, headers);
        if (!signatureValid) {
          return { isValid: false, error: 'Invalid signature' };
        }
      }

      // Provider-specific validation
      const providerValid = await this.validateProviderSpecific(event);
      if (!providerValid) {
        return { isValid: false, error: 'Provider-specific validation failed' };
      }

      return { isValid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Webhook validation failed:', errorMessage);
      return { isValid: false, error: errorMessage };
    }
  }

  /**
   * Validate webhook signature
   */
  private async validateSignature(
    event: WebhookEvent,
    headers: Record<string, string>
  ): Promise<boolean> {
    try {
      const providerSecret = this.providerSecrets.get(event.providerId);
      if (!providerSecret) {
        console.warn(`No secret found for provider ${event.providerId}`);
        return false;
      }

      // Different providers use different signature methods
      switch (event.providerId) {
        case 'netflix':
          return this.validateNetflixSignature(event, headers, providerSecret);
        case 'spotify':
          return this.validateSpotifySignature(event, headers, providerSecret);
        case 'openai':
          return this.validateOpenAISignature(event, headers, providerSecret);
        case 'amazon':
          return this.validateAmazonSignature(event, headers, providerSecret);
        default:
          console.warn(`Unknown provider ${event.providerId} for signature validation`);
          return false;
      }
    } catch (error) {
      console.error('Signature validation failed:', error);
      return false;
    }
  }

  /**
   * Validate Netflix webhook signature
   */
  private validateNetflixSignature(
    event: WebhookEvent,
    headers: Record<string, string>,
    secret: string
  ): boolean {
    try {
      // Netflix uses HMAC-SHA256
      const signatureHeader = headers['x-netflix-signature'];
      if (!signatureHeader) {
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(event.payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signatureHeader, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Netflix signature validation failed:', error);
      return false;
    }
  }

  /**
   * Validate Spotify webhook signature
   */
  private validateSpotifySignature(
    event: WebhookEvent,
    headers: Record<string, string>,
    secret: string
  ): boolean {
    try {
      // Spotify uses HMAC-SHA1
      const signatureHeader = headers['x-spotify-signature'];
      if (!signatureHeader) {
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha1', secret)
        .update(JSON.stringify(event.payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signatureHeader, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Spotify signature validation failed:', error);
      return false;
    }
  }

  /**
   * Validate OpenAI webhook signature
   */
  private validateOpenAISignature(
    event: WebhookEvent,
    headers: Record<string, string>,
    secret: string
  ): boolean {
    try {
      // OpenAI uses HMAC-SHA256 with timestamp
      const signatureHeader = headers['openai-signature'];
      const timestampHeader = headers['openai-timestamp'];
      
      if (!signatureHeader || !timestampHeader) {
        return false;
      }

      // Check timestamp
      const timestamp = parseInt(timestampHeader, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > 300) { // 5 minutes
        return false;
      }

      const payload = `${timestamp}.${JSON.stringify(event.payload)}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signatureHeader, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('OpenAI signature validation failed:', error);
      return false;
    }
  }

  /**
   * Validate Amazon webhook signature
   */
  private validateAmazonSignature(
    event: WebhookEvent,
    headers: Record<string, string>,
    secret: string
  ): boolean {
    try {
      // Amazon uses SHA256 with certificate verification
      const signatureHeader = headers['x-amz-signature'];
      const certUrlHeader = headers['x-amz-cert-url'];
      
      if (!signatureHeader || !certUrlHeader) {
        return false;
      }

      // For simplicity, we'll just check if the signature matches
      // In a real implementation, you would verify the certificate and signature properly
      const expectedSignature = crypto
        .createHash('sha256')
        .update(JSON.stringify(event.payload) + secret)
        .digest('hex');

      return signatureHeader === expectedSignature;
    } catch (error) {
      console.error('Amazon signature validation failed:', error);
      return false;
    }
  }

  /**
   * Provider-specific validation
   */
  private async validateProviderSpecific(event: WebhookEvent): Promise<boolean> {
    try {
      // Validate connection exists for this provider
      if (event.connectionId) {
        // In a real implementation, you would check if the connection exists
        // and is valid for this provider
        // const connection = await oauthService.getConnection(event.connectionId);
        // if (!connection || connection.providerId !== event.providerId) {
        //   return false;
        // }
      }

      // Additional provider-specific validations could go here
      return true;
    } catch (error) {
      console.error('Provider-specific validation failed:', error);
      return false;
    }
  }

  /**
   * Check if validator is healthy
   */
  isHealthy(): boolean {
    return this.initialized;
 }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // No cleanup needed for now
    console.log('Webhook validator cleanup completed');
  }
}