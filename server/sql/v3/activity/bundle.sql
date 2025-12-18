-- Parameters: none
-- Returns header metrics for activity page
SELECT 
    (SELECT COUNT(*) FROM activity) as total_activity_entries,
    (SELECT COUNT(*) FROM activity WHERE created_at >= NOW() - INTERVAL '24 hours') as recent_activity_24h,
    (SELECT COUNT(*) FROM feedback WHERE resolved = false) as unresolved_feedback_count,
    (SELECT COUNT(*) FROM feedback) as total_feedback_count,
    (SELECT COUNT(*) FROM activity WHERE created_at >= NOW() - INTERVAL '7 days') as recent_activity_7d,
    (SELECT COUNT(*) FROM activity WHERE created_at >= NOW() - INTERVAL '30 days') as recent_activity_30d;

