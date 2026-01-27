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
WITH RECURSIVE
-- Unified attempts (general + practice)
all_attempts AS (
    SELECT id, created_at, updated_at, infinite_mode, archived, generated, mcp, active
    FROM view_simulation_attempts_entry
),
-- Unified chats (general + practice)
all_chats AS (
    SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active
    FROM view_simulation_chats_entry
),
-- Unified attempt→simulation connections
all_attempt_simulations AS (
    SELECT attempt_id, simulations_id FROM simulation_attempts_simulations_connection
),
-- Unified chat→scenario connections
all_chat_scenarios AS (
    SELECT chat_id, scenarios_id FROM simulation_chats_scenarios_connection
),
attempt_base AS (
    SELECT
        sa.id as attempt_id,
        ssj.simulation_id,
        sa.infinite_mode
    FROM all_attempts sa
    JOIN all_attempt_simulations aas ON aas.attempt_id = sa.id
    JOIN simulation_simulations_junction ssj ON ssj.simulations_id = aas.simulations_id
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
        ssj.scenario_id as child_scenario_id,
        sc.completed
    FROM all_chats sc
    JOIN all_chat_scenarios acs ON acs.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = acs.scenarios_id
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
             FROM scenario_tree_junction st 
             WHERE st.child_id = sa.ancestor_id 
               AND st.parent_id != st.child_id 
             LIMIT 1),
            sa.ancestor_id
        ) as ancestor_id,
        sa.depth + 1 as depth
    FROM scenario_ancestors sa
    WHERE sa.depth < 100
      AND EXISTS (
          SELECT 1 FROM scenario_tree_junction st 
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
-- Get scenarios that already have view_chats_entry (even without view_grades_entry) to avoid duplicates
existing_parent_scenario_ids AS (
    SELECT DISTINCT ctp.parent_scenario_id
    FROM child_to_parent_mapping ctp
    JOIN simulation_scenarios_list ssl ON ssl.scenario_id = ctp.parent_scenario_id
),
-- Get parent scenarios that have graded chats (reuse logic from get_scenarios_with_grades.sql)
scenarios_with_grades AS (
    SELECT DISTINCT ss.scenario_id as parent_scenario_id
    FROM simulation_scenarios_junction ss
    CROSS JOIN attempt_base ab
    JOIN all_chats sc ON sc.attempt_id = ab.attempt_id
    JOIN all_chat_scenarios acs2 ON acs2.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj2 ON ssj2.scenarios_id = acs2.scenarios_id
    JOIN view_grades_entry scg ON scg.chat_id = sc.id
    LEFT JOIN root_scenarios rs ON rs.child_scenario_id = ssj2.scenario_id
    WHERE ss.simulation_id = ab.simulation_id
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id
        WHERE ssf.simulation_id = ss.simulation_id
          AND sfr.scenario_id = ss.scenario_id
          AND f.name = 'scenario_active'
          AND ssf.value = true)
      AND (
        COALESCE(rs.root_scenario_id, ssj2.scenario_id) = ss.scenario_id
        OR ssj2.scenario_id = ss.scenario_id
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
