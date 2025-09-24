import { WebhookEvent } from './WebhookHandler';

/**
 * Webhook Queue - Queue management for webhook events
 * 
 * This class handles queue management for webhook events including:
 * - Enqueuing validated events
 * - Dequeuing events for processing
 * - Managing queue size limits
 * - Providing queue metrics
 */
export class WebhookQueue {
  private queue: WebhookEvent[] = [];
  private maxSize: number;
  private initialized: boolean = false;
  private processing: boolean = false;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Initialize the webhook queue
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('Initializing webhook queue...');
      this.initialized = true;
      console.log('✅ Webhook queue initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize webhook queue:', error);
      throw error;
    }
  }

  /**
   * Add event to queue
   */
  async enqueue(event: WebhookEvent): Promise<boolean> {
    try {
      // Check if queue is initialized
      if (!this.initialized) {
        throw new Error('Queue not initialized');
      }

      // Check queue size limit
      if (this.queue.length >= this.maxSize) {
        console.warn('Webhook queue is full, dropping event');
        return false;
      }

      // Add event to queue
      this.queue.push(event);
      console.log(`Event ${event.id} enqueued, queue size: ${this.queue.length}`);
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to enqueue event:', errorMessage);
      return false;
    }
  }

  /**
   * Remove event from queue
   */
  async dequeue(): Promise<WebhookEvent | null> {
    try {
      // Check if queue is initialized
      if (!this.initialized) {
        throw new Error('Queue not initialized');
      }

      // Return null if queue is empty
      if (this.queue.length === 0) {
        return null;
      }

      // Remove and return first event
      const event = this.queue.shift() || null;
      if (event) {
        console.log(`Event ${event.id} dequeued, queue size: ${this.queue.length}`);
      }
      
      return event;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to dequeue event:', errorMessage);
      return null;
    }
  }

  /**
   * Remove multiple events from queue
   */
  async dequeueBatch(count: number): Promise<WebhookEvent[]> {
    try {
      // Check if queue is initialized
      if (!this.initialized) {
        throw new Error('Queue not initialized');
      }

      // Determine how many events to dequeue
      const dequeueCount = Math.min(count, this.queue.length);
      
      // Remove and return events
      const events = this.queue.splice(0, dequeueCount);
      console.log(`Dequeued ${events.length} events, queue size: ${this.queue.length}`);
      
      return events;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to dequeue batch:', errorMessage);
      return [];
    }
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Check if queue is full
   */
  isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }

  /**
   * Get queue capacity
   */
  capacity(): number {
    return this.maxSize;
  }

  /**
   * Get available space in queue
   */
  availableSpace(): number {
    return this.maxSize - this.queue.length;
  }

  /**
   * Clear queue
   */
  async clear(): Promise<void> {
    this.queue = [];
    console.log('Webhook queue cleared');
  }

  /**
   * Check if queue is healthy
   */
  isHealthy(): boolean {
    return this.initialized && this.queue.length <= this.maxSize;
  }

  /**
   * Get queue metrics
   */
  getMetrics(): {
    size: number;
    capacity: number;
    availableSpace: number;
    isFull: boolean;
    isEmpty: boolean;
  } {
    return {
      size: this.queue.length,
      capacity: this.maxSize,
      availableSpace: this.availableSpace(),
      isFull: this.isFull(),
      isEmpty: this.isEmpty()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Process remaining events before cleanup
    if (this.queue.length > 0) {
      console.log(`Processing ${this.queue.length} remaining events before cleanup`);
      // In a real implementation, you would want to process or persist these events
    }
    
    this.queue = [];
    console.log('Webhook queue cleanup completed');
  }
}