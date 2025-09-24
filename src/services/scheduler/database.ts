import { Schedule, ScheduleLog, ScheduleConflict } from './types';
import { SyncFrequency } from '../../types/oauth';
import { supabase } from '../supabase';

/**
 * Database Service for Scheduler
 * 
 * Handles database operations for sync schedules with:
 * - CRUD operations for schedules
 * - Logging schedule executions
 * - Recording schedule conflicts
 * - Database integration
 */
export class SchedulerDatabaseService {
  private initialized: boolean = false;

  constructor() {}

  /**
   * Initialize the database service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Any initialization logic here
      this.initialized = true;
      console.log('SchedulerDatabaseService: Initialized successfully');
    } catch (error) {
      console.error('SchedulerDatabaseService: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Save schedule to database
   */
  async saveSchedule(schedule: Schedule): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('SchedulerDatabaseService not initialized');
    }

    try {
      const { data, error } = await supabase
        .from('sync_schedules')
        .upsert({
          id: schedule.id,
          connection_id: schedule.connectionId,
          user_id: schedule.userId,
          provider_id: schedule.providerId,
          frequency: schedule.frequency,
          enabled: schedule.enabled,
          next_run_at: schedule.nextRunAt.toISOString(),
          last_run_at: schedule.lastRunAt?.toISOString() || null,
          config: schedule.config,
          metadata: schedule.metadata || {},
          created_at: schedule.createdAt.toISOString(),
          updated_at: schedule.updatedAt.toISOString()
        })
        .select();

      if (error) {
        console.error('SchedulerDatabaseService: Error saving schedule:', error);
        return false;
      }

      console.log(`SchedulerDatabaseService: Saved schedule ${schedule.id} to database`);
      return true;
    } catch (error) {
      console.error('SchedulerDatabaseService: Error saving schedule:', error);
      return false;
    }
  }

  /**
   * Load schedules from database
   */
  async loadSchedules(): Promise<Schedule[]> {
    if (!this.initialized) {
      throw new Error('SchedulerDatabaseService not initialized');
    }

    try {
      const { data, error } = await supabase
        .from('sync_schedules')
        .select('*')
        .order('next_run_at', { ascending: true });

      if (error) {
        console.error('SchedulerDatabaseService: Error loading schedules:', error);
        return [];
      }

      if (!data) {
        return [];
      }

      return data.map(row => ({
        id: row.id,
        connectionId: row.connection_id,
        userId: row.user_id,
        providerId: row.provider_id,
        frequency: row.frequency as SyncFrequency,
        enabled: row.enabled,
        nextRunAt: new Date(row.next_run_at),
        lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
        config: row.config,
        metadata: row.metadata || {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      console.error('SchedulerDatabaseService: Error loading schedules:', error);
      return [];
    }
  }

  /**
   * Delete schedule from database
   */
  async deleteSchedule(scheduleId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('SchedulerDatabaseService not initialized');
    }

    try {
      const { error } = await supabase
        .from('sync_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) {
        console.error('SchedulerDatabaseService: Error deleting schedule:', error);
        return false;
      }

      console.log(`SchedulerDatabaseService: Deleted schedule ${scheduleId} from database`);
      return true;
    } catch (error) {
      console.error('SchedulerDatabaseService: Error deleting schedule:', error);
      return false;
    }
  }

  /**
   * Get due schedules from database
   */
  async getDueSchedules(): Promise<Schedule[]> {
    if (!this.initialized) {
      throw new Error('SchedulerDatabaseService not initialized');
    }

    try {
      const { data, error } = await supabase
        .from('sync_schedules')
        .select('*')
        .eq('enabled', true)
        .lte('next_run_at', new Date().toISOString())
        .order('next_run_at', { ascending: true });

      if (error) {
        console.error('SchedulerDatabaseService: Error getting due schedules:', error);
        return [];
      }

      if (!data) {
        return [];
      }

      return data.map(row => ({
        id: row.id,
        connectionId: row.connection_id,
        userId: row.user_id,
        providerId: row.provider_id,
        frequency: row.frequency as SyncFrequency,
        enabled: row.enabled,
        nextRunAt: new Date(row.next_run_at),
        lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
        config: row.config,
        metadata: row.metadata || {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      console.error('SchedulerDatabaseService: Error getting due schedules:', error);
      return [];
    }
  }

  /**
   * Log schedule execution
   */
  async logScheduleExecution(log: ScheduleLog): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('SchedulerDatabaseService not initialized');
    }

    try {
      const { data, error } = await supabase
        .from('sync_schedule_logs')
        .insert({
          id: log.id,
          schedule_id: log.scheduleId,
          status: log.status,
          started_at: log.startedAt?.toISOString() || null,
          completed_at: log.completedAt?.toISOString() || null,
          error: log.error || null,
          metadata: log.metadata || {},
          created_at: log.createdAt.toISOString()
        })
        .select();

      if (error) {
        console.error('SchedulerDatabaseService: Error logging schedule execution:', error);
        return false;
      }

      console.log(`SchedulerDatabaseService: Logged schedule execution for ${log.scheduleId}`);
      return true;
    } catch (error) {
      console.error('SchedulerDatabaseService: Error logging schedule execution:', error);
      return false;
    }
  }

  /**
   * Record schedule conflict
   */
  async recordScheduleConflict(conflict: ScheduleConflict): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('SchedulerDatabaseService not initialized');
    }

    try {
      const { data, error } = await supabase
        .from('sync_schedule_conflicts')
        .insert({
          id: conflict.id,
          schedule_id: conflict.scheduleId,
          conflict_type: conflict.conflictType,
          details: conflict.details,
          resolved: conflict.resolved,
          resolved_at: conflict.resolvedAt?.toISOString() || null,
          resolution_details: conflict.resolutionDetails || {},
          created_at: conflict.createdAt.toISOString()
        })
        .select();

      if (error) {
        console.error('SchedulerDatabaseService: Error recording schedule conflict:', error);
        return false;
      }

      console.log(`SchedulerDatabaseService: Recorded schedule conflict for ${conflict.scheduleId}`);
      return true;
    } catch (error) {
      console.error('SchedulerDatabaseService: Error recording schedule conflict:', error);
      return false;
    }
  }

  /**
   * Get schedule statistics from database
   */
  async getScheduleStatistics(userId: string): Promise<any> {
    if (!this.initialized) {
      throw new Error('SchedulerDatabaseService not initialized');
    }

    try {
      const { data, error } = await supabase
        .rpc('get_schedule_statistics', { user_id_param: userId });

      if (error) {
        console.error('SchedulerDatabaseService: Error getting schedule statistics:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('SchedulerDatabaseService: Error getting schedule statistics:', error);
      return null;
    }
  }

  /**
   * Update schedule next run time
   */
  async updateScheduleNextRun(scheduleId: string, nextRunAt: Date): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('SchedulerDatabaseService not initialized');
    }

    try {
      const { error } = await supabase
        .from('sync_schedules')
        .update({
          next_run_at: nextRunAt.toISOString(),
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId);

      if (error) {
        console.error('SchedulerDatabaseService: Error updating schedule next run time:', error);
        return false;
      }

      console.log(`SchedulerDatabaseService: Updated next run time for schedule ${scheduleId}`);
      return true;
    } catch (error) {
      console.error('SchedulerDatabaseService: Error updating schedule next run time:', error);
      return false;
    }
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
    // No cleanup needed for now
    console.log('SchedulerDatabaseService: Cleanup completed');
  }
}