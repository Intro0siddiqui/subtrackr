# OAuth Database Schema

This directory contains the complete database schema and functions for OAuth integration with the subscription tracking application.

## Files Overview

- `oauth_schema.sql` - Main database schema with tables, indexes, RLS policies, and initial data
- `oauth_functions.sql` - Additional database functions for common operations
- `README.md` - This deployment guide

## Database Tables

### Core Tables

1. **oauth_connections** - Stores OAuth tokens and connection metadata
2. **service_providers** - Configuration for supported OAuth service providers
3. **sync_logs** - Tracks synchronization operations and results
4. **webhook_events** - Stores incoming webhook payloads for processing
5. **provider_mappings** - Field mappings between provider APIs and internal schema
6. **security_events** - Audit log for security-related OAuth events

### Views

- **active_oauth_connections** - Active connections with provider information
- **sync_statistics** - Sync statistics grouped by connection

## Deployment Instructions

### Prerequisites

- Supabase project with proper authentication configured
- Environment variables set up for Supabase connection
- Database user with appropriate permissions

### Step 1: Run Schema Migration

Execute the main schema file in your Supabase SQL editor or via CLI:

```bash
# Using Supabase CLI
supabase db reset --linked

# Or run the SQL file directly in Supabase Dashboard SQL Editor
```

### Step 2: Run Additional Functions

After the main schema is deployed, run the additional functions:

```sql
-- Run this in Supabase SQL Editor
\i database/migrations/oauth_functions.sql
```

### Step 3: Verify Installation

Check that all tables and functions were created successfully:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'oauth_%';

-- Check functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%oauth%';

-- Check providers
SELECT * FROM service_providers;
```

## Environment Variables

Ensure these environment variables are set in your application:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# OAuth Provider Configuration (add as needed)
VITE_NETFLIX_CLIENT_ID=your_netflix_client_id
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_AMAZON_CLIENT_ID=your_amazon_client_id
```

## Usage Examples

### Creating an OAuth Connection

```typescript
import { oauthDatabase } from '../services/oauthDatabase';

const connection = await oauthDatabase.createConnection({
  userId: user.id,
  providerId: 'spotify',
  status: 'active',
  accessToken: 'encrypted_token',
  refreshToken: 'encrypted_refresh_token',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour
  tokenType: 'Bearer',
  scope: 'user-read-private user-read-email'
});
```

### Getting User Connections

```typescript
const connections = await oauthDatabase.getUserConnections(userId);
const activeConnections = await oauthDatabase.getActiveUserConnections(userId);
```

### Token Refresh

```typescript
const success = await oauthDatabase.refreshToken(
  connectionId,
  newAccessToken,
  newRefreshToken,
  newExpiresAt
);
```

### Sync Operations

```typescript
const syncLog = await oauthDatabase.createSyncLog({
  connectionId: connection.id,
  syncType: 'manual',
  status: 'success',
  recordsProcessed: 15,
  startedAt: new Date(),
  completedAt: new Date()
});
```

## Security Features

### Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Users can only access their own OAuth connections
- Service providers are read-only for authenticated users
- Sync logs are scoped to user's connections
- Webhook events are scoped to user's connections

### Audit Logging

Security events are automatically logged for:
- OAuth connection creation/updates/deletion
- Token refresh operations
- Failed authentication attempts

### Token Encryption

Access tokens and refresh tokens should be encrypted before storage:
- Use the existing encryption service in the application
- Never store plain text tokens in the database

## Maintenance

### Regular Cleanup

Run these functions periodically to maintain database performance:

```sql
-- Clean up expired tokens
SELECT cleanup_expired_tokens();

-- Clean up old sync logs (older than 90 days)
SELECT cleanup_old_sync_logs(90);

-- Clean up old webhook events (older than 30 days)
SELECT cleanup_old_webhook_events(30);

-- Clean up old security events (older than 365 days)
SELECT cleanup_old_security_events(365);
```

### Health Monitoring

Monitor system health with:

```sql
-- Get health metrics
SELECT * FROM get_oauth_health_metrics();

-- Get provider usage statistics
SELECT * FROM get_provider_usage_stats();

-- Get daily sync summary
SELECT * FROM get_daily_sync_summary(7);
```

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**
   - Ensure user is authenticated
   - Check that user_id matches auth.uid()

2. **Token Refresh Failures**
   - Check refresh_token is not null
   - Verify expires_at is properly set
   - Use get_connections_needing_refresh() to find tokens to refresh

3. **Sync Failures**
   - Check sync_logs for error details
   - Use get_failed_syncs_for_retry() to find retryable failures
   - Verify connection status is 'active'

### Debug Queries

```sql
-- Check for problematic connections
SELECT * FROM oauth_connections
WHERE status = 'error'
OR (expires_at IS NOT NULL AND expires_at < NOW());

-- Check for unprocessed webhooks
SELECT COUNT(*) FROM webhook_events WHERE processed = false;

-- Check recent security events
SELECT * FROM security_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

## Extending the Schema

### Adding New Providers

1. Add provider configuration to service_providers table
2. Add field mappings to provider_mappings table
3. Update TypeScript types if needed
4. Add provider-specific logic to the application

### Adding New Tables

1. Create new migration file following the naming convention
2. Include RLS policies for security
3. Add appropriate indexes for performance
4. Update TypeScript types and database service

## Performance Considerations

### Indexes

The schema includes optimized indexes for:
- User-specific queries (user_id)
- Provider-specific queries (provider_id)
- Status-based filtering
- Timestamp-based ordering
- Composite indexes for common query patterns

### Query Optimization

- Use connection pooling for high concurrency
- Implement pagination for large result sets
- Consider partitioning for large sync_logs tables
- Use database views for complex queries

### Caching Strategy

- Cache provider configurations (rarely change)
- Cache active connections metadata
- Implement Redis caching for frequently accessed data
- Use database materialized views for complex aggregations