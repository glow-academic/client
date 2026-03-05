-- Create denormalized cohorts_resource from resolved resource IDs
-- Parameters: names_id, descriptions_id, department_ids, simulation_ids, profile_ids, profile_persona_ids
-- Returns: cohorts_resource_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_cohorts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_cohorts_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_cohorts_v4(
    names_id uuid DEFAULT NULL,
    descriptions_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_ids uuid[] DEFAULT ARRAY[]::uuid[],
    profile_ids uuid[] DEFAULT ARRAY[]::uuid[],
    profile_persona_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_position_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_availability_ids uuid[] DEFAULT ARRAY[]::uuid[],
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    cohorts_resource_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_resource_id uuid;
BEGIN
    INSERT INTO cohorts_resource (
        name,
        description,
        department_ids,
        simulation_ids,
        profile_ids,
        profile_persona_ids,
        simulation_position_ids,
        simulation_availability_ids,
        mcp,
        generated
    )
    SELECT
        n.name,
        d.description,
        api_create_cohorts_v4.department_ids,
        api_create_cohorts_v4.simulation_ids,
        api_create_cohorts_v4.profile_ids,
        api_create_cohorts_v4.profile_persona_ids,
        api_create_cohorts_v4.simulation_position_ids,
        api_create_cohorts_v4.simulation_availability_ids,
        api_create_cohorts_v4.mcp,
        api_create_cohorts_v4.mcp
    FROM (SELECT 1) AS dummy
    LEFT JOIN names_resource n ON n.id = api_create_cohorts_v4.names_id
    LEFT JOIN descriptions_resource d ON d.id = api_create_cohorts_v4.descriptions_id
    RETURNING id INTO v_resource_id;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
