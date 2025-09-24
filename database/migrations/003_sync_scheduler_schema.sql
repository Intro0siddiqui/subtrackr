-- Sync Scheduler Database Schema
-- This file contains tables, indexes, RLS policies, and functions for the background sync scheduler

-- =============================================
-- TABLES
-- =============================================

-- Sync Schedules Table
CREATE TABLE IF NOT EXISTS sync_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES oauth_connections(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider_id TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly')),
    enabled BOOLEAN DEFAULT true NOT NULL,
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    config JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Sync Schedule Logs Table
CREATE TABLE IF NOT EXISTS sync_schedule_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES sync_schedules(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Sync Schedule Conflicts Table
CREATE TABLE IF NOT EXISTS sync_schedule_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES sync_schedules(id) ON DELETE CASCADE NOT NULL,
    conflict_type TEXT NOT NULL,
    details JSONB NOT NULL,
    resolved BOOLEAN DEFAULT false NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolution_details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- INDEXES
-- =============================================

-- Sync Schedules Indexes
CREATE INDEX IF NOT EXISTS idx_sync_schedules_connection_id ON sync_schedules(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_user_id ON sync_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_provider_id ON sync_schedules(provider_id);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_frequency ON sync_schedules(frequency);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_enabled ON sync_schedules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_sync_schedules_next_run_at ON sync_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_user_provider ON sync_schedules(user_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_due_schedules ON sync_schedules(next_run_at) WHERE enabled = true AND next_run_at <= NOW();

-- Sync Schedule Logs Indexes
CREATE INDEX IF NOT EXISTS idx_sync_schedule_logs_schedule_id ON sync_schedule_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sync_schedule_logs_status ON sync_schedule_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_schedule_logs_created_at ON sync_schedule_logs(created_at);

-- Sync Schedule Conflicts Indexes
CREATE INDEX IF NOT EXISTS idx_sync_schedule_conflicts_schedule_id ON sync_schedule_conflicts(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sync_schedule_conflicts_resolved ON sync_schedule_conflicts(resolved);
CREATE INDEX IF NOT EXISTS idx_sync_schedule_conflicts_created_at ON sync_schedule_conflicts(created_at);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE sync_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_schedule_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_schedule_conflicts ENABLE ROW LEVEL SECURITY;

-- Sync Schedules Policies
CREATE POLICY "Users can view their own sync schedules" ON sync_schedules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync schedules" ON sync_schedules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync schedules" ON sync_schedules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync schedules" ON sync_schedules
    FOR DELETE USING (auth.uid() = user_id);

-- Sync Schedule Logs Policies
CREATE POLICY "Users can view logs for their schedules" ON sync_schedule_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sync_schedules
            WHERE sync_schedules.id = sync_schedule_logs.schedule_id
            AND sync_schedules.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert schedule logs" ON sync_schedule_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update schedule logs" ON sync_schedule_logs
    FOR UPDATE USING (true);

-- Sync Schedule Conflicts Policies
CREATE POLICY "Users can view conflicts for their schedules" ON sync_schedule_conflicts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sync_schedules
            WHERE sync_schedules.id = sync_schedule_conflicts.schedule_id
            AND sync_schedules.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert schedule conflicts" ON sync_schedule_conflicts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update schedule conflicts" ON sync_schedule_conflicts
    FOR UPDATE USING (true);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_sync_schedules_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to get due schedules
CREATE OR REPLACE FUNCTION get_due_schedules()
RETURNS TABLE (
    id UUID,
    connection_id UUID,
    user_id UUID,
    provider_id TEXT,
    frequency TEXT,
    config JSONB,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.connection_id,
        s.user_id,
        s.provider_id,
        s.frequency,
        s.config,
        s.metadata
    FROM sync_schedules s
    WHERE s.enabled = true
    AND s.next_run_at <= NOW()
    ORDER BY s.next_run_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update next run time for a schedule
CREATE OR REPLACE FUNCTION update_schedule_next_run(schedule_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    schedule_frequency TEXT;
    new_next_run TIMESTAMPTZ;
BEGIN
    -- Get the schedule frequency
    SELECT frequency INTO schedule_frequency
    FROM sync_schedules
    WHERE id = schedule_id_param;
    
    -- Calculate next run time based on frequency
    CASE schedule_frequency
        WHEN 'hourly' THEN
            new_next_run := NOW() + INTERVAL '1 hour';
        WHEN 'daily' THEN
            new_next_run := NOW() + INTERVAL '1 day';
        WHEN 'weekly' THEN
            new_next_run := NOW() + INTERVAL '1 week';
        WHEN 'monthly' THEN
            new_next_run := NOW() + INTERVAL '1 month';
        ELSE
            new_next_run := NOW() + INTERVAL '1 day'; -- Default to daily
    END CASE;
    
    -- Update the schedule
    UPDATE sync_schedules
    SET 
        next_run_at = new_next_run,
        last_run_at = NOW(),
        updated_at = NOW()
    WHERE id = schedule_id_param;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get schedule statistics
CREATE OR REPLACE FUNCTION get_schedule_statistics(user_id_param UUID)
RETURNS TABLE (
    total_schedules INTEGER,
    enabled_schedules INTEGER,
    disabled_schedules INTEGER,
    due_schedules INTEGER,
    hourly_schedules INTEGER,
    daily_schedules INTEGER,
    weekly_schedules INTEGER,
    monthly_schedules INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_schedules,
        COUNT(*) FILTER (WHERE enabled = true)::INTEGER as enabled_schedules,
        COUNT(*) FILTER (WHERE enabled = false)::INTEGER as disabled_schedules,
        COUNT(*) FILTER (WHERE enabled = true AND next_run_at <= NOW())::INTEGER as due_schedules,
        COUNT(*) FILTER (WHERE frequency = 'hourly')::INTEGER as hourly_schedules,
        COUNT(*) FILTER (WHERE frequency = 'daily')::INTEGER as daily_schedules,
        COUNT(*) FILTER (WHERE frequency = 'weekly')::INTEGER as weekly_schedules,
        COUNT(*) FILTER (WHERE frequency = 'monthly')::INTEGER as monthly_schedules
    FROM sync_schedules
    WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to automatically update updated_at
CREATE TRIGGER update_sync_schedules_updated_at
    BEFORE UPDATE ON sync_schedules
    FOR EACH ROW EXECUTE FUNCTION update_sync_schedules_updated_at_column();

-- =============================================
-- VIEWS
-- =============================================

-- View for active schedules with connection info
CREATE OR REPLACE VIEW active_schedules AS
SELECT
    s.id,
    s.connection_id,
    s.user_id,
    s.provider_id,
    s.frequency,
    s.enabled,
    s.next_run_at,
    s.last_run_at,
    s.config,
    s.metadata,
    s.created_at,
    s.updated_at,
    oc.status as connection_status,
    sp.display_name as provider_name
FROM sync_schedules s
JOIN oauth_connections oc ON s.connection_id = oc.id
JOIN service_providers sp ON s.provider_id = sp.id
WHERE s.enabled = true
AND oc.status = 'active'
AND sp.is_active = true;

-- View for schedule execution summary
CREATE OR REPLACE VIEW schedule_execution_summary AS
SELECT
    s.id as schedule_id,
    s.provider_id,
    s.frequency,
    COUNT(sl.id) as total_executions,
    COUNT(*) FILTER (WHERE sl.status = 'completed') as successful_executions,
    COUNT(*) FILTER (WHERE sl.status = 'failed') as failed_executions,
    MAX(sl.started_at) as last_execution_at,
    AVG(EXTRACT(EPOCH FROM (sl.completed_at - sl.started_at))) as avg_execution_time_seconds
FROM sync_schedules s
LEFT JOIN sync_schedule_logs sl ON s.id = sl.schedule_id
GROUP BY s.id, s.provider_id, s.frequency;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE sync_schedules IS 'Stores sync schedule configurations for automated synchronization';
COMMENT ON TABLE sync_schedule_logs IS 'Tracks execution logs for sync schedules';
COMMENT ON TABLE sync_schedule_conflicts IS 'Records conflicts detected in sync scheduling';

COMMENT ON FUNCTION get_due_schedules() IS 'Returns all schedules that are due for execution';
COMMENT ON FUNCTION update_schedule_next_run(UUID) IS 'Updates the next run time for a schedule based on its frequency';
COMMENT ON FUNCTION get_schedule_statistics(UUID) IS 'Returns statistics for user schedules';