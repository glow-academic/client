-- Check if attempt has next incomplete scenario that could come next
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_check_next_incomplete_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_next_incomplete_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_check_next_incomplete_scenario_v4(
    attempt_id uuid
)
RETURNS TABLE (
    has_next_scenario boolean,
    next_scenario_id uuid,
    next_scenario_position integer
)
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE attempt_base AS (
    SELECT 
        sa.id as attempt_id,
        sa.simulation_id,
        sa.infinite_mode
    FROM attempts_entry sa
    WHERE sa.id = attempt_id
),
simulation_scenarios_list AS (
    SELECT 
        ss.scenario_id,
        (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) as position
    FROM simulation_scenarios_junction ss
    CROSS JOIN attempt_base ab
    WHERE ss.simulation_id = ab.simulation_id
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id 
        WHERE ssf.simulation_id = ss.simulation_id 
          AND sfr.scenario_id = ss.scenario_id 
          AND f.name = 'scenario_active' 
          AND ssf.value = true)
    ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
),
existing_chats AS (
    SELECT
        sc.id as chat_id,
        sc.scenario_id as child_scenario_id,
        sc.completed
    FROM chats_entry sc
    CROSS JOIN attempt_base ab
    WHERE sc.attempt_id = ab.attempt_id
),
-- Recursively map child scenario IDs to root parent IDs  
scenario_ancestors AS (
    SELECT DISTINCT
        ec.child_scenario_id,
        ec.child_scenario_id as ancestor_id,
        0 as depth
    FROM existing_chats ec
    
    UNION ALL
    
    SELECT 
        sa.child_scenario_id,
        COALESCE(
            (SELECT st.parent_id 
             FROM scenario_tree_entry st 
             WHERE st.child_id = sa.ancestor_id 
               AND st.parent_id != st.child_id 
             LIMIT 1),
            sa.ancestor_id
        ) as ancestor_id,
        sa.depth + 1 as depth
    FROM scenario_ancestors sa
    WHERE sa.depth < 100
      AND EXISTS (
          SELECT 1 FROM scenario_tree_entry st 
          WHERE st.child_id = sa.ancestor_id 
            AND st.parent_id != st.child_id
      )
),
root_scenarios AS (
    SELECT DISTINCT
        child_scenario_id,
        ancestor_id as root_scenario_id
    FROM scenario_ancestors
    WHERE depth = (
        SELECT MAX(depth) 
        FROM scenario_ancestors sa2 
        WHERE sa2.child_scenario_id = scenario_ancestors.child_scenario_id
    )
),
-- Map child scenario IDs to root parent IDs for comparison
child_to_parent_mapping AS (
    SELECT DISTINCT
        ec.child_scenario_id,
        COALESCE(rs.root_scenario_id, ec.child_scenario_id) as parent_scenario_id
    FROM existing_chats ec
    LEFT JOIN root_scenarios rs ON rs.child_scenario_id = ec.child_scenario_id
),
-- Get scenarios that already have chats_entry (even without grades_entry) to avoid duplicates
existing_parent_scenario_ids AS (
    SELECT DISTINCT ctp.parent_scenario_id
    FROM child_to_parent_mapping ctp
    JOIN simulation_scenarios_list ssl ON ssl.scenario_id = ctp.parent_scenario_id
),
-- Get parent scenarios that have graded chats_entry (reuse logic from get_scenarios_with_grades.sql)
scenarios_with_grades AS (
    SELECT DISTINCT ss.scenario_id as parent_scenario_id
    FROM simulation_scenarios_junction ss
    CROSS JOIN attempt_base ab
    JOIN chats_entry sc ON sc.attempt_id = ab.attempt_id
    JOIN grades_entry scg ON EXISTS (
        SELECT 1 FROM runs_entry r_check
        JOIN groups_entry g_check ON g_check.id = r_check.group_id
        JOIN chats_entry c_check ON c_check.group_id = g_check.id AND c_check.id = sc.id
        WHERE r_check.id = scg.run_id
    )
    JOIN runs_entry r ON r.id = scg.run_id
    JOIN groups_entry g ON g.id = r.group_id
    JOIN chats_entry c ON c.group_id = g.id AND c.id = sc.id
    LEFT JOIN root_scenarios rs ON rs.child_scenario_id = sc.scenario_id
    WHERE ss.simulation_id = ab.simulation_id
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id 
        WHERE ssf.simulation_id = ss.simulation_id 
          AND sfr.scenario_id = ss.scenario_id 
          AND f.name = 'scenario_active' 
          AND ssf.value = true)
      AND (
        COALESCE(rs.root_scenario_id, sc.scenario_id) = ss.scenario_id
        OR sc.scenario_id = ss.scenario_id
      )
),
-- Find next scenario that doesn't have a graded chat and doesn't already have a chat
next_scenario_candidate AS (
    SELECT 
        ssl.scenario_id,
        ssl.position
    FROM simulation_scenarios_list ssl
    CROSS JOIN attempt_base ab
    WHERE ssl.scenario_id NOT IN (
        SELECT parent_scenario_id FROM scenarios_with_grades
    )
    AND ssl.scenario_id NOT IN (
        SELECT parent_scenario_id FROM existing_parent_scenario_ids
    )
    ORDER BY ssl.position
    LIMIT 1
),
-- For infinite mode, always find next scenario (cycle through)
infinite_mode_next AS (
    SELECT 
        ssl.scenario_id,
        ssl.position
    FROM simulation_scenarios_list ssl
    CROSS JOIN attempt_base ab
    WHERE ab.infinite_mode = true
    AND EXISTS (SELECT 1 FROM simulation_scenarios_list)
    ORDER BY ssl.position
    LIMIT 1
)
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM next_scenario_candidate) THEN true
        WHEN EXISTS (SELECT 1 FROM infinite_mode_next) THEN true
        ELSE false
    END as has_next_scenario,
    COALESCE(
        (SELECT scenario_id FROM next_scenario_candidate),
        (SELECT scenario_id FROM infinite_mode_next)
    ) as next_scenario_id,
    COALESCE(
        (SELECT position FROM next_scenario_candidate),
        (SELECT position FROM infinite_mode_next)
    ) as next_scenario_position
$$;