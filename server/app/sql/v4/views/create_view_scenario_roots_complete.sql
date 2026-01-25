-- View: view_scenario_roots
-- Layer 2 Domain Aggregate View: Recursive CTE to find root scenario for any scenario.
-- Maps every scenario.id to its root_id using scenario_tree_junction.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_scenario_roots AS
WITH RECURSIVE roots AS (
    -- Base: scenarios that have a self-edge (are their own parent = root)
    SELECT s.id, s.id AS root_id
    FROM scenario_artifact s
    JOIN scenario_tree_junction st ON st.child_id = s.id AND st.parent_id = s.id
    WHERE st.active = true

    UNION ALL

    -- Recursive: traverse up the tree to find the root
    SELECT s.id, r.root_id
    FROM scenario_artifact s
    JOIN scenario_tree_junction st ON st.child_id = s.id AND st.parent_id != s.id
    JOIN roots r ON r.id = st.parent_id
    WHERE st.active = true
)
SELECT DISTINCT ON (id)
    id AS scenario_id,
    root_id AS root_scenario_id
FROM roots;
