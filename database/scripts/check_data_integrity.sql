-- Optimized Data Integrity Check Script
-- This script verifies data integrity after migration 118
-- Run with: psql -h localhost -U myuser -d mydb -f database/scripts/check_data_integrity.sql

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_group_runs_group_id_idx ON group_runs(group_id, idx);
CREATE INDEX IF NOT EXISTS idx_message_runs_run_id_role ON message_runs(run_id) INCLUDE (message_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role) WHERE role IN ('system', 'developer');

-- Summary Report
\echo '=== DATA INTEGRITY REPORT ==='
\echo ''

-- 1. Overall Statistics
\echo '1. Overall Statistics:'
SELECT 
    COUNT(*) as total_groups,
    COUNT(DISTINCT gr.run_id) as total_runs,
    COUNT(DISTINCT CASE WHEN gr.idx = 0 THEN gr.run_id END) as first_runs,
    ROUND(AVG(run_count)::numeric, 2) as avg_runs_per_group,
    MAX(run_count) as max_runs_per_group
FROM groups g
CROSS JOIN LATERAL (
    SELECT COUNT(*) as run_count
    FROM group_runs gr2
    WHERE gr2.group_id = g.id
) gr_stats
LEFT JOIN group_runs gr ON gr.group_id = g.id;

\echo ''

-- 2. message_tree Link Integrity
\echo '2. message_tree Link Integrity:'
SELECT 
    'System → Developer' as link_type,
    COUNT(*) as total_links,
    COUNT(DISTINCT parent_id) as unique_parents,
    COUNT(DISTINCT child_id) as unique_children,
    CASE WHEN COUNT(*) = COUNT(DISTINCT (parent_id, child_id)) THEN '✅ No duplicates' ELSE '❌ Has duplicates' END as status
FROM message_tree mt
JOIN messages m1 ON m1.id = mt.parent_id
JOIN messages m2 ON m2.id = mt.child_id
WHERE mt.active = true 
AND m1.role = 'system' 
AND m2.role = 'developer'

UNION ALL

SELECT 
    'Developer → Developer' as link_type,
    COUNT(*) as total_links,
    COUNT(DISTINCT parent_id) as unique_parents,
    COUNT(DISTINCT child_id) as unique_children,
    CASE WHEN COUNT(*) = COUNT(DISTINCT (parent_id, child_id)) THEN '✅ No duplicates' ELSE '❌ Has duplicates' END as status
FROM message_tree mt
JOIN messages m1 ON m1.id = mt.parent_id
JOIN messages m2 ON m2.id = mt.child_id
WHERE mt.active = true 
AND m1.role = 'developer' 
AND m2.role = 'developer';

\echo ''

-- 3. System/Developer Message Placement (Optimized)
\echo '3. System/Developer Message Placement:'
WITH group_message_stats AS (
    SELECT 
        g.id as group_id,
        gr.idx as run_idx,
        m.role,
        COUNT(DISTINCT m.id) as message_count
    FROM groups g
    JOIN group_runs gr ON gr.group_id = g.id
    LEFT JOIN message_runs mr ON mr.run_id = gr.run_id
    LEFT JOIN messages m ON m.id = mr.message_id AND m.role IN ('system', 'developer')
    GROUP BY g.id, gr.idx, m.role
),
group_summary AS (
    SELECT 
        group_id,
        SUM(CASE WHEN run_idx > 0 AND role IN ('system', 'developer') THEN message_count ELSE 0 END) as system_dev_in_non_first,
        SUM(CASE WHEN run_idx = 0 AND role = 'system' THEN message_count ELSE 0 END) as system_in_first,
        SUM(CASE WHEN run_idx = 0 AND role = 'developer' THEN message_count ELSE 0 END) as dev_in_first
    FROM group_message_stats
    GROUP BY group_id
)
SELECT 
    COUNT(*) as total_groups,
    COUNT(CASE WHEN system_dev_in_non_first > 0 THEN 1 END) as groups_with_system_dev_in_non_first_runs,
    COUNT(CASE WHEN system_in_first > 1 THEN 1 END) as groups_with_multiple_system_msgs,
    COUNT(CASE WHEN dev_in_first > 2 THEN 1 END) as groups_with_too_many_dev_msgs
FROM group_summary;

\echo ''

-- 4. Problematic Messages (if any)
\echo '4. Problematic Messages (top 5):'
SELECT 
    m.id as message_id,
    m.role,
    LEFT(mc.content, 60) as content_preview,
    COUNT(DISTINCT gr.group_id) as affected_groups,
    COUNT(DISTINCT gr.run_id) as affected_runs,
    array_agg(DISTINCT gr.idx ORDER BY gr.idx) FILTER (WHERE gr.idx > 0) as problematic_run_indices
FROM messages m
JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
JOIN message_runs mr ON mr.message_id = m.id
JOIN group_runs gr ON gr.run_id = mr.run_id
WHERE gr.idx > 0 
AND m.role IN ('system', 'developer')
GROUP BY m.id, m.role, mc.content
ORDER BY affected_runs DESC
LIMIT 5;

\echo ''
\echo '=== END OF REPORT ==='
\echo ''
\echo 'Note: Groups with system/dev in non-first runs indicate pre-existing data issues'
\echo '      (likely from migration 117). These should be fixed separately.'

