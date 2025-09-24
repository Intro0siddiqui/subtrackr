import { Schedule, ScheduleValidationResult } from './types';
import { SyncFrequency } from '../../types/oauth';
import { ConflictDetectionService } from './conflict';
import { SchedulerDatabaseService } from './database';

/**
 * Schedule Validator
 * 
 * Validates sync schedules and prevents conflicts with:
 * - Schedule integrity validation
 * - Conflict detection and prevention
 * - Overlap detection
 * - Resource limit checking
 */
export class ScheduleValidator {
  private conflictDetectionService: ConflictDetectionService;
  private databaseService: SchedulerDatabaseService;
  private initialized: boolean = false;

  constructor(databaseService: SchedulerDatabaseService) {
    this.databaseService = databaseService;
    this.conflictDetectionService = new ConflictDetectionService(databaseService);
  }

  /**
   * Initialize the schedule validator
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize conflict detection service
      await this.conflictDetectionService.initialize();
      
      this.initialized = true;
      console.log('ScheduleValidator: Initialized successfully');
    } catch (error) {
      console.error('ScheduleValidator: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Validate a schedule
   */
  async validateSchedule(schedule: Schedule, existingSchedules: Schedule[] = []): Promise<ScheduleValidationResult> {
    if (!this.initialized) {
      throw new Error('ScheduleValidator not initialized');
    }

    const result: ScheduleValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Validate required fields
    if (!schedule.connectionId) {
      result.errors.push('Connection ID is required');
      result.isValid = false;
    }

    if (!schedule.userId) {
      result.errors.push('User ID is required');
      result.isValid = false;
    }

    if (!schedule.providerId) {
      result.errors.push('Provider ID is required');
      result.isValid = false;
    }

    if (!schedule.frequency) {
      result.errors.push('Frequency is required');
      result.isValid = false;
    }

    // Validate frequency
    if (schedule.frequency && !this.isValidFrequency(schedule.frequency)) {
      result.errors.push(`Invalid frequency: ${schedule.frequency}`);
      result.isValid = false;
    }

    // Validate nextRunAt is in the future
    if (schedule.nextRunAt && schedule.nextRunAt <= new Date()) {
      result.warnings.push('Next run time is in the past');
    }

    // Check for conflicts with existing schedules
    const conflicts = await this.conflictDetectionService.detectConflicts(schedule, existingSchedules);
    if (conflicts.length > 0) {
      result.errors.push(...conflicts.map(c => c.details.message));
      result.isValid = false;
    }

    // Validate config
    if (!schedule.config) {
      result.errors.push('Schedule configuration is required');
      result.isValid = false;
    } else {
      if (!schedule.config.operationType) {
        result.errors.push('Operation type is required in config');
        result.isValid = false;
      }

      if (!schedule.config.priority) {
        result.errors.push('Priority is required in config');
        result.isValid = false;
      }
    }

    // Add suggestions for improvement
    if (!schedule.lastRunAt) {
      result.suggestions.push('Consider setting an initial last run time');
    }

    return result;
  }

  /**
   * Check if frequency is valid
   */
  private isValidFrequency(frequency: SyncFrequency): boolean {
    return Object.values(SyncFrequency).includes(frequency);
  }

  /**
   * Validate multiple schedules
   */
  async validateSchedules(schedules: Schedule[]): Promise<ScheduleValidationResult[]> {
    if (!this.initialized) {
      throw new Error('ScheduleValidator not initialized');
    }

    return Promise.all(schedules.map(schedule => 
      this.validateSchedule(schedule, schedules.filter(s => s.id !== schedule.id))
    ));
  }

  /**
   * Check if all schedules are valid
   */
  async areAllSchedulesValid(schedules: Schedule[]): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('ScheduleValidator not initialized');
    }

    const results = await this.validateSchedules(schedules);
    return results.every(r => r.isValid);
  }

  /**
   * Get validation report
   */
  async getValidationReport(schedules: Schedule[]): Promise<{
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
    errors: string[];
    suggestions: string[];
  }> {
    if (!this.initialized) {
      throw new Error('ScheduleValidator not initialized');
    }

    const results = await this.validateSchedules(schedules);
    const validCount = results.filter(r => r.isValid).length;
    const warningCount = results.filter(r => r.warnings.length > 0).length;
    const allErrors = results.flatMap(r => r.errors);
    const allSuggestions = results.flatMap(r => r.suggestions);

    return {
      total: schedules.length,
      valid: validCount,
      invalid: schedules.length - validCount,
      warnings: warningCount,
      errors: allErrors,
      suggestions: allSuggestions
    };
  }

  /**
   * Check if validator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.conflictDetectionService.cleanup();
    console.log('ScheduleValidator: Cleanup completed');
  }
}