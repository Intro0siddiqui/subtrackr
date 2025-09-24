// OAuth Provider Types
export enum OAuthProviderType {
  OAUTH2 = 'oauth2',
  API_KEY = 'api_key',
  LWA = 'lwa' // Login with Amazon
}

export enum OAuthFlowType {
  AUTHORIZATION_CODE = 'authorization_code',
  CLIENT_CREDENTIALS = 'client_credentials',
  IMPLICIT = 'implicit',
  PASSWORD = 'password'
}

export enum OAuthConnectionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  ERROR = 'error'
}

// Core OAuth Provider Interface
export interface OAuthProvider {
  id: string;
  name: string;
  displayName: string;
  logoUrl: string;
  type: OAuthProviderType;
  supportedFlows: OAuthFlowType[];
  authUrl: string;
  tokenUrl: string;
  apiBaseUrl: string;
  scopes: string[];
  features: {
    subscriptionSync: boolean;
    webhookSupport: boolean;
    realTimeUpdates: boolean;
  };
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// OAuth Connection Interface
export interface OAuthConnection {
  id: string;
  userId: string;
  providerId: string;
  status: OAuthConnectionStatus;
  accessToken: string; // Encrypted
  refreshToken?: string; // Encrypted
  expiresAt?: Date;
  tokenType: string;
  scope: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Token Management
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType: string;
  scope: string;
}

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

// Sync Engine Types
export enum SyncType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  WEBHOOK = 'webhook'
}

export enum SyncStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed'
}

export interface SyncLog {
  id: string;
  connectionId: string;
  syncType: SyncType;
  status: SyncStatus;
  recordsProcessed: number;
  errors?: Record<string, any>;
  metadata?: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

// Webhook Types
export interface WebhookEvent {
  id: string;
  connectionId: string;
  providerId: string;
  eventType: string;
  payload: Record<string, any>;
  signature?: string;
  processed: boolean;
  processedAt?: Date;
  createdAt: Date;
}

// Data Mapping Types
export interface ProviderMapping {
  id: string;
  providerId: string;
  fieldPath: string;
  internalField: string;
  transformation?: string; // JSON path, function name, etc.
  isRequired: boolean;
  defaultValue?: string;
  createdAt: Date;
}

export interface MappingConfig {
  providerId: string;
  mappings: ProviderMapping[];
}

// API Client Types
export interface SubscriptionData {
  id: string;
  name: string;
  status: string;
  amount?: number;
  currency?: string;
  billingCycle?: string;
  nextBillingDate?: Date;
  startDate?: Date;
  endDate?: Date;
  metadata?: Record<string, any>;
}

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  metadata?: Record<string, any>;
}

export interface BillingRecord {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  date: Date;
  description?: string;
  metadata?: Record<string, any>;
}

// Sync Engine Types
export enum SyncFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  errors: string[];
  metadata?: Record<string, any>;
}

export interface SyncStatusInfo {
  connectionId: string;
  status: 'idle' | 'running' | 'paused' | 'error';
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  frequency: SyncFrequency;
}

// Security and Audit Types
export interface SecurityEvent {
  id: string;
  userId: string;
  eventType: 'oauth_initiated' | 'token_refreshed' | 'token_revoked' | 'auth_failed' | 'suspicious_activity';
  providerId?: string;
  connectionId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Webhook Processing Types
export interface WebhookResult {
  success: boolean;
  processedEvents: number;
  errors: string[];
  metadata?: Record<string, any>;
}

// Database Row Types (for Supabase)
export interface DatabaseOAuthConnection {
  id: string;
  user_id: string;
  provider_id: string;
  status: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  token_type: string;
  scope: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DatabaseServiceProvider {
  id: string;
  name: string;
  display_name: string;
  logo_url?: string;
  type: string;
  auth_url: string;
  token_url: string;
  api_base_url: string;
  scopes: string[];
  supported_flows: string[];
  features: Record<string, any>;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSyncLog {
  id: string;
  connection_id: string;
  sync_type: string;
  status: string;
  records_processed: number;
  errors?: Record<string, any>;
  metadata?: Record<string, any>;
  started_at: string;
  completed_at?: string;
  created_at: string;
}

export interface DatabaseWebhookEvent {
  id: string;
  connection_id: string;
  provider_id: string;
  event_type: string;
  payload: Record<string, any>;
  signature?: string;
  processed: boolean;
  processed_at?: string;
  created_at: string;
}

export interface DatabaseProviderMapping {
  id: string;
  provider_id: string;
  field_path: string;
  internal_field: string;
  transformation?: string;
  is_required: boolean;
  default_value?: string;
  created_at: string;
}

// Extended Subscription Interface for OAuth Integration
export interface OAuthSubscription {
  id: string;
  user_id?: string;
  name: string;
  amount: number;
  currency: string;
  category: string; // Using string instead of SubscriptionCategory to avoid import
  status: string; // Using string instead of SubscriptionStatus to avoid import
  billingCycle: string; // Using string instead of BillingCycle to avoid import
  paymentMethod: string; // Using string instead of PaymentMethod to avoid import
  startDate: Date;
  endDate?: Date;
  nextBillingDate: Date;
  logoUrl: string;
  description?: string;
  providerId?: string;
  autoRenew: boolean;
  trialEndDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  // OAuth-specific fields
  oauthConnectionId?: string;
  externalId?: string;
  providerData?: Record<string, any>;
  lastSyncedAt?: Date;
  syncStatus?: 'synced' | 'pending' | 'error';
}

// Provider-specific configuration types
export interface NetflixConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
}

export interface AmazonConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

// Error Types
export interface OAuthError {
  code: string;
  message: string;
  provider?: string;
  connectionId?: string;
  details?: Record<string, any>;
}

export interface SyncError extends OAuthError {
  syncType: SyncType;
  recordsAffected?: number;
}

// Utility Types
export type OAuthProviderConfig = NetflixConfig | SpotifyConfig | OpenAIConfig | AmazonConfig;

export type SupportedProvider = 'netflix' | 'spotify' | 'openai' | 'amazon';