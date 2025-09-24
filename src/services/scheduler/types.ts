import { SyncFrequency } from '../../types/oauth';
import { SyncOperationType, SyncPriority } from '../sync/types';

/**
 * Scheduler Types
 */

// Core schedule interface
export interface Schedule {
  id: string;
  connectionId: string;
  userId: string;
  providerId: string;
  frequency: SyncFrequency;
  enabled: boolean;
  nextRunAt: Date;
  lastRunAt?: Date;
  config: {
    operationType: SyncOperationType;
    priority: SyncPriority;
    parameters?: Record<string, any>;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Schedule configuration
export interface ScheduleConfig {
  enabled: boolean;
  defaultFrequency: SyncFrequency;
  maxConcurrentSchedules: number;
  scheduleAheadTime: number; // hours
  cleanupInterval: number;
  retryFailedSchedules: boolean;
  maxScheduleRetries: number;
  conflictResolutionStrategy: 'prevent' | 'queue' | 'cancel';
}

// Schedule execution log
export interface ScheduleLog {
  id: string;
  scheduleId: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Schedule conflict
export interface ScheduleConflict {
  id: string;
  scheduleId: string;
  conflictType: 'overlap' | 'resource_limit' | 'provider_limit';
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolutionDetails?: Record<string, any>;
  createdAt: Date;
}

// Schedule statistics
export interface ScheduleStats {
  total: number;
  enabled: number;
  disabled: number;
  due: number;
  byFrequency: Record<SyncFrequency, number>;
  byProvider: Record<string, number>;
  conflicts: number;
}

// Schedule event
export interface ScheduleEvent {
  type: 'schedule_created' | 'schedule_updated' | 'schedule_deleted' | 'schedule_executed' | 'schedule_failed' | 'conflict_detected';
  scheduleId: string;
  connectionId: string;
  userId: string;
  providerId: string;
  data: Record<string, any>;
  timestamp: Date;
}

// Execution result
export interface ExecutionResult {
  success: boolean;
  scheduleId: string;
  jobId?: string;
  error?: string;
  duration: number;
  metadata?: Record<string, any>;
  completedAt: Date;
}

// Resource usage metrics
export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeSchedules: number;
  queuedTasks: number;
  maxConcurrentTasks: number;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  maxRetryDelay: number;
}

// Provider-specific schedule configuration
export interface ProviderScheduleConfig {
  providerId: string;
  enabled: boolean;
  defaultFrequency: SyncFrequency;
  operationTypes: SyncOperationType[];
  rateLimit: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    burstLimit: number;
  };
  timeout: number;
  retryConfig: RetryConfig;
  conflictResolution: {
    strategy: 'provider_wins' | 'local_wins' | 'manual' | 'merge';
    fields: string[];
  };
}

// Schedule validation result
export interface ScheduleValidationResult {
 isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Schedule report
export interface ScheduleReport {
  id: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalSchedules: number;
    activeSchedules: number;
    executedSchedules: number;
    failedSchedules: number;
    conflictsDetected: number;
    averageExecutionTime: number;
    successRate: number;
  };
  providerStats: Record<string, {
    totalSchedules: number;
    executedSchedules: number;
    failedSchedules: number;
    averageExecutionTime: number;
    conflicts: number;
    errorRate: number;
  }>;
  conflicts: ScheduleConflict[];
  errors: string[];
  performance: {
    peakThroughput: number;
    averageThroughput: number;
    resourceUsage: ResourceMetrics;
  };
  generatedAt: Date;
}