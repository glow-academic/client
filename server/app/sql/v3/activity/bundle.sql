-- Parameters: none
-- Returns header metrics and time series data for activity page
WITH daily_activity AS (
    SELECT 
        DATE(created_at) as date,
        COUNT(*) as activity_count,
        COUNT(*) FILTER (WHERE error = true) as error_count
    FROM activity
    WHERE created_at >= NOW() - INTERVAL '90 days'
    GROUP BY DATE(created_at)
),
daily_feedback AS (
    SELECT 
        DATE(created_at) as date,
        COUNT(*) as feedback_count
    FROM feedback
    WHERE created_at >= NOW() - INTERVAL '90 days'
    GROUP BY DATE(created_at)
),
daily_active_profiles AS (
    SELECT 
        DATE(last_active) as date,
        COUNT(DISTINCT profile_id) as active_profiles_count
    FROM profile_activity
    WHERE last_active >= NOW() - INTERVAL '90 days'
    GROUP BY DATE(last_active)
),
date_series AS (
    SELECT generate_series(
        DATE(NOW() - INTERVAL '90 days'),
        DATE(NOW()),
        '1 day'::interval
    )::date as date
),
combined_daily AS (
    SELECT 
        ds.date,
        COALESCE(da.activity_count, 0) as activity_count,
        COALESCE(da.error_count, 0) as error_count,
        COALESCE(df.feedback_count, 0) as feedback_count,
        COALESCE(dap.active_profiles_count, 0) as active_profiles_count
    FROM date_series ds
    LEFT JOIN daily_activity da ON ds.date = da.date
    LEFT JOIN daily_feedback df ON ds.date = df.date
    LEFT JOIN daily_active_profiles dap ON ds.date = dap.date
    ORDER BY ds.date
),
chart_data_json AS (
    SELECT COALESCE(
        json_agg(
            json_build_object(
                'date', to_char(date, 'YYYY-MM-DD'),
                'activeProfiles', active_profiles_count,
                'feedbackEntries', feedback_count,
                'activityEntries', activity_count,
                'errors', error_count
            ) ORDER BY date
        ),
        '[]'::json
    ) as chart_data
    FROM combined_daily
)
SELECT 
    -- Header metrics
    (SELECT COUNT(*) FROM activity) as total_activity_entries,
    (SELECT COUNT(*) FROM activity WHERE created_at >= NOW() - INTERVAL '24 hours') as recent_activity_24h,
    (SELECT COUNT(*) FROM feedback WHERE resolved = false) as unresolved_feedback_count,
    (SELECT COUNT(*) FROM feedback) as total_feedback_count,
    (SELECT COUNT(*) FROM activity WHERE created_at >= NOW() - INTERVAL '7 days') as recent_activity_7d,
    (SELECT COUNT(*) FROM activity WHERE created_at >= NOW() - INTERVAL '30 days') as recent_activity_30d,
    (SELECT COUNT(DISTINCT profile_id) FROM profile_activity) as active_profiles_count,
    (SELECT COUNT(*) FROM activity WHERE error = true) as total_errors_count,
    -- Time series data as JSON array
    (SELECT chart_data FROM chart_data_json) as chart_data;

