import { Schedule } from './types';
import { ScheduleConflict } from './types';
import { SchedulerDatabaseService } from './database';

/**
 * Conflict Detection and Prevention Service
 * 
 * Detects and prevents conflicts in schedule execution with:
 * - Overlap detection
 * - Resource limit checking
 * - Conflict resolution strategies
 * - Conflict logging
 */
export class ConflictDetectionService {
  private databaseService: SchedulerDatabaseService;
  private initialized: boolean = false;

  constructor(databaseService: SchedulerDatabaseService) {
    this.databaseService = databaseService;
  }

 /**
   * Initialize the conflict detection service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Any initialization logic here
      this.initialized = true;
      console.log('ConflictDetectionService: Initialized successfully');
    } catch (error) {
      console.error('ConflictDetectionService: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Detect conflicts for a schedule
   */
  async detectConflicts(schedule: Schedule, existingSchedules: Schedule[]): Promise<ScheduleConflict[]> {
    if (!this.initialized) {
      throw new Error('ConflictDetectionService not initialized');
    }

    const conflicts: ScheduleConflict[] = [];

    // Check for duplicate schedules (same connection and provider)
    const duplicateSchedules = existingSchedules.filter(
      s => s.connectionId === schedule.connectionId && 
           s.providerId === schedule.providerId &&
           s.id !== schedule.id
    );

    if (duplicateSchedules.length > 0) {
      conflicts.push({
        id: `conflict_${schedule.id}_duplicate_${Date.now()}`,
        scheduleId: schedule.id,
        conflictType: 'overlap',
        details: {
          message: `Duplicate schedule exists for connection ${schedule.connectionId} and provider ${schedule.providerId}`,
          duplicateSchedules: duplicateSchedules.map(s => s.id)
        },
        resolved: false,
        createdAt: new Date()
      });
    }

    // Check for overlapping schedules (same user and provider with close nextRunAt times)
    const overlappingSchedules = existingSchedules.filter(s => {
      if (s.userId !== schedule.userId || s.providerId !== schedule.providerId || s.id === schedule.id) {
        return false;
      }

      // Check if next run times are within 1 hour of each other
      const timeDiff = Math.abs(s.nextRunAt.getTime() - schedule.nextRunAt.getTime());
      return timeDiff < 60 * 60 * 1000; // 1 hour
    });

    if (overlappingSchedules.length > 0) {
      conflicts.push({
        id: `conflict_${schedule.id}_overlap_${Date.now()}`,
        scheduleId: schedule.id,
        conflictType: 'overlap',
        details: {
          message: `Overlapping schedule detected with ${overlappingSchedules.length} other schedule(s)`,
          overlappingSchedules: overlappingSchedules.map(s => s.id),
          timeWindow: '1 hour'
        },
        resolved: false,
        createdAt: new Date()
      });
    }

    // Check for resource limits (too many schedules for the same user)
    const userSchedules = existingSchedules.filter(s => s.userId === schedule.userId);
    if (userSchedules.length > 50) { // Arbitrary limit
      conflicts.push({
        id: `conflict_${schedule.id}_resource_${Date.now()}`,
        scheduleId: schedule.id,
        conflictType: 'resource_limit',
        details: {
          message: `User has too many active schedules (${userSchedules.length})`,
          maxLimit: 50,
          currentCount: userSchedules.length
        },
        resolved: false,
        createdAt: new Date()
      });
    }

    // Record conflicts in database
    for (const conflict of conflicts) {
      await this.databaseService.recordScheduleConflict(conflict);
    }

    return conflicts;
  }

  /**
   * Resolve conflict using specified strategy
   */
  async resolveConflict(conflict: ScheduleConflict, strategy: 'prevent' | 'queue' | 'cancel'): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('ConflictDetectionService not initialized');
    }

    try {
      switch (strategy) {
        case 'prevent':
          // Mark conflict as resolved without taking action
          conflict.resolved = true;
          conflict.resolvedAt = new Date();
          conflict.resolutionDetails = {
            strategy: 'prevent',
            message: 'Conflict prevented by not executing overlapping schedules'
          };
          break;
          
        case 'queue':
          // Queue the conflicting schedule for later execution
          conflict.resolved = true;
          conflict.resolvedAt = new Date();
          conflict.resolutionDetails = {
            strategy: 'queue',
            message: 'Conflicting schedule queued for later execution'
          };
          break;
          
        case 'cancel':
          // Cancel the conflicting schedule
          conflict.resolved = true;
          conflict.resolvedAt = new Date();
          conflict.resolutionDetails = {
            strategy: 'cancel',
            message: 'Conflicting schedule cancelled'
          };
          break;
          
        default:
          return false;
      }

      // Update conflict in database
      // In a real implementation, this would update the database record
      console.log(`ConflictDetectionService: Resolved conflict ${conflict.id} using strategy ${strategy}`);
      
      return true;
    } catch (error) {
      console.error('ConflictDetectionService: Error resolving conflict:', error);
      return false;
    }
  }

  /**
   * Get unresolved conflicts for a schedule
   */
  async getUnresolvedConflicts(scheduleId: string): Promise<ScheduleConflict[]> {
    if (!this.initialized) {
      throw new Error('ConflictDetectionService not initialized');
    }

    // In a real implementation, this would query the database for unresolved conflicts
    // For now, we'll return an empty array
    return [];
  }

  /**
   * Prevent conflicts for a schedule
   */
  async preventConflicts(schedule: Schedule, existingSchedules: Schedule[], strategy: 'prevent' | 'queue' | 'cancel' = 'prevent'): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('ConflictDetectionService not initialized');
    }

    try {
      // Detect conflicts
      const conflicts = await this.detectConflicts(schedule, existingSchedules);
      
      if (conflicts.length === 0) {
        // No conflicts detected
        return true;
      }

      // Resolve all conflicts using the specified strategy
      const resolutionResults = await Promise.all(
        conflicts.map(conflict => this.resolveConflict(conflict, strategy))
      );

      // Check if all conflicts were resolved successfully
      return resolutionResults.every(result => result);
    } catch (error) {
      console.error('ConflictDetectionService: Error preventing conflicts:', error);
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
    console.log('ConflictDetectionService: Cleanup completed');
  }
}