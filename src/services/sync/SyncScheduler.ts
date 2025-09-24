import {
  SyncSchedule,
  SyncJob,
  SyncOperationType,
  SyncPriority,
  SchedulerConfig,
  SyncJobStatus,
  SyncEvent
} from './types';
import {
  SyncFrequency
} from '../../types/oauth';
import { SyncQueue } from './SyncQueue';
import { SyncProcessor } from './SyncProcessor';

/**
 * Sync Scheduler Implementation
 *
 * Manages automated scheduling of sync operations with:
 * - Multiple frequency options (hourly, daily, weekly, monthly)
 * - Provider-specific scheduling configurations
 * - Intelligent scheduling to avoid conflicts
 * - Failed schedule retry logic
 * - Real-time schedule management
 */
export class SyncScheduler {
  private static instance: SyncScheduler;
  private config: SchedulerConfig;
  private schedules: Map<string, SyncSchedule> = new Map();
  private syncQueue: SyncQueue;
  private syncProcessor: SyncProcessor;
  private isRunning = false;
  private schedulerTimer?: NodeJS.Timeout;
  private scheduleCheckInterval = 60000; // 1 minute
  private eventHandlers: ((event: SyncEvent) => void)[] = [];

  private constructor(config: SchedulerConfig = SyncScheduler.getDefaultConfig()) {
    this.config = config;
    this.syncQueue = SyncQueue.getInstance();
    this.syncProcessor = SyncProcessor.getInstance();
    this.initializeEventHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: SchedulerConfig): SyncScheduler {
    if (!SyncScheduler.instance) {
      SyncScheduler.instance = new SyncScheduler(config);
    }
    return SyncScheduler.instance;
  }

  /**
   * Get default scheduler configuration
   */
  static getDefaultConfig(): SchedulerConfig {
    return {
      enabled: true,
      defaultFrequency: SyncFrequency.DAILY,
      maxConcurrentSchedules: 5,
      scheduleAheadTime: 24, // hours
      cleanupInterval: 3600000, // 1 hour
      retryFailedSchedules: true,
      maxScheduleRetries: 3
    };
  }

  /**
   * Initialize event handlers
   */
  private initializeEventHandlers(): void {
    this.syncQueue.addEventHandler((event) => {
      this.handleSyncEvent(event);
    });
  }

  /**
   * Handle sync events
   */
  private handleSyncEvent(event: SyncEvent): void {
    switch (event.type) {
      case 'job_completed':
        this.handleJobCompleted(event);
        break;
      case 'job_failed':
        this.handleJobFailed(event);
        break;
    }

    // Forward event to registered handlers
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('SyncScheduler: Error in event handler:', error);
      }
    });
  }

  /**
   * Handle job completed event
   */
  private handleJobCompleted(event: SyncEvent): void {
    const schedule = this.schedules.get(event.connectionId);
    if (schedule) {
      schedule.lastRunAt = new Date();
      schedule.updatedAt = new Date();
      this.updateNextRunTime(schedule);
    }
  }

  /**
   * Handle job failed event
   */
  private handleJobFailed(event: SyncEvent): void {
    const schedule = this.schedules.get(event.connectionId);
    if (schedule && this.config.retryFailedSchedules) {
      // Schedule retry with backoff
      this.scheduleRetry(schedule);
    }
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('SyncScheduler: Already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('SyncScheduler: Scheduling is disabled');
      return;
    }

    this.isRunning = true;
    console.log('SyncScheduler: Starting scheduler');

    // Load existing schedules from database
    await this.loadSchedules();

    // Start the scheduling loop
    this.startSchedulingLoop();

    // Schedule immediate check for due schedules
    setTimeout(() => {
      this.checkAndExecuteSchedules();
    }, 1000);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.isRunning = false;
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
      if (this.isRunning) {
        this.checkAndExecuteSchedules();
      }
    }, this.scheduleCheckInterval);
  }

  /**
   * Check and execute due schedules
   */
  private async checkAndExecuteSchedules(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const now = new Date();
      const dueSchedules: SyncSchedule[] = [];

      // Find all due schedules
      for (const schedule of this.schedules.values()) {
        if (schedule.enabled && schedule.nextRunAt <= now) {
          dueSchedules.push(schedule);
        }
      }

      // Sort by priority (earlier nextRunAt first)
      dueSchedules.sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime());

      // Execute schedules (limit concurrent executions)
      const maxConcurrent = Math.min(dueSchedules.length, this.config.maxConcurrentSchedules);
      for (let i = 0; i < maxConcurrent; i++) {
        const schedule = dueSchedules[i];
        await this.executeSchedule(schedule);
      }

    } catch (error) {
      console.error('SyncScheduler: Error checking schedules:', error);
    }
  }

  /**
   * Execute a schedule
   */
  private async executeSchedule(schedule: SyncSchedule): Promise<void> {
    try {
      console.log(`SyncScheduler: Executing schedule ${schedule.id} for provider ${schedule.providerId}`);

      // Create sync job
      const job: Omit<SyncJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'retryCount'> = {
        connectionId: schedule.connectionId,
        userId: schedule.userId,
        providerId: schedule.providerId,
        operationType: schedule.config.operationType,
        priority: schedule.config.priority,
        parameters: schedule.config.parameters,
        scheduledAt: new Date(),
        maxRetries: 3,
        metadata: {
          scheduled: true,
          scheduleId: schedule.id
        }
      };

      // Add job to queue
      const jobId = await this.syncQueue.addJob(job);

      // Update schedule
      schedule.lastRunAt = new Date();
      this.updateNextRunTime(schedule);

      console.log(`SyncScheduler: Schedule ${schedule.id} executed successfully, job ${jobId} created`);

    } catch (error) {
      console.error(`SyncScheduler: Failed to execute schedule ${schedule.id}:`, error);

      if (this.config.retryFailedSchedules) {
        this.scheduleRetry(schedule);
      }
    }
  }

  /**
   * Schedule retry for failed schedule
   */
  private scheduleRetry(schedule: SyncSchedule): void {
    // Calculate retry delay (exponential backoff)
    const retryDelay = Math.min(1000 * Math.pow(2, (schedule.metadata?.retryCount || 0)), 300000); // Max 5 minutes

    // Update schedule metadata
    if (!schedule.metadata) {
      schedule.metadata = {};
    }
    schedule.metadata.retryCount = (schedule.metadata.retryCount || 0) + 1;
    schedule.metadata.lastRetryAt = new Date();

    // Schedule retry
    setTimeout(() => {
      if (schedule.metadata && (schedule.metadata.retryCount || 0) < this.config.maxScheduleRetries) {
        this.executeSchedule(schedule);
      } else {
        console.error(`SyncScheduler: Max retries exceeded for schedule ${schedule.id}`);
      }
    }, retryDelay);
  }

  /**
   * Update next run time for a schedule
   */
  private updateNextRunTime(schedule: SyncSchedule): void {
    const now = new Date();
    let nextRun: Date;

    switch (schedule.frequency) {
      case SyncFrequency.HOURLY:
        nextRun = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
        break;
      case SyncFrequency.DAILY:
        nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
        break;
      case SyncFrequency.WEEKLY:
        nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
        break;
      case SyncFrequency.MONTHLY:
        nextRun = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        break;
      default:
        nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to daily
    }

    schedule.nextRunAt = nextRun;
    schedule.updatedAt = new Date();
  }

  /**
   * Create a new schedule
   */
  async createSchedule(schedule: Omit<SyncSchedule, 'id' | 'createdAt' | 'updatedAt' | 'nextRunAt' | 'lastRunAt'>): Promise<string> {
    const scheduleId = this.generateScheduleId();
    const now = new Date();

    const newSchedule: SyncSchedule = {
      ...schedule,
      id: scheduleId,
      nextRunAt: now, // Schedule immediately for first run
      lastRunAt: undefined,
      createdAt: now,
      updatedAt: now
    };

    // Set default configuration if not provided
    if (!newSchedule.config) {
      newSchedule.config = {
        operationType: SyncOperationType.INCREMENTAL_SYNC,
        priority: SyncPriority.NORMAL,
        parameters: {}
      };
    }

    // Set default frequency if not provided
    if (!newSchedule.frequency) {
      newSchedule.frequency = this.config.defaultFrequency;
    }

    this.schedules.set(scheduleId, newSchedule);

    // Save to database (placeholder)
    await this.saveSchedule(newSchedule);

    console.log(`SyncScheduler: Created schedule ${scheduleId} for provider ${schedule.providerId}`);

    return scheduleId;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<SyncSchedule>): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    // Update schedule
    Object.assign(schedule, updates);
    schedule.updatedAt = new Date();

    // Save to database (placeholder)
    await this.saveSchedule(schedule);

    console.log(`SyncScheduler: Updated schedule ${scheduleId}`);

    return true;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    this.schedules.delete(scheduleId);

    // Delete from database (placeholder)
    await this.deleteScheduleFromDatabase(scheduleId);

    console.log(`SyncScheduler: Deleted schedule ${scheduleId}`);

    return true;
  }

  /**
   * Enable a schedule
   */
  async enableSchedule(scheduleId: string): Promise<boolean> {
    return await this.updateSchedule(scheduleId, { enabled: true });
  }

  /**
   * Disable a schedule
   */
  async disableSchedule(scheduleId: string): Promise<boolean> {
    return await this.updateSchedule(scheduleId, { enabled: false });
  }

  /**
   * Get schedule by ID
   */
  getSchedule(scheduleId: string): SyncSchedule | undefined {
    return this.schedules.get(scheduleId);
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): SyncSchedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get schedules by provider
   */
  getSchedulesByProvider(providerId: string): SyncSchedule[] {
    return Array.from(this.schedules.values()).filter(schedule => schedule.providerId === providerId);
  }

  /**
   * Get schedules by user
   */
  getSchedulesByUser(userId: string): SyncSchedule[] {
    return Array.from(this.schedules.values()).filter(schedule => schedule.userId === userId);
  }

  /**
   * Get due schedules
   */
  getDueSchedules(): SyncSchedule[] {
    const now = new Date();
    return Array.from(this.schedules.values()).filter(schedule =>
      schedule.enabled && schedule.nextRunAt <= now
    );
  }

  /**
   * Get schedule statistics
   */
  getScheduleStats(): {
    total: number;
    enabled: number;
    disabled: number;
    byFrequency: Record<SyncFrequency, number>;
    byProvider: Record<string, number>;
  } {
    const stats = {
      total: this.schedules.size,
      enabled: 0,
      disabled: 0,
      byFrequency: {
        [SyncFrequency.HOURLY]: 0,
        [SyncFrequency.DAILY]: 0,
        [SyncFrequency.WEEKLY]: 0,
        [SyncFrequency.MONTHLY]: 0
      },
      byProvider: {} as Record<string, number>
    };

    for (const schedule of this.schedules.values()) {
      if (schedule.enabled) {
        stats.enabled++;
      } else {
        stats.disabled++;
      }

      stats.byFrequency[schedule.frequency]++;

      if (!stats.byProvider[schedule.providerId]) {
        stats.byProvider[schedule.providerId] = 0;
      }
      stats.byProvider[schedule.providerId]++;
    }

    return stats;
  }

  /**
   * Load schedules from database
   */
  private async loadSchedules(): Promise<void> {
    try {
      // This would load schedules from your database
      // For now, create some default schedules for demonstration
      console.log('SyncScheduler: Loading schedules from database...');

      // Create default schedules for active connections
      await this.createDefaultSchedules();

    } catch (error) {
      console.error('SyncScheduler: Error loading schedules:', error);
    }
  }

  /**
   * Create default schedules for active connections
   */
  private async createDefaultSchedules(): Promise<void> {
    // This would query your database for active OAuth connections
    // and create default schedules for each
    // For now, just log the action
    console.log('SyncScheduler: Creating default schedules for active connections...');
  }

  /**
   * Save schedule to database
   */
  private async saveSchedule(schedule: SyncSchedule): Promise<void> {
    // This would save the schedule to your database
    // For now, just log the action
    console.log(`SyncScheduler: Saving schedule ${schedule.id} to database`);
  }

  /**
   * Delete schedule from database
   */
  private async deleteScheduleFromDatabase(scheduleId: string): Promise<void> {
    // This would delete the schedule from your database
    // For now, just log the action
    console.log(`SyncScheduler: Deleting schedule ${scheduleId} from database`);
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
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    totalSchedules: number;
    activeSchedules: number;
    nextScheduleAt?: Date;
    config: SchedulerConfig;
  } {
    const dueSchedules = this.getDueSchedules();
    const nextSchedule = dueSchedules.length > 0 ?
      dueSchedules.reduce((earliest, current) =>
        current.nextRunAt < earliest.nextRunAt ? current : earliest
      ) : undefined;

    return {
      isRunning: this.isRunning,
      totalSchedules: this.schedules.size,
      activeSchedules: dueSchedules.length,
      nextScheduleAt: nextSchedule?.nextRunAt,
      config: this.config
    };
  }

  /**
   * Force execute a schedule immediately
   */
  async forceExecuteSchedule(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.enabled) {
      return false;
    }

    await this.executeSchedule(schedule);
    return true;
  }

  /**
   * Reschedule all schedules
   */
  async rescheduleAll(): Promise<void> {
    console.log('SyncScheduler: Rescheduling all schedules...');

    for (const schedule of this.schedules.values()) {
      if (schedule.enabled) {
        this.updateNextRunTime(schedule);
      }
    }

    console.log('SyncScheduler: All schedules rescheduled');
  }

  /**
   * Clean up old schedules
   */
  async cleanup(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const schedulesToDelete: string[] = [];

    for (const [scheduleId, schedule] of this.schedules) {
      if (schedule.updatedAt < cutoffDate) {
        schedulesToDelete.push(scheduleId);
      }
    }

    for (const scheduleId of schedulesToDelete) {
      await this.deleteSchedule(scheduleId);
    }

    if (schedulesToDelete.length > 0) {
      console.log(`SyncScheduler: Cleaned up ${schedulesToDelete.length} old schedules`);
    }
  }

  /**
   * Generate unique schedule ID
   */
  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}