-- Get agent resource IDs by group_id - no-op function for validation and mapping
-- Takes resources_id and resource_type from event, validates, and maps to correct field
-- Uses safe drop/recreate pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_agent_resource_ids_by_group_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_resource_ids_by_group_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_agent_resource_ids_by_group_id_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create function (no-op - validation and mapping only)
CREATE OR REPLACE FUNCTION api_get_agent_resource_ids_by_group_id_v4(
    profile_id uuid,
    group_id uuid,
    resources_id uuid,
    resource_type text,
    artifact_type text
)
RETURNS TABLE (
    names_id uuid,
    descriptions_id uuid,
    model_id uuid,
    prompt_id uuid,
    instructions_id uuid,
    active_flag_id uuid,
    department_ids uuid[]
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    valid_agent_resource_types text[] := ARRAY['names', 'descriptions', 'models', 'prompts', 'instructions', 'flags', 'departments'];
BEGIN
    -- Validate artifact_type (all validation in SQL)
    IF artifact_type != 'agent' THEN
        RAISE EXCEPTION 'Invalid artifact_type: expected "agent", got "%"', artifact_type;
    END IF;
    
    -- Validate resource_type
    IF resource_type != ALL(valid_agent_resource_types) THEN
        RAISE EXCEPTION 'Invalid resource_type: "%" is not a valid agent resource type', resource_type;
    END IF;
    
    -- Map resources_id to appropriate field based on resource_type (no database queries)
    RETURN QUERY
    SELECT
        CASE WHEN resource_type = 'names' THEN resources_id ELSE NULL::uuid END as names_id,
        CASE WHEN resource_type = 'descriptions' THEN resources_id ELSE NULL::uuid END as descriptions_id,
        CASE WHEN resource_type = 'models' THEN resources_id ELSE NULL::uuid END as model_id,
        CASE WHEN resource_type = 'prompts' THEN resources_id ELSE NULL::uuid END as prompt_id,
        CASE WHEN resource_type = 'instructions' THEN resources_id ELSE NULL::uuid END as instructions_id,
        CASE WHEN resource_type = 'flags' THEN resources_id ELSE NULL::uuid END as active_flag_id,
        CASE WHEN resource_type = 'departments' THEN ARRAY[resources_id] ELSE ARRAY[]::uuid[] END as department_ids;
END;
$$;
