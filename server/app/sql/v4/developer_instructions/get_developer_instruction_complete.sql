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
-- Note: developer_instructions.type column was removed - developer instructions are now linked via agent_developer_instructions only
CREATE OR REPLACE FUNCTION api_get_developer_instruction_v4(
    instruction_type text,  -- Changed from developer_instruction_type enum to text (no longer used, kept for compatibility)
    agent_role_val text
)
RETURNS TABLE (
    developer_instruction_id uuid,
    type text,  -- Changed from developer_instruction_type enum to text
    template text,
    active boolean,
    schema_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT
    i.id as developer_instruction_id,
    instruction_type as type,  -- Return the passed parameter since i.type no longer exists
    i.template,
    i.active,
    ins.schema_id
FROM instructions_resource i
JOIN agent_instructions ai ON ai.instruction_id = i.id
JOIN agents_resource a ON a.id = ai.agent_id


LEFT JOIN instruction_schemas ins ON ins.instruction_id = i.id
WHERE i.active = true
LIMIT 1
$$;

