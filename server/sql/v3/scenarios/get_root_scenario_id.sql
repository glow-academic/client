-- Recursively find the root scenario ID for a given scenario ID
-- Root scenario is the topmost ancestor (scenario with no parent or parent = self)
-- Parameters: $1=scenario_id (uuid)
-- Returns: root_scenario_id (uuid)
WITH RECURSIVE scenario_ancestors AS (
    -- Base case: start with the given scenario
    SELECT 
        $1::uuid as scenario_id,
        COALESCE(
            (SELECT parent_id 
             FROM scenario_tree 
             WHERE child_id = $1::uuid AND parent_id != child_id 
             LIMIT 1),
            $1::uuid
        ) as ancestor_id,
        0 as depth
    UNION ALL
    -- Recursive case: traverse up the tree
    SELECT 
        sa.scenario_id,
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
)
SELECT ancestor_id as root_scenario_id
FROM scenario_ancestors
WHERE depth = (SELECT MAX(depth) FROM scenario_ancestors)
LIMIT 1;

