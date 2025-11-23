-- Logs runs query - paginated, filtered, sorted logs table data
-- Parameters: 
--   $1 = start_date (timestamp | NULL)
--   $2 = end_date (timestamp | NULL)
--   $3 = level (text[] | NULL) - filter by log levels
--   $4 = logger_name (text | NULL) - search in logger_name
--   $5 = search (text | NULL) - text search across message, logger_name
--   $6 = page (int) - page number (0-indexed)
--   $7 = page_size (int) - page size
-- Returns: JSONB object with data (paginated logs), totalCount, page, pageSize, totalPages, filter options

WITH
-- Base filtered logs
filtered_logs AS (
    SELECT 
        al.id,
        al.ts as created_at,
        al.level,
        al.logger_name,
        al.message,
        al.extra,
        COALESCE(
            p.first_name || ' ' || p.last_name,
            'System'
        ) as actor_name,
        alp.profile_id::text as profile_id
    FROM app_logs al
    LEFT JOIN app_logs_profiles alp ON alp.app_log_id = al.id
    LEFT JOIN profiles p ON p.id = alp.profile_id
    WHERE 
        -- Date filters (optional)
        ($1::timestamptz IS NULL OR al.ts >= $1)
        AND ($2::timestamptz IS NULL OR al.ts <= $2)
        -- Level filter
        AND ($3::text[] IS NULL OR cardinality($3::text[]) = 0 OR al.level = ANY($3::text[]))
        -- Logger name filter (exact match or LIKE)
        AND ($4::text IS NULL OR $4::text = '' OR al.logger_name ILIKE '%' || $4::text || '%')
        -- Search filter (searches in message and logger_name)
        AND ($5::text IS NULL OR $5::text = '' OR 
             al.message ILIKE '%' || $5::text || '%' OR 
             al.logger_name ILIKE '%' || $5::text || '%')
),

-- Get total count
total_count_cte AS (
    SELECT COUNT(*)::int as total_count
    FROM filtered_logs
),

-- Paginated logs
paginated_logs AS (
    SELECT 
        fl.*,
        (SELECT total_count FROM total_count_cte) as total_count
    FROM filtered_logs fl
    ORDER BY fl.created_at DESC
    LIMIT $7::int OFFSET (($6::int * $7::int))
),

-- Level options (for filters)
level_options_cte AS (
    SELECT 
        level as value,
        INITCAP(level) as label,
        COUNT(*)::int as count
    FROM filtered_logs
    GROUP BY level
),

-- Logger options (top 20 most common loggers)
logger_options_cte AS (
    SELECT 
        logger_name as value,
        logger_name as label,
        COUNT(*)::int as count
    FROM filtered_logs
    WHERE logger_name IS NOT NULL AND logger_name != ''
    GROUP BY logger_name
    ORDER BY count DESC
    LIMIT 20
)

-- Build final JSONB response
SELECT jsonb_build_object(
    'data', COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'id', pl.id::text,
                'created_at', pl.created_at,
                'logger_name', pl.logger_name,
                'level', pl.level,
                'actor_name', pl.actor_name,
                'profile_id', pl.profile_id,
                'message', pl.message,
                'extra', pl.extra
            ) ORDER BY pl.created_at DESC
        ) FROM paginated_logs pl),
        '[]'::jsonb
    ),
    'totalCount', COALESCE((SELECT total_count FROM total_count_cte), 0),
    'page', $6,
    'pageSize', $7,
    'totalPages', CASE 
        WHEN $7 > 0 THEN CEIL(COALESCE((SELECT total_count FROM total_count_cte), 0)::float / $7::float)::int
        ELSE 0
    END,
    'levelOptions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'value', loc.value,
            'label', loc.label,
            'count', loc.count
        ))
        FROM level_options_cte loc
    ), '[]'::jsonb),
    'loggerOptions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'value', loc.value,
            'label', loc.label,
            'count', loc.count
        ))
        FROM logger_options_cte loc
    ), '[]'::jsonb)
) as result;

