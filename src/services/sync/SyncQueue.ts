import {
  SyncJob,
  SyncJobResult,
  SyncJobStatus,
  SyncPriority,
  SyncOperationType,
  SyncError,
  QueueMetrics,
  QueueConfig,
  SyncEvent,
  SyncJobHandler,
  SyncEventHandler
} from './types';

/**
 * Sync Queue Implementation
 *
 * Manages a priority queue for sync operations with:
 * - Priority-based job scheduling
 * - Concurrent job processing
 * - Retry logic with exponential backoff
 * - Real-time metrics and monitoring
 * - Event-driven architecture
 */
export class SyncQueue {
  private static instance: SyncQueue;
  private config: QueueConfig;
  private jobs: Map<string, SyncJob> = new Map();
  private priorityQueues: Map<SyncPriority, SyncJob[]> = new Map();
  private runningJobs: Set<string> = new Set();
  private jobHandlers: Map<SyncOperationType, SyncJobHandler> = new Map();
  private eventHandlers: SyncEventHandler[] = [];
  private isProcessing = false;
  private cleanupTimer?: NodeJS.Timeout;
  private metrics: QueueMetrics = this.initializeMetrics();

  private constructor(config: QueueConfig = SyncQueue.getDefaultConfig()) {
    this.config = config;
    this.initializePriorityQueues();
    this.startCleanupTimer();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: QueueConfig): SyncQueue {
    if (!SyncQueue.instance) {
      SyncQueue.instance = new SyncQueue(config);
    }
    return SyncQueue.instance;
  }

  /**
   * Get default queue configuration
   */
  static getDefaultConfig(): QueueConfig {
    return {
      maxConcurrentJobs: 3,
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      exponentialBackoff: true,
      backoffMultiplier: 2,
      maxRetryDelay: 30000, // 30 seconds
      jobTimeout: 300000, // 5 minutes
      cleanupInterval: 300000, // 5 minutes
      maxQueueSize: 1000
    };
  }

  /**
   * Initialize priority queues
   */
  private initializePriorityQueues(): void {
    Object.values(SyncPriority).forEach(priority => {
      this.priorityQueues.set(priority, []);
    });
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): QueueMetrics {
    return {
      totalJobs: 0,
      pendingJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      throughput: 0
    };
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Add job to queue
   */
  async addJob(job: Omit<SyncJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'retryCount'>): Promise<string> {
    // Check queue size limit
    if (this.jobs.size >= this.config.maxQueueSize) {
      throw new Error('Queue size limit exceeded');
    }

    const jobId = this.generateJobId();
    const newJob: SyncJob = {
      ...job,
      id: jobId,
      status: SyncJobStatus.PENDING,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add to main jobs map
    this.jobs.set(jobId, newJob);

    // Add to priority queue
    const priorityQueue = this.priorityQueues.get(job.priority) || [];
    priorityQueue.push(newJob);
    this.priorityQueues.set(job.priority, priorityQueue);

    // Update metrics
    this.metrics.totalJobs++;
    this.metrics.pendingJobs++;

    // Emit event
    this.emitEvent({
      type: 'job_queued',
      jobId,
      connectionId: job.connectionId,
      userId: job.userId,
      providerId: job.providerId,
      data: { job: newJob },
      timestamp: new Date()
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return jobId;
  }

  /**
   * Remove job from queue
   */
  removeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // Remove from main jobs map
    this.jobs.delete(jobId);

    // Remove from priority queue
    const priorityQueue = this.priorityQueues.get(job.priority) || [];
    const index = priorityQueue.findIndex(j => j.id === jobId);
    if (index > -1) {
      priorityQueue.splice(index, 1);
      this.priorityQueues.set(job.priority, priorityQueue);
    }

    // Remove from running jobs if applicable
    this.runningJobs.delete(jobId);

    // Update metrics
    this.updateMetricsAfterJobRemoval(job);

    return true;
  }

  /**
   * Get next job to process
   */
  private getNextJob(): SyncJob | null {
    // Process jobs in priority order: URGENT -> HIGH -> NORMAL -> LOW
    const priorities: SyncPriority[] = [SyncPriority.URGENT, SyncPriority.HIGH, SyncPriority.NORMAL, SyncPriority.LOW];

    for (const priority of priorities) {
      const queue = this.priorityQueues.get(priority) || [];
      if (queue.length > 0) {
        const job = queue.shift()!;
        this.priorityQueues.set(priority, queue);
        return job;
      }
    }

    return null;
  }

  /**
   * Start processing jobs
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    console.log('SyncQueue: Started processing jobs');

    while (this.isProcessing) {
      try {
        // Check if we can process more jobs
        if (this.runningJobs.size >= this.config.maxConcurrentJobs) {
          await this.sleep(1000); // Wait 1 second before checking again
          continue;
        }

        // Get next job
        const job = this.getNextJob();
        if (!job) {
          // No jobs to process, wait a bit
          await this.sleep(5000);
          continue;
        }

        // Process the job
        this.processJob(job);

      } catch (error) {
        console.error('SyncQueue: Error in processing loop:', error);
        await this.sleep(1000);
      }
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: SyncJob): Promise<void> {
    const startTime = Date.now();

    // Update job status
    job.status = SyncJobStatus.RUNNING;
    job.startedAt = new Date();
    job.updatedAt = new Date();
    this.runningJobs.add(job.id);

    // Update metrics
    this.metrics.pendingJobs--;
    this.metrics.runningJobs++;

    // Emit event
    this.emitEvent({
      type: 'job_started',
      jobId: job.id,
      connectionId: job.connectionId,
      userId: job.userId,
      providerId: job.providerId,
      data: { job },
      timestamp: new Date()
    });

    try {
      // Get handler for operation type
      const handler = this.jobHandlers.get(job.operationType);
      if (!handler) {
        throw new Error(`No handler found for operation type: ${job.operationType}`);
      }

      // Execute job with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), this.config.jobTimeout);
      });

      const result = await Promise.race([
        handler(job),
        timeoutPromise
      ]);

      // Handle successful completion
      await this.handleJobSuccess(job, result, startTime);

    } catch (error) {
      // Handle job failure
      await this.handleJobFailure(job, error as Error, startTime);
    }
  }

  /**
   * Handle successful job completion
   */
  private async handleJobSuccess(job: SyncJob, result: SyncJobResult, startTime: number): Promise<void> {
    const duration = Date.now() - startTime;

    // Update job
    job.status = SyncJobStatus.COMPLETED;
    job.completedAt = new Date();
    job.updatedAt = new Date();
    job.progress = undefined; // Clear progress

    // Update metrics
    this.metrics.runningJobs--;
    this.metrics.completedJobs++;
    this.updateAverageProcessingTime(duration);

    // Remove from running jobs
    this.runningJobs.delete(job.id);

    // Emit event
    this.emitEvent({
      type: 'job_completed',
      jobId: job.id,
      connectionId: job.connectionId,
      userId: job.userId,
      providerId: job.providerId,
      data: { job, result },
      timestamp: new Date()
    });

    console.log(`SyncQueue: Job ${job.id} completed successfully in ${duration}ms`);
  }

  /**
   * Handle job failure
   */
  private async handleJobFailure(job: SyncJob, error: Error, startTime: number): Promise<void> {
    const duration = Date.now() - startTime;

    // Update metrics
    this.metrics.runningJobs--;
    this.updateAverageProcessingTime(duration);

    // Remove from running jobs
    this.runningJobs.delete(job.id);

    // Check if we should retry
    const shouldRetry = this.shouldRetryJob(job, error);

    if (shouldRetry && job.retryCount < job.maxRetries) {
      // Schedule retry
      await this.scheduleRetry(job, error);
    } else {
      // Mark as failed
      job.status = SyncJobStatus.FAILED;
      job.completedAt = new Date();
      job.updatedAt = new Date();
      job.error = this.createSyncError(error, job);
      this.metrics.failedJobs++;

      // Emit event
      this.emitEvent({
        type: 'job_failed',
        jobId: job.id,
        connectionId: job.connectionId,
        userId: job.userId,
        providerId: job.providerId,
        data: { job, error: job.error },
        timestamp: new Date()
      });

      console.error(`SyncQueue: Job ${job.id} failed after ${job.retryCount} retries:`, error.message);
    }
  }

  /**
   * Check if job should be retried
   */
  private shouldRetryJob(job: SyncJob, error: Error): boolean {
    // Don't retry if we've exceeded max retries
    if (job.retryCount >= job.maxRetries) {
      return false;
    }

    // Don't retry certain types of errors
    const nonRetryableErrors = ['INVALID_CREDENTIALS', 'ACCESS_DENIED', 'NOT_FOUND'];
    if (nonRetryableErrors.some(code => error.message.includes(code))) {
      return false;
    }

    return true;
  }

  /**
   * Schedule job retry
   */
  private async scheduleRetry(job: SyncJob, error: Error): Promise<void> {
    job.retryCount++;
    job.status = SyncJobStatus.RETRYING;
    job.updatedAt = new Date();

    // Calculate retry delay
    const delay = this.calculateRetryDelay(job.retryCount);

    // Set next retry time
    job.nextRetryAt = new Date(Date.now() + delay);

    // Move job back to appropriate priority queue
    const priorityQueue = this.priorityQueues.get(job.priority) || [];
    priorityQueue.push(job);
    this.priorityQueues.set(job.priority, priorityQueue);

    // Update metrics
    this.metrics.pendingJobs++;

    // Emit event
    this.emitEvent({
      type: 'job_queued', // Re-queued for retry
      jobId: job.id,
      connectionId: job.connectionId,
      userId: job.userId,
      providerId: job.providerId,
      data: { job, retryDelay: delay },
      timestamp: new Date()
    });

    console.log(`SyncQueue: Job ${job.id} scheduled for retry ${job.retryCount}/${job.maxRetries} in ${delay}ms`);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    if (!this.config.exponentialBackoff) {
      return this.config.retryDelay;
    }

    const delay = this.config.retryDelay * Math.pow(this.config.backoffMultiplier, retryCount - 1);
    return Math.min(delay, this.config.maxRetryDelay);
  }

  /**
   * Create sync error from error
   */
  private createSyncError(error: Error, job: SyncJob): SyncError {
    return {
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message,
      details: {
        stack: error.stack,
        jobId: job.id,
        operationType: job.operationType
      },
      timestamp: new Date(),
      jobId: job.id,
      connectionId: job.connectionId,
      providerId: job.providerId,
      operationType: job.operationType,
      retryable: this.shouldRetryJob(job, error),
      severity: this.determineErrorSeverity(error)
    };
  }

  /**
   * Determine error severity
   */
  private determineErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('timeout')) {
      return 'medium';
    }

    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return 'high';
    }

    if (message.includes('server error') || message.includes('internal error')) {
      return 'critical';
    }

    return 'low';
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(duration: number): void {
    const totalCompleted = this.metrics.completedJobs + this.metrics.failedJobs;
    if (totalCompleted > 0) {
      this.metrics.averageProcessingTime =
        (this.metrics.averageProcessingTime * (totalCompleted - 1) + duration) / totalCompleted;
    }
  }

  /**
   * Update metrics after job removal
   */
  private updateMetricsAfterJobRemoval(job: SyncJob): void {
    switch (job.status) {
      case SyncJobStatus.COMPLETED:
        this.metrics.completedJobs--;
        break;
      case SyncJobStatus.FAILED:
        this.metrics.failedJobs--;
        break;
      case SyncJobStatus.RUNNING:
        this.metrics.runningJobs--;
        break;
      case SyncJobStatus.PENDING:
      case SyncJobStatus.QUEUED:
        this.metrics.pendingJobs--;
        break;
    }
    this.metrics.totalJobs--;
  }

  /**
   * Register job handler
   */
  registerHandler(operationType: SyncOperationType, handler: SyncJobHandler): void {
    this.jobHandlers.set(operationType, handler);
    console.log(`SyncQueue: Registered handler for operation type: ${operationType}`);
  }

  /**
   * Unregister job handler
   */
  unregisterHandler(operationType: SyncOperationType): boolean {
    return this.jobHandlers.delete(operationType);
  }

  /**
   * Add event handler
   */
  addEventHandler(handler: SyncEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove event handler
   */
  removeEventHandler(handler: SyncEventHandler): boolean {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Emit event to all handlers
   */
  private emitEvent(event: SyncEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('SyncQueue: Error in event handler:', error);
      }
    });
  }

  /**
   * Get queue metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get all jobs
   */
  getAllJobs(): SyncJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: SyncJobStatus): SyncJob[] {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): SyncJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get queue status
   */
  getStatus(): {
    isProcessing: boolean;
    queueSize: number;
    runningJobs: number;
    handlersRegistered: number;
    eventHandlersRegistered: number;
  } {
    return {
      isProcessing: this.isProcessing,
      queueSize: this.jobs.size,
      runningJobs: this.runningJobs.size,
      handlersRegistered: this.jobHandlers.size,
      eventHandlersRegistered: this.eventHandlers.length
    };
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId: string, progress: SyncJob['progress']): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    job.progress = progress;
    job.updatedAt = new Date();

    // Emit progress event
    this.emitEvent({
      type: 'job_progress',
      jobId,
      connectionId: job.connectionId,
      userId: job.userId,
      providerId: job.providerId,
      data: { progress },
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== SyncJobStatus.PENDING) {
      return false;
    }

    job.status = SyncJobStatus.CANCELLED;
    job.completedAt = new Date();
    job.updatedAt = new Date();

    // Remove from priority queue
    const priorityQueue = this.priorityQueues.get(job.priority) || [];
    const index = priorityQueue.findIndex(j => j.id === jobId);
    if (index > -1) {
      priorityQueue.splice(index, 1);
      this.priorityQueues.set(job.priority, priorityQueue);
    }

    // Update metrics
    this.metrics.pendingJobs--;

    // Emit event
    this.emitEvent({
      type: 'job_cancelled',
      jobId,
      connectionId: job.connectionId,
      userId: job.userId,
      providerId: job.providerId,
      data: { job },
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Cleanup old jobs
   */
  private cleanup(): void {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const jobsToRemove: string[] = [];

    for (const [jobId, job] of this.jobs) {
      if (job.completedAt && job.completedAt < cutoffDate) {
        jobsToRemove.push(jobId);
      }
    }

    jobsToRemove.forEach(jobId => {
      this.removeJob(jobId);
    });

    if (jobsToRemove.length > 0) {
      console.log(`SyncQueue: Cleaned up ${jobsToRemove.length} old jobs`);
    }
  }

  /**
   * Stop processing
   */
  stop(): void {
    this.isProcessing = false;
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    console.log('SyncQueue: Stopped processing jobs');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}