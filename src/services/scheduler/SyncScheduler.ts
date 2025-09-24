import { Schedule, ScheduleConfig, ScheduleEvent, ExecutionResult } from './types';
import { ScheduleManager } from './ScheduleManager';
import { TaskExecutor } from './TaskExecutor';
import { ScheduleValidator } from './ScheduleValidator';
import { ScheduleReporter } from './ScheduleReporter';
import { SyncManager } from '../sync/SyncManager';
import { SyncFrequency } from '../../types/oauth';
import { SchedulerDatabaseService } from './database';
import { SchedulerUIService } from './ui';

/**
 * Sync Scheduler
 * 
 * Main scheduling engine for automated syncs with:
 * - Multi-provider support
 * - Flexible scheduling frequencies
 * - Conflict prevention
 * - Retry mechanism with exponential backoff
 * - Error handling and logging
 * - Resource management with concurrent task limits
 */
export class SyncScheduler {
  private scheduleManager: ScheduleManager;
  private taskExecutor: TaskExecutor;
  private scheduleValidator: ScheduleValidator;
  private scheduleReporter: ScheduleReporter;
  private syncManager: SyncManager;
  private config: ScheduleConfig;
  private running: boolean = false;
  private schedulerTimer?: NodeJS.Timeout;
  private scheduleCheckInterval: number = 60000; // 1 minute
  private initialized: boolean = false;
  private databaseService: SchedulerDatabaseService;
  private uiService: SchedulerUIService;

  constructor(syncManager: SyncManager, config: ScheduleConfig) {
    this.syncManager = syncManager;
    this.config = config;
    
    // Initialize components
    this.databaseService = new SchedulerDatabaseService();
    this.scheduleManager = new ScheduleManager(config);
    this.taskExecutor = new TaskExecutor(syncManager, config.maxConcurrentSchedules);
    this.scheduleValidator = new ScheduleValidator(this.databaseService);
    this.scheduleReporter = new ScheduleReporter(this.scheduleManager, this.taskExecutor);
    this.uiService = new SchedulerUIService();
  }

  /**
   * Initialize the sync scheduler
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize database service
      await this.databaseService.initialize();
      
      // Initialize UI service
      await this.uiService.initialize();
      
      // Initialize all components
      await this.scheduleManager.initialize();
      await this.taskExecutor.initialize();
      await this.scheduleValidator.initialize();
      await this.scheduleReporter.initialize();

      // Set up event handlers
      this.setupEventHandlers();

      this.initialized = true;
      console.log('SyncScheduler: Initialized successfully');
    } catch (error) {
      console.error('SyncScheduler: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Forward schedule events to reporter
    this.scheduleManager.addEventHandler((event: ScheduleEvent) => {
      this.scheduleReporter.logScheduleEvent({
        type: event.type,
        scheduleId: event.scheduleId,
        message: `Schedule event: ${event.type}`,
        metadata: event.data
      });
      
      // Notify UI of schedule events
      switch (event.type) {
        case 'schedule_created':
          const createdSchedule = this.scheduleManager.getSchedule(event.scheduleId);
          if (createdSchedule) {
            this.uiService.notifyScheduleCreated(createdSchedule);
          }
          break;
        case 'schedule_updated':
          const updatedSchedule = this.scheduleManager.getSchedule(event.scheduleId);
          if (updatedSchedule) {
            this.uiService.notifyScheduleUpdated(updatedSchedule);
          }
          break;
        case 'schedule_deleted':
          this.uiService.notifyScheduleDeleted(event.scheduleId);
          break;
      }
    });
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('SyncScheduler not initialized');
    }

    if (this.running) {
      console.log('SyncScheduler: Already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('SyncScheduler: Scheduling is disabled');
      return;
    }

    this.running = true;
    console.log('SyncScheduler: Starting scheduler');

    // Start the scheduling loop
    this.startSchedulingLoop();

    // Schedule immediate check for due schedules
    setTimeout(() => {
      this.checkAndExecuteSchedules();
    }, 1000);

    console.log('SyncScheduler: Started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = undefined;
    }
    console.log('SyncScheduler: Stopped scheduler');
  }

  /**
   * Start the main scheduling loop
   */
  private startSchedulingLoop(): void {
    this.schedulerTimer = setInterval(() => {
      if (this.running) {
        this.checkAndExecuteSchedules();
      }
    }, this.scheduleCheckInterval);
  }

  /**
   * Check and execute due schedules
   */
  private async checkAndExecuteSchedules(): Promise<void> {
    if (!this.running || !this.initialized) {
      return;
    }

    try {
      const dueSchedules = this.scheduleManager.getDueSchedules();
      
      if (dueSchedules.length === 0) {
        return;
      }

      console.log(`SyncScheduler: Found ${dueSchedules.length} due schedules`);

      // Sort by priority (earlier nextRunAt first)
      dueSchedules.sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime());

      // Execute schedules (limit concurrent executions)
      const maxConcurrent = Math.min(dueSchedules.length, this.config.maxConcurrentSchedules);
      const schedulesToExecute = dueSchedules.slice(0, maxConcurrent);

      // Execute schedules concurrently
      const results = await this.taskExecutor.executeSchedules(schedulesToExecute);

      // Process results
      for (const result of results) {
        await this.handleExecutionResult(result);
      }

    } catch (error) {
      console.error('SyncScheduler: Error checking schedules:', error);
      this.scheduleReporter.logError({
        scheduleId: 'scheduler',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Handle execution result
   */
  private async handleExecutionResult(result: ExecutionResult): Promise<void> {
    const schedule = this.scheduleManager.getSchedule(result.scheduleId);
    if (!schedule) {
      return;
    }

    if (result.success) {
      // Notify UI of execution completion
      this.uiService.notifyScheduleExecutionComplete(
        result.scheduleId, 
        result.jobId || 'unknown', 
        true, 
        result.duration
      );
      
      // Update schedule for next run
      await this.scheduleManager.updateNextRunTime(schedule);
      
      // Update schedule metadata
      if (!schedule.metadata) {
        schedule.metadata = {};
      }
      schedule.metadata.lastRunAt = result.completedAt;
      schedule.metadata.lastDuration = result.duration;
      delete schedule.metadata.lastError;
      
      await this.scheduleManager.updateSchedule(result.scheduleId, schedule);
      
      console.log(`SyncScheduler: Schedule ${result.scheduleId} executed successfully`);
    } else {
      // Notify UI of execution completion (failure)
      this.uiService.notifyScheduleExecutionComplete(
        result.scheduleId, 
        result.jobId || 'unknown', 
        false, 
        result.duration
      );
      
      // Handle failed execution
      console.error(`SyncScheduler: Schedule ${result.scheduleId} failed: ${result.error}`);
      
      // Update schedule metadata with error
      if (!schedule.metadata) {
        schedule.metadata = {};
      }
      schedule.metadata.lastError = {
        message: result.error,
        timestamp: result.completedAt
      };
      
      await this.scheduleManager.updateSchedule(result.scheduleId, schedule);

      // Retry if configured
      if (this.config.retryFailedSchedules) {
        await this.scheduleRetry(schedule);
      }
    }
  }

  /**
   * Schedule retry for failed schedule
   */
  private async scheduleRetry(schedule: Schedule): Promise<void> {
    // Calculate retry delay (exponential backoff)
    const retryCount = schedule.metadata?.retryCount || 0;
    const retryDelay = Math.min(
      1000 * Math.pow(2, retryCount), 
      this.config.maxScheduleRetries * 1000
    );

    // Update schedule metadata
    if (!schedule.metadata) {
      schedule.metadata = {};
    }
    schedule.metadata.retryCount = retryCount + 1;
    schedule.metadata.lastRetryAt = new Date();

    // Schedule retry
    setTimeout(async () => {
      if (schedule.metadata && (schedule.metadata.retryCount || 0) < this.config.maxScheduleRetries) {
        console.log(`SyncScheduler: Retrying schedule ${schedule.id}`);
        
        // Notify UI of execution start
        const executionId = `exec_${schedule.id}_${Date.now()}`;
        this.uiService.notifyScheduleExecutionStart(schedule.id, executionId);
        
        const result = await this.taskExecutor.executeSchedule(schedule);
        await this.handleExecutionResult(result);
      } else {
        console.error(`SyncScheduler: Max retries exceeded for schedule ${schedule.id}`);
      }
    }, retryDelay);
  }

  /**
   * Create a new schedule
   */
  async createSchedule(
    connectionId: string,
    userId: string,
    providerId: string,
    frequency: SyncFrequency,
    config: {
      operationType: any; // SyncOperationType from sync/types
      priority: any; // SyncPriority from sync/types
      parameters?: Record<string, any>;
    }
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('SyncScheduler not initialized');
    }

    // Validate schedule
    const tempSchedule: Schedule = {
      id: 'temp',
      connectionId,
      userId,
      providerId,
      frequency,
      enabled: true,
      nextRunAt: new Date(),
      config,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const validation = await this.scheduleValidator.validateSchedule(
      tempSchedule,
      this.scheduleManager.getAllSchedules()
    );

    if (!validation.isValid) {
      throw new Error(`Invalid schedule: ${validation.errors.join(', ')}`);
    }

    // Create schedule through manager
    const schedule = await this.scheduleManager.createSchedule(
      connectionId,
      userId,
      providerId,
      frequency,
      config
    );

    return schedule.id;
  }

  /**
   * Get schedule by ID
   */
  getSchedule(scheduleId: string): Schedule | undefined {
    return this.scheduleManager.getSchedule(scheduleId);
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): Schedule[] {
    return this.scheduleManager.getAllSchedules();
  }

  /**
   * Get schedules by user
   */
  getSchedulesByUser(userId: string): Schedule[] {
    return this.scheduleManager.getSchedulesByUser(userId);
  }

  /**
   * Get schedules by provider
   */
  getSchedulesByProvider(providerId: string): Schedule[] {
    return this.scheduleManager.getSchedulesByProvider(providerId);
  }

  /**
   * Update schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<Schedule>): Promise<boolean> {
    return await this.scheduleManager.updateSchedule(scheduleId, updates);
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(scheduleId: string): Promise<boolean> {
    return await this.scheduleManager.deleteSchedule(scheduleId);
  }

  /**
   * Enable schedule
   */
  async enableSchedule(scheduleId: string): Promise<boolean> {
    return await this.scheduleManager.enableSchedule(scheduleId);
  }

  /**
   * Disable schedule
   */
  async disableSchedule(scheduleId: string): Promise<boolean> {
    return await this.scheduleManager.disableSchedule(scheduleId);
  }

  /**
   * Get schedule statistics
   */
  async getScheduleStats() {
    return await this.scheduleReporter.getScheduleStats();
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    return await this.scheduleReporter.getPerformanceMetrics();
  }

  /**
   * Get resource metrics
   */
  getResourceMetrics() {
    return this.scheduleReporter.getResourceMetrics();
  }

  /**
   * Generate report
   */
  async generateReport(startDate: Date, endDate: Date) {
    return await this.scheduleReporter.generateReport(startDate, endDate);
  }

  /**
   * Force execute a schedule immediately
   */
  async forceExecuteSchedule(scheduleId: string): Promise<boolean> {
    const schedule = this.scheduleManager.getSchedule(scheduleId);
    if (!schedule || !schedule.enabled) {
      return false;
    }

    // Notify UI of execution start
    const executionId = `exec_${scheduleId}_${Date.now()}`;
    this.uiService.notifyScheduleExecutionStart(scheduleId, executionId);
    
    const result = await this.taskExecutor.executeSchedule(schedule);
    await this.handleExecutionResult(result);
    return result.success;
  }

  /**
   * Subscribe to schedule events for UI
   */
  subscribeToScheduleEvents(scheduleId: string, callback: (event: any) => void): void {
    this.uiService.subscribeToScheduleEvents(scheduleId, callback);
  }

  /**
   * Unsubscribe from schedule events for UI
   */
  unsubscribeFromScheduleEvents(scheduleId: string, callback: (event: any) => void): void {
    this.uiService.unsubscribeFromScheduleEvents(scheduleId, callback);
  }

  /**
   * Get schedule status for UI
   */
  getScheduleStatusForUI(scheduleId: string): any {
    const schedule = this.scheduleManager.getSchedule(scheduleId);
    if (!schedule) {
      return null;
    }
    return this.uiService.getScheduleStatusForUI(schedule);
  }

  /**
   * Format schedule for UI display
   */
  formatScheduleForUIDisplay(scheduleId: string): any {
    const schedule = this.scheduleManager.getSchedule(scheduleId);
    if (!schedule) {
      return null;
    }
    return this.uiService.formatScheduleForUIDisplay(schedule);
  }

  /**
   * Check if scheduler is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get configuration
   */
  getConfig(): ScheduleConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ScheduleConfig>): void {
    Object.assign(this.config, newConfig);
    this.scheduleManager.updateConfig(newConfig);
    
    // Update task executor if maxConcurrentSchedules changed
    if (newConfig.maxConcurrentSchedules !== undefined) {
      this.taskExecutor.updateMaxConcurrentTasks(newConfig.maxConcurrentSchedules);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stop();
    await this.taskExecutor.cleanup();
    await this.scheduleValidator.cleanup();
    await this.scheduleReporter.cleanup();
    await this.scheduleManager.cleanup();
    await this.databaseService.cleanup();
    await this.uiService.cleanup();
    console.log('SyncScheduler: Cleanup completed');
  }
}