-- Create denormalized personas_resource from resolved resource IDs
-- Parameters: name_id, description_id, color_id, icon_id, instructions_id,
--             department_ids, example_ids, parameter_field_ids
-- Returns: personas_resource_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_personas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_personas_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_personas_v4(
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    color_id uuid DEFAULT NULL,
    icon_id uuid DEFAULT NULL,
    instructions_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    example_ids uuid[] DEFAULT ARRAY[]::uuid[],
    parameter_field_ids uuid[] DEFAULT ARRAY[]::uuid[],
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    personas_resource_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_resource_id uuid;
BEGIN
    INSERT INTO personas_resource (
        name,
        description,
        icon,
        color,
        department_ids,
        instructions,
        examples,
        parameter_field_ids,
        mcp,
        generated
    )
    SELECT
        n.name,
        d.description,
        ic.value,
        c.hex_code,
        api_create_personas_v4.department_ids,
        ins.template,
        COALESCE(
            (SELECT ARRAY_AGG(e.example ORDER BY idx.ord)
             FROM UNNEST(api_create_personas_v4.example_ids) WITH ORDINALITY AS idx(id, ord)
             JOIN examples_resource e ON e.id = idx.id),
            ARRAY[]::text[]
        ),
        api_create_personas_v4.parameter_field_ids,
        api_create_personas_v4.mcp,
        api_create_personas_v4.mcp
    FROM (SELECT 1) AS dummy
    LEFT JOIN names_resource n ON n.id = api_create_personas_v4.name_id
    LEFT JOIN descriptions_resource d ON d.id = api_create_personas_v4.description_id
    LEFT JOIN icons_resource ic ON ic.id = api_create_personas_v4.icon_id
    LEFT JOIN colors_resource c ON c.id = api_create_personas_v4.color_id
    LEFT JOIN instructions_resource ins ON ins.id = api_create_personas_v4.instructions_id
    RETURNING id INTO v_resource_id;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
