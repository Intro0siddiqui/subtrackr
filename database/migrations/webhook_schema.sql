-- Webhook Events Database Schema
-- This file contains tables, indexes, RLS policies, and functions for webhook functionality

-- =============================================
-- TABLES
-- =============================================

-- Webhook Events Table (extends existing webhook_events table)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES oauth_connections(id) ON DELETE CASCADE NOT NULL,
    provider_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT,
    processed BOOLEAN DEFAULT false NOT NULL,
    processed_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0 NOT NULL,
    max_attempts INTEGER DEFAULT 3 NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Webhook Event Reports Table
CREATE TABLE IF NOT EXISTS webhook_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES webhook_events(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('received', 'processed', 'failed', 'retry')),
    message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Webhook Provider Configurations Table
CREATE TABLE IF NOT EXISTS webhook_provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT NOT NULL UNIQUE,
    webhook_url TEXT NOT NULL,
    secret TEXT NOT NULL, -- Encrypted
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- INDEXES
-- =============================================

-- Webhook Events Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_connection_id ON webhook_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_id ON webhook_events(provider_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events(connection_id, created_at) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_webhook_events_attempts ON webhook_events(attempts) WHERE processed = false;

-- Webhook Reports Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_reports_event_id ON webhook_reports(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_reports_status ON webhook_reports(status);
CREATE INDEX IF NOT EXISTS idx_webhook_reports_created_at ON webhook_reports(created_at);

-- Webhook Provider Configurations Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_provider_configs_provider_id ON webhook_provider_configs(provider_id);
CREATE INDEX IF NOT EXISTS idx_webhook_provider_configs_active ON webhook_provider_configs(is_active) WHERE is_active = true;

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_provider_configs ENABLE ROW LEVEL SECURITY;

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

-- Webhook Reports Policies
CREATE POLICY "Users can view webhook reports for their connections" ON webhook_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM webhook_events
            WHERE webhook_events.id = webhook_reports.event_id
            AND EXISTS (
                SELECT 1 FROM oauth_connections
                WHERE oauth_connections.id = webhook_events.connection_id
                AND oauth_connections.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "System can insert webhook reports" ON webhook_reports
    FOR INSERT WITH CHECK (true);

-- Webhook Provider Configurations Policies (admin only)
CREATE POLICY "Admin can manage webhook provider configs" ON webhook_provider_configs
    FOR ALL USING (auth.uid() IN (SELECT id FROM auth.users WHERE email = 'admin@subtrackr.com'));

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to get webhook statistics
CREATE OR REPLACE FUNCTION get_webhook_statistics(user_id_param UUID)
RETURNS TABLE (
    total_events INTEGER,
    processed_events INTEGER,
    failed_events INTEGER,
    success_rate NUMERIC,
    average_processing_time NUMERIC,
    provider_stats JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_events,
        COUNT(*) FILTER (WHERE we.processed = true)::INTEGER as processed_events,
        COUNT(*) FILTER (WHERE we.error IS NOT NULL)::INTEGER as failed_events,
        ROUND(
            (COUNT(*) FILTER (WHERE we.processed = true)::NUMERIC / 
             GREATEST(COUNT(*), 1)) * 100, 
            2
        ) as success_rate,
        ROUND(
            AVG(EXTRACT(EPOCH FROM (we.processed_at - we.created_at)))::NUMERIC, 
            2
        ) as average_processing_time,
        jsonb_build_object() as provider_stats
    FROM webhook_events we
    JOIN oauth_connections oc ON we.connection_id = oc.id
    WHERE oc.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent webhook events
CREATE OR REPLACE FUNCTION get_recent_webhook_events(user_id_param UUID, limit_param INTEGER DEFAULT 50)
RETURNS TABLE (
    id UUID,
    provider_id TEXT,
    event_type TEXT,
    processed BOOLEAN,
    error TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        we.id,
        we.provider_id,
        we.event_type,
        we.processed,
        we.error,
        we.created_at
    FROM webhook_events we
    JOIN oauth_connections oc ON we.connection_id = oc.id
    WHERE oc.user_id = user_id_param
    ORDER BY we.created_at DESC
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to automatically update updated_at
CREATE TRIGGER update_webhook_provider_configs_updated_at
    BEFORE UPDATE ON webhook_provider_configs
    FOR EACH ROW EXECUTE FUNCTION update_webhook_updated_at_column();

-- =============================================
-- VIEWS
-- =============================================

-- View for webhook event summary
CREATE OR REPLACE VIEW webhook_event_summary AS
SELECT
    we.id,
    we.connection_id,
    we.provider_id,
    we.event_type,
    we.processed,
    we.error,
    we.attempts,
    we.created_at,
    oc.user_id,
    sp.display_name as provider_name
FROM webhook_events we
JOIN oauth_connections oc ON we.connection_id = oc.id
JOIN service_providers sp ON we.provider_id = sp.id;

-- View for webhook processing statistics
CREATE OR REPLACE VIEW webhook_processing_stats AS
SELECT
    provider_id,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE processed = true) as processed_events,
    COUNT(*) FILTER (WHERE error IS NOT NULL) as failed_events,
    ROUND(
        (COUNT(*) FILTER (WHERE processed = true)::NUMERIC / 
         GREATEST(COUNT(*), 1)) * 100, 
        2
    ) as success_rate,
    ROUND(
        AVG(EXTRACT(EPOCH FROM (processed_at - created_at)))::NUMERIC, 
        2
    ) as average_processing_time_seconds
FROM webhook_events
GROUP BY provider_id;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE webhook_events IS 'Stores incoming webhook payloads for processing';
COMMENT ON TABLE webhook_reports IS 'Tracks webhook processing results and events';
COMMENT ON TABLE webhook_provider_configs IS 'Configuration for webhook provider integrations';

COMMENT ON FUNCTION get_webhook_statistics(UUID) IS 'Returns webhook processing statistics for a user';
COMMENT ON FUNCTION get_recent_webhook_events(UUID, INTEGER) IS 'Returns recent webhook events for a user';