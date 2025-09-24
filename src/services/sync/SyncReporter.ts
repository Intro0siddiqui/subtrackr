import {
  SyncReport,
  SyncAnalytics,
  SyncJob,
  SyncJobResult,
  SyncError,
  SyncEvent,
  SyncJobStatus
} from './types';
import { SyncQueue } from './SyncQueue';
import { SyncScheduler } from './SyncScheduler';

/**
 * Sync Reporter Implementation
 *
 * Provides comprehensive reporting and analytics for sync operations with:
 * - Real-time performance metrics
 * - Historical reporting and trends
 * - Error analysis and categorization
 * - Provider-specific performance insights
 * - Automated report generation
 */
export class SyncReporter {
  private static instance: SyncReporter;
  private syncQueue: SyncQueue;
  private syncScheduler: SyncScheduler;
  private reports: Map<string, SyncReport> = new Map();
  private analytics: SyncAnalytics | null = null;
  private eventHandlers: ((event: SyncEvent) => void)[] = [];
  private metrics = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    totalProcessingTime: 0,
    totalRecordsProcessed: 0,
    providerStats: new Map<string, {
      syncCount: number;
      successCount: number;
      totalTime: number;
      errorCount: number;
      recordsProcessed: number;
    }>()
  };

  private constructor() {
    this.syncQueue = SyncQueue.getInstance();
    this.syncScheduler = SyncScheduler.getInstance();
    this.initializeEventHandlers();
    this.startPeriodicReporting();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SyncReporter {
    if (!SyncReporter.instance) {
      SyncReporter.instance = new SyncReporter();
    }
    return SyncReporter.instance;
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
   * Handle sync events for metrics collection
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

    // Forward to registered handlers
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('SyncReporter: Error in event handler:', error);
      }
    });
  }

  /**
   * Handle job completed event
   */
  private handleJobCompleted(event: SyncEvent): void {
    this.metrics.totalSyncs++;
    this.metrics.successfulSyncs++;

    // Update provider stats
    const providerId = event.providerId;
    if (!this.metrics.providerStats.has(providerId)) {
      this.metrics.providerStats.set(providerId, {
        syncCount: 0,
        successCount: 0,
        totalTime: 0,
        errorCount: 0,
        recordsProcessed: 0
      });
    }

    const stats = this.metrics.providerStats.get(providerId)!;
    stats.syncCount++;
    stats.successCount++;

    // Add processing time if available
    const job = this.syncQueue.getJob(event.jobId);
    if (job && job.startedAt && job.completedAt) {
      const processingTime = job.completedAt.getTime() - job.startedAt.getTime();
      stats.totalTime += processingTime;
      this.metrics.totalProcessingTime += processingTime;
    }

    // Add records processed if available
    const result = event.data.result as SyncJobResult;
    if (result) {
      stats.recordsProcessed += result.recordsProcessed;
      this.metrics.totalRecordsProcessed += result.recordsProcessed;
    }
  }

  /**
   * Handle job failed event
   */
  private handleJobFailed(event: SyncEvent): void {
    this.metrics.totalSyncs++;
    this.metrics.failedSyncs++;

    // Update provider stats
    const providerId = event.providerId;
    if (!this.metrics.providerStats.has(providerId)) {
      this.metrics.providerStats.set(providerId, {
        syncCount: 0,
        successCount: 0,
        totalTime: 0,
        errorCount: 0,
        recordsProcessed: 0
      });
    }

    const stats = this.metrics.providerStats.get(providerId)!;
    stats.syncCount++;
    stats.errorCount++;
  }

  /**
   * Start periodic reporting
   */
  private startPeriodicReporting(): void {
    // Generate analytics every 5 minutes
    setInterval(() => {
      this.generateAnalytics();
    }, 5 * 60 * 1000);

    // Generate daily reports at midnight
    this.scheduleDailyReport();
  }

  /**
   * Schedule daily report generation
   */
  private scheduleDailyReport(): void {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.generateDailyReport();
      // Schedule next day's report
      this.scheduleDailyReport();
    }, timeUntilMidnight);
  }

  /**
   * Generate analytics
   */
  private generateAnalytics(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    this.analytics = {
      totalSyncs: this.metrics.totalSyncs,
      successfulSyncs: this.metrics.successfulSyncs,
      failedSyncs: this.metrics.failedSyncs,
      averageSyncTime: this.metrics.totalSyncs > 0 ?
        this.metrics.totalProcessingTime / this.metrics.totalSyncs : 0,
      providerPerformance: Object.fromEntries(
        Array.from(this.metrics.providerStats.entries()).map(([providerId, stats]) => [
          providerId,
          {
            syncCount: stats.syncCount,
            successRate: stats.syncCount > 0 ? (stats.successCount / stats.syncCount) * 100 : 0,
            averageTime: stats.syncCount > 0 ? stats.totalTime / stats.syncCount : 0,
            errorCount: stats.errorCount
          }
        ])
      ),
      timeRange: {
        start: oneHourAgo,
        end: now
      }
    };

    console.log('SyncReporter: Generated analytics for the last hour');
  }

  /**
   * Generate daily report
   */
  private async generateDailyReport(): Promise<void> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const report: SyncReport = {
      id: this.generateReportId(),
      period: {
        start: yesterday,
        end: now
      },
      summary: {
        totalJobs: this.metrics.totalSyncs,
        successfulJobs: this.metrics.successfulSyncs,
        failedJobs: this.metrics.failedSyncs,
        averageProcessingTime: this.metrics.totalSyncs > 0 ?
          this.metrics.totalProcessingTime / this.metrics.totalSyncs : 0,
        totalRecordsProcessed: this.metrics.totalRecordsProcessed,
        successRate: this.metrics.totalSyncs > 0 ?
          (this.metrics.successfulSyncs / this.metrics.totalSyncs) * 100 : 0
      },
      providerStats: Object.fromEntries(
        Array.from(this.metrics.providerStats.entries()).map(([providerId, stats]) => [
          providerId,
          {
            totalJobs: stats.syncCount,
            successfulJobs: stats.successCount,
            failedJobs: stats.errorCount,
            averageProcessingTime: stats.syncCount > 0 ? stats.totalTime / stats.syncCount : 0,
            recordsProcessed: stats.recordsProcessed,
            errorRate: stats.syncCount > 0 ? (stats.errorCount / stats.syncCount) * 100 : 0
          }
        ])
      ),
      errors: this.collectErrors(yesterday, now),
      performance: {
        peakThroughput: this.calculatePeakThroughput(yesterday, now),
        averageThroughput: this.calculateAverageThroughput(yesterday, now),
        queueWaitTime: this.calculateAverageQueueWaitTime(yesterday, now),
        processingTime: this.metrics.totalProcessingTime
      },
      generatedAt: now
    };

    this.reports.set(report.id, report);

    // Clean up old reports (keep last 30 days)
    this.cleanupOldReports();

    console.log(`SyncReporter: Generated daily report ${report.id}`);

    // Save report to database (placeholder)
    await this.saveReport(report);
  }

  /**
   * Collect errors in the given time range
   */
  private collectErrors(startDate: Date, endDate: Date): SyncError[] {
    const errors: SyncError[] = [];

    // This would query your database for sync errors in the time range
    // For now, return empty array
    return errors;
  }

  /**
   * Calculate peak throughput
   */
  private calculatePeakThroughput(startDate: Date, endDate: Date): number {
    // This would calculate the peak jobs per minute in the time range
    // For now, return a mock value
    return 10;
  }

  /**
   * Calculate average throughput
   */
  private calculateAverageThroughput(startDate: Date, endDate: Date): number {
    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    return hours > 0 ? this.metrics.totalSyncs / hours : 0;
  }

  /**
   * Calculate average queue wait time
   */
  private calculateAverageQueueWaitTime(startDate: Date, endDate: Date): number {
    // This would calculate average time jobs spend in queue
    // For now, return a mock value
    return 5000; // 5 seconds
  }

  /**
   * Clean up old reports
   */
  private cleanupOldReports(): void {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const reportsToDelete: string[] = [];

    for (const [reportId, report] of this.reports) {
      if (report.generatedAt < cutoffDate) {
        reportsToDelete.push(reportId);
      }
    }

    reportsToDelete.forEach(reportId => {
      this.reports.delete(reportId);
    });

    if (reportsToDelete.length > 0) {
      console.log(`SyncReporter: Cleaned up ${reportsToDelete.length} old reports`);
    }
  }

  /**
   * Save report to database
   */
  private async saveReport(report: SyncReport): Promise<void> {
    // This would save the report to your database
    // For now, just log the action
    console.log(`SyncReporter: Saving report ${report.id} to database`);
  }

  /**
   * Get current analytics
   */
  getAnalytics(): SyncAnalytics | null {
    return this.analytics;
  }

  /**
   * Get report by ID
   */
  getReport(reportId: string): SyncReport | undefined {
    return this.reports.get(reportId);
  }

  /**
   * Get all reports
   */
  getAllReports(): SyncReport[] {
    return Array.from(this.reports.values()).sort((a, b) =>
      b.generatedAt.getTime() - a.generatedAt.getTime()
    );
  }

  /**
   * Get reports for a specific time range
   */
  getReportsInRange(startDate: Date, endDate: Date): SyncReport[] {
    return this.getAllReports().filter(report =>
      report.generatedAt >= startDate && report.generatedAt <= endDate
    );
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    totalSyncs: number;
    successRate: number;
    averageProcessingTime: number;
    totalRecordsProcessed: number;
    providerPerformance: Record<string, {
      syncCount: number;
      successRate: number;
      averageTime: number;
      errorRate: number;
    }>;
  } {
    return {
      totalSyncs: this.metrics.totalSyncs,
      successRate: this.metrics.totalSyncs > 0 ?
        (this.metrics.successfulSyncs / this.metrics.totalSyncs) * 100 : 0,
      averageProcessingTime: this.metrics.totalSyncs > 0 ?
        this.metrics.totalProcessingTime / this.metrics.totalSyncs : 0,
      totalRecordsProcessed: this.metrics.totalRecordsProcessed,
      providerPerformance: Object.fromEntries(
        Array.from(this.metrics.providerStats.entries()).map(([providerId, stats]) => [
          providerId,
          {
            syncCount: stats.syncCount,
            successRate: stats.syncCount > 0 ? (stats.successCount / stats.syncCount) * 100 : 0,
            averageTime: stats.syncCount > 0 ? stats.totalTime / stats.syncCount : 0,
            errorRate: stats.syncCount > 0 ? (stats.errorCount / stats.syncCount) * 100 : 0
          }
        ])
      )
    };
  }

  /**
   * Get error analysis
   */
  getErrorAnalysis(): {
    totalErrors: number;
    errorByType: Record<string, number>;
    errorByProvider: Record<string, number>;
    recentErrors: SyncError[];
    topErrorMessages: Array<{ message: string; count: number }>;
  } {
    // This would analyze errors from your database
    // For now, return mock data
    return {
      totalErrors: this.metrics.failedSyncs,
      errorByType: {
        'TIMEOUT': 10,
        'RATE_LIMIT': 5,
        'AUTH_ERROR': 3,
        'API_ERROR': 2
      },
      errorByProvider: {
        'netflix': 8,
        'spotify': 5,
        'openai': 4,
        'amazon': 3
      },
      recentErrors: [],
      topErrorMessages: [
        { message: 'Rate limit exceeded', count: 5 },
        { message: 'Authentication failed', count: 3 },
        { message: 'Timeout error', count: 2 }
      ]
    };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    currentJobs: number;
    runningJobs: number;
    pendingJobs: number;
    failedJobs: number;
    averageWaitTime: number;
    averageProcessingTime: number;
    throughput: number;
  } {
    const queueMetrics = this.syncQueue.getMetrics();
    return {
      currentJobs: queueMetrics.totalJobs,
      runningJobs: queueMetrics.runningJobs,
      pendingJobs: queueMetrics.pendingJobs,
      failedJobs: queueMetrics.failedJobs,
      averageWaitTime: queueMetrics.averageWaitTime,
      averageProcessingTime: queueMetrics.averageProcessingTime,
      throughput: queueMetrics.throughput
    };
  }

  /**
   * Get scheduler status
   */
  getSchedulerStatus(): {
    isRunning: boolean;
    totalSchedules: number;
    activeSchedules: number;
    nextScheduleAt?: Date;
  } {
    return this.syncScheduler.getStatus();
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): {
    timestamp: Date;
    performance: ReturnType<SyncReporter['getPerformanceMetrics']>;
    queue: ReturnType<SyncReporter['getQueueStatus']>;
    scheduler: ReturnType<SyncReporter['getSchedulerStatus']>;
    errors: ReturnType<SyncReporter['getErrorAnalysis']>;
    analytics: SyncAnalytics | null;
  } {
    return {
      timestamp: new Date(),
      performance: this.getPerformanceMetrics(),
      queue: this.getQueueStatus(),
      scheduler: this.getSchedulerStatus(),
      errors: this.getErrorAnalysis(),
      analytics: this.getAnalytics()
    };
  }

  /**
   * Generate custom report
   */
  async generateCustomReport(
    startDate: Date,
    endDate: Date,
    options: {
      includeErrors?: boolean;
      includePerformance?: boolean;
      groupByProvider?: boolean;
      groupByHour?: boolean;
    } = {}
  ): Promise<SyncReport> {
    const report: SyncReport = {
      id: this.generateReportId(),
      period: { start: startDate, end: endDate },
      summary: {
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        averageProcessingTime: 0,
        totalRecordsProcessed: 0,
        successRate: 0
      },
      providerStats: {},
      errors: options.includeErrors ? this.collectErrors(startDate, endDate) : [],
      performance: {
        peakThroughput: this.calculatePeakThroughput(startDate, endDate),
        averageThroughput: this.calculateAverageThroughput(startDate, endDate),
        queueWaitTime: this.calculateAverageQueueWaitTime(startDate, endDate),
        processingTime: 0
      },
      generatedAt: new Date()
    };

    // This would generate a custom report based on the options
    // For now, return the basic report
    return report;
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
   * Export analytics data
   */
  exportAnalytics(format: 'json' | 'csv' = 'json'): string {
    if (!this.analytics) {
      throw new Error('No analytics data available');
    }

    if (format === 'csv') {
      return this.convertAnalyticsToCSV(this.analytics);
    }

    return JSON.stringify(this.analytics, null, 2);
  }

  /**
   * Convert analytics to CSV
   */
  private convertAnalyticsToCSV(analytics: SyncAnalytics): string {
    const headers = ['Provider', 'Sync Count', 'Success Rate (%)', 'Average Time (ms)', 'Error Count'];
    const rows = [headers.join(',')];

    Object.entries(analytics.providerPerformance).forEach(([provider, stats]) => {
      rows.push([
        provider,
        stats.syncCount.toString(),
        stats.successRate.toFixed(2),
        stats.averageTime.toFixed(0),
        stats.errorCount.toString()
      ].join(','));
    });

    return rows.join('\n');
  }

  /**
   * Reset metrics (for testing or maintenance)
   */
  resetMetrics(): void {
    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalProcessingTime: 0,
      totalRecordsProcessed: 0,
      providerStats: new Map()
    };

    console.log('SyncReporter: Metrics reset');
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}