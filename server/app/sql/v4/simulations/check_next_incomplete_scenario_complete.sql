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
    FROM simulation_attempts sa
    WHERE sa.id = attempt_id
),
simulation_scenarios_list AS (
    SELECT 
        ss.scenario_id,
        (SELECT sp.value FROM scenario_positions sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1) as position
    FROM simulation_scenarios ss
    CROSS JOIN attempt_base ab
    WHERE ss.simulation_id = ab.simulation_id
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf 
        WHERE ssf.simulation_id = ss.simulation_id 
          AND ssf.scenario_id = ss.scenario_id 
          AND ssf.type = 'active'::type_simulation_scenario_flags 
          AND ssf.value = true)
    ORDER BY (SELECT sp.value FROM scenario_positions sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1)
),
existing_chats AS (
    SELECT 
        sc.id as chat_id,
        sc.scenario_id as child_scenario_id,
        sc.completed
    FROM attempt_chats ac
    JOIN chat sc ON sc.id = ac.chat_id
    CROSS JOIN attempt_base ab
    WHERE ac.attempt_id = ab.attempt_id
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
             FROM scenario_tree st 
             WHERE st.child_id = sa.ancestor_id 
               AND st.parent_id != st.child_id 
             LIMIT 1),
            sa.ancestor_id
        ) as ancestor_id,
        sa.depth + 1 as depth
    FROM scenario_ancestors sa
    WHERE sa.depth < 100
      AND EXISTS (
          SELECT 1 FROM scenario_tree st 
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
-- Get scenarios that already have chats (even without grades) to avoid duplicates
existing_parent_scenario_ids AS (
    SELECT DISTINCT ctp.parent_scenario_id
    FROM child_to_parent_mapping ctp
    JOIN simulation_scenarios_list ssl ON ssl.scenario_id = ctp.parent_scenario_id
),
-- Get parent scenarios that have graded chats (reuse logic from get_scenarios_with_grades.sql)
scenarios_with_grades AS (
    SELECT DISTINCT ss.scenario_id as parent_scenario_id
    FROM simulation_scenarios ss
    CROSS JOIN attempt_base ab
    JOIN attempt_chats ac ON ac.attempt_id = ab.attempt_id
    JOIN chat sc ON sc.id = ac.chat_id
    JOIN grade scg ON EXISTS (
        SELECT 1 FROM run r_check
        JOIN group_runs gr_check ON gr_check.run_id = r_check.id
        JOIN groups g_check ON g_check.id = gr_check.group_id
        JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
        JOIN chat c_check ON c_check.id = cg_check.chat_id AND c_check.id = sc.id
        WHERE r_check.id = scg.run_id
    )
    JOIN run r ON r.id = scg.run_id
    JOIN group_runs gr ON gr.run_id = r.id
    JOIN groups g ON g.id = gr.group_id
    JOIN chat_groups cg ON cg.group_id = g.id
    JOIN chat c ON c.id = cg.chat_id AND c.id = sc.id
    LEFT JOIN root_scenarios rs ON rs.child_scenario_id = sc.scenario_id
    WHERE ss.simulation_id = ab.simulation_id
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf 
        WHERE ssf.simulation_id = ss.simulation_id 
          AND ssf.scenario_id = ss.scenario_id 
          AND ssf.type = 'active'::type_simulation_scenario_flags 
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