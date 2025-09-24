/**
 * Sync Service Layer - Main Entry Point
 *
 * This module provides a complete subscription synchronization engine with:
 * - Multi-provider support (Netflix, Spotify, ChatGPT, Amazon Prime)
 * - Intelligent scheduling and queue management
 * - Real-time progress tracking and reporting
 * - Error recovery and conflict resolution
 * - Comprehensive analytics and monitoring
 *
 * @example
 * ```typescript
 * import { syncManager, syncQueue, syncScheduler } from '@/services/sync';
 *
 * // Initialize the sync engine
 * await syncManager.initialize();
 *
 * // Start a manual sync
 * const jobId = await syncManager.startSync('user123', 'netflix');
 *
 * // Schedule automatic sync
 * const scheduleId = await syncManager.scheduleSync('user123', 'netflix', 'daily');
 *
 * // Get sync status
 * const status = syncManager.getStatus();
 * ```
 */

// Core Components
export { SyncManager } from './SyncManager';
export { SyncQueue } from './SyncQueue';
export { SyncProcessor } from './SyncProcessor';
export { SyncScheduler } from './SyncScheduler';
export { SyncReporter } from './SyncReporter';

// Types
export type {
  SyncJob,
  SyncJobResult,
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
  ProviderSyncConfig,
  SyncProgress,
  SyncStep,
  SyncError,
  QueueMetrics,
  QueueConfig,
  SchedulerConfig
} from './types';

// Import required types from oauth module
import type {
  SyncFrequency,
  OAuthSubscription,
  BillingRecord,
  OAuthConnection
} from '../../types/oauth';

// Re-export commonly used types
export type {
  SyncFrequency,
  OAuthSubscription,
  BillingRecord,
  OAuthConnection
};

// Singleton instances
import { SyncManager } from './SyncManager';
import { SyncQueue } from './SyncQueue';
import { SyncProcessor } from './SyncProcessor';
import { SyncScheduler } from './SyncScheduler';
import { SyncReporter } from './SyncReporter';

// Create singleton instances with default configurations
const syncManager = SyncManager.getInstance();
const syncQueue = SyncQueue.getInstance();
const syncProcessor = SyncProcessor.getInstance();
const syncScheduler = SyncScheduler.getInstance();
const syncReporter = SyncReporter.getInstance();

// Main Service Class
export class SyncService {
  private static instance: SyncService;
  private manager: SyncManager;

  private constructor() {
    this.manager = syncManager;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Initialize the sync service
   */
  async initialize(config?: any): Promise<void> {
    return await this.manager.initialize();
  }

  /**
   * Start a sync operation
   */
  async startSync(
    userId: string,
    providerId: string,
    operationType?: any,
    options?: {
      priority?: any;
      parameters?: Record<string, any>;
      connectionId?: string;
    }
  ): Promise<string> {
    return await this.manager.startSync(userId, providerId, operationType, options);
  }

  /**
   * Schedule a sync operation
   */
  async scheduleSync(
    userId: string,
    providerId: string,
    frequency: any,
    operationType?: any,
    options?: {
      priority?: any;
      parameters?: Record<string, any>;
      connectionId?: string;
    }
  ): Promise<string> {
    return await this.manager.scheduleSync(userId, providerId, frequency, operationType, options);
  }

  /**
   * Get sync job status
   */
  getJobStatus(jobId: string) {
    return this.manager.getJobStatus(jobId);
  }

  /**
   * Get all sync jobs for a user
   */
  getUserJobs(userId: string) {
    return this.manager.getUserJobs(userId);
  }

  /**
   * Get sync jobs by status
   */
  getJobsByStatus(status: any) {
    return this.manager.getJobsByStatus(status);
  }

  /**
   * Cancel a sync job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    return await this.manager.cancelJob(jobId);
  }

  /**
   * Get sync schedule
   */
  getSchedule(scheduleId: string) {
    return this.manager.getSchedule(scheduleId);
  }

  /**
   * Get all sync schedules for a user
   */
  getUserSchedules(userId: string) {
    return this.manager.getUserSchedules(userId);
  }

  /**
   * Update sync schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<any>): Promise<boolean> {
    return await this.manager.updateSchedule(scheduleId, updates);
  }

  /**
   * Delete sync schedule
   */
  async deleteSchedule(scheduleId: string): Promise<boolean> {
    return await this.manager.deleteSchedule(scheduleId);
  }

  /**
   * Get sync engine status
   */
  getStatus() {
    return this.manager.getStatus();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return this.manager.getPerformanceMetrics();
  }

  /**
   * Get error analysis
   */
  getErrorAnalysis() {
    return this.manager.getErrorAnalysis();
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return this.manager.getQueueStatus();
  }

  /**
   * Get scheduler status
   */
  getSchedulerStatus() {
    return this.manager.getSchedulerStatus();
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return this.manager.getSystemStatus();
  }

  /**
   * Get current analytics
   */
  getAnalytics() {
    return this.manager.getAnalytics();
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
  ) {
    return await this.manager.generateReport(startDate, endDate, options);
  }

  /**
   * Get all reports
   */
  getAllReports(): any[] {
    return this.manager.getAllReports();
  }

  /**
   * Get reports in date range
   */
  getReportsInRange(startDate: Date, endDate: Date): any[] {
    return this.manager.getReportsInRange(startDate, endDate);
  }

  /**
   * Register conflict resolver
   */
  registerConflictResolver(providerId: string, resolver: (conflict: any) => Promise<any>): void {
    this.manager.registerConflictResolver(providerId, resolver);
  }

  /**
   * Add event handler
   */
  addEventHandler(handler: (event: any) => void): void {
    this.manager.addEventHandler(handler);
  }

  /**
   * Remove event handler
   */
  removeEventHandler(handler: (event: any) => void): boolean {
    return this.manager.removeEventHandler(handler);
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(providerId: string, config: Partial<any>): boolean {
    return this.manager.updateProviderConfig(providerId, config);
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(providerId: string) {
    return this.manager.getProviderConfig(providerId);
  }

  /**
   * Enable provider
   */
  enableProvider(providerId: string): boolean {
    return this.manager.enableProvider(providerId);
  }

  /**
   * Disable provider
   */
  disableProvider(providerId: string): boolean {
    return this.manager.disableProvider(providerId);
  }

  /**
   * Force execute a schedule
   */
  async forceExecuteSchedule(scheduleId: string): Promise<boolean> {
    return await this.manager.forceExecuteSchedule(scheduleId);
  }

  /**
   * Reschedule all schedules
   */
  async rescheduleAll(): Promise<void> {
    return await this.manager.rescheduleAll();
  }

  /**
   * Cleanup old data
   */
  async cleanup(): Promise<void> {
    return await this.manager.cleanup();
  }

  /**
   * Health check
   */
  async healthCheck() {
    return await this.manager.healthCheck();
  }

  /**
   * Shutdown the sync service
   */
  async shutdown(): Promise<void> {
    return await this.manager.shutdown();
  }
}

// Export singleton instances
export {
  syncManager,
  syncQueue,
  syncProcessor,
  syncScheduler,
  syncReporter
};

// Default export
export default SyncService.getInstance();

// Utility functions for common operations
export const syncUtils = {
  /**
   * Start sync for all providers for a user
   */
  async syncAllProviders(userId: string): Promise<string[]> {
    const providers = ['netflix', 'spotify', 'openai', 'amazon'];
    const jobIds: string[] = [];

    for (const providerId of providers) {
      try {
        const jobId = await syncManager.startSync(userId, providerId);
        jobIds.push(jobId);
      } catch (error) {
        console.error(`Failed to start sync for provider ${providerId}:`, error);
      }
    }

    return jobIds;
  },

  /**
   * Schedule daily sync for all providers for a user
   */
  async scheduleDailySyncAllProviders(userId: string): Promise<string[]> {
    const providers = ['netflix', 'spotify', 'openai', 'amazon'];
    const scheduleIds: string[] = [];

    for (const providerId of providers) {
      try {
        const scheduleId = await syncManager.scheduleSync(
          userId,
          providerId,
          'daily' as any
        );
        scheduleIds.push(scheduleId);
      } catch (error) {
        console.error(`Failed to schedule sync for provider ${providerId}:`, error);
      }
    }

    return scheduleIds;
  },

  /**
   * Get comprehensive sync status for a user
   */
  getUserSyncStatus(userId: string) {
    const jobs = syncManager.getUserJobs(userId);
    const schedules = syncManager.getUserSchedules(userId);

    return {
      userId,
      activeJobs: jobs.filter(job => job.status === 'running' || job.status === 'pending'),
      completedJobs: jobs.filter(job => job.status === 'completed'),
      failedJobs: jobs.filter(job => job.status === 'failed'),
      schedules: schedules.filter(schedule => schedule.enabled),
      lastSyncAt: jobs
        .filter(job => job.completedAt)
        .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]?.completedAt
    };
  },

  /**
   * Check if user has any active sync operations
   */
  hasActiveSyncs(userId: string): boolean {
    const jobs = syncManager.getUserJobs(userId);
    return jobs.some(job => job.status === 'running' || job.status === 'pending');
  },

  /**
   * Get sync statistics for all providers
   */
  getProviderSyncStats() {
    const status = syncManager.getStatus();
    const performance = syncManager.getPerformanceMetrics();

    return {
      providers: Object.entries(status.providers).map(([providerId, providerStatus]) => ({
        providerId,
        status: providerStatus.status,
        lastSyncAt: providerStatus.lastSyncAt,
        errorRate: providerStatus.errorRate,
        syncCount: performance.providerPerformance[providerId]?.syncCount || 0,
        successRate: performance.providerPerformance[providerId]?.successRate || 0
      })),
      totalSyncs: performance.totalSyncs,
      overallSuccessRate: performance.successRate,
      averageProcessingTime: performance.averageProcessingTime
    };
  }
};