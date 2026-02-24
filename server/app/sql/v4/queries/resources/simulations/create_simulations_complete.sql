-- Create denormalized simulations_resource from resolved resource IDs
-- Parameters: name_id, description_id, department_ids, scenario_ids
-- Returns: simulations_resource_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_simulations_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_simulations_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_simulations_v4(
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    simulations_resource_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_resource_id uuid;
BEGIN
    INSERT INTO simulations_resource (
        name,
        description,
        department_ids,
        scenario_ids,
        mcp,
        generated
    )
    SELECT
        n.name,
        d.description,
        api_create_simulations_v4.department_ids,
        api_create_simulations_v4.scenario_ids,
        api_create_simulations_v4.mcp,
        api_create_simulations_v4.mcp
    FROM (SELECT 1) AS dummy
    LEFT JOIN names_resource n ON n.id = api_create_simulations_v4.name_id
    LEFT JOIN descriptions_resource d ON d.id = api_create_simulations_v4.description_id
    RETURNING id INTO v_resource_id;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
