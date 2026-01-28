-- Search simulations with suggest_source pattern
-- Returns simulation details with search and filtering

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_simulations_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_simulations_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_search_simulations_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    group_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_simulations_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        search AS search_term,
        COALESCE(limit_count, 20) AS limit_val,
        COALESCE(offset_count, 0) AS offset_val,
        group_id AS group_id,
        COALESCE(suggest_source, 'all') AS suggest_source,
        COALESCE(exclude_ids, ARRAY[]::uuid[]) AS exclude_ids
),
-- All active simulations with search filtering
all_simulations AS (
    SELECT
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name,
        COALESCE(
            (SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1),
            ''
        ) as description,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id
               AND sstl.active = true
               AND stlr.active = true
               AND EXISTS (
                   SELECT 1 FROM simulation_scenario_flags_junction ssf
                   JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id
                   JOIN flags_resource f ON sfr.flag_id = f.id
                   WHERE ssf.simulation_id = ss.simulation_id
                     AND sfr.scenario_id = ss.scenario_id
                     AND f.name = 'scenario_active'
                     AND ssf.value = true
               )
            ),
            0
        ) as time_limit,
        COALESCE(s.generated, false) as generated,
        s.updated_at
    FROM simulation_artifact s
    CROSS JOIN params p
    WHERE EXISTS (
        SELECT 1 FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND f.name = 'simulation_active'
          AND sf.value = true
    )
    -- Apply search filter if provided
    AND (
        p.search_term IS NULL
        OR p.search_term = ''
        OR LOWER((SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)) LIKE '%' || LOWER(p.search_term) || '%'
        OR LOWER(COALESCE((SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1), '')) LIKE '%' || LOWER(p.search_term) || '%'
    )
    -- Exclude specified IDs
    AND NOT s.id = ANY(p.exclude_ids)
),
-- Simulations linked to cohorts (for 'linked' suggest_source)
linked_simulations AS (
    SELECT DISTINCT
        a.simulation_id,
        a.name,
        a.description,
        a.time_limit,
        a.generated,
        a.updated_at
    FROM all_simulations a
    WHERE EXISTS (
        SELECT 1 FROM cohort_simulations_junction cs
        WHERE cs.simulation_id = a.simulation_id
          AND cs.active = true
    )
),
-- Recently used simulations in the group (for 'recent' suggest_source)
recent_simulations AS (
    SELECT DISTINCT
        a.simulation_id,
        a.name,
        a.description,
        a.time_limit,
        a.generated,
        a.updated_at
    FROM all_simulations a
    CROSS JOIN params p
    WHERE p.group_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM simulations_resource sr
        JOIN calls_entry c ON c.id = sr.call_id
        JOIN messages_entry m ON m.id = c.message_id
        JOIN runs_entry r ON r.id = m.run_id
        WHERE sr.simulation_id = a.simulation_id
          AND r.group_id = p.group_id
    )
),
-- Select based on suggest_source
filtered_simulations AS (
    SELECT
        simulation_id,
        name,
        description,
        time_limit,
        generated,
        updated_at
    FROM (
        SELECT * FROM all_simulations a
        CROSS JOIN params p
        WHERE p.suggest_source = 'all'
        UNION ALL
        SELECT * FROM linked_simulations l
        CROSS JOIN params p
        WHERE p.suggest_source = 'linked'
        UNION ALL
        SELECT * FROM recent_simulations r
        CROSS JOIN params p
        WHERE p.suggest_source = 'recent'
    ) sub
),
-- Apply pagination
paginated_simulations AS (
    SELECT
        fs.simulation_id,
        fs.name,
        fs.description,
        fs.time_limit,
        fs.generated
    FROM filtered_simulations fs
    CROSS JOIN params p
    ORDER BY fs.name ASC
    LIMIT p.limit_val
    OFFSET p.offset_val
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (ps.simulation_id, ps.name, ps.description, ps.time_limit, ps.generated)::types.q_get_simulations_v4_item
            ORDER BY ps.name
        ) FROM paginated_simulations ps),
        '{}'::types.q_get_simulations_v4_item[]
    ) as items;
$$;
