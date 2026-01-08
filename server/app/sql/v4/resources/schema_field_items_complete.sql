-- Create schema_field_items resource
-- Always INSERT operation (preserves all information)
-- Parameters: schema_field_id uuid, item_schema_id uuid
-- Returns: schema_field_item_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_schema_field_items_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_schema_field_items_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_schema_field_items_v4(
    schema_field_id uuid, item_schema_id uuid
)
RETURNS TABLE (
    schema_field_item_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_schema_field_item_id uuid;
BEGIN
    -- INSERT into schema_field_items table (always insert, never update)
    INSERT INTO schema_field_items(schema_field_id, item_schema_id, active)
    VALUES (schema_field_id, item_schema_id, true)
    RETURNING id INTO v_schema_field_item_id;

    RETURN QUERY SELECT v_schema_field_item_id;
END;
$$;