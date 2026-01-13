-- Get parent scenarios from simulation_scenarios that have at least one graded chat in this attempt
-- Converted to PostgreSQL function
-- A scenario is considered "done" if it has a chat (linked via attempt_chats) with a grade
-- Uses simulation_scenarios as source of truth - checks if each parent scenario has a graded chat
-- Recursively maps child scenarios to root scenarios via scenario_tree
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_scenarios_with_grades_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenarios_with_grades_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_scenarios_with_grades_v4(
    attempt_id uuid
)
RETURNS TABLE (
    parent_scenario_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE scenario_ancestors AS (
    -- Base case: start with each chat's scenario
    SELECT DISTINCT
        sc.scenario_id as child_scenario_id,
        sc.scenario_id as ancestor_id,
        0 as depth
    FROM attempt_chats ac
    JOIN chat_artifact sc ON sc.id = ac.chat_id
    JOIN grade_artifact scg ON EXISTS (
        SELECT 1 FROM run_artifact r_check
        JOIN group_runs gr_check ON gr_check.run_id = r_check.id
        JOIN groups g_check ON g_check.id = gr_check.group_id
        JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
        JOIN chat_artifact c_check ON c_check.id = cg_check.chat_id
        WHERE r_check.id = scg.run_id AND c_check.id = sc.id
    )
    JOIN run_artifact r_scen1 ON r_scen1.id = scg.run_id
    JOIN group_runs gr_scen1 ON gr_scen1.run_id = r_scen1.id
    JOIN groups g_scen1 ON g_scen1.id = gr_scen1.group_id
    JOIN chat_groups cg_scen1 ON cg_scen1.group_id = g_scen1.id
    JOIN chat_artifact c_scen1 ON c_scen1.id = cg_scen1.chat_id AND c_scen1.id = sc.id
    WHERE ac.attempt_id = attempt_id
    
    UNION ALL
    
    -- Recursive case: traverse up the tree
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
    WHERE sa.depth < 100  -- Safety limit
      AND EXISTS (
          SELECT 1 FROM scenario_tree st 
          WHERE st.child_id = sa.ancestor_id 
            AND st.parent_id != st.child_id
      )
),
root_scenarios AS (
    -- Find the root scenario for each child (topmost ancestor)
    SELECT DISTINCT
        child_scenario_id,
        ancestor_id as root_scenario_id
    FROM scenario_ancestors
    WHERE depth = (
        SELECT MAX(depth) 
        FROM scenario_ancestors sa2 
        WHERE sa2.child_scenario_id = scenario_ancestors.child_scenario_id
    )
)
SELECT DISTINCT ss.scenario_id as parent_scenario_id
FROM simulation_scenarios ss
JOIN simulation_attempts sa ON sa.simulation_id = ss.simulation_id
JOIN attempt_chats ac ON ac.attempt_id = sa.id
JOIN chat_artifact sc ON sc.id = ac.chat_id
JOIN grade_artifact scg ON EXISTS (
    SELECT 1 FROM run_artifact r_check
    JOIN group_runs gr_check ON gr_check.run_id = r_check.id
    JOIN groups g_check ON g_check.id = gr_check.group_id
    JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
    JOIN chat_artifact c_check ON c_check.id = cg_check.chat_id AND c_check.id = sc.id
    WHERE r_check.id = scg.run_id
)
JOIN run_artifact r_scen2 ON r_scen2.id = scg.run_id
JOIN group_runs gr_scen2 ON gr_scen2.run_id = r_scen2.id
JOIN groups g_scen2 ON g_scen2.id = gr_scen2.group_id
JOIN chat_groups cg_scen2 ON cg_scen2.group_id = g_scen2.id
JOIN chat_artifact c_scen2 ON c_scen2.id = cg_scen2.chat_id AND c_scen2.id = sc.id
LEFT JOIN root_scenarios rs ON rs.child_scenario_id = sc.scenario_id
WHERE sa.id = attempt_id
  AND (
    -- Case 1: Root scenario matches the parent scenario from simulation_scenarios
    COALESCE(rs.root_scenario_id, sc.scenario_id) = ss.scenario_id
    -- Case 2: Child scenario IS the parent scenario (no child variant)
    OR sc.scenario_id = ss.scenario_id
  )
$$;