import { supabase } from './supabase';
import {
  OAuthConnection,
  OAuthProvider,
  SyncLog,
  WebhookEvent,
  ProviderMapping,
  SyncResult,
  SyncStatusInfo,
  DatabaseOAuthConnection,
  DatabaseServiceProvider,
  DatabaseSyncLog,
  DatabaseWebhookEvent,
  DatabaseProviderMapping,
  OAuthConnectionStatus,
  SyncType,
  SyncStatus
} from '../types/oauth';

export class OAuthDatabaseService {
  // =============================================
  // OAUTH CONNECTIONS
  // =============================================

  /**
   * Create a new OAuth connection
   */
  async createConnection(connection: Omit<OAuthConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<OAuthConnection> {
    const { data, error } = await supabase
      .from('oauth_connections')
      .insert({
        user_id: connection.userId,
        provider_id: connection.providerId,
        status: connection.status,
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
        expires_at: connection.expiresAt?.toISOString(),
        token_type: connection.tokenType,
        scope: connection.scope,
        metadata: connection.metadata
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapDatabaseConnectionToOAuthConnection(data);
  }

  /**
   * Get OAuth connection by ID
   */
  async getConnectionById(id: string): Promise<OAuthConnection | null> {
    const { data, error } = await supabase
      .from('oauth_connections')
      .select(`
        *,
        service_providers!inner(name, display_name, logo_url, category)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapDatabaseConnectionToOAuthConnection(data);
  }

  /**
   * Get all connections for a user
   */
  async getUserConnections(userId: string): Promise<OAuthConnection[]> {
    const { data, error } = await supabase
      .from('oauth_connections')
      .select(`
        *,
        service_providers!inner(name, display_name, logo_url, category)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(this.mapDatabaseConnectionToOAuthConnection);
  }

  /**
   * Get active connections for a user
   */
  async getActiveUserConnections(userId: string): Promise<OAuthConnection[]> {
    const { data, error } = await supabase
      .from('active_oauth_connections')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    return data.map(this.mapDatabaseConnectionToOAuthConnection);
  }

  /**
   * Update OAuth connection
   */
  async updateConnection(id: string, updates: Partial<OAuthConnection>): Promise<OAuthConnection> {
    const { data, error } = await supabase
      .from('oauth_connections')
      .update({
        status: updates.status,
        access_token: updates.accessToken,
        refresh_token: updates.refreshToken,
        expires_at: updates.expiresAt?.toISOString(),
        token_type: updates.tokenType,
        scope: updates.scope,
        metadata: updates.metadata
      })
      .eq('id', id)
      .eq('user_id', updates.userId) // Ensure user owns the connection
      .select()
      .single();

    if (error) throw error;

    return this.mapDatabaseConnectionToOAuthConnection(data);
  }

  /**
   * Delete OAuth connection
   */
  async deleteConnection(id: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('oauth_connections')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(
    connectionId: string,
    newAccessToken: string,
    newRefreshToken?: string,
    newExpiresAt?: Date
  ): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('refresh_oauth_token', {
        connection_id_param: connectionId,
        new_access_token: newAccessToken,
        new_refresh_token: newRefreshToken || null,
        new_expires_at: newExpiresAt?.toISOString() || null
      });

    if (error) throw error;
    return data;
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const { data, error } = await supabase
      .rpc('cleanup_expired_tokens');

    if (error) throw error;
    return data;
  }

  // =============================================
  // SERVICE PROVIDERS
  // =============================================

  /**
   * Get all service providers
   */
  async getAllProviders(): Promise<OAuthProvider[]> {
    const { data, error } = await supabase
      .from('service_providers')
      .select('*')
      .eq('is_active', true)
      .order('display_name');

    if (error) throw error;

    return data.map(this.mapDatabaseProviderToOAuthProvider);
  }

  /**
   * Get provider by ID
   */
  async getProviderById(id: string): Promise<OAuthProvider | null> {
    const { data, error } = await supabase
      .from('service_providers')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapDatabaseProviderToOAuthProvider(data);
  }

  /**
   * Get providers by category
   */
  async getProvidersByCategory(category: string): Promise<OAuthProvider[]> {
    const { data, error } = await supabase
      .from('service_providers')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('display_name');

    if (error) throw error;

    return data.map(this.mapDatabaseProviderToOAuthProvider);
  }

  // =============================================
  // SYNC LOGS
  // =============================================

  /**
   * Create sync log entry
   */
  async createSyncLog(syncLog: Omit<SyncLog, 'id' | 'createdAt'>): Promise<SyncLog> {
    const { data, error } = await supabase
      .from('sync_logs')
      .insert({
        connection_id: syncLog.connectionId,
        sync_type: syncLog.syncType,
        status: syncLog.status,
        records_processed: syncLog.recordsProcessed,
        errors: syncLog.errors,
        metadata: syncLog.metadata,
        started_at: syncLog.startedAt.toISOString(),
        completed_at: syncLog.completedAt?.toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapDatabaseSyncLogToSyncLog(data);
  }

  /**
   * Get sync logs for connection
   */
  async getSyncLogsForConnection(connectionId: string, limit = 50): Promise<SyncLog[]> {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapDatabaseSyncLogToSyncLog);
  }

  /**
   * Get sync status for connection
   */
  async getConnectionSyncStatus(connectionId: string): Promise<SyncStatusInfo | null> {
    const { data, error } = await supabase
      .rpc('get_connection_sync_status', {
        connection_id_param: connectionId
      });

    if (error) throw error;

    if (!data || data.length === 0) return null;

    const status = data[0];
    return {
      connectionId,
      status: 'idle', // This would need to be determined by checking running syncs
      lastSyncAt: status.last_sync_at ? new Date(status.last_sync_at) : undefined,
      nextSyncAt: undefined, // This would need to be calculated based on schedule
      frequency: 'daily' as any // This would need to be stored in connection metadata
    };
  }

  /**
   * Update sync log
   */
  async updateSyncLog(id: string, updates: Partial<SyncLog>): Promise<SyncLog> {
    const { data, error } = await supabase
      .from('sync_logs')
      .update({
        status: updates.status,
        records_processed: updates.recordsProcessed,
        errors: updates.errors,
        metadata: updates.metadata,
        completed_at: updates.completedAt?.toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapDatabaseSyncLogToSyncLog(data);
  }

  // =============================================
  // WEBHOOK EVENTS
  // =============================================

  /**
   * Create webhook event
   */
  async createWebhookEvent(event: Omit<WebhookEvent, 'id' | 'createdAt' | 'processedAt'>): Promise<WebhookEvent> {
    const { data, error } = await supabase
      .from('webhook_events')
      .insert({
        connection_id: event.connectionId,
        provider_id: event.providerId,
        event_type: event.eventType,
        payload: event.payload,
        signature: event.signature
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapDatabaseWebhookEventToWebhookEvent(data);
  }

  /**
   * Get unprocessed webhook events
   */
  async getUnprocessedWebhookEvents(limit = 100): Promise<WebhookEvent[]> {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return data.map(this.mapDatabaseWebhookEventToWebhookEvent);
  }

  /**
   * Mark webhook event as processed
   */
  async markWebhookEventProcessed(id: string, processedAt?: Date): Promise<WebhookEvent> {
    const { data, error } = await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: (processedAt || new Date()).toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapDatabaseWebhookEventToWebhookEvent(data);
  }

  // =============================================
  // PROVIDER MAPPINGS
  // =============================================

  /**
   * Get provider mappings
   */
  async getProviderMappings(providerId: string): Promise<ProviderMapping[]> {
    const { data, error } = await supabase
      .from('provider_mappings')
      .select('*')
      .eq('provider_id', providerId)
      .order('field_path');

    if (error) throw error;

    return data.map(this.mapDatabaseProviderMappingToProviderMapping);
  }

  /**
   * Get all provider mappings
   */
  async getAllProviderMappings(): Promise<ProviderMapping[]> {
    const { data, error } = await supabase
      .from('provider_mappings')
      .select('*')
      .order('provider_id, field_path');

    if (error) throw error;

    return data.map(this.mapDatabaseProviderMappingToProviderMapping);
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Check if user has active connection to provider
   */
  async hasActiveConnection(userId: string, providerId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('oauth_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('provider_id', providerId)
      .eq('status', 'active')
      .limit(1);

    if (error) throw error;
    return data.length > 0;
  }

  /**
   * Get connection by user and provider
   */
  async getConnectionByUserAndProvider(userId: string, providerId: string): Promise<OAuthConnection | null> {
    const { data, error } = await supabase
      .from('oauth_connections')
      .select(`
        *,
        service_providers!inner(name, display_name, logo_url, category)
      `)
      .eq('user_id', userId)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapDatabaseConnectionToOAuthConnection(data);
  }

  // =============================================
  // MAPPING METHODS
  // =============================================

  private mapDatabaseConnectionToOAuthConnection(data: any): OAuthConnection {
    return {
      id: data.id,
      userId: data.user_id,
      providerId: data.provider_id,
      status: data.status as OAuthConnectionStatus,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      tokenType: data.token_type,
      scope: data.scope,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapDatabaseProviderToOAuthProvider(data: DatabaseServiceProvider): OAuthProvider {
    return {
      id: data.id,
      name: data.name,
      displayName: data.display_name,
      logoUrl: data.logo_url || '',
      type: data.type as any,
      supportedFlows: data.supported_flows as any,
      authUrl: data.auth_url,
      tokenUrl: data.token_url,
      apiBaseUrl: data.api_base_url,
      scopes: data.scopes,
      features: data.features as { subscriptionSync: boolean; webhookSupport: boolean; realTimeUpdates: boolean; },
      category: data.category,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapDatabaseSyncLogToSyncLog(data: DatabaseSyncLog): SyncLog {
    return {
      id: data.id,
      connectionId: data.connection_id,
      syncType: data.sync_type as SyncType,
      status: data.status as SyncStatus,
      recordsProcessed: data.records_processed,
      errors: data.errors,
      metadata: data.metadata,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      createdAt: new Date(data.created_at)
    };
  }

  private mapDatabaseWebhookEventToWebhookEvent(data: DatabaseWebhookEvent): WebhookEvent {
    return {
      id: data.id,
      connectionId: data.connection_id,
      providerId: data.provider_id,
      eventType: data.event_type,
      payload: data.payload,
      signature: data.signature,
      processed: data.processed,
      processedAt: data.processed_at ? new Date(data.processed_at) : undefined,
      createdAt: new Date(data.created_at)
    };
  }

  private mapDatabaseProviderMappingToProviderMapping(data: DatabaseProviderMapping): ProviderMapping {
    return {
      id: data.id,
      providerId: data.provider_id,
      fieldPath: data.field_path,
      internalField: data.internal_field,
      transformation: data.transformation,
      isRequired: data.is_required,
      defaultValue: data.default_value,
      createdAt: new Date(data.created_at)
    };
  }
}

// Export singleton instance
export const oauthDatabase = new OAuthDatabaseService();