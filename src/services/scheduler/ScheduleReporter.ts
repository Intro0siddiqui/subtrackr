import { Schedule, ScheduleReport, ScheduleStats, ScheduleConflict, ResourceMetrics } from './types';
import { ScheduleManager } from './ScheduleManager';
import { TaskExecutor } from './TaskExecutor';

/**
 * Schedule Reporter
 * 
 * Provides reporting and analytics for sync schedules with:
 * - Performance metrics
 * - Schedule statistics
 * - Conflict reporting
 * - Resource usage tracking
 */
export class ScheduleReporter {
  private scheduleManager: ScheduleManager;
  private taskExecutor: TaskExecutor;
  private reports: ScheduleReport[] = [];
  private initialized: boolean = false;

  constructor(scheduleManager: ScheduleManager, taskExecutor: TaskExecutor) {
    this.scheduleManager = scheduleManager;
    this.taskExecutor = taskExecutor;
  }

  /**
   * Initialize the schedule reporter
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Any initialization logic here
      this.initialized = true;
      console.log('ScheduleReporter: Initialized successfully');
    } catch (error) {
      console.error('ScheduleReporter: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Generate a schedule report for a time period
   */
  async generateReport(startDate: Date, endDate: Date): Promise<ScheduleReport> {
    if (!this.initialized) {
      throw new Error('ScheduleReporter not initialized');
    }

    const schedules = this.scheduleManager.getAllSchedules();
    const stats = await this.scheduleManager.getScheduleStats();
    const resourceMetrics = this.taskExecutor.getResourceMetrics();

    // Filter schedules in the time period
    const schedulesInPeriod = schedules.filter(schedule => 
      schedule.createdAt >= startDate && schedule.createdAt <= endDate
    );

    // Calculate performance metrics
    const executedSchedules = schedulesInPeriod.filter(s => s.lastRunAt);
    const failedSchedules = schedulesInPeriod.filter(s => 
      s.metadata?.lastError && new Date(s.metadata.lastError.timestamp) >= startDate
    );

    const averageExecutionTime = executedSchedules.length > 0
      ? executedSchedules.reduce((sum, s) => sum + (s.metadata?.lastDuration || 0), 0) / executedSchedules.length
      : 0;

    const successRate = executedSchedules.length > 0
      ? (executedSchedules.length - failedSchedules.length) / executedSchedules.length
      : 1;

    // Provider statistics
    const providerStats: Record<string, any> = {};
    Object.keys(stats.byProvider).forEach(providerId => {
      const providerSchedules = schedules.filter(s => s.providerId === providerId);
      const providerExecuted = providerSchedules.filter(s => s.lastRunAt);
      const providerFailed = providerSchedules.filter(s => 
        s.metadata?.lastError && new Date(s.metadata.lastError.timestamp) >= startDate
      );

      providerStats[providerId] = {
        totalSchedules: providerSchedules.length,
        executedSchedules: providerExecuted.length,
        failedSchedules: providerFailed.length,
        averageExecutionTime: providerExecuted.length > 0
          ? providerExecuted.reduce((sum, s) => sum + (s.metadata?.lastDuration || 0), 0) / providerExecuted.length
          : 0,
        conflicts: 0, // Would be populated from conflict data
        errorRate: providerExecuted.length > 0
          ? providerFailed.length / providerExecuted.length
          : 0
      };
    });

    const report: ScheduleReport = {
      id: `report_${Date.now()}`,
      period: {
        start: startDate,
        end: endDate
      },
      summary: {
        totalSchedules: stats.total,
        activeSchedules: stats.enabled,
        executedSchedules: executedSchedules.length,
        failedSchedules: failedSchedules.length,
        conflictsDetected: stats.conflicts,
        averageExecutionTime,
        successRate
      },
      providerStats,
      conflicts: [], // Would be populated from conflict data
      errors: [], // Would be populated from error data
      performance: {
        peakThroughput: 0, // Would be calculated from execution data
        averageThroughput: 0, // Would be calculated from execution data
        resourceUsage: resourceMetrics
      },
      generatedAt: new Date()
    };

    // Store the report
    this.reports.push(report);

    return report;
  }

 /**
   * Get schedule statistics
   */
  async getScheduleStats(): Promise<ScheduleStats> {
    if (!this.initialized) {
      throw new Error('ScheduleReporter not initialized');
    }

    return await this.scheduleManager.getScheduleStats();
  }

  /**
   * Get resource metrics
   */
  getResourceMetrics(): ResourceMetrics {
    if (!this.initialized) {
      throw new Error('ScheduleReporter not initialized');
    }

    return this.taskExecutor.getResourceMetrics();
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    totalSchedules: number;
    activeSchedules: number;
    executedSchedules: number;
    failedSchedules: number;
    averageExecutionTime: number;
    successRate: number;
    resourceUsage: ResourceMetrics;
  }> {
    if (!this.initialized) {
      throw new Error('ScheduleReporter not initialized');
    }

    const stats = await this.getScheduleStats();
    const resourceMetrics = this.getResourceMetrics();

    // In a real implementation, you would get these from actual execution data
    return {
      totalSchedules: stats.total,
      activeSchedules: stats.enabled,
      executedSchedules: stats.due, // Approximation
      failedSchedules: stats.conflicts, // Approximation
      averageExecutionTime: 0, // Would be calculated from execution data
      successRate: stats.enabled > 0 ? (stats.enabled - stats.conflicts) / stats.enabled : 1,
      resourceUsage: resourceMetrics
    };
  }

  /**
   * Get all reports
   */
  getAllReports(): ScheduleReport[] {
    return [...this.reports];
  }

  /**
   * Get reports in date range
   */
  getReportsInRange(startDate: Date, endDate: Date): ScheduleReport[] {
    return this.reports.filter(report => 
      report.generatedAt >= startDate && report.generatedAt <= endDate
    );
  }

  /**
   * Get latest report
   */
  getLatestReport(): ScheduleReport | null {
    if (this.reports.length === 0) {
      return null;
    }
    return this.reports[this.reports.length - 1];
  }

  /**
   * Export report data
   */
  exportReportData(format: 'json' | 'csv' = 'json'): string {
    if (!this.initialized) {
      throw new Error('ScheduleReporter not initialized');
    }

    const latestReport = this.getLatestReport();
    if (!latestReport) {
      return format === 'json' ? '{}' : '';
    }

    if (format === 'json') {
      return JSON.stringify(latestReport, null, 2);
    } else {
      // Simple CSV export (would be more complex in a real implementation)
      return `Report ID,Period Start,Period End,Total Schedules,Active Schedules,Executed Schedules,Failed Schedules,Conflicts Detected,Average Execution Time,Success Rate
${latestReport.id},${latestReport.period.start.toISOString()},${latestReport.period.end.toISOString()},${latestReport.summary.totalSchedules},${latestReport.summary.activeSchedules},${latestReport.summary.executedSchedules},${latestReport.summary.failedSchedules},${latestReport.summary.conflictsDetected},${latestReport.summary.averageExecutionTime},${latestReport.summary.successRate}`;
    }
  }

  /**
   * Log schedule event
   */
  logScheduleEvent(event: {
    type: string;
    scheduleId: string;
    message: string;
    metadata?: Record<string, any>;
  }): void {
    if (!this.initialized) {
      throw new Error('ScheduleReporter not initialized');
    }

    console.log(`ScheduleReporter: [${event.type}] Schedule ${event.scheduleId}: ${event.message}`, event.metadata || {});
  }

  /**
   * Log error
   */
  logError(error: {
    scheduleId: string;
    error: string;
    stack?: string;
    metadata?: Record<string, any>;
  }): void {
    if (!this.initialized) {
      throw new Error('ScheduleReporter not initialized');
    }

    console.error(`ScheduleReporter: Error in schedule ${error.scheduleId}: ${error.error}`, {
      stack: error.stack,
      ...error.metadata
    });
  }

  /**
   * Check if reporter is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
 async cleanup(): Promise<void> {
    this.reports = [];
    console.log('ScheduleReporter: Cleanup completed');
  }
}