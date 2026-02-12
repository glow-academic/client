-- Create/update arg_positions resource

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_arg_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_arg_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_arg_positions_v4(
    args_id uuid,
    value integer,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_resource_id uuid;
BEGIN
    -- Validate args_id exists
    IF NOT EXISTS (SELECT 1 FROM args_resource WHERE id = api_create_arg_positions_v4.args_id) THEN
        RAISE EXCEPTION 'Arg % does not exist', api_create_arg_positions_v4.args_id;
    END IF;

    -- Check if arg_position already exists for this args_id
    SELECT ap.id
    INTO v_resource_id
    FROM arg_positions_resource ap
    WHERE ap.args_id = api_create_arg_positions_v4.args_id
      AND ap.active = true
    LIMIT 1;

    IF v_resource_id IS NULL THEN
        -- Create new arg_positions resource
        INSERT INTO arg_positions_resource (id, args_id, value, active, generated, mcp, created_at)
        VALUES (uuidv7(), api_create_arg_positions_v4.args_id, api_create_arg_positions_v4.value, true, true, mcp, NOW())
        RETURNING arg_positions_resource.id INTO v_resource_id;
    ELSE
        -- Update existing arg_positions resource
        UPDATE arg_positions_resource
        SET value = api_create_arg_positions_v4.value,
            active = true,
            generated = true,
            mcp = api_create_arg_positions_v4.mcp
        WHERE arg_positions_resource.id = v_resource_id;
    END IF;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
