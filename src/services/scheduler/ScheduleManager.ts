import { SyncFrequency } from '../../types/oauth';
import { SyncOperationType, SyncPriority } from '../sync/types';
import { Schedule, ScheduleConfig, ScheduleEvent, ScheduleStats } from './types';
import { SchedulerDatabaseService } from './database';

/**
 * Schedule Manager
 * 
 * Manages sync schedules and frequencies with:
 * - CRUD operations for schedules
 * - Schedule validation
 * - Frequency management
 * - Event handling
 */
export class ScheduleManager {
  private schedules: Map<string, Schedule> = new Map();
  private config: ScheduleConfig;
  private eventHandlers: ((event: ScheduleEvent) => void)[] = [];
  private initialized: boolean = false;
  private databaseService: SchedulerDatabaseService;

  constructor(config: ScheduleConfig) {
    this.config = config;
    this.databaseService = new SchedulerDatabaseService();
  }

  /**
   * Initialize the schedule manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize database service
      await this.databaseService.initialize();
      
      // Load schedules from database
      await this.loadSchedulesFromDatabase();
      this.initialized = true;
      console.log('ScheduleManager: Initialized successfully');
    } catch (error) {
      console.error('ScheduleManager: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Load schedules from database
   */
  private async loadSchedulesFromDatabase(): Promise<void> {
    try {
      const schedules = await this.databaseService.loadSchedules();
      schedules.forEach(schedule => {
        this.schedules.set(schedule.id, schedule);
      });
      console.log(`ScheduleManager: Loaded ${schedules.length} schedules from database`);
    } catch (error) {
      console.error('ScheduleManager: Error loading schedules from database:', error);
      throw error;
    }
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
      operationType: SyncOperationType;
      priority: SyncPriority;
      parameters?: Record<string, any>;
    }
  ): Promise<Schedule> {
    if (!this.initialized) {
      throw new Error('ScheduleManager not initialized');
    }

    // Generate a simple ID without uuid dependency
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const schedule: Schedule = {
      id: scheduleId,
      connectionId,
      userId,
      providerId,
      frequency,
      enabled: true,
      nextRunAt: now,
      config,
      createdAt: now,
      updatedAt: now
    };

    this.schedules.set(scheduleId, schedule);

    // Save to database
    await this.databaseService.saveSchedule(schedule);

    // Emit event
    this.emitEvent({
      type: 'schedule_created',
      scheduleId,
      connectionId,
      userId,
      providerId,
      data: { schedule },
      timestamp: new Date()
    });

    console.log(`ScheduleManager: Created schedule ${scheduleId} for provider ${providerId}`);
    return schedule;
  }

 /**
   * Get schedule by ID
   */
  getSchedule(scheduleId: string): Schedule | undefined {
    return this.schedules.get(scheduleId);
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): Schedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get schedules by user
   */
  getSchedulesByUser(userId: string): Schedule[] {
    return Array.from(this.schedules.values()).filter(schedule => schedule.userId === userId);
  }

  /**
   * Get schedules by provider
   */
  getSchedulesByProvider(providerId: string): Schedule[] {
    return Array.from(this.schedules.values()).filter(schedule => schedule.providerId === providerId);
  }

  /**
   * Get schedules by connection
   */
 getSchedulesByConnection(connectionId: string): Schedule[] {
    return Array.from(this.schedules.values()).filter(schedule => schedule.connectionId === connectionId);
  }

  /**
   * Get due schedules
   */
  getDueSchedules(): Schedule[] {
    // In a real implementation, this would query the database for due schedules
    // For now, we'll filter in memory
    const now = new Date();
    return Array.from(this.schedules.values()).filter(
      schedule => schedule.enabled && schedule.nextRunAt <= now
    );
  }

  /**
   * Update schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<Schedule>): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    // Update schedule
    Object.assign(schedule, updates);
    schedule.updatedAt = new Date();

    // Save to database
    const saved = await this.databaseService.saveSchedule(schedule);
    if (!saved) {
      return false;
    }

    // Emit event
    this.emitEvent({
      type: 'schedule_updated',
      scheduleId,
      connectionId: schedule.connectionId,
      userId: schedule.userId,
      providerId: schedule.providerId,
      data: { updates },
      timestamp: new Date()
    });

    console.log(`ScheduleManager: Updated schedule ${scheduleId}`);
    return true;
  }

  /**
   * Delete schedule
   */
 async deleteSchedule(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    this.schedules.delete(scheduleId);

    // Delete from database
    const deleted = await this.databaseService.deleteSchedule(scheduleId);
    if (!deleted) {
      return false;
    }

    // Emit event
    this.emitEvent({
      type: 'schedule_deleted',
      scheduleId,
      connectionId: schedule.connectionId,
      userId: schedule.userId,
      providerId: schedule.providerId,
      data: {},
      timestamp: new Date()
    });

    console.log(`ScheduleManager: Deleted schedule ${scheduleId}`);
    return true;
  }

  /**
   * Enable schedule
   */
 async enableSchedule(scheduleId: string): Promise<boolean> {
    return await this.updateSchedule(scheduleId, { enabled: true });
  }

  /**
   * Disable schedule
   */
  async disableSchedule(scheduleId: string): Promise<boolean> {
    return await this.updateSchedule(scheduleId, { enabled: false });
 }

  /**
   * Update next run time for a schedule
   */
  async updateNextRunTime(schedule: Schedule): Promise<void> {
    const now = new Date();
    let nextRun: Date;

    switch (schedule.frequency) {
      case SyncFrequency.HOURLY:
        nextRun = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
        break;
      case SyncFrequency.DAILY:
        nextRun = new Date(now.getTime() + 24 * 60 * 1000); // 24 hours
        break;
      case SyncFrequency.WEEKLY:
        nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
        break;
      case SyncFrequency.MONTHLY:
        nextRun = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        break;
      default:
        nextRun = new Date(now.getTime() + 24 * 60 * 1000); // Default to daily
    }

    schedule.nextRunAt = nextRun;
    schedule.updatedAt = new Date();
    
    // Update in database
    await this.databaseService.updateScheduleNextRun(schedule.id, nextRun);
  }

  /**
   * Get schedule statistics
   */
  async getScheduleStats(userId?: string): Promise<ScheduleStats> {
    // In a real implementation, this would query the database
    // For now, we'll calculate in memory
    
    let schedulesToCount = Array.from(this.schedules.values());
    if (userId) {
      schedulesToCount = schedulesToCount.filter(s => s.userId === userId);
    }

    const stats: ScheduleStats = {
      total: schedulesToCount.length,
      enabled: 0,
      disabled: 0,
      due: 0,
      byFrequency: {
        [SyncFrequency.HOURLY]: 0,
        [SyncFrequency.DAILY]: 0,
        [SyncFrequency.WEEKLY]: 0,
        [SyncFrequency.MONTHLY]: 0
      },
      byProvider: {},
      conflicts: 0 // This would be populated from conflict detection
    };

    const now = new Date();

    for (const schedule of schedulesToCount) {
      if (schedule.enabled) {
        stats.enabled++;
        if (schedule.nextRunAt <= now) {
          stats.due++;
        }
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
   * Add event handler
   */
  addEventHandler(handler: (event: ScheduleEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove event handler
   */
  removeEventHandler(handler: (event: ScheduleEvent) => void): boolean {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Emit event to registered handlers
   */
  private emitEvent(event: ScheduleEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('ScheduleManager: Error in event handler:', error);
      }
    });
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
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.databaseService.cleanup();
  }
}