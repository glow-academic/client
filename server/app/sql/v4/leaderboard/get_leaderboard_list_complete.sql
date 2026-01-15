-- Get leaderboard list with pagination
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_leaderboard_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_leaderboard_list_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_leaderboard_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_leaderboard_list_v4_row AS (
    profile_id uuid,
    first_name text,
    last_name text,
    simulation_ids uuid[],
    scenario_ids uuid[],
    total_attempts int,
    highest_score int,
    avg_messages int,
    persona_response_time int,
    total_time int,
    improvement_rate int,
    perfect_count int,
    quickest_pass int,
    rank int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_leaderboard_list_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    roles text[] DEFAULT ARRAY[]::text[],
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_filters text[] DEFAULT ARRAY['general']::text[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    sort_by text DEFAULT 'highest_score',
    sort_order text DEFAULT 'desc',
    page_size int DEFAULT 20,
    "offset" int DEFAULT 0
)
RETURNS TABLE (
    actor_name text,
    data types.q_get_leaderboard_list_v4_row[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        start_date::timestamptz AS start_date,
        end_date::timestamptz AS end_date,
        profile_id AS profile_id,
        COALESCE(NULLIF(roles, ARRAY[]::text[]), ARRAY[]::text[]) AS roles,
        COALESCE(NULLIF(cohort_ids, ARRAY[]::uuid[]), ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(NULLIF(simulation_filters, ARRAY[]::text[]), ARRAY['general']::text[]) AS simulation_filters,
        COALESCE(NULLIF(department_ids, ARRAY[]::uuid[]), ARRAY[]::uuid[]) AS department_ids,
        COALESCE(sort_by, 'highest_score') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page_size, 20) AS page_size,
        COALESCE("offset", 0) AS offset_val
),
user_profile AS (
    SELECT 
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names_resource n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
),
filt AS (
    SELECT * FROM analytics a 
    WHERE a.attempt_created_at >= (SELECT start_date FROM params)
      AND a.attempt_created_at < (SELECT end_date FROM params)
      AND (
          cardinality((SELECT simulation_filters FROM params)::text[]) = 0
          OR (
              ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND a.is_general = TRUE) OR
              ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND a.is_practice = TRUE) OR
              ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) AND (
                  (('general' = ANY((SELECT simulation_filters FROM params)::text[]) OR 'practice' = ANY((SELECT simulation_filters FROM params)::text[])) 
                   AND (a.is_archived = TRUE OR (a.is_general = FALSE AND a.is_practice = FALSE)))
                  OR
                  (NOT ('general' = ANY((SELECT simulation_filters FROM params)::text[]) OR 'practice' = ANY((SELECT simulation_filters FROM params)::text[]))
                   AND a.is_archived = TRUE)
              ))
          )
      )
      AND (cardinality((SELECT roles FROM params)::text[]) = 0 OR a.profile_role::text = ANY((SELECT roles FROM params)::text[]))
      AND (cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR a.simulation_id IN (
          SELECT DISTINCT s.id
          FROM simulation_artifact s
          WHERE EXISTS (
            SELECT 1 FROM simulation_flags sf
            JOIN flags_resource f ON sf.flag_id = f.id
            WHERE sf.simulation_id = s.id
              AND (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) = 'active'
              AND sf.type = 'active'::type_simulation_flags
              AND sf.value = TRUE
          )
            AND (
                EXISTS (
                    SELECT 1 
                    FROM cohort_simulations cs 
                    WHERE cs.simulation_id = s.id 
                      AND cs.cohort_id = ANY((SELECT cohort_ids FROM params)::uuid[])
                      AND cs.active = TRUE
                )
                OR
                (EXISTS (SELECT 1 FROM simulation_flags sf WHERE sf.simulation_id = s.id AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE)
                 AND NOT EXISTS (
                     SELECT 1 
                     FROM cohort_simulations cs2 
                     WHERE cs2.simulation_id = s.id 
                       AND cs2.active = TRUE
                 ))
            )
      ))
      AND (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR a.department_id = ANY((SELECT department_ids FROM params)::uuid[]))
),
profile_stats AS (
    SELECT
        f.profile_id,
        (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = f.profile_id AND pn.type = 'first'::type_profile_names LIMIT 1) AS first_name,
        (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = f.profile_id AND pn.type = 'last'::type_profile_names LIMIT 1) AS last_name,
        COUNT(DISTINCT f.attempt_id)::int AS total_attempts,
        ROUND(MAX(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL))::int AS highest_score,
        ROUND(AVG(f.num_messages_total) FILTER (WHERE f.num_messages_total IS NOT NULL))::int AS avg_messages,
        COALESCE(SUM(LEAST(f.time_taken_seconds / 60.0, 30.0)) FILTER (WHERE f.time_taken_seconds IS NOT NULL), 0.0)::float AS total_time,
        ARRAY_AGG(DISTINCT f.simulation_id) FILTER (WHERE f.simulation_id IS NOT NULL) AS simulation_ids,
        ARRAY_AGG(DISTINCT f.scenario_id) FILTER (WHERE f.scenario_id IS NOT NULL) AS scenario_ids
    FROM filt f
    GROUP BY f.profile_id
),
persona_times AS (
    SELECT
        f.profile_id,
        UNNEST(f.message_time_taken_seconds) AS delta_sec
    FROM filt f
    WHERE cardinality(f.message_time_taken_seconds) > 0
),
persona_per_profile AS (
    SELECT
        profile_id,
        ROUND(AVG(delta_sec))::int AS avg_response_time
    FROM persona_times
    GROUP BY profile_id
),
attempt_grades AS (
    SELECT
        simulation_id,
        attempt_id,
        profile_id,
        MIN(chat_created_at) as first_time,
        MAX(grade_percent) as best_grade
    FROM filt
    WHERE grade_percent IS NOT NULL AND attempt_id IS NOT NULL
    GROUP BY simulation_id, attempt_id, profile_id
),
sim_improvement_rates AS (
    SELECT
        profile_id,
        simulation_id,
        CASE
            WHEN COUNT(*) >= 2 THEN
                ROUND(
                    (MAX(best_grade) - MIN(best_grade)) /
                    GREATEST(1.0,
                        EXTRACT(EPOCH FROM (MAX(first_time) - MIN(first_time))) / 86400.0
                    )
                )::int
            ELSE 0
        END AS improvement_rate
    FROM attempt_grades
    GROUP BY profile_id, simulation_id
),
improvement_per_profile AS (
    SELECT
        profile_id,
        MAX(improvement_rate) AS max_improvement_rate
    FROM sim_improvement_rates
    GROUP BY profile_id
),
perfect_per_profile AS (
    SELECT
        profile_id,
        COUNT(*) AS perfect_count
    FROM filt
    WHERE grade_percent >= 100.0
    GROUP BY profile_id
),
quickest_per_profile AS (
    SELECT
        profile_id,
        ROUND(MIN(time_taken_seconds / 60.0))::int AS quickest_minutes
    FROM filt
    WHERE passed = TRUE AND time_taken_seconds IS NOT NULL
    GROUP BY profile_id
),
all_stats AS (
    SELECT
        ps.*,
        COALESCE(pp.avg_response_time, 0) AS persona_response_time,
        COALESCE(ip.max_improvement_rate, 0) AS improvement_rate,
        COALESCE(pf.perfect_count, 0) AS perfect_count,
        COALESCE(qp.quickest_minutes, 0) AS quickest_pass
    FROM profile_stats ps
    LEFT JOIN persona_per_profile pp ON ps.profile_id = pp.profile_id
    LEFT JOIN improvement_per_profile ip ON ps.profile_id = ip.profile_id
    LEFT JOIN perfect_per_profile pf ON ps.profile_id = pf.profile_id
    LEFT JOIN quickest_per_profile qp ON ps.profile_id = qp.profile_id
),
ranked_stats AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (
            ORDER BY 
                CASE WHEN (SELECT sort_by FROM params) = 'highest_score' AND (SELECT sort_order FROM params) = 'desc' THEN highest_score END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'highest_score' AND (SELECT sort_order FROM params) = 'asc' THEN highest_score END ASC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'total_attempts' AND (SELECT sort_order FROM params) = 'desc' THEN total_attempts END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'total_attempts' AND (SELECT sort_order FROM params) = 'asc' THEN total_attempts END ASC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'avg_messages' AND (SELECT sort_order FROM params) = 'desc' THEN avg_messages END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'avg_messages' AND (SELECT sort_order FROM params) = 'asc' THEN avg_messages END ASC NULLS LAST,
                highest_score DESC NULLS LAST
        ) as rank,
        COUNT(*) OVER () as total_count
    FROM all_stats
),
paginated_stats AS (
    SELECT *
    FROM ranked_stats
    ORDER BY rank
    LIMIT (SELECT page_size FROM params)
    OFFSET (SELECT offset_val FROM params)
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (ps.profile_id,
             ps.first_name,
             ps.last_name,
             COALESCE(ps.simulation_ids, ARRAY[]::uuid[]),
             COALESCE(ps.scenario_ids, ARRAY[]::uuid[]),
             ps.total_attempts,
             COALESCE(ps.highest_score, 0),
             COALESCE(ps.avg_messages, 0),
             ps.persona_response_time,
             ROUND(COALESCE(ps.total_time, 0))::int,
             ps.improvement_rate,
             ps.perfect_count,
             ps.quickest_pass,
             ps.rank)::types.q_get_leaderboard_list_v4_row
            ORDER BY ps.rank
        ),
        '{}'::types.q_get_leaderboard_list_v4_row[]
    ) as data,
    (SELECT total_count FROM ranked_stats LIMIT 1)::bigint as total_count
FROM paginated_stats ps
CROSS JOIN user_profile up
GROUP BY up.actor_name, (SELECT total_count FROM ranked_stats LIMIT 1)
$$;
