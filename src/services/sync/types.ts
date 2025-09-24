import {
  SyncType,
  SyncStatus,
  SyncFrequency,
  SyncResult,
  SyncStatusInfo,
  OAuthConnection,
  OAuthSubscription,
  BillingRecord
} from '../../types/oauth';

/**
 * Sync Engine Types
 */

// Core sync operation types
export enum SyncOperationType {
  FULL_SYNC = 'full_sync',
  INCREMENTAL_SYNC = 'incremental_sync',
  SUBSCRIPTION_SYNC = 'subscription_sync',
  BILLING_SYNC = 'billing_sync',
  PROFILE_SYNC = 'profile_sync',
  WEBHOOK_SYNC = 'webhook_sync'
}

export enum SyncPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum SyncJobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

// Sync job interface
export interface SyncJob {
  id: string;
  connectionId: string;
  userId: string;
  providerId: string;
  operationType: SyncOperationType;
  priority: SyncPriority;
  status: SyncJobStatus;
  parameters?: Record<string, any>;
  retryCount: number;
  maxRetries: number;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  nextRetryAt?: Date;
  error?: SyncError;
  progress?: SyncProgress;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Sync progress tracking
export interface SyncProgress {
  total: number;
  completed: number;
  percentage: number;
  currentStep?: string;
  steps: SyncStep[];
  estimatedTimeRemaining?: number;
}

export interface SyncStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// Sync result interface
export interface SyncJobResult {
  jobId: string;
  success: boolean;
  status: SyncJobStatus;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  errors: SyncError[];
  warnings: string[];
  duration: number; // in milliseconds
  data?: {
    subscriptions?: OAuthSubscription[];
    billingRecords?: BillingRecord[];
    profile?: any;
  };
  metadata?: Record<string, any>;
  completedAt: Date;
}

// Sync error interface
export interface SyncError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  jobId?: string;
  connectionId?: string;
  providerId?: string;
  operationType?: SyncOperationType;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Queue management types
export interface QueueMetrics {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  throughput: number; // jobs per minute
}

export interface QueueConfig {
  maxConcurrentJobs: number;
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  backoffMultiplier: number;
  maxRetryDelay: number;
  jobTimeout: number;
  cleanupInterval: number;
  maxQueueSize: number;
}

// Scheduler types
export interface SyncSchedule {
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

export interface SchedulerConfig {
  enabled: boolean;
  defaultFrequency: SyncFrequency;
  maxConcurrentSchedules: number;
  scheduleAheadTime: number; // hours
  cleanupInterval: number;
  retryFailedSchedules: boolean;
  maxScheduleRetries: number;
}

// Provider sync configuration
export interface ProviderSyncConfig {
  providerId: string;
  enabled: boolean;
  syncFrequency: SyncFrequency;
  operationTypes: SyncOperationType[];
  rateLimit: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    burstLimit: number;
  };
  timeout: number;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };
  incrementalSync: {
    enabled: boolean;
    field: string; // field to track for incremental updates
    lastSyncField: string;
  };
  conflictResolution: {
    strategy: 'provider_wins' | 'local_wins' | 'manual' | 'merge';
    fields: string[];
  };
}

// Conflict resolution types
export interface SyncConflict {
  id: string;
  jobId: string;
  connectionId: string;
  providerId: string;
  field: string;
  localValue: any;
  providerValue: any;
  resolution?: 'provider_wins' | 'local_wins' | 'merge' | 'manual';
  resolvedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Reporting types
export interface SyncReport {
  id: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    averageProcessingTime: number;
    totalRecordsProcessed: number;
    successRate: number;
  };
  providerStats: Record<string, {
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    averageProcessingTime: number;
    recordsProcessed: number;
    errorRate: number;
  }>;
  errors: SyncError[];
  performance: {
    peakThroughput: number;
    averageThroughput: number;
    queueWaitTime: number;
    processingTime: number;
  };
  generatedAt: Date;
}

export interface SyncAnalytics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncTime: number;
  providerPerformance: Record<string, {
    syncCount: number;
    successRate: number;
    averageTime: number;
    errorCount: number;
  }>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

// Event types for real-time updates
export interface SyncEvent {
  type: 'job_queued' | 'job_started' | 'job_progress' | 'job_completed' | 'job_failed' | 'job_cancelled';
  jobId: string;
  connectionId: string;
  userId: string;
  providerId: string;
  data: Record<string, any>;
  timestamp: Date;
}

// Database types for sync operations
export interface DatabaseSyncJob {
  id: string;
  connection_id: string;
  user_id: string;
  provider_id: string;
  operation_type: string;
  priority: string;
  status: string;
  parameters?: Record<string, any>;
  retry_count: number;
  max_retries: number;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  next_retry_at?: string;
  error?: Record<string, any>;
  progress?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSyncSchedule {
  id: string;
  connection_id: string;
  user_id: string;
  provider_id: string;
  frequency: string;
  enabled: boolean;
  next_run_at: string;
  last_run_at?: string;
  config: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Utility types
export type SyncJobHandler = (job: SyncJob) => Promise<SyncJobResult>;
export type SyncEventHandler = (event: SyncEvent) => void;
export type ConflictResolver = (conflict: SyncConflict) => Promise<SyncConflict>;

// Configuration interfaces
export interface SyncEngineConfig {
  queue: QueueConfig;
  scheduler: SchedulerConfig;
  providers: Record<string, ProviderSyncConfig>;
  reporting: {
    enabled: boolean;
    interval: number; // minutes
    retentionDays: number;
  };
  events: {
    enabled: boolean;
    realtime: boolean;
    webhookUrl?: string;
  };
}

// Status and health types
export interface SyncEngineStatus {
  isRunning: boolean;
  queue: QueueMetrics;
  scheduler: {
    isRunning: boolean;
    activeSchedules: number;
    nextRunAt?: Date;
  };
  providers: Record<string, {
    status: 'online' | 'offline' | 'degraded';
    lastSyncAt?: Date;
    errorRate: number;
  }>;
  performance: {
    averageThroughput: number;
    queueWaitTime: number;
    processingTime: number;
    memoryUsage: number;
  };
  lastUpdated: Date;
}