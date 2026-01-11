-- Get persona resource IDs by group_id - no-op function for validation and mapping
-- Takes resource_id and resource_type from event, validates, and maps to correct field
-- Uses safe drop/recreate pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_persona_resource_ids_by_group_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_resource_ids_by_group_id_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_persona_resource_ids_by_group_id_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create function (no-op - validation and mapping only)
CREATE OR REPLACE FUNCTION api_get_persona_resource_ids_by_group_id_v4(
    profile_id uuid,
    group_id uuid,
    resource_id uuid,
    resource_type text,
    artifact_type text
)
RETURNS TABLE (
    name_id uuid,
    description_id uuid,
    color_id uuid,
    icon_id uuid,
    instructions_id uuid,
    active_flag_id uuid,
    field_ids uuid[],
    department_ids uuid[],
    example_ids uuid[]
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    valid_persona_resource_types text[] := ARRAY['names', 'descriptions', 'colors', 'icons', 'instructions', 'flags', 'examples', 'fields', 'departments'];
BEGIN
    -- Validate artifact_type (all validation in SQL)
    IF artifact_type != 'persona' THEN
        RAISE EXCEPTION 'Invalid artifact_type: expected "persona", got "%"', artifact_type;
    END IF;
    
    -- Validate resource_type
    IF resource_type != ALL(valid_persona_resource_types) THEN
        RAISE EXCEPTION 'Invalid resource_type: "%" is not a valid persona resource type', resource_type;
    END IF;
    
    -- Map resource_id to appropriate field based on resource_type (no database queries)
    RETURN QUERY
    SELECT
        CASE WHEN resource_type = 'names' THEN resource_id ELSE NULL::uuid END as name_id,
        CASE WHEN resource_type = 'descriptions' THEN resource_id ELSE NULL::uuid END as description_id,
        CASE WHEN resource_type = 'colors' THEN resource_id ELSE NULL::uuid END as color_id,
        CASE WHEN resource_type = 'icons' THEN resource_id ELSE NULL::uuid END as icon_id,
        CASE WHEN resource_type = 'instructions' THEN resource_id ELSE NULL::uuid END as instructions_id,
        CASE WHEN resource_type = 'flags' THEN resource_id ELSE NULL::uuid END as active_flag_id,
        CASE WHEN resource_type = 'fields' THEN ARRAY[resource_id] ELSE ARRAY[]::uuid[] END as field_ids,
        CASE WHEN resource_type = 'departments' THEN ARRAY[resource_id] ELSE ARRAY[]::uuid[] END as department_ids,
        CASE WHEN resource_type = 'examples' THEN ARRAY[resource_id] ELSE ARRAY[]::uuid[] END as example_ids;
END;
$$;
