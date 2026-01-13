-- Bulk archive or unarchive simulation attempts
-- Supports two modes:
-- 1. attempt_ids mode: Archive specific attempts by their IDs (when attempt_ids is provided)
-- 2. filter mode: Archive all attempts matching filters (when attempt_ids is empty)
-- Converted to function
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
        WHERE proname = 'api_bulk_archive_attempts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_bulk_archive_attempts_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_bulk_archive_attempts_v4(
    archived boolean,
    profile_id uuid,
    -- attempt_ids mode parameters
    attempt_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- filter mode parameters (accept text, cast to timestamptz internally)
    start_date text DEFAULT NULL,
    end_date text DEFAULT NULL,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    roles profile_role[] DEFAULT ARRAY[]::profile_role[],
    simulation_filters text[] DEFAULT ARRAY[]::text[],
    search text DEFAULT NULL,
    profile_ids_filter uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_ids uuid[] DEFAULT ARRAY[]::uuid[],
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    infinite_mode boolean DEFAULT NULL
)
RETURNS TABLE (
    updated_count bigint,
    actor_name text,
    profile_ids_to_invalidate text[]
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_updated_count bigint;
    v_actor_name text;
    v_profile_ids text[];
    v_use_attempt_ids_mode boolean;
BEGIN
    -- Get actor name
    SELECT first_name || ' ' || last_name INTO v_actor_name
    FROM profile
    WHERE id = profile_id;

    -- Determine mode: use attempt_ids if provided and non-empty
    v_use_attempt_ids_mode := cardinality(attempt_ids) > 0;

    IF v_use_attempt_ids_mode THEN
        -- attempt_ids mode: Archive specific attempts
        WITH update_attempts AS (
            UPDATE simulation_attempts
            SET archived = api_bulk_archive_attempts_v4.archived
            WHERE id = ANY(attempt_ids)
              AND archived != api_bulk_archive_attempts_v4.archived
            RETURNING id
        )
        SELECT COUNT(*)::bigint INTO v_updated_count
        FROM update_attempts;

        -- Get profile IDs to invalidate from attempt_ids
        SELECT COALESCE(
            ARRAY_AGG(DISTINCT ap.profile_id::text) FILTER (WHERE ap.profile_id IS NOT NULL),
            ARRAY[]::text[]
        ) INTO v_profile_ids
        FROM attempt_profiles ap
        WHERE ap.attempt_id = ANY(attempt_ids)
          AND ap.active = true;
    ELSE
        -- filter mode: Use the existing filter-based logic from bulk_archive_attempts_by_filters.sql
        -- This is a complex query, so we'll execute it as a subquery
        WITH 
        roles_param AS (
            SELECT roles AS roles_array
        ),
        history_viewer_role AS (
            SELECT 
                CASE 
                    WHEN profile_id::text IS NULL OR profile_id::text = '' THEN
                        CASE 
                            WHEN 'superadmin'::profile_role = ANY(roles) THEN 'superadmin'::text
                            WHEN 'admin'::profile_role = ANY(roles) THEN 'admin'::text
                            WHEN 'instructional'::profile_role = ANY(roles) THEN 'instructional'::text
                            WHEN 'member'::profile_role = ANY(roles) THEN 'member'::text
                            ELSE 'guest'::text
                        END
                    ELSE COALESCE((SELECT role::text FROM profile WHERE id = profile_id), 'guest'::text)
                END::profile_role as role
        ),
        expanded_history_cohort_ids AS (
            SELECT DISTINCT cohort_id
            FROM (
                SELECT unnest(cohort_ids) as cohort_id
                WHERE cardinality(cohort_ids) > 0
                UNION
                SELECT cp.cohort_id
                FROM cohort_profiles cp
                WHERE cp.profile_id = profile_id AND (profile_id::text IS NOT NULL AND profile_id::text != '')
            ) combined
        ),
        history_attempts AS (
            SELECT DISTINCT
                sa.id AS attempt_id,
                sa.simulation_id,
                sa.created_at AS attempt_date,
                sa.archived AS is_archived,
                sa.infinite_mode,
                ap.profile_id,
                (SELECT n.name FROM simulation_names simn JOIN names n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1) AS simulation_name,
                sim.practice_simulation,
                COALESCE(sdd.department_ids, NULL) as department_ids
            FROM simulation_attempts sa
            JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
            JOIN simulation sim ON sim.id = sa.simulation_id
            JOIN profile p_attempt ON p_attempt.id = ap.profile_id
            CROSS JOIN history_viewer_role hvr
            LEFT JOIN (
                SELECT 
                    sd.simulation_id,
                    ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
                FROM simulation_departments sd
                WHERE sd.active = true
                GROUP BY sd.simulation_id
            ) sdd ON sdd.simulation_id = sim.id
            WHERE (start_date IS NULL OR start_date = '' OR sa.created_at >= (NULLIF(start_date, '')::timestamptz))
              AND (end_date IS NULL OR end_date = '' OR sa.created_at <= (NULLIF(end_date, '')::timestamptz))
              AND (
                (cardinality(simulation_filters) = 0) AND sim.practice_simulation = FALSE
                OR
                (cardinality(simulation_filters) > 0 AND (
                  ('general' = ANY(simulation_filters) AND sim.practice_simulation = FALSE) OR
                  ('practice' = ANY(simulation_filters) AND sim.practice_simulation = TRUE) OR
                  ('archived' = ANY(simulation_filters) AND sa.archived = TRUE)
                ))
              )
              AND (
                cardinality(simulation_filters) = 0 OR 'archived' = ANY(simulation_filters) OR sa.archived = FALSE
              )
              AND ((profile_id::text IS NULL OR profile_id::text = '') OR ap.profile_id = profile_id)
              AND (cardinality(department_ids) = 0 OR sdd.department_ids IS NULL OR sdd.department_ids && department_ids::text[])
              AND (
                hvr.role = 'superadmin'::profile_role OR
                (hvr.role = 'admin'::profile_role AND p_attempt.role IN ('admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role)) OR
                (hvr.role = 'instructional'::profile_role AND p_attempt.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role)) OR
                (hvr.role = 'member'::profile_role AND p_attempt.role IN ('member'::profile_role, 'guest'::profile_role)) OR
                (hvr.role = 'guest'::profile_role AND p_attempt.role = 'guest'::profile_role)
              )
        ),
        history_attempt_cohorts AS (
            SELECT
                ha.attempt_id,
                COALESCE(ARRAY_AGG(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::uuid[]) AS cohort_ids
            FROM history_attempts ha
            LEFT JOIN cohort_profiles cp ON cp.profile_id = ha.profile_id
            LEFT JOIN cohort c ON c.id = cp.cohort_id AND c.active = TRUE
            LEFT JOIN cohort_simulations cs ON cs.cohort_id = c.id
            WHERE (
                (SELECT COUNT(*) FROM expanded_history_cohort_ids) = 0
                OR c.id IN (SELECT cohort_id FROM expanded_history_cohort_ids)
            )
            GROUP BY ha.attempt_id
        ),
        history_attempts_filtered AS (
            SELECT ha.*
            FROM history_attempts ha
            JOIN history_attempt_cohorts hac ON hac.attempt_id = ha.attempt_id
            WHERE (
                (SELECT COUNT(*) FROM expanded_history_cohort_ids) = 0
                OR cardinality(hac.cohort_ids) > 0
            )
        ),
        history_attempts_with_filters AS (
            SELECT haf.*
            FROM history_attempts_filtered haf
            WHERE 
                (cardinality(profile_ids_filter) = 0 OR haf.profile_id = ANY(profile_ids_filter))
                AND (cardinality(simulation_ids) = 0 OR haf.simulation_id = ANY(simulation_ids))
                AND (infinite_mode IS NULL OR haf.infinite_mode = infinite_mode)
        ),
        attempt_scenario_ids AS (
            SELECT DISTINCT
                ac.attempt_id,
                ARRAY_AGG(DISTINCT sc.scenario_id) FILTER (WHERE sc.scenario_id IS NOT NULL) AS scenario_ids
            FROM attempt_chats ac
            JOIN chat sc ON sc.id = ac.chat_id
            WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_with_filters)
            GROUP BY ac.attempt_id
        ),
        history_attempts_final AS (
            SELECT haf.*
            FROM history_attempts_with_filters haf
            LEFT JOIN attempt_scenario_ids asi ON asi.attempt_id = haf.attempt_id
            WHERE 
                (cardinality(scenario_ids) = 0 OR asi.scenario_ids IS NULL OR asi.scenario_ids && scenario_ids)
        ),
        history_personas AS (
            SELECT
                ac.attempt_id,
                array_agg(DISTINCT sp.persona_id) FILTER (WHERE sp.persona_id IS NOT NULL) AS persona_ids
            FROM attempt_chats ac
            JOIN chat sc ON sc.id = ac.chat_id
            JOIN scenarios scn ON scn.id = sc.scenario_id
            LEFT JOIN scenario_personas sp ON sp.scenario_id = scn.id AND sp.active = TRUE
            WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
            GROUP BY ac.attempt_id
        ),
        final_filtered_attempts AS (
            SELECT haf.attempt_id
            FROM history_attempts_final haf
            LEFT JOIN profile p ON p.id = haf.profile_id
            LEFT JOIN history_personas hp ON hp.attempt_id = haf.attempt_id
            WHERE 
                (search IS NULL OR search = '' OR
                 LOWER(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '')) LIKE '%' || LOWER(search) || '%' OR
                 LOWER(haf.simulation_name) LIKE '%' || LOWER(search) || '%' OR
                 EXISTS (
                     SELECT 1
                     FROM unnest(hp.persona_ids) AS pid
                     JOIN personas per ON per.id = pid
                     WHERE LOWER(per.name) LIKE '%' || LOWER(search) || '%'
                 ))
        ),
        filter_update AS (
            UPDATE simulation_attempts
            SET archived = api_bulk_archive_attempts_v4.archived
            WHERE id IN (SELECT attempt_id FROM final_filtered_attempts)
              AND archived != api_bulk_archive_attempts_v4.archived
            RETURNING id
        )
        SELECT COUNT(*)::bigint INTO v_updated_count
        FROM filter_update;

        -- Get profile IDs to invalidate (use current user's profile ID)
        IF profile_id IS NOT NULL THEN
            v_profile_ids := ARRAY[profile_id::text];
        ELSE
            v_profile_ids := ARRAY[]::text[];
        END IF;
    END IF;

    -- Return results
    RETURN QUERY SELECT v_updated_count, v_actor_name, COALESCE(v_profile_ids, ARRAY[]::text[]);
END;
$$;