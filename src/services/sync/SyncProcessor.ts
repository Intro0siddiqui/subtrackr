import {
  SyncJob,
  SyncJobResult,
  SyncJobStatus,
  SyncOperationType,
  SyncError,
  SyncProgress,
  SyncStep,
  SyncConflict,
  ProviderSyncConfig,
  SyncJobHandler
} from './types';
import {
  OAuthSubscription,
  BillingRecord,
  OAuthConnection
} from '../../types/oauth';
import { oauthService } from '../oauth';
import { SyncQueue } from './SyncQueue';

/**
 * Sync Processor Implementation
 *
 * Handles provider-specific sync operations with:
 * - Multi-provider support (Netflix, Spotify, ChatGPT, Amazon Prime)
 * - Incremental sync capabilities
 * - Data transformation and mapping
 * - Conflict resolution strategies
 * - Progress tracking and reporting
 */
export class SyncProcessor {
  private static instance: SyncProcessor;
  private providerConfigs: Map<string, ProviderSyncConfig> = new Map();
  private syncQueue: SyncQueue;
  private conflictResolvers: Map<string, (conflict: SyncConflict) => Promise<SyncConflict>> = new Map();

  private constructor() {
    this.syncQueue = SyncQueue.getInstance();
    this.initializeDefaultProviderConfigs();
    this.registerJobHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SyncProcessor {
    if (!SyncProcessor.instance) {
      SyncProcessor.instance = new SyncProcessor();
    }
    return SyncProcessor.instance;
  }

  /**
   * Initialize default provider configurations
   */
  private initializeDefaultProviderConfigs(): void {
    const defaultConfigs: ProviderSyncConfig[] = [
      {
        providerId: 'netflix',
        enabled: true,
        syncFrequency: 'daily' as any,
        operationTypes: [
          SyncOperationType.SUBSCRIPTION_SYNC,
          SyncOperationType.BILLING_SYNC,
          SyncOperationType.PROFILE_SYNC
        ],
        rateLimit: {
          requestsPerSecond: 5,
          requestsPerMinute: 100,
          burstLimit: 10
        },
        timeout: 30000,
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true
        },
        incrementalSync: {
          enabled: true,
          field: 'updated_at',
          lastSyncField: 'last_synced_at'
        },
        conflictResolution: {
          strategy: 'provider_wins',
          fields: ['amount', 'status', 'next_billing_date']
        }
      },
      {
        providerId: 'spotify',
        enabled: true,
        syncFrequency: 'weekly' as any,
        operationTypes: [
          SyncOperationType.SUBSCRIPTION_SYNC,
          SyncOperationType.BILLING_SYNC
        ],
        rateLimit: {
          requestsPerSecond: 10,
          requestsPerMinute: 200,
          burstLimit: 20
        },
        timeout: 15000,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 500,
          exponentialBackoff: true
        },
        incrementalSync: {
          enabled: true,
          field: 'last_updated',
          lastSyncField: 'last_synced_at'
        },
        conflictResolution: {
          strategy: 'merge',
          fields: ['amount', 'status']
        }
      },
      {
        providerId: 'openai',
        enabled: true,
        syncFrequency: 'monthly' as any,
        operationTypes: [
          SyncOperationType.SUBSCRIPTION_SYNC,
          SyncOperationType.BILLING_SYNC
        ],
        rateLimit: {
          requestsPerSecond: 20,
          requestsPerMinute: 300,
          burstLimit: 30
        },
        timeout: 10000,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 300,
          exponentialBackoff: false
        },
        incrementalSync: {
          enabled: false,
          field: '',
          lastSyncField: ''
        },
        conflictResolution: {
          strategy: 'local_wins',
          fields: ['amount', 'billing_cycle']
        }
      },
      {
        providerId: 'amazon',
        enabled: true,
        syncFrequency: 'daily' as any,
        operationTypes: [
          SyncOperationType.SUBSCRIPTION_SYNC,
          SyncOperationType.BILLING_SYNC,
          SyncOperationType.PROFILE_SYNC
        ],
        rateLimit: {
          requestsPerSecond: 8,
          requestsPerMinute: 150,
          burstLimit: 15
        },
        timeout: 20000,
        retryConfig: {
          maxRetries: 3,
          retryDelay: 800,
          exponentialBackoff: true
        },
        incrementalSync: {
          enabled: true,
          field: 'lastModifiedDate',
          lastSyncField: 'last_synced_at'
        },
        conflictResolution: {
          strategy: 'provider_wins',
          fields: ['amount', 'status', 'next_billing_date']
        }
      }
    ];

    defaultConfigs.forEach(config => {
      this.providerConfigs.set(config.providerId, config);
    });
  }

  /**
   * Register job handlers with the sync queue
   */
  private registerJobHandlers(): void {
    // Register handlers for each operation type
    this.syncQueue.registerHandler(SyncOperationType.FULL_SYNC, this.handleFullSync.bind(this));
    this.syncQueue.registerHandler(SyncOperationType.INCREMENTAL_SYNC, this.handleIncrementalSync.bind(this));
    this.syncQueue.registerHandler(SyncOperationType.SUBSCRIPTION_SYNC, this.handleSubscriptionSync.bind(this));
    this.syncQueue.registerHandler(SyncOperationType.BILLING_SYNC, this.handleBillingSync.bind(this));
    this.syncQueue.registerHandler(SyncOperationType.PROFILE_SYNC, this.handleProfileSync.bind(this));
  }

  /**
   * Handle full sync operation
   */
  private async handleFullSync(job: SyncJob): Promise<SyncJobResult> {
    const progressSteps: SyncStep[] = [
      { name: 'Initialize sync', status: 'pending', progress: 0 },
      { name: 'Sync subscriptions', status: 'pending', progress: 0 },
      { name: 'Sync billing records', status: 'pending', progress: 0 },
      { name: 'Sync user profile', status: 'pending', progress: 0 },
      { name: 'Process conflicts', status: 'pending', progress: 0 },
      { name: 'Finalize sync', status: 'pending', progress: 0 }
    ];

    const progress: SyncProgress = {
      total: 100,
      completed: 0,
      percentage: 0,
      currentStep: progressSteps[0].name,
      steps: progressSteps
    };

    // Update progress
    this.syncQueue.updateJobProgress(job.id, progress);

    try {
      const connection = await this.getConnection(job.connectionId);
      if (!connection) {
        throw new Error(`Connection ${job.connectionId} not found`);
      }

      const providerConfig = this.providerConfigs.get(job.providerId);
      if (!providerConfig) {
        throw new Error(`Provider config for ${job.providerId} not found`);
      }

      // Step 1: Initialize sync
      progress.steps[0].status = 'completed';
      progress.completed = 10;
      progress.percentage = 10;
      progress.currentStep = progressSteps[1].name;
      this.syncQueue.updateJobProgress(job.id, progress);

      // Step 2: Sync subscriptions
      const subscriptionResult = await this.syncSubscriptions(job, connection, providerConfig);
      progress.steps[1].status = 'completed';
      progress.completed = 40;
      progress.percentage = 40;
      progress.currentStep = progressSteps[2].name;
      this.syncQueue.updateJobProgress(job.id, progress);

      // Step 3: Sync billing records
      const billingResult = await this.syncBillingRecords(job, connection, providerConfig);
      progress.steps[2].status = 'completed';
      progress.completed = 70;
      progress.percentage = 70;
      progress.currentStep = progressSteps[3].name;
      this.syncQueue.updateJobProgress(job.id, progress);

      // Step 4: Sync user profile
      const profileResult = await this.syncUserProfile(job, connection, providerConfig);
      progress.steps[3].status = 'completed';
      progress.completed = 85;
      progress.percentage = 85;
      progress.currentStep = progressSteps[4].name;
      this.syncQueue.updateJobProgress(job.id, progress);

      // Step 5: Process conflicts
      const conflicts = await this.resolveConflicts(job, subscriptionResult, billingResult);
      progress.steps[4].status = 'completed';
      progress.completed = 95;
      progress.percentage = 95;
      progress.currentStep = progressSteps[5].name;
      this.syncQueue.updateJobProgress(job.id, progress);

      // Step 6: Finalize sync
      progress.steps[5].status = 'completed';
      progress.completed = 100;
      progress.percentage = 100;
      this.syncQueue.updateJobProgress(job.id, progress);

      const result: SyncJobResult = {
        jobId: job.id,
        success: true,
        status: SyncJobStatus.COMPLETED,
        recordsProcessed: subscriptionResult.recordsProcessed + billingResult.recordsProcessed,
        recordsCreated: subscriptionResult.recordsCreated + billingResult.recordsCreated,
        recordsUpdated: subscriptionResult.recordsUpdated + billingResult.recordsUpdated,
        recordsDeleted: subscriptionResult.recordsDeleted + billingResult.recordsDeleted,
        errors: [...subscriptionResult.errors, ...billingResult.errors],
        warnings: [...subscriptionResult.warnings, ...billingResult.warnings],
        duration: Date.now() - (job.startedAt?.getTime() || 0),
        data: {
          subscriptions: subscriptionResult.subscriptions,
          billingRecords: billingResult.billingRecords,
          profile: profileResult.profile
        },
        metadata: {
          conflictsResolved: conflicts.length,
          providerConfig: providerConfig.providerId
        },
        completedAt: new Date()
      };

      return result;

    } catch (error) {
      const syncError = this.createSyncError(error as Error, job);
      throw syncError;
    }
  }

  /**
   * Handle incremental sync operation
   */
  private async handleIncrementalSync(job: SyncJob): Promise<SyncJobResult> {
    const progressSteps: SyncStep[] = [
      { name: 'Check last sync', status: 'pending', progress: 0 },
      { name: 'Sync changed subscriptions', status: 'pending', progress: 0 },
      { name: 'Sync changed billing records', status: 'pending', progress: 0 },
      { name: 'Update sync timestamp', status: 'pending', progress: 0 }
    ];

    const progress: SyncProgress = {
      total: 100,
      completed: 0,
      percentage: 0,
      currentStep: progressSteps[0].name,
      steps: progressSteps
    };

    this.syncQueue.updateJobProgress(job.id, progress);

    try {
      const connection = await this.getConnection(job.connectionId);
      if (!connection) {
        throw new Error(`Connection ${job.connectionId} not found`);
      }

      const providerConfig = this.providerConfigs.get(job.providerId);
      if (!providerConfig?.incrementalSync.enabled) {
        throw new Error(`Incremental sync not enabled for provider ${job.providerId}`);
      }

      // Step 1: Check last sync
      const lastSync = await this.getLastSyncTimestamp(job.connectionId, job.providerId);
      progress.steps[0].status = 'completed';
      progress.completed = 25;
      progress.percentage = 25;
      progress.currentStep = progressSteps[1].name;
      this.syncQueue.updateJobProgress(job.id, progress);

      // Step 2: Sync changed subscriptions
      const subscriptionResult = await this.syncSubscriptionsIncremental(
        job, connection, providerConfig, lastSync
      );
      progress.steps[1].status = 'completed';
      progress.completed = 60;
      progress.percentage = 60;
      progress.currentStep = progressSteps[2].name;
      this.syncQueue.updateJobProgress(job.id, progress);

      // Step 3: Sync changed billing records
      const billingResult = await this.syncBillingRecordsIncremental(
        job, connection, providerConfig, lastSync
      );
      progress.steps[2].status = 'completed';
      progress.completed = 85;
      progress.percentage = 85;
      progress.currentStep = progressSteps[3].name;
      this.syncQueue.updateJobProgress(job.id, progress);

      // Step 4: Update sync timestamp
      await this.updateLastSyncTimestamp(job.connectionId, job.providerId);
      progress.steps[3].status = 'completed';
      progress.completed = 100;
      progress.percentage = 100;
      this.syncQueue.updateJobProgress(job.id, progress);

      const result: SyncJobResult = {
        jobId: job.id,
        success: true,
        status: SyncJobStatus.COMPLETED,
        recordsProcessed: subscriptionResult.recordsProcessed + billingResult.recordsProcessed,
        recordsCreated: subscriptionResult.recordsCreated + billingResult.recordsCreated,
        recordsUpdated: subscriptionResult.recordsUpdated + billingResult.recordsUpdated,
        recordsDeleted: subscriptionResult.recordsDeleted + billingResult.recordsDeleted,
        errors: [...subscriptionResult.errors, ...billingResult.errors],
        warnings: [...subscriptionResult.warnings, ...billingResult.warnings],
        duration: Date.now() - (job.startedAt?.getTime() || 0),
        data: {
          subscriptions: subscriptionResult.subscriptions,
          billingRecords: billingResult.billingRecords
        },
        metadata: {
          incrementalSync: true,
          lastSyncTimestamp: lastSync
        },
        completedAt: new Date()
      };

      return result;

    } catch (error) {
      const syncError = this.createSyncError(error as Error, job);
      throw syncError;
    }
  }

  /**
   * Handle subscription sync operation
   */
  private async handleSubscriptionSync(job: SyncJob): Promise<SyncJobResult> {
    const connection = await this.getConnection(job.connectionId);
    if (!connection) {
      throw new Error(`Connection ${job.connectionId} not found`);
    }

    const providerConfig = this.providerConfigs.get(job.providerId);
    if (!providerConfig) {
      throw new Error(`Provider config for ${job.providerId} not found`);
    }

    const result = await this.syncSubscriptions(job, connection, providerConfig);

    return {
      jobId: job.id,
      success: result.errors.length === 0,
      status: SyncJobStatus.COMPLETED,
      recordsProcessed: result.recordsProcessed,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      recordsDeleted: result.recordsDeleted,
      errors: result.errors,
      warnings: result.warnings,
      duration: Date.now() - (job.startedAt?.getTime() || 0),
      data: {
        subscriptions: result.subscriptions
      },
      completedAt: new Date()
    };
  }

  /**
   * Handle billing sync operation
   */
  private async handleBillingSync(job: SyncJob): Promise<SyncJobResult> {
    const connection = await this.getConnection(job.connectionId);
    if (!connection) {
      throw new Error(`Connection ${job.connectionId} not found`);
    }

    const providerConfig = this.providerConfigs.get(job.providerId);
    if (!providerConfig) {
      throw new Error(`Provider config for ${job.providerId} not found`);
    }

    const result = await this.syncBillingRecords(job, connection, providerConfig);

    return {
      jobId: job.id,
      success: result.errors.length === 0,
      status: SyncJobStatus.COMPLETED,
      recordsProcessed: result.recordsProcessed,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      recordsDeleted: result.recordsDeleted,
      errors: result.errors,
      warnings: result.warnings,
      duration: Date.now() - (job.startedAt?.getTime() || 0),
      data: {
        billingRecords: result.billingRecords
      },
      completedAt: new Date()
    };
  }

  /**
   * Handle profile sync operation
   */
  private async handleProfileSync(job: SyncJob): Promise<SyncJobResult> {
    const connection = await this.getConnection(job.connectionId);
    if (!connection) {
      throw new Error(`Connection ${job.connectionId} not found`);
    }

    const providerConfig = this.providerConfigs.get(job.providerId);
    if (!providerConfig) {
      throw new Error(`Provider config for ${job.providerId} not found`);
    }

    const result = await this.syncUserProfile(job, connection, providerConfig);

    return {
      jobId: job.id,
      success: result.errors.length === 0,
      status: SyncJobStatus.COMPLETED,
      recordsProcessed: result.recordsProcessed,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      recordsDeleted: result.recordsDeleted,
      errors: result.errors,
      warnings: result.warnings,
      duration: Date.now() - (job.startedAt?.getTime() || 0),
      data: {
        profile: result.profile
      },
      completedAt: new Date()
    };
  }

  /**
   * Sync subscriptions for a provider
   */
  private async syncSubscriptions(
    job: SyncJob,
    connection: OAuthConnection,
    providerConfig: ProviderSyncConfig
  ): Promise<{
    subscriptions: OAuthSubscription[];
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    errors: SyncError[];
    warnings: string[];
  }> {
    try {
      const provider = oauthService.getProvider(job.providerId);
      if (!provider) {
        throw new Error(`Provider ${job.providerId} not found`);
      }

      const tokens = await oauthService.getValidTokens(job.userId, job.providerId);
      if (!tokens) {
        throw new Error(`No valid tokens found for user ${job.userId} and provider ${job.providerId}`);
      }

      // Get subscriptions from provider (cast to OAuthSubscription for now)
      const subscriptions = await provider.getSubscriptions(tokens.accessToken) as OAuthSubscription[];

      // Process subscriptions (create/update/delete)
      const result = await this.processSubscriptions(subscriptions, job, providerConfig);

      return result;

    } catch (error) {
      throw this.createSyncError(error as Error, job, 'subscription_sync');
    }
  }

  /**
   * Sync billing records for a provider
   */
  private async syncBillingRecords(
    job: SyncJob,
    connection: OAuthConnection,
    providerConfig: ProviderSyncConfig
  ): Promise<{
    billingRecords: BillingRecord[];
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    errors: SyncError[];
    warnings: string[];
  }> {
    try {
      const provider = oauthService.getProvider(job.providerId);
      if (!provider) {
        throw new Error(`Provider ${job.providerId} not found`);
      }

      const tokens = await oauthService.getValidTokens(job.userId, job.providerId);
      if (!tokens) {
        throw new Error(`No valid tokens found for user ${job.userId} and provider ${job.providerId}`);
      }

      // Get billing history from provider
      const billingRecords = await provider.getBillingHistory(tokens.accessToken);

      // Process billing records (create/update/delete)
      const result = await this.processBillingRecords(billingRecords, job, providerConfig);

      return result;

    } catch (error) {
      throw this.createSyncError(error as Error, job, 'billing_sync');
    }
  }

  /**
   * Sync user profile for a provider
   */
  private async syncUserProfile(
    job: SyncJob,
    connection: OAuthConnection,
    providerConfig: ProviderSyncConfig
  ): Promise<{
    profile: any;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    errors: SyncError[];
    warnings: string[];
  }> {
    try {
      const provider = oauthService.getProvider(job.providerId);
      if (!provider) {
        throw new Error(`Provider ${job.providerId} not found`);
      }

      const tokens = await oauthService.getValidTokens(job.userId, job.providerId);
      if (!tokens) {
        throw new Error(`No valid tokens found for user ${job.userId} and provider ${job.providerId}`);
      }

      // Get user profile from provider
      const profile = await provider.getUserProfile(tokens.accessToken);

      // Process profile (update if exists)
      const result = await this.processUserProfile(profile, job, providerConfig);

      return result;

    } catch (error) {
      throw this.createSyncError(error as Error, job, 'profile_sync');
    }
  }

  /**
   * Process subscriptions with conflict resolution
   */
  private async processSubscriptions(
    subscriptions: OAuthSubscription[],
    job: SyncJob,
    providerConfig: ProviderSyncConfig
  ): Promise<{
    subscriptions: OAuthSubscription[];
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    errors: SyncError[];
    warnings: string[];
  }> {
    // This would integrate with your database layer
    // For now, return mock results
    return {
      subscriptions,
      recordsProcessed: subscriptions.length,
      recordsCreated: 0,
      recordsUpdated: subscriptions.length,
      recordsDeleted: 0,
      errors: [],
      warnings: []
    };
  }

  /**
   * Process billing records
   */
  private async processBillingRecords(
    billingRecords: BillingRecord[],
    job: SyncJob,
    providerConfig: ProviderSyncConfig
  ): Promise<{
    billingRecords: BillingRecord[];
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    errors: SyncError[];
    warnings: string[];
  }> {
    // This would integrate with your database layer
    // For now, return mock results
    return {
      billingRecords,
      recordsProcessed: billingRecords.length,
      recordsCreated: 0,
      recordsUpdated: billingRecords.length,
      recordsDeleted: 0,
      errors: [],
      warnings: []
    };
  }

  /**
   * Process user profile
   */
  private async processUserProfile(
    profile: any,
    job: SyncJob,
    providerConfig: ProviderSyncConfig
  ): Promise<{
    profile: any;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    errors: SyncError[];
    warnings: string[];
  }> {
    // This would integrate with your database layer
    // For now, return mock results
    return {
      profile,
      recordsProcessed: 1,
      recordsCreated: 0,
      recordsUpdated: 1,
      recordsDeleted: 0,
      errors: [],
      warnings: []
    };
  }

  /**
   * Incremental sync for subscriptions
   */
  private async syncSubscriptionsIncremental(
    job: SyncJob,
    connection: OAuthConnection,
    providerConfig: ProviderSyncConfig,
    lastSync: Date
  ): Promise<{
    subscriptions: OAuthSubscription[];
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    errors: SyncError[];
    warnings: string[];
  }> {
    // This would query for subscriptions changed since lastSync
    // For now, return mock results
    return {
      subscriptions: [],
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      warnings: ['Incremental sync not fully implemented yet']
    };
  }

  /**
   * Incremental sync for billing records
   */
  private async syncBillingRecordsIncremental(
    job: SyncJob,
    connection: OAuthConnection,
    providerConfig: ProviderSyncConfig,
    lastSync: Date
  ): Promise<{
    billingRecords: BillingRecord[];
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    errors: SyncError[];
    warnings: string[];
  }> {
    // This would query for billing records changed since lastSync
    // For now, return mock results
    return {
      billingRecords: [],
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      warnings: ['Incremental sync not fully implemented yet']
    };
  }

  /**
   * Resolve conflicts between local and provider data
   */
  private async resolveConflicts(
    job: SyncJob,
    subscriptionResult: any,
    billingResult: any
  ): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    // This would detect and resolve conflicts based on the provider's conflict resolution strategy
    // For now, return empty array

    return conflicts;
  }

  /**
   * Get connection by ID
   */
  private async getConnection(connectionId: string): Promise<OAuthConnection | null> {
    // This would integrate with your database layer
    // For now, return null
    return null;
  }

  /**
   * Get last sync timestamp
   */
  private async getLastSyncTimestamp(connectionId: string, providerId: string): Promise<Date> {
    // This would query your database for the last sync timestamp
    // For now, return a date from 24 hours ago
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  /**
   * Update last sync timestamp
   */
  private async updateLastSyncTimestamp(connectionId: string, providerId: string): Promise<void> {
    // This would update your database with the current timestamp
    // For now, do nothing
  }

  /**
   * Create sync error
   */
  private createSyncError(error: Error, job: SyncJob, operation?: string): SyncError {
    return {
      code: error.name || 'SYNC_ERROR',
      message: error.message,
      details: {
        stack: error.stack,
        jobId: job.id,
        operationType: job.operationType,
        operation
      },
      timestamp: new Date(),
      jobId: job.id,
      connectionId: job.connectionId,
      providerId: job.providerId,
      operationType: job.operationType,
      retryable: true,
      severity: 'medium'
    };
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(providerId: string): ProviderSyncConfig | undefined {
    return this.providerConfigs.get(providerId);
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(providerId: string, config: Partial<ProviderSyncConfig>): boolean {
    const existingConfig = this.providerConfigs.get(providerId);
    if (!existingConfig) {
      return false;
    }

    this.providerConfigs.set(providerId, { ...existingConfig, ...config });
    return true;
  }

  /**
   * Register conflict resolver
   */
  registerConflictResolver(providerId: string, resolver: (conflict: SyncConflict) => Promise<SyncConflict>): void {
    this.conflictResolvers.set(providerId, resolver);
  }

  /**
   * Get sync queue instance
   */
  getSyncQueue(): SyncQueue {
    return this.syncQueue;
  }
}