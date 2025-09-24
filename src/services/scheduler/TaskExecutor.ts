import { Schedule } from './types';
import { ExecutionResult, ResourceMetrics } from './types';
import { ExecutionIntegrationService } from './execution';
import { SyncManager } from '../sync/SyncManager';

/**
 * Task Executor
 * 
 * Executes scheduled sync tasks with:
 * - Concurrent task management
 * - Resource monitoring
 * - Error handling and retries
 * - Performance tracking
 */
export class TaskExecutor {
  private executionService: ExecutionIntegrationService;
  private maxConcurrentTasks: number;
  private activeTasks: Set<string> = new Set();
  private taskQueue: Schedule[] = [];
  private isProcessing: boolean = false;
  private initialized: boolean = false;

  constructor(syncManager: SyncManager, maxConcurrentTasks: number = 5) {
    this.executionService = new ExecutionIntegrationService(syncManager);
    this.maxConcurrentTasks = maxConcurrentTasks;
  }

  /**
   * Initialize the task executor
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize execution service
      await this.executionService.initialize();
      
      this.initialized = true;
      console.log('TaskExecutor: Initialized successfully');
    } catch (error) {
      console.error('TaskExecutor: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Execute a schedule
   */
  async executeSchedule(schedule: Schedule): Promise<ExecutionResult> {
    if (!this.initialized) {
      throw new Error('TaskExecutor not initialized');
    }

    const scheduleId = schedule.id;

    // Check if we can execute more tasks
    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      // Queue the task for later execution
      this.taskQueue.push(schedule);
      console.log(`TaskExecutor: Queued schedule ${scheduleId} due to concurrency limit`);
      
      return {
        success: true,
        scheduleId,
        duration: 0,
        metadata: { queued: true },
        completedAt: new Date()
      };
    }

    // Add to active tasks
    this.activeTasks.add(scheduleId);

    try {
      console.log(`TaskExecutor: Executing schedule ${scheduleId} for provider ${schedule.providerId}`);

      // Execute through integration service
      const result = await this.executionService.executeSchedule(schedule);

      console.log(`TaskExecutor: Schedule ${scheduleId} executed with result: ${result.success}`);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`TaskExecutor: Failed to execute schedule ${scheduleId}:`, errorMessage);

      return {
        success: false,
        scheduleId,
        error: errorMessage,
        duration: 0,
        completedAt: new Date()
      };

    } finally {
      // Remove from active tasks
      this.activeTasks.delete(scheduleId);

      // Process next task in queue if available
      this.processQueue();
    }
  }

  /**
   * Process queued tasks
   */
  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0 || this.activeTasks.size >= this.maxConcurrentTasks) {
      return;
    }

    const schedule = this.taskQueue.shift();
    if (schedule) {
      // Execute the queued task
      await this.executeSchedule(schedule);
    }
  }

  /**
   * Execute multiple schedules concurrently
   */
  async executeSchedules(schedules: Schedule[]): Promise<ExecutionResult[]> {
    if (!this.initialized) {
      throw new Error('TaskExecutor not initialized');
    }

    // Use execution service to execute schedules
    return await this.executionService.executeSchedules(schedules, this.maxConcurrentTasks);
  }

  /**
   * Get resource metrics
   */
  getResourceMetrics(): ResourceMetrics {
    return {
      cpuUsage: this.getCpuUsage(),
      memoryUsage: this.getMemoryUsage(),
      activeSchedules: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      maxConcurrentTasks: this.maxConcurrentTasks
    };
  }

  /**
   * Get CPU usage (simplified)
   */
  private getCpuUsage(): number {
    // In a real implementation, you would get actual CPU usage
    // This is a placeholder implementation
    return process.cpuUsage ? (process.cpuUsage().user / 100000) : 0;
 }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    return process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;
  }

  /**
   * Get active task count
   */
  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Get queued task count
   */
  getQueuedTaskCount(): number {
    return this.taskQueue.length;
  }

  /**
   * Update max concurrent tasks
   */
  updateMaxConcurrentTasks(maxTasks: number): void {
    this.maxConcurrentTasks = maxTasks;
    
    // Process any queued tasks that can now be executed
    this.processQueue();
  }

  /**
   * Cancel all pending tasks
   */
  async cancelAllPendingTasks(): Promise<void> {
    this.taskQueue = [];
    console.log('TaskExecutor: Cancelled all pending tasks');
  }

  /**
   * Check if executor is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.taskQueue = [];
    this.activeTasks.clear();
    await this.executionService.cleanup();
    console.log('TaskExecutor: Cleanup completed');
  }
}