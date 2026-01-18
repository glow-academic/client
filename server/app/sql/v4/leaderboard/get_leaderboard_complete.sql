-- Get leaderboard bundle with all metrics and profile data
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_leaderboard_bundle_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_leaderboard_bundle_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- Drop in reverse dependency order: metrics (depends on metric) first, then metric, then others
DO $$
DECLARE
    r RECORD;
    type_names text[] := ARRAY[
        'q_get_leaderboard_bundle_v4_row',  -- Depends on metrics
        'q_get_leaderboard_bundle_v4_metrics',  -- Depends on metric
        'q_get_leaderboard_bundle_v4_metric',
        'q_get_leaderboard_bundle_v4_simulation',
        'q_get_leaderboard_bundle_v4_scenario'
    ];
    type_name text;
BEGIN
    FOREACH type_name IN ARRAY type_names
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', type_name);
    END LOOP;
    -- Also drop any other types matching the pattern (for future additions)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_leaderboard_bundle_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
          AND typname != ALL(type_names)
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_leaderboard_bundle_v4_metric AS (
    has_data boolean,
    method text,
    current_value int,
    key_field text,
    trend_data text[],
    data_points text[],
    hover text
);

CREATE TYPE types.q_get_leaderboard_bundle_v4_metrics AS (
    total_attempts types.q_get_leaderboard_bundle_v4_metric,
    highest_score_avg types.q_get_leaderboard_bundle_v4_metric,
    messages_per_session types.q_get_leaderboard_bundle_v4_metric,
    persona_response_seconds types.q_get_leaderboard_bundle_v4_metric,
    time_spent_minutes types.q_get_leaderboard_bundle_v4_metric,
    improvement_rate_per_day types.q_get_leaderboard_bundle_v4_metric,
    perfect_score_count types.q_get_leaderboard_bundle_v4_metric,
    quickest_pass_minutes types.q_get_leaderboard_bundle_v4_metric
);

CREATE TYPE types.q_get_leaderboard_bundle_v4_row AS (
    profile_id uuid,
    first_name text,
    last_name text,
    simulation_ids uuid[],
    scenario_ids uuid[],
    metrics types.q_get_leaderboard_bundle_v4_metrics
);

CREATE TYPE types.q_get_leaderboard_bundle_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit int,
    department_ids text[]
);

CREATE TYPE types.q_get_leaderboard_bundle_v4_scenario AS (
    scenario_id uuid,
    name text,
    description text
);

-- 4) Recreate function
-- Accept dates as text (ISO format strings) and cast to timestamptz internally
-- This allows Python to pass ISO strings from model_dump(mode="json"), and SQL handles conversion
CREATE OR REPLACE FUNCTION api_get_leaderboard_bundle_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    roles text[] DEFAULT ARRAY[]::text[],
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_filters text[] DEFAULT ARRAY['general']::text[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    actor_name text,
    data types.q_get_leaderboard_bundle_v4_row[],
    simulations types.q_get_leaderboard_bundle_v4_simulation[],
    scenarios types.q_get_leaderboard_bundle_v4_scenario[],
    primary_color text,
    accent_color text
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
        COALESCE(NULLIF(department_ids, ARRAY[]::uuid[]), ARRAY[]::uuid[]) AS department_ids
),
-- Get colors from active settings (defaults if no settings found)
settings_colors AS (
    SELECT 
        COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'primary'::type_setting_colors LIMIT 1), '#171717') AS primary_color,
        COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'accent'::type_setting_colors LIMIT 1), '#f5f5f5') AS accent
    FROM setting_artifact s
    WHERE EXISTS (
        SELECT 1 FROM setting_flags sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.setting_id = s.id
          AND (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) = 'active'
          AND f.name = 'active'
          AND sf.value = TRUE
    )
    LIMIT 1
),
-- Get actor name FROM profile_artifact
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
          -- Default to general if no filters specified
          cardinality((SELECT simulation_filters FROM params)::text[]) = 0
          OR (
              -- General filter
              ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND a.is_general = TRUE) OR
              -- Practice filter
              ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND a.is_practice = TRUE) OR
              -- Archived filter: if general/practice also selected, include archived OR non-general/non-practice
              -- Otherwise, just archived
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
              AND f.name = 'active'
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
                (EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE)
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
        MAX(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS highest_score,
        AVG(f.num_messages_total) FILTER (WHERE f.num_messages_total IS NOT NULL) AS avg_messages,
        COALESCE(SUM(LEAST(f.time_taken_seconds / 60.0, 30.0)) FILTER (WHERE f.time_taken_seconds IS NOT NULL), 0.0)::float AS total_time,
        ARRAY_AGG(DISTINCT f.simulation_id) FILTER (WHERE f.simulation_id IS NOT NULL) AS simulation_ids,
        ARRAY_AGG(DISTINCT f.scenario_id) FILTER (WHERE f.scenario_id IS NOT NULL) AS scenario_ids
    FROM filt f
    GROUP BY f.profile_id
),
-- Persona response times per profile
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
-- Improvement rate per day per profile
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
-- Perfect score count per profile
perfect_per_profile AS (
    SELECT
        profile_id,
        COUNT(*) AS perfect_count
    FROM filt
    WHERE grade_percent >= 100.0
    GROUP BY profile_id
),
-- Quickest pass per profile
quickest_per_profile AS (
    SELECT
        profile_id,
        MIN(time_taken_seconds / 60.0) AS quickest_minutes
    FROM filt
    WHERE passed = TRUE AND time_taken_seconds IS NOT NULL
    GROUP BY profile_id
),
-- Join all metrics together
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
-- Get all unique simulation IDs for mapping
all_simulation_ids AS (
    SELECT DISTINCT unnest(simulation_ids) AS simulation_id
    FROM profile_stats
    WHERE simulation_ids IS NOT NULL
),
simulation_data AS (
    SELECT 
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name,
        COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM simulation_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1), '') as description,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'active' AND ssf.value = true)),
            0
        )::int as time_limit,
        COALESCE(
            (SELECT ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at)
             FROM simulation_departments sd
             WHERE sd.simulation_id = s.id AND sd.active = true),
            ARRAY[]::text[]
        ) as department_ids
    FROM all_simulation_ids asi
    LEFT JOIN simulation_artifact s ON s.id = asi.simulation_id
    WHERE EXISTS (
        SELECT 1 FROM simulation_flags sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) = 'active'
          AND f.name = 'active'
          AND sf.value = TRUE
    )
),
-- Get all unique scenario IDs for mapping
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) AS scenario_id
    FROM profile_stats
    WHERE scenario_ids IS NOT NULL
),
scenario_data AS (
    SELECT 
        sc.id as scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = sc.id LIMIT 1) as name,
        COALESCE(
            (SELECT ps.problem_statement 
             FROM scenario_problem_statements sps 
             JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id 
             WHERE sps.scenario_id = sc.id AND sps.active = true 
             ORDER BY sps.created_at DESC, sps.updated_at DESC 
             LIMIT 1),
            ''
        ) as description
    FROM all_scenario_ids asci
    LEFT JOIN scenarios_resource sc ON sc.id = asci.scenario_id
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = sc.id AND f.name = 'active' AND sf.value = true)
),
-- Get top 25% of profiles by highest score
ranked_stats AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (ORDER BY highest_score DESC) as rank,
        COUNT(*) OVER () as total_count
    FROM all_stats
),
top_25_percent AS (
    SELECT *
    FROM ranked_stats
    WHERE rank <= GREATEST(1, CEIL(total_count * 0.25)::int)
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (t25p.profile_id,
             t25p.first_name,
             t25p.last_name,
             COALESCE(t25p.simulation_ids, ARRAY[]::uuid[]),
             COALESCE(t25p.scenario_ids, ARRAY[]::uuid[]),
             ((true, 'countDistinct', t25p.total_attempts, NULL::text, ARRAY[]::text[], ARRAY[]::text[], ''::text)::types.q_get_leaderboard_bundle_v4_metric,
              (t25p.highest_score IS NOT NULL, 'max', ROUND(COALESCE(t25p.highest_score, 0))::int, NULL::text, ARRAY[]::text[], ARRAY[]::text[], ''::text)::types.q_get_leaderboard_bundle_v4_metric,
              (t25p.avg_messages IS NOT NULL, 'avg', ROUND(COALESCE(t25p.avg_messages, 0))::int, NULL::text, ARRAY[]::text[], ARRAY[]::text[], ''::text)::types.q_get_leaderboard_bundle_v4_metric,
              (t25p.persona_response_time > 0, 'avg', t25p.persona_response_time, NULL::text, ARRAY[]::text[], ARRAY[]::text[], ''::text)::types.q_get_leaderboard_bundle_v4_metric,
              (t25p.total_time IS NOT NULL AND t25p.total_time > 0, 'sum', ROUND(COALESCE(t25p.total_time, 0))::int, NULL::text, ARRAY[]::text[], ARRAY[]::text[], ''::text)::types.q_get_leaderboard_bundle_v4_metric,
              (t25p.improvement_rate > 0, 'slope', t25p.improvement_rate, NULL::text, ARRAY[]::text[], ARRAY[]::text[], ''::text)::types.q_get_leaderboard_bundle_v4_metric,
              (t25p.perfect_count > 0, 'sum', t25p.perfect_count, NULL::text, ARRAY[]::text[], ARRAY[]::text[], ''::text)::types.q_get_leaderboard_bundle_v4_metric,
              (t25p.quickest_pass > 0, 'min', ROUND(t25p.quickest_pass)::int, NULL::text, ARRAY[]::text[], ARRAY[]::text[], ''::text)::types.q_get_leaderboard_bundle_v4_metric)::types.q_get_leaderboard_bundle_v4_metrics
            )::types.q_get_leaderboard_bundle_v4_row
            ORDER BY t25p.highest_score DESC
        ),
        '{}'::types.q_get_leaderboard_bundle_v4_row[]
    ) as data,
    (SELECT COALESCE(
        ARRAY_AGG(
            (sd.simulation_id, sd.name, sd.description, sd.time_limit, sd.department_ids)::types.q_get_leaderboard_bundle_v4_simulation
            ORDER BY sd.name
        ),
        '{}'::types.q_get_leaderboard_bundle_v4_simulation[]
    ) FROM simulation_data sd) as simulations,
    (SELECT COALESCE(
        ARRAY_AGG(
            (scd.scenario_id, scd.name, scd.description)::types.q_get_leaderboard_bundle_v4_scenario
            ORDER BY scd.name
        ),
        '{}'::types.q_get_leaderboard_bundle_v4_scenario[]
    ) FROM scenario_data scd) as scenarios,
    (SELECT primary_color FROM settings_colors LIMIT 1)::text as primary_color,
    (SELECT accent FROM settings_colors LIMIT 1)::text as accent_color
FROM top_25_percent t25p
CROSS JOIN user_profile up
CROSS JOIN settings_colors sc
GROUP BY up.actor_name, sc.primary_color, sc.accent
$$;