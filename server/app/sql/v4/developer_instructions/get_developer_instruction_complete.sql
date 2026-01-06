-- Get developer instruction template and schema for a given type and agent role
-- Joins developer_instructions → developer_instruction_schemas → schemas
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_developer_instruction_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_developer_instruction_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_developer_instruction_v4(
    instruction_type developer_instruction_type,
    agent_role_val text  -- Changed from agent_role enum to text
)
RETURNS TABLE (
    developer_instruction_id uuid,
    type developer_instruction_type,
    template text,
    active boolean,
    schema_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT
    di.id as developer_instruction_id,
    di.type,
    di.template,
    di.active,
    dis.schema_id
FROM developer_instructions di
JOIN agent_developer_instructions adi ON adi.developer_instruction_id = di.id
JOIN agents a ON a.id = adi.agent_id
JOIN artifact_agents aa ON aa.agent_id = a.id AND aa.artifact_instance_id IS NULL AND aa.role = agent_role_val
LEFT JOIN developer_instruction_schemas dis ON dis.developer_instruction_id = di.id
WHERE di.type = instruction_type
  AND di.active = true
LIMIT 1
$$;

