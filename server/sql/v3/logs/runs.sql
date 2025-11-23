-- Logs runs query - paginated, filtered, sorted logs table data
-- Parameters: 
--   $1 = start_date (timestamp | NULL)
--   $2 = end_date (timestamp | NULL)
--   $3 = level (text[] | NULL) - filter by log levels
--   $4 = logger_names (text[] | NULL) - filter by logger names (array)
--   $5 = search (text | NULL) - text search across message, logger_name
--   $6 = actor_names (text[] | NULL) - filter by actor names (array)
-- Placeholders:
--   {ORDER_BY_CLAUSE} - ORDER BY clause (e.g., "ORDER BY created_at DESC NULLS LAST")
--   {LIMIT_OFFSET_CLAUSE} - LIMIT/OFFSET clause (e.g., "LIMIT 10 OFFSET 0")
--   {JSON_AGG_ORDER_BY} - ORDER BY for json_agg (e.g., "ORDER BY created_at DESC NULLS LAST")
-- Returns: JSONB object with data (paginated logs), totalCount, filter options

WITH
-- All logs (or recent logs) for filter option counts
-- Use date filters if provided, otherwise use last 30 days to keep counts manageable
all_logs_for_counts AS (
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
        -- Use date filters if provided, otherwise default to last 30 days
        (
            ($1::timestamptz IS NOT NULL AND $2::timestamptz IS NOT NULL)
            OR al.ts >= (CURRENT_TIMESTAMP - INTERVAL '30 days')
        )
        AND ($1::timestamptz IS NULL OR al.ts >= $1)
        AND ($2::timestamptz IS NULL OR al.ts <= $2)
),
-- Base filtered logs (for pagination and data)
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
        -- Logger name filter (array)
        AND ($4::text[] IS NULL OR cardinality($4::text[]) = 0 OR al.logger_name = ANY($4::text[]))
        -- Search filter (searches in message and logger_name)
        AND ($5::text IS NULL OR $5::text = '' OR 
             al.message ILIKE '%' || $5::text || '%' OR 
             al.logger_name ILIKE '%' || $5::text || '%')
        -- Actor name filter (array)
        AND ($6::text[] IS NULL OR cardinality($6::text[]) = 0 OR 
             COALESCE(p.first_name || ' ' || p.last_name, 'System') = ANY($6::text[]))
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
    {ORDER_BY_CLAUSE}
    {LIMIT_OFFSET_CLAUSE}
),

-- Level options (for filters) - calculated from all_logs_for_counts to show overall distribution
level_options_cte AS (
    SELECT 
        level as value,
        INITCAP(level) as label,
        COUNT(*)::int as count
    FROM all_logs_for_counts
    GROUP BY level
    ORDER BY count DESC
),

-- Logger options (top 20 most common loggers) - calculated from all_logs_for_counts
logger_options_cte AS (
    SELECT 
        logger_name as value,
        logger_name as label,
        COUNT(*)::int as count
    FROM all_logs_for_counts
    WHERE logger_name IS NOT NULL AND logger_name != ''
    GROUP BY logger_name
    ORDER BY count DESC
    LIMIT 20
),

-- Actor options (top 20 most common actors) - calculated from all_logs_for_counts
actor_options_cte AS (
    SELECT 
        actor_name as value,
        actor_name as label,
        COUNT(*)::int as count
    FROM all_logs_for_counts
    WHERE actor_name IS NOT NULL AND actor_name != ''
    GROUP BY actor_name
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
            ) {JSON_AGG_ORDER_BY}
        ) FROM paginated_logs pl),
        '[]'::jsonb
    ),
    'totalCount', COALESCE((SELECT total_count FROM total_count_cte), 0),
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
    ), '[]'::jsonb),
    'actorOptions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'value', aoc.value,
            'label', aoc.label,
            'count', aoc.count
        ))
        FROM actor_options_cte aoc
    ), '[]'::jsonb)
) as result;

