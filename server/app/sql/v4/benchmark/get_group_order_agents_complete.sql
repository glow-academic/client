-- Get agents in group_order for a group (ordered by position_idx)
-- Converted to PostgreSQL function

BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_group_order_agents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_group_order_agents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_group_order_agents_v4(
    group_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    position_idx integer
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    go.agent_id::uuid,
    go.position_idx
FROM group_order go
WHERE go.group_id = api_get_group_order_agents_v4.group_id
ORDER BY go.position_idx ASC
$$;

COMMIT;

