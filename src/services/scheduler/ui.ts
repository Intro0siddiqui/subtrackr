import { Schedule, ScheduleStats } from './types';

/**
 * UI Integration Service for Scheduler
 * 
 * Provides UI integration capabilities for the scheduler with:
 * - Status updates for UI components
 * - Real-time schedule monitoring
 * - Progress tracking
 * - Event notifications
 */
export class SchedulerUIService {
  private eventListeners: Map<string, Function[]> = new Map();
  private initialized: boolean = false;

  constructor() {}

  /**
   * Initialize the UI service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Any initialization logic here
      this.initialized = true;
      console.log('SchedulerUIService: Initialized successfully');
    } catch (error) {
      console.error('SchedulerUIService: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Subscribe to schedule events
   */
 subscribeToScheduleEvents(scheduleId: string, callback: (event: any) => void): void {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    if (!this.eventListeners.has(scheduleId)) {
      this.eventListeners.set(scheduleId, []);
    }
    
    this.eventListeners.get(scheduleId)!.push(callback);
  }

  /**
   * Unsubscribe from schedule events
   */
  unsubscribeFromScheduleEvents(scheduleId: string, callback: (event: any) => void): void {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    const listeners = this.eventListeners.get(scheduleId);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify UI of schedule status update
   */
  notifyScheduleStatusUpdate(scheduleId: string, status: any): void {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    const listeners = this.eventListeners.get(scheduleId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          console.error('SchedulerUIService: Error in UI callback:', error);
        }
      });
    }
  }

  /**
   * Notify UI of schedule creation
   */
  notifyScheduleCreated(schedule: Schedule): void {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    this.notifyScheduleStatusUpdate(schedule.id, {
      type: 'schedule_created',
      schedule,
      timestamp: new Date()
    });
  }

  /**
   * Notify UI of schedule update
   */
 notifyScheduleUpdated(schedule: Schedule): void {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    this.notifyScheduleStatusUpdate(schedule.id, {
      type: 'schedule_updated',
      schedule,
      timestamp: new Date()
    });
  }

  /**
   * Notify UI of schedule deletion
   */
  notifyScheduleDeleted(scheduleId: string): void {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    this.notifyScheduleStatusUpdate(scheduleId, {
      type: 'schedule_deleted',
      scheduleId,
      timestamp: new Date()
    });
  }

  /**
   * Notify UI of schedule execution start
   */
  notifyScheduleExecutionStart(scheduleId: string, executionId: string): void {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    this.notifyScheduleStatusUpdate(scheduleId, {
      type: 'execution_start',
      scheduleId,
      executionId,
      timestamp: new Date()
    });
  }

  /**
   * Notify UI of schedule execution progress
   */
  notifyScheduleExecutionProgress(scheduleId: string, executionId: string, progress: number, message?: string): void {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    this.notifyScheduleStatusUpdate(scheduleId, {
      type: 'execution_progress',
      scheduleId,
      executionId,
      progress,
      message,
      timestamp: new Date()
    });
  }

  /**
   * Notify UI of schedule execution completion
   */
  notifyScheduleExecutionComplete(scheduleId: string, executionId: string, success: boolean, duration: number): void {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    this.notifyScheduleStatusUpdate(scheduleId, {
      type: 'execution_complete',
      scheduleId,
      executionId,
      success,
      duration,
      timestamp: new Date()
    });
  }

  /**
   * Notify UI of schedule statistics update
   */
  notifyScheduleStatsUpdate(stats: ScheduleStats): void {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    // Notify all listeners of stats update
    this.eventListeners.forEach((listeners, scheduleId) => {
      listeners.forEach(callback => {
        try {
          callback({
            type: 'stats_update',
            stats,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('SchedulerUIService: Error in UI callback:', error);
        }
      });
    });
  }

  /**
   * Get current schedule status for UI
   */
  getScheduleStatusForUI(schedule: Schedule): any {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    return {
      id: schedule.id,
      providerId: schedule.providerId,
      frequency: schedule.frequency,
      enabled: schedule.enabled,
      nextRunAt: schedule.nextRunAt,
      lastRunAt: schedule.lastRunAt,
      status: schedule.enabled ? 'active' : 'disabled',
      progress: schedule.metadata?.progress || 0,
      lastError: schedule.metadata?.lastError,
      lastDuration: schedule.metadata?.lastDuration,
      retryCount: schedule.metadata?.retryCount || 0
    };
  }

  /**
   * Format schedule data for UI display
   */
 formatScheduleForUIDisplay(schedule: Schedule): any {
    if (!this.initialized) {
      throw new Error('SchedulerUIService not initialized');
    }

    return {
      id: schedule.id,
      provider: this.getProviderDisplayName(schedule.providerId),
      frequency: this.getFrequencyDisplayName(schedule.frequency),
      enabled: schedule.enabled,
      nextRunAt: schedule.nextRunAt.toLocaleString(),
      lastRunAt: schedule.lastRunAt ? schedule.lastRunAt.toLocaleString() : 'Never',
      status: schedule.enabled ? 'Active' : 'Disabled',
      lastDuration: schedule.metadata?.lastDuration 
        ? this.formatDuration(schedule.metadata.lastDuration) 
        : 'N/A',
      retryCount: schedule.metadata?.retryCount || 0
    };
  }

  /**
   * Get provider display name
   */
  private getProviderDisplayName(providerId: string): string {
    const providerNames: Record<string, string> = {
      'netflix': 'Netflix',
      'spotify': 'Spotify',
      'openai': 'ChatGPT',
      'amazon': 'Amazon Prime'
    };
    
    return providerNames[providerId] || providerId;
  }

  /**
   * Get frequency display name
   */
  private getFrequencyDisplayName(frequency: string): string {
    const frequencyNames: Record<string, string> = {
      'hourly': 'Hourly',
      'daily': 'Daily',
      'weekly': 'Weekly',
      'monthly': 'Monthly'
    };
    
    return frequencyNames[frequency] || frequency;
  }

  /**
   * Format duration for display
   */
  private formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
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
    this.eventListeners.clear();
    console.log('SchedulerUIService: Cleanup completed');
  }
}