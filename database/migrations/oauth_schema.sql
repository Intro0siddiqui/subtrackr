-- OAuth Integration Database Schema
-- This file contains all tables, indexes, RLS policies, and functions for OAuth functionality

-- =============================================
-- TABLES
-- =============================================

-- OAuth Connections Table
CREATE TABLE IF NOT EXISTS oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'error')),
    access_token TEXT NOT NULL, -- Encrypted
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    token_type TEXT NOT NULL,
    scope TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Service Providers Configuration Table
CREATE TABLE IF NOT EXISTS service_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    logo_url TEXT,
    type TEXT NOT NULL CHECK (type IN ('oauth2', 'api_key', 'lwa')),
    auth_url TEXT NOT NULL,
    token_url TEXT NOT NULL,
    api_base_url TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    supported_flows TEXT[] NOT NULL DEFAULT '{}',
    features JSONB NOT NULL DEFAULT '{}',
    category TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Sync Logs Table
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES oauth_connections(id) ON DELETE CASCADE NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    records_processed INTEGER DEFAULT 0 NOT NULL,
    errors JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Webhook Events Table
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES oauth_connections(id) ON DELETE CASCADE NOT NULL,
    provider_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT,
    processed BOOLEAN DEFAULT false NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Provider Mappings Table
CREATE TABLE IF NOT EXISTS provider_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT NOT NULL,
    field_path TEXT NOT NULL,
    internal_field TEXT NOT NULL,
    transformation TEXT, -- JSON path, function name, etc.
    is_required BOOLEAN DEFAULT false NOT NULL,
    default_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Security Events Table (for audit logging)
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('oauth_initiated', 'token_refreshed', 'token_revoked', 'auth_failed', 'suspicious_activity')),
    provider_id TEXT,
    connection_id UUID REFERENCES oauth_connections(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- INDEXES
-- =============================================

-- OAuth Connections Indexes
CREATE INDEX IF NOT EXISTS idx_oauth_connections_user_id ON oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_provider_id ON oauth_connections(provider_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_status ON oauth_connections(status);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_user_provider ON oauth_connections(user_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_expires_at ON oauth_connections(expires_at) WHERE expires_at IS NOT NULL;

-- Service Providers Indexes
CREATE INDEX IF NOT EXISTS idx_service_providers_category ON service_providers(category);
CREATE INDEX IF NOT EXISTS idx_service_providers_active ON service_providers(is_active) WHERE is_active = true;

-- Sync Logs Indexes
CREATE INDEX IF NOT EXISTS idx_sync_logs_connection_id ON sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_connection_created ON sync_logs(connection_id, created_at DESC);

-- Webhook Events Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_connection_id ON webhook_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_id ON webhook_events(provider_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events(connection_id, created_at) WHERE processed = false;

-- Provider Mappings Indexes
CREATE INDEX IF NOT EXISTS idx_provider_mappings_provider_id ON provider_mappings(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_mappings_internal_field ON provider_mappings(internal_field);

-- Security Events Indexes
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- OAuth Connections Policies
CREATE POLICY "Users can view their own OAuth connections" ON oauth_connections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OAuth connections" ON oauth_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OAuth connections" ON oauth_connections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OAuth connections" ON oauth_connections
    FOR DELETE USING (auth.uid() = user_id);

-- Service Providers Policies (read-only for authenticated users)
CREATE POLICY "Authenticated users can view service providers" ON service_providers
    FOR SELECT USING (auth.role() = 'authenticated');

-- Sync Logs Policies
CREATE POLICY "Users can view sync logs for their connections" ON sync_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM oauth_connections
            WHERE oauth_connections.id = sync_logs.connection_id
            AND oauth_connections.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert sync logs" ON sync_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update sync logs" ON sync_logs
    FOR UPDATE USING (true);

-- Webhook Events Policies
CREATE POLICY "Users can view webhook events for their connections" ON webhook_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM oauth_connections
            WHERE oauth_connections.id = webhook_events.connection_id
            AND oauth_connections.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert webhook events" ON webhook_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update webhook events" ON webhook_events
    FOR UPDATE USING (true);

-- Provider Mappings Policies (read-only for authenticated users)
CREATE POLICY "Authenticated users can view provider mappings" ON provider_mappings
    FOR SELECT USING (auth.role() = 'authenticated');

-- Security Events Policies
CREATE POLICY "Users can view their own security events" ON security_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert security events" ON security_events
    FOR INSERT WITH CHECK (true);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE oauth_connections
    SET status = 'expired'
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW()
    AND status = 'active';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refresh OAuth tokens
CREATE OR REPLACE FUNCTION refresh_oauth_token(
    connection_id_param UUID,
    new_access_token TEXT,
    new_refresh_token TEXT DEFAULT NULL,
    new_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE oauth_connections
    SET
        access_token = new_access_token,
        refresh_token = COALESCE(new_refresh_token, refresh_token),
        expires_at = COALESCE(new_expires_at, expires_at),
        status = 'active',
        updated_at = NOW()
    WHERE id = connection_id_param
    AND user_id = auth.uid();

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sync status for a connection
CREATE OR REPLACE FUNCTION get_connection_sync_status(connection_id_param UUID)
RETURNS TABLE (
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,
    total_syncs INTEGER,
    successful_syncs INTEGER,
    failed_syncs INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        MAX(sl.created_at) as last_sync_at,
        (array_agg(sl.status ORDER BY sl.created_at DESC))[1] as last_sync_status,
        COUNT(*) as total_syncs,
        COUNT(*) FILTER (WHERE sl.status = 'success') as successful_syncs,
        COUNT(*) FILTER (WHERE sl.status = 'failed') as failed_syncs
    FROM sync_logs sl
    WHERE sl.connection_id = connection_id_param
    GROUP BY sl.connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    event_type_param TEXT,
    provider_id_param TEXT DEFAULT NULL,
    connection_id_param UUID DEFAULT NULL,
    metadata_param JSONB DEFAULT '{}',
    ip_address_param INET DEFAULT NULL,
    user_agent_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO security_events (
        user_id,
        event_type,
        provider_id,
        connection_id,
        metadata,
        ip_address,
        user_agent
    ) VALUES (
        auth.uid(),
        event_type_param,
        provider_id_param,
        connection_id_param,
        metadata_param,
        ip_address_param,
        user_agent_param
    ) RETURNING id INTO event_id;

    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to automatically update updated_at
CREATE TRIGGER update_oauth_connections_updated_at
    BEFORE UPDATE ON oauth_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_providers_updated_at
    BEFORE UPDATE ON service_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to log security events for OAuth operations
CREATE OR REPLACE FUNCTION log_oauth_security_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_security_event(
            'oauth_initiated',
            NEW.provider_id,
            NEW.id,
            jsonb_build_object('action', 'connection_created')
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            PERFORM log_security_event(
                'token_refreshed',
                NEW.provider_id,
                NEW.id,
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
            );
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_security_event(
            'token_revoked',
            OLD.provider_id,
            OLD.id,
            jsonb_build_object('action', 'connection_deleted')
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oauth_connections_security_logging
    AFTER INSERT OR UPDATE OR DELETE ON oauth_connections
    FOR EACH ROW EXECUTE FUNCTION log_oauth_security_event();

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default service providers
INSERT INTO service_providers (
    id, name, display_name, type, auth_url, token_url, api_base_url,
    scopes, supported_flows, features, category
) VALUES
(
    'netflix',
    'netflix',
    'Netflix',
    'oauth2',
    'https://api.netflix.com/oauth/authorize',
    'https://api.netflix.com/oauth/token',
    'https://api.netflix.com/v1/me',
    ARRAY['profile', 'subscription'],
    ARRAY['authorization_code'],
    '{"subscriptionSync": true, "webhookSupport": false, "realTimeUpdates": false}',
    'Entertainment'
),
(
    'spotify',
    'spotify',
    'Spotify',
    'oauth2',
    'https://accounts.spotify.com/authorize',
    'https://accounts.spotify.com/api/token',
    'https://api.spotify.com/v1',
    ARRAY['user-read-private', 'user-read-email', 'user-read-playback-state'],
    ARRAY['authorization_code'],
    '{"subscriptionSync": true, "webhookSupport": false, "realTimeUpdates": false}',
    'Music'
),
(
    'openai',
    'openai',
    'ChatGPT',
    'api_key',
    '',
    '',
    'https://api.openai.com/v1',
    ARRAY['read'],
    ARRAY['client_credentials'],
    '{"subscriptionSync": true, "webhookSupport": false, "realTimeUpdates": false}',
    'Productivity'
),
(
    'amazon',
    'amazon',
    'Amazon Prime',
    'lwa',
    'https://www.amazon.com/ap/oa',
    'https://api.amazon.com/auth/o2/token',
    'https://api.amazon.com/user/profile',
    ARRAY['profile', 'payments:widget'],
    ARRAY['authorization_code'],
    '{"subscriptionSync": true, "webhookSupport": true, "realTimeUpdates": true}',
    'Entertainment'
) ON CONFLICT (id) DO NOTHING;

-- Insert default provider mappings
INSERT INTO provider_mappings (provider_id, field_path, internal_field, transformation, is_required) VALUES
-- Netflix mappings
('netflix', 'subscription.status', 'status', 'direct', true),
('netflix', 'subscription.price', 'amount', 'direct', true),
('netflix', 'subscription.nextBillingDate', 'nextBillingDate', 'date', true),
('netflix', 'subscription.plan.name', 'name', 'direct', true),

-- Spotify mappings
('spotify', 'product', 'status', 'direct', true),
('spotify', 'plan.amount', 'amount', 'direct', false),
('spotify', 'current_period_end', 'nextBillingDate', 'date', false),
('spotify', 'plan.name', 'name', 'direct', true),
('spotify', 'id', 'externalId', 'direct', true),
('spotify', 'country', 'metadata.country', 'direct', false),
('spotify', 'display_name', 'metadata.displayName', 'direct', false),
('spotify', 'email', 'metadata.email', 'direct', false),
('spotify', 'followers.total', 'metadata.followers', 'direct', false),
('spotify', 'images[0].url', 'metadata.imageUrl', 'direct', false),

-- OpenAI mappings
('openai', 'subscription.status', 'status', 'direct', true),
('openai', 'subscription.plan.amount', 'amount', 'direct', true),
('openai', 'subscription.current_period_end', 'nextBillingDate', 'date', false),
('openai', 'subscription.plan.name', 'name', 'direct', true),

-- Amazon mappings
('amazon', 'subscription.status', 'status', 'direct', true),
('amazon', 'subscription.amount', 'amount', 'direct', true),
('amazon', 'subscription.nextRenewalDate', 'nextBillingDate', 'date', true),
('amazon', 'subscription.name', 'name', 'direct', true)

ON CONFLICT (provider_id, field_path) DO NOTHING;

-- =============================================
-- VIEWS
-- =============================================

-- View for active connections with provider info
CREATE OR REPLACE VIEW active_oauth_connections AS
SELECT
    oc.id,
    oc.user_id,
    oc.provider_id,
    oc.status,
    oc.expires_at,
    oc.scope,
    oc.metadata,
    oc.created_at,
    oc.updated_at,
    sp.name as provider_name,
    sp.display_name as provider_display_name,
    sp.logo_url as provider_logo_url,
    sp.category as provider_category
FROM oauth_connections oc
JOIN service_providers sp ON oc.provider_id = sp.id
WHERE oc.status = 'active'
AND sp.is_active = true;

-- View for sync statistics
CREATE OR REPLACE VIEW sync_statistics AS
SELECT
    connection_id,
    COUNT(*) as total_syncs,
    COUNT(*) FILTER (WHERE status = 'success') as successful_syncs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_syncs,
    MAX(created_at) as last_sync_at,
    AVG(records_processed) as avg_records_processed
FROM sync_logs
GROUP BY connection_id;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE oauth_connections IS 'Stores OAuth tokens and connection metadata for external service providers';
COMMENT ON TABLE service_providers IS 'Configuration for supported OAuth service providers';
COMMENT ON TABLE sync_logs IS 'Tracks synchronization operations and their results';
COMMENT ON TABLE webhook_events IS 'Stores incoming webhook payloads for processing';
COMMENT ON TABLE provider_mappings IS 'Field mappings between provider APIs and internal schema';
COMMENT ON TABLE security_events IS 'Audit log for security-related OAuth events';

COMMENT ON FUNCTION cleanup_expired_tokens() IS 'Updates expired OAuth connections to expired status';
COMMENT ON FUNCTION refresh_oauth_token(UUID, TEXT, TEXT, TIMESTAMPTZ) IS 'Refreshes OAuth tokens for a connection';
COMMENT ON FUNCTION get_connection_sync_status(UUID) IS 'Returns sync statistics for a connection';
COMMENT ON FUNCTION log_security_event(TEXT, TEXT, UUID, JSONB, INET, TEXT) IS 'Logs security events for audit purposes';