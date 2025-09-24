-- Additional OAuth Database Functions
-- These functions provide common operations for OAuth functionality

-- =============================================
-- TOKEN MANAGEMENT FUNCTIONS
-- =============================================

-- Function to get connections that need token refresh
CREATE OR REPLACE FUNCTION get_connections_needing_refresh()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    provider_id TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        oc.id,
        oc.user_id,
        oc.provider_id,
        oc.refresh_token,
        oc.expires_at
    FROM oauth_connections oc
    WHERE oc.status = 'active'
    AND oc.refresh_token IS NOT NULL
    AND oc.expires_at IS NOT NULL
    AND oc.expires_at <= NOW() + INTERVAL '1 hour'; -- Refresh 1 hour before expiry
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk update connection status
CREATE OR REPLACE FUNCTION bulk_update_connection_status(
    connection_ids UUID[],
    new_status TEXT
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE oauth_connections
    SET
        status = new_status,
        updated_at = NOW()
    WHERE id = ANY(connection_ids);

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SYNC MANAGEMENT FUNCTIONS
-- =============================================

-- Function to get sync statistics for a user
CREATE OR REPLACE FUNCTION get_user_sync_stats(user_id_param UUID)
RETURNS TABLE (
    provider_id TEXT,
    total_syncs BIGINT,
    successful_syncs BIGINT,
    failed_syncs BIGINT,
    last_sync_at TIMESTAMPTZ,
    avg_records_per_sync NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.id as provider_id,
        COUNT(sl.*) as total_syncs,
        COUNT(sl.*) FILTER (WHERE sl.status = 'success') as successful_syncs,
        COUNT(sl.*) FILTER (WHERE sl.status = 'failed') as failed_syncs,
        MAX(sl.created_at) as last_sync_at,
        AVG(sl.records_processed) as avg_records_per_sync
    FROM service_providers sp
    LEFT JOIN oauth_connections oc ON sp.id = oc.provider_id AND oc.user_id = user_id_param
    LEFT JOIN sync_logs sl ON oc.id = sl.connection_id
    WHERE sp.is_active = true
    GROUP BY sp.id
    ORDER BY sp.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get failed syncs that need retry
CREATE OR REPLACE FUNCTION get_failed_syncs_for_retry(max_age_hours INTEGER DEFAULT 24)
RETURNS TABLE (
    id UUID,
    connection_id UUID,
    sync_type TEXT,
    errors JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sl.id,
        sl.connection_id,
        sl.sync_type,
        sl.errors,
        sl.created_at
    FROM sync_logs sl
    JOIN oauth_connections oc ON sl.connection_id = oc.id
    WHERE sl.status = 'failed'
    AND sl.created_at >= NOW() - (max_age_hours || ' hours')::INTERVAL
    AND oc.status = 'active'
    ORDER BY sl.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- WEBHOOK MANAGEMENT FUNCTIONS
-- =============================================

-- Function to get webhook events by provider
CREATE OR REPLACE FUNCTION get_webhook_events_by_provider(
    provider_id_param TEXT,
    limit_param INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    connection_id UUID,
    event_type TEXT,
    payload JSONB,
    processed BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        we.id,
        we.connection_id,
        we.event_type,
        we.payload,
        we.processed,
        we.created_at
    FROM webhook_events we
    WHERE we.provider_id = provider_id_param
    ORDER BY we.created_at DESC
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk mark webhook events as processed
CREATE OR REPLACE FUNCTION bulk_mark_webhooks_processed(
    event_ids UUID[],
    processed_at_param TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE webhook_events
    SET
        processed = true,
        processed_at = processed_at_param
    WHERE id = ANY(event_ids);

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PROVIDER MANAGEMENT FUNCTIONS
-- =============================================

-- Function to get provider usage statistics
CREATE OR REPLACE FUNCTION get_provider_usage_stats()
RETURNS TABLE (
    provider_id TEXT,
    provider_name TEXT,
    total_connections BIGINT,
    active_connections BIGINT,
    total_syncs BIGINT,
    successful_syncs BIGINT,
    last_used TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.id as provider_id,
        sp.display_name as provider_name,
        COUNT(oc.*) as total_connections,
        COUNT(oc.*) FILTER (WHERE oc.status = 'active') as active_connections,
        COUNT(sl.*) as total_syncs,
        COUNT(sl.*) FILTER (WHERE sl.status = 'success') as successful_syncs,
        MAX(GREATEST(oc.updated_at, sl.created_at)) as last_used
    FROM service_providers sp
    LEFT JOIN oauth_connections oc ON sp.id = oc.provider_id
    LEFT JOIN sync_logs sl ON oc.id = sl.connection_id
    WHERE sp.is_active = true
    GROUP BY sp.id, sp.display_name
    ORDER BY total_connections DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to disable provider (soft delete)
CREATE OR REPLACE FUNCTION disable_provider(provider_id_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE service_providers
    SET
        is_active = false,
        updated_at = NOW()
    WHERE id = provider_id_param;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Also mark all connections for this provider as revoked
    UPDATE oauth_connections
    SET
        status = 'revoked',
        updated_at = NOW()
    WHERE provider_id = provider_id_param
    AND status = 'active';

    RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ANALYTICS AND REPORTING FUNCTIONS
-- =============================================

-- Function to get daily sync summary
CREATE OR REPLACE FUNCTION get_daily_sync_summary(
    days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
    sync_date DATE,
    total_syncs BIGINT,
    successful_syncs BIGINT,
    failed_syncs BIGINT,
    total_records BIGINT,
    avg_processing_time INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(sl.started_at) as sync_date,
        COUNT(*) as total_syncs,
        COUNT(*) FILTER (WHERE sl.status = 'success') as successful_syncs,
        COUNT(*) FILTER (WHERE sl.status = 'failed') as failed_syncs,
        SUM(sl.records_processed) as total_records,
        AVG(sl.completed_at - sl.started_at) as avg_processing_time
    FROM sync_logs sl
    WHERE sl.started_at >= NOW() - (days_back || ' days')::INTERVAL
    GROUP BY DATE(sl.started_at)
    ORDER BY sync_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user activity summary
CREATE OR REPLACE FUNCTION get_user_activity_summary(
    user_id_param UUID,
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    metric TEXT,
    value BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'total_connections'::TEXT, COUNT(*)::BIGINT
    FROM oauth_connections
    WHERE user_id = user_id_param
    UNION ALL
    SELECT 'active_connections'::TEXT, COUNT(*)::BIGINT
    FROM oauth_connections
    WHERE user_id = user_id_param AND status = 'active'
    UNION ALL
    SELECT 'total_syncs'::TEXT, COUNT(*)::BIGINT
    FROM sync_logs sl
    JOIN oauth_connections oc ON sl.connection_id = oc.id
    WHERE oc.user_id = user_id_param
    AND sl.created_at >= NOW() - (days_back || ' days')::INTERVAL
    UNION ALL
    SELECT 'successful_syncs'::TEXT, COUNT(*)::BIGINT
    FROM sync_logs sl
    JOIN oauth_connections oc ON sl.connection_id = oc.id
    WHERE oc.user_id = user_id_param
    AND sl.status = 'success'
    AND sl.created_at >= NOW() - (days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- MAINTENANCE FUNCTIONS
-- =============================================

-- Function to clean up old sync logs
CREATE OR REPLACE FUNCTION cleanup_old_sync_logs(
    days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sync_logs
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old webhook events
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(
    days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_events
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old security events
CREATE OR REPLACE FUNCTION cleanup_old_security_events(
    days_to_keep INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM security_events
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get database health metrics
CREATE OR REPLACE FUNCTION get_oauth_health_metrics()
RETURNS TABLE (
    metric TEXT,
    value TEXT,
    details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'total_connections'::TEXT, COUNT(*)::TEXT, jsonb_build_object('active', COUNT(*) FILTER (WHERE status = 'active'))
    FROM oauth_connections
    UNION ALL
    SELECT 'expired_tokens'::TEXT, COUNT(*)::TEXT, jsonb_build_object('expired', COUNT(*))
    FROM oauth_connections
    WHERE status = 'expired'
    UNION ALL
    SELECT 'unprocessed_webhooks'::TEXT, COUNT(*)::TEXT, jsonb_build_object('pending', COUNT(*))
    FROM webhook_events
    WHERE processed = false
    UNION ALL
    SELECT 'failed_syncs_24h'::TEXT, COUNT(*)::TEXT, jsonb_build_object('failed', COUNT(*))
    FROM sync_logs
    WHERE status = 'failed'
    AND created_at >= NOW() - INTERVAL '24 hours'
    UNION ALL
    SELECT 'providers_count'::TEXT, COUNT(*)::TEXT, jsonb_build_object('active', COUNT(*) FILTER (WHERE is_active = true))
    FROM service_providers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON FUNCTION get_connections_needing_refresh() IS 'Returns connections that need token refresh within the next hour';
COMMENT ON FUNCTION bulk_update_connection_status(UUID[], TEXT) IS 'Bulk update status for multiple connections';
COMMENT ON FUNCTION get_user_sync_stats(UUID) IS 'Returns sync statistics grouped by provider for a user';
COMMENT ON FUNCTION get_failed_syncs_for_retry(INTEGER) IS 'Returns failed syncs that are eligible for retry';
COMMENT ON FUNCTION get_webhook_events_by_provider(TEXT, INTEGER) IS 'Returns webhook events for a specific provider';
COMMENT ON FUNCTION bulk_mark_webhooks_processed(UUID[], TIMESTAMPTZ) IS 'Bulk mark webhook events as processed';
COMMENT ON FUNCTION get_provider_usage_stats() IS 'Returns usage statistics for all providers';
COMMENT ON FUNCTION disable_provider(TEXT) IS 'Soft delete a provider and revoke all its connections';
COMMENT ON FUNCTION get_daily_sync_summary(INTEGER) IS 'Returns daily sync statistics for the specified number of days';
COMMENT ON FUNCTION get_user_activity_summary(UUID, INTEGER) IS 'Returns activity summary for a specific user';
COMMENT ON FUNCTION cleanup_old_sync_logs(INTEGER) IS 'Clean up sync logs older than specified days';
COMMENT ON FUNCTION cleanup_old_webhook_events(INTEGER) IS 'Clean up webhook events older than specified days';
COMMENT ON FUNCTION cleanup_old_security_events(INTEGER) IS 'Clean up security events older than specified days';
COMMENT ON FUNCTION get_oauth_health_metrics() IS 'Returns health metrics for the OAuth system';