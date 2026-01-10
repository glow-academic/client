-- Get previous chat info (scenario_id and whether it has a grade)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_previous_chat_info_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_previous_chat_info_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_previous_chat_info_v4(
    chat_id uuid
)
RETURNS TABLE (
    scenario_id uuid,
    has_grade boolean
)
LANGUAGE sql
STABLE
AS $$
SELECT sc.scenario_id, c_prev.id IS NOT NULL as has_grade
FROM chat sc
LEFT JOIN grade scg ON EXISTS (
    SELECT 1 FROM run r_check
    JOIN group_runs gr_check ON gr_check.run_id = r_check.id
    JOIN groups g_check ON g_check.id = gr_check.group_id
    JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
    JOIN chat c_check ON c_check.id = cg_check.chat_id
    WHERE r_check.id = scg.run_id AND c_check.id = sc.id
)
LEFT JOIN run r_prev ON r_prev.id = scg.run_id
LEFT JOIN group_runs gr_prev ON gr_prev.run_id = r_prev.id
LEFT JOIN groups g_prev ON g_prev.id = gr_prev.group_id
LEFT JOIN chat_groups cg_prev ON cg_prev.group_id = g_prev.id
LEFT JOIN chat c_prev ON c_prev.id = cg_prev.chat_id AND c_prev.id = sc.id
WHERE sc.id = chat_id AND sc.completed = true
$$;