import {
  SyncJob,
  SyncJobStatus,
  SyncOperationType,
  SyncPriority,
  SyncEngineConfig,
  SyncEngineStatus,
  SyncEvent,
  SyncSchedule,
  SyncReport,
  SyncAnalytics,
  SyncConflict,
  ProviderSyncConfig
} from './types';
import { SyncQueue } from './SyncQueue';
import { SyncProcessor } from './SyncProcessor';
import { SyncScheduler } from './SyncScheduler';
import { SyncReporter } from './SyncReporter';
import { oauthService } from '../oauth';
import { errorHandler } from '../error/ErrorHandler';
import { errorReporter } from '../error/ErrorReporter';

/**
 * Sync Manager Implementation
 *
 * Main orchestration engine for subscription synchronization with:
 * - Unified interface for all sync operations
 * - Multi-provider coordination
 * - Real-time status monitoring
 * - Error handling and recovery
 * - Configuration management
 * - Event-driven architecture
 */
export class SyncManager {
  private static instance: SyncManager;
  private config: SyncEngineConfig;
  private syncQueue: SyncQueue;
  private syncProcessor: SyncProcessor;
  private syncScheduler: SyncScheduler;
  private syncReporter: SyncReporter;
  private isInitialized = false;
  private eventHandlers: ((event: SyncEvent) => void)[] = [];

  private constructor(config: SyncEngineConfig = SyncManager.getDefaultConfig()) {
    this.config = config;
    this.syncQueue = SyncQueue.getInstance(config.queue);
    this.syncProcessor = SyncProcessor.getInstance();
    this.syncScheduler = SyncScheduler.getInstance(config.scheduler);
    this.syncReporter = SyncReporter.getInstance();
    this.initializeEventHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: SyncEngineConfig): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager(config);
    }
    return SyncManager.instance;
  }

  /**
   * Get default sync engine configuration
   */
  static getDefaultConfig(): SyncEngineConfig {
    return {
      queue: SyncQueue.getDefaultConfig(),
      scheduler: SyncScheduler.getDefaultConfig(),
      providers: {
        netflix: {
          providerId: 'netflix',
          enabled: true,
          syncFrequency: 'daily' as any,
          operationTypes: [
            SyncOperationType.SUBSCRIPTION_SYNC,
            SyncOperationType.BILLING_SYNC,
            SyncOperationType.PROFILE_SYNC
          ],
          rateLimit: {
            requestsPerSecond: 5,
            requestsPerMinute: 100,
            burstLimit: 10
          },
          timeout: 30000,
          retryConfig: {
            maxRetries: 3,
            retryDelay: 1000,
            exponentialBackoff: true
          },
          incrementalSync: {
            enabled: true,
            field: 'updated_at',
            lastSyncField: 'last_synced_at'
          },
          conflictResolution: {
            strategy: 'provider_wins',
            fields: ['amount', 'status', 'next_billing_date']
          }
        },
        spotify: {
          providerId: 'spotify',
          enabled: true,
          syncFrequency: 'weekly' as any,
          operationTypes: [
            SyncOperationType.SUBSCRIPTION_SYNC,
            SyncOperationType.BILLING_SYNC
          ],
          rateLimit: {
            requestsPerSecond: 10,
            requestsPerMinute: 200,
            burstLimit: 20
          },
          timeout: 15000,
          retryConfig: {
            maxRetries: 2,
            retryDelay: 500,
            exponentialBackoff: true
          },
          incrementalSync: {
            enabled: true,
            field: 'last_updated',
            lastSyncField: 'last_synced_at'
          },
          conflictResolution: {
            strategy: 'merge',
            fields: ['amount', 'status']
          }
        },
        openai: {
          providerId: 'openai',
          enabled: true,
          syncFrequency: 'monthly' as any,
          operationTypes: [
            SyncOperationType.SUBSCRIPTION_SYNC,
            SyncOperationType.BILLING_SYNC
          ],
          rateLimit: {
            requestsPerSecond: 20,
            requestsPerMinute: 300,
            burstLimit: 30
          },
          timeout: 10000,
          retryConfig: {
            maxRetries: 2,
            retryDelay: 300,
            exponentialBackoff: false
          },
          incrementalSync: {
            enabled: false,
            field: '',
            lastSyncField: ''
          },
          conflictResolution: {
            strategy: 'local_wins',
            fields: ['amount', 'billing_cycle']
          }
        },
        amazon: {
          providerId: 'amazon',
          enabled: true,
          syncFrequency: 'daily' as any,
          operationTypes: [
            SyncOperationType.SUBSCRIPTION_SYNC,
            SyncOperationType.BILLING_SYNC,
            SyncOperationType.PROFILE_SYNC
          ],
          rateLimit: {
            requestsPerSecond: 8,
            requestsPerMinute: 150,
            burstLimit: 15
          },
          timeout: 20000,
          retryConfig: {
            maxRetries: 3,
            retryDelay: 800,
            exponentialBackoff: true
          },
          incrementalSync: {
            enabled: true,
            field: 'lastModifiedDate',
            lastSyncField: 'last_synced_at'
          },
          conflictResolution: {
            strategy: 'provider_wins',
            fields: ['amount', 'status', 'next_billing_date']
          }
        }
      },
      reporting: {
        enabled: true,
        interval: 5, // minutes
        retentionDays: 30
      },
      events: {
        enabled: true,
        realtime: true,
        webhookUrl: undefined
      }
    };
  }

  /**
   * Initialize the sync engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('SyncManager: Already initialized');
      return;
    }

    try {
      console.log('SyncManager: Initializing sync engine...');

      // Initialize OAuth service
      await oauthService.initialize();

      // Configure providers
      this.configureProviders();

      // Start scheduler
      await this.syncScheduler.start();

      this.isInitialized = true;
      console.log('SyncManager: Sync engine initialized successfully');

      // Emit initialization event
      this.emitEvent({
        type: 'job_queued', // Using existing event type for initialization
        jobId: 'system_init',
        connectionId: 'system',
        userId: 'system',
        providerId: 'system',
        data: { initialized: true },
        timestamp: new Date()
      });

    } catch (error) {
      // Handle error with new error handling system
      const appError = {
        code: error instanceof Error ? error.name : 'INITIALIZATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown initialization error',
        timestamp: new Date()
      };
      
      const errorResult = errorHandler.handleError(appError, {
        component: 'SyncManager',
        operation: 'initialize'
      });
      
      // Report the error
      errorReporter.reportError(
        appError,
        {
          component: 'SyncManager',
          operation: 'initialize'
        },
        errorResult.severity,
        errorResult.category
      );
      
      console.error('SyncManager: Failed to initialize sync engine:', error);
      throw error;
    }
  }

  /**
   * Configure providers
   */
  private configureProviders(): void {
    Object.entries(this.config.providers).forEach(([providerId, config]) => {
      this.syncProcessor.updateProviderConfig(providerId, config);
      console.log(`SyncManager: Configured provider ${providerId}`);
    });
  }

  /**
   * Initialize event handlers
   */
  private initializeEventHandlers(): void {
    // Forward events from components to registered handlers
    this.syncQueue.addEventHandler((event) => {
      this.emitEvent(event);
    });

    this.syncScheduler.addEventHandler((event) => {
      this.emitEvent(event);
    });

    this.syncReporter.addEventHandler((event) => {
      this.emitEvent(event);
    });
  }

  /**
   * Emit event to registered handlers
   */
  private emitEvent(event: SyncEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('SyncManager: Error in event handler:', error);
      }
    });
  }

  /**
   * Start a sync job
   */
  async startSync(
    userId: string,
    providerId: string,
    operationType: SyncOperationType = SyncOperationType.FULL_SYNC,
    options: {
      priority?: SyncPriority;
      parameters?: Record<string, any>;
      connectionId?: string;
    } = {}
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Sync engine not initialized');
    }

    try {
      // Get or create connection
      const connectionId = options.connectionId || await this.getOrCreateConnection(userId, providerId);

      // Create sync job
      const job: Omit<SyncJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'retryCount'> = {
        connectionId,
        userId,
        providerId,
        operationType,
        priority: options.priority || SyncPriority.NORMAL,
        parameters: options.parameters || {},
        scheduledAt: new Date(),
        maxRetries: 3,
        metadata: {
          manual: true,
          initiatedBy: userId
        }
      };

      // Add job to queue
      const jobId = await this.syncQueue.addJob(job);

      console.log(`SyncManager: Started sync job ${jobId} for user ${userId}, provider ${providerId}`);

      return jobId;

    } catch (error) {
      console.error('SyncManager: Failed to start sync:', error);
      throw error;
    }
  }

  /**
   * Start a webhook-triggered sync job
   */
  async startWebhookSync(
    userId: string,
    providerId: string,
    webhookEvent: string,
    webhookPayload: any,
    options: {
      priority?: SyncPriority;
      connectionId?: string;
    } = {}
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Sync engine not initialized');
    }

    try {
      // Get or create connection
      const connectionId = options.connectionId || await this.getOrCreateConnection(userId, providerId);

      // Create sync job with webhook-specific operation type
      const job: Omit<SyncJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'retryCount'> = {
        connectionId,
        userId,
        providerId,
        operationType: SyncOperationType.WEBHOOK_SYNC, // Custom operation type for webhook events
        priority: options.priority || SyncPriority.HIGH, // Webhook syncs should have high priority
        parameters: {
          webhookEvent,
          webhookPayload
        },
        scheduledAt: new Date(),
        maxRetries: 3,
        metadata: {
          manual: false,
          initiatedBy: 'webhook',
          webhookEvent
        }
      };

      // Add job to queue
      const jobId = await this.syncQueue.addJob(job);

      console.log(`SyncManager: Started webhook sync job ${jobId} for user ${userId}, provider ${providerId}, event ${webhookEvent}`);

      return jobId;

    } catch (error) {
      console.error('SyncManager: Failed to start webhook sync:', error);
      throw error;
    }
  }

  /**
   * Get or create OAuth connection
   */
  private async getOrCreateConnection(userId: string, providerId: string): Promise<string> {
    // Check if user has active connection
    const hasConnection = await oauthService.hasActiveConnection(userId, providerId);

    if (hasConnection) {
      const connections = await oauthService.getUserConnections(userId);
      const connection = connections.find(c => c.providerId === providerId);
      if (connection) {
        return connection.id;
      }
    }

    // This would typically redirect to OAuth flow
    // For now, throw an error
    throw new Error(`No active connection found for user ${userId} and provider ${providerId}`);
  }

  /**
   * Schedule a sync operation
   */
  async scheduleSync(
    userId: string,
    providerId: string,
    frequency: any, // SyncFrequency
    operationType: SyncOperationType = SyncOperationType.INCREMENTAL_SYNC,
    options: {
      priority?: SyncPriority;
      parameters?: Record<string, any>;
      connectionId?: string;
    } = {}
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Sync engine not initialized');
    }

    try {
      const connectionId = options.connectionId || await this.getOrCreateConnection(userId, providerId);

      const schedule: Omit<SyncSchedule, 'id' | 'createdAt' | 'updatedAt' | 'nextRunAt' | 'lastRunAt'> = {
        connectionId,
        userId,
        providerId,
        frequency,
        enabled: true,
        config: {
          operationType,
          priority: options.priority || SyncPriority.NORMAL,
          parameters: options.parameters || {}
        },
        metadata: {
          scheduled: true,
          createdBy: userId
        }
      };

      const scheduleId = await this.syncScheduler.createSchedule(schedule);

      console.log(`SyncManager: Scheduled sync ${scheduleId} for user ${userId}, provider ${providerId}`);

      return scheduleId;

    } catch (error) {
      console.error('SyncManager: Failed to schedule sync:', error);
      throw error;
    }
  }

  /**
   * Get sync job status
   */
  getJobStatus(jobId: string): SyncJob | undefined {
    return this.syncQueue.getJob(jobId);
  }

  /**
   * Get all sync jobs for a user
   */
  getUserJobs(userId: string): SyncJob[] {
    return this.syncQueue.getAllJobs().filter(job => job.userId === userId);
  }

  /**
   * Get sync jobs by status
   */
  getJobsByStatus(status: SyncJobStatus): SyncJob[] {
    return this.syncQueue.getJobsByStatus(status);
  }

  /**
   * Cancel a sync job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const success = this.syncQueue.cancelJob(jobId);

    if (success) {
      console.log(`SyncManager: Cancelled sync job ${jobId}`);
    }

    return success;
  }

  /**
   * Get sync schedule
   */
  getSchedule(scheduleId: string): SyncSchedule | undefined {
    return this.syncScheduler.getSchedule(scheduleId);
  }

  /**
   * Get all sync schedules for a user
   */
  getUserSchedules(userId: string): SyncSchedule[] {
    return this.syncScheduler.getSchedulesByUser(userId);
  }

  /**
   * Update sync schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<SyncSchedule>): Promise<boolean> {
    return await this.syncScheduler.updateSchedule(scheduleId, updates);
  }

  /**
   * Delete sync schedule
   */
  async deleteSchedule(scheduleId: string): Promise<boolean> {
    return await this.syncScheduler.deleteSchedule(scheduleId);
  }

  /**
   * Get sync engine status
   */
  getStatus(): SyncEngineStatus {
    return {
      isRunning: this.isInitialized,
      queue: this.syncQueue.getMetrics(),
      scheduler: {
        isRunning: this.syncScheduler.getStatus().isRunning,
        activeSchedules: this.syncScheduler.getStatus().activeSchedules,
        nextRunAt: this.syncScheduler.getStatus().nextScheduleAt
      },
      providers: Object.fromEntries(
        Object.entries(this.config.providers).map(([providerId, config]) => [
          providerId,
          {
            status: config.enabled ? 'online' : 'offline',
            lastSyncAt: undefined, // Would be populated from database
            errorRate: 0 // Would be calculated from recent errors
          }
        ])
      ),
      performance: {
        averageThroughput: this.syncReporter.getPerformanceMetrics().totalSyncs,
        queueWaitTime: this.syncQueue.getMetrics().averageWaitTime,
        processingTime: this.syncQueue.getMetrics().averageProcessingTime,
        memoryUsage: process.memoryUsage().heapUsed
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return this.syncReporter.getPerformanceMetrics();
  }

  /**
   * Get error analysis
   */
  getErrorAnalysis() {
    return this.syncReporter.getErrorAnalysis();
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return this.syncReporter.getQueueStatus();
  }

  /**
   * Get scheduler status
   */
  getSchedulerStatus() {
    return this.syncReporter.getSchedulerStatus();
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return this.syncReporter.getSystemStatus();
  }

  /**
   * Get current analytics
   */
  getAnalytics(): SyncAnalytics | null {
    return this.syncReporter.getAnalytics();
  }

  /**
   * Generate custom report
   */
  async generateReport(
    startDate: Date,
    endDate: Date,
    options?: {
      includeErrors?: boolean;
      includePerformance?: boolean;
      groupByProvider?: boolean;
      groupByHour?: boolean;
    }
  ): Promise<SyncReport> {
    return await this.syncReporter.generateCustomReport(startDate, endDate, options);
  }

  /**
   * Get all reports
   */
  getAllReports(): SyncReport[] {
    return this.syncReporter.getAllReports();
  }

  /**
   * Get reports in date range
   */
  getReportsInRange(startDate: Date, endDate: Date): SyncReport[] {
    return this.syncReporter.getReportsInRange(startDate, endDate);
  }

  /**
   * Register conflict resolver
   */
  registerConflictResolver(providerId: string, resolver: (conflict: SyncConflict) => Promise<SyncConflict>): void {
    this.syncProcessor.registerConflictResolver(providerId, resolver);
  }

  /**
   * Add event handler
   */
  addEventHandler(handler: (event: SyncEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove event handler
   */
  removeEventHandler(handler: (event: SyncEvent) => void): boolean {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(providerId: string, config: Partial<ProviderSyncConfig>): boolean {
    return this.syncProcessor.updateProviderConfig(providerId, config);
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(providerId: string): ProviderSyncConfig | undefined {
    return this.syncProcessor.getProviderConfig(providerId);
  }

  /**
   * Enable provider
   */
  enableProvider(providerId: string): boolean {
    return this.updateProviderConfig(providerId, { enabled: true });
  }

  /**
   * Disable provider
   */
  disableProvider(providerId: string): boolean {
    return this.updateProviderConfig(providerId, { enabled: false });
  }

  /**
   * Force execute a schedule
   */
  async forceExecuteSchedule(scheduleId: string): Promise<boolean> {
    return await this.syncScheduler.forceExecuteSchedule(scheduleId);
  }

  /**
   * Reschedule all schedules
   */
  async rescheduleAll(): Promise<void> {
    return await this.syncScheduler.rescheduleAll();
  }

  /**
   * Cleanup old data
   */
  async cleanup(): Promise<void> {
    await this.syncScheduler.cleanup();
    this.syncReporter.resetMetrics();
    console.log('SyncManager: Cleanup completed');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      initialized: boolean;
      queue: boolean;
      scheduler: boolean;
      providers: boolean;
    };
    details?: string;
  }> {
    const checks = {
      initialized: this.isInitialized,
      queue: false,
      scheduler: false,
      providers: false
    };

    try {
      // Check queue
      const queueStatus = this.syncQueue.getStatus();
      checks.queue = queueStatus.isProcessing;

      // Check scheduler
      const schedulerStatus = this.syncScheduler.getStatus();
      checks.scheduler = schedulerStatus.isRunning;

      // Check providers
      const providerCount = Object.values(this.config.providers).filter(p => p.enabled).length;
      checks.providers = providerCount > 0;

      const allHealthy = Object.values(checks).every(check => check);
      const anyHealthy = Object.values(checks).some(check => check);

      return {
        status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
        checks,
        details: !allHealthy ? 'Some components are not functioning properly' : undefined
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        checks,
        details: `Health check failed: ${error}`
      };
    }
  }

  /**
   * Shutdown the sync engine
   */
  async shutdown(): Promise<void> {
    console.log('SyncManager: Shutting down sync engine...');

    this.syncScheduler.stop();
    this.syncQueue.stop();

    this.isInitialized = false;

    console.log('SyncManager: Sync engine shutdown completed');
  }
}